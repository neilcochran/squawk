import type { Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson';

import type { AirspaceFeature, AltitudeBound } from '@squawk/types';

/**
 * Synthetic per-feature property added at airspace source-projection
 * time so the highlight filter can match against the same encoding the
 * chip / URL path uses. Format mirrors `selectedFromFeature` in
 * `click-to-select.ts`: `{TYPE}/{IDENTIFIER}` for named features,
 * `{TYPE}/c:{LON},{LAT}` (5dp centroid) for empty-id features. Without
 * this, the highlight filter for a centroid-encoded selection would
 * never match because the real `identifier` field is empty.
 *
 * Lives in this shared module so the click-time encoder
 * (`click-to-select.ts`), the projection writer
 * (`airspace-source-projection.ts`), and the layer reader
 * (`airspace-layer.tsx`) all reference the same constant.
 */
export const AIRSPACE_MATCH_KEY_PROPERTY = '__atlasMatchKey';

/**
 * Synthetic per-feature properties carrying the floor / ceiling values
 * as primitives (number + string), copied at source-projection time
 * from the `floor` / `ceiling` `AltitudeBound` objects on the original
 * dataset feature. Primitive copies are necessary because MapLibre's
 * GeoJSON worker pipeline does not reliably round-trip nested object
 * properties through `queryRenderedFeatures` - downstream consumers
 * (e.g. the disambiguation popover) only see strings, numbers, and
 * booleans. The primitive split (Ft + Ref) preserves enough fidelity
 * to format an "11k-18k" or "700ft AGL" subtitle without re-fetching
 * the source dataset.
 */
export const AIRSPACE_FLOOR_FT_PROPERTY = '__atlasFloorFt';
/** Reference datum for the floor altitude. One of `'MSL'`, `'AGL'`, `'SFC'`. */
export const AIRSPACE_FLOOR_REF_PROPERTY = '__atlasFloorRef';
/** Ceiling altitude in feet. See {@link AIRSPACE_FLOOR_FT_PROPERTY}. */
export const AIRSPACE_CEILING_FT_PROPERTY = '__atlasCeilingFt';
/** Reference datum for the ceiling altitude. */
export const AIRSPACE_CEILING_REF_PROPERTY = '__atlasCeilingRef';

/**
 * Minimal shape consumed by {@link compareAirspaceByAltitudeDesc}. Two
 * primitive fields are enough to drive the sort, so call sites that
 * only have the synthetic GeoJSON properties (e.g. the disambiguation
 * popover, where the altitude originates from `__atlasCeilingFt` /
 * `__atlasFloorFt`) can participate without first re-hydrating the
 * full {@link AirspaceFeature} record.
 */
export interface AirspaceAltitudeKey {
  /** Ceiling altitude in feet. SFC reads as 0. */
  readonly ceilingFt: number;
  /** Floor altitude in feet. SFC reads as 0. */
  readonly floorFt: number;
}

/**
 * Comparator that orders airspace listings highest "vertical layer"
 * first. Primary key is `ceilingFt` descending - the stratum that tops
 * out higher comes first. Tie-break by `floorFt` descending so a
 * Class B's outer ring (high floor, same ceiling as inner rings) sits
 * above its inner rings, matching the "top-down altitude stack"
 * mental model pilots use when reading a chart.
 *
 * MSL and AGL values are compared by their numeric `valueFt` directly.
 * The approximation conflates the two when they happen to share a
 * value, but no realistic airspace stack mixes MSL and AGL at the
 * same altitude band, so the sort lands the right way in practice.
 *
 * Used by the inspector's airspace panel (multi-feature sub-sections),
 * the disambiguation popover (stacked-airspace rows), and the
 * inspector's "Also here" chip strip (airspace chips).
 */
export function compareAirspaceByAltitudeDesc(
  a: AirspaceAltitudeKey,
  b: AirspaceAltitudeKey,
): number {
  return b.ceilingFt - a.ceilingFt || b.floorFt - a.floorFt;
}

/**
 * GeoJSON feature carrying the airspace property bag the
 * `@squawk/airspace-data` bundle ships. The geometry is always a
 * `Polygon`; the properties are the full {@link AirspaceFeature} record
 * (type, identifier, floor, ceiling, etc.).
 */
export type AirspacePolygonFeature = Feature<Polygon, AirspaceFeature>;

/**
 * Type-narrows a generic GeoJSON feature to {@link AirspacePolygonFeature}.
 * Checks the geometry kind and the presence of the discriminating property
 * fields, so subsequent reads of `feature.properties.type` /
 * `feature.properties.identifier` are typed directly without `as`
 * assertions.
 *
 * @param feature - Candidate GeoJSON feature pulled from the airspace dataset.
 * @returns `true` when `feature` is an airspace polygon; the type predicate
 *          narrows the input in callers' control flow.
 */
export function isAirspacePolygonFeature(
  feature: Feature<Geometry, GeoJsonProperties>,
): feature is AirspacePolygonFeature {
  if (feature.geometry.type !== 'Polygon') {
    return false;
  }
  const props = feature.properties;
  if (props === null) {
    return false;
  }
  return 'type' in props && 'identifier' in props && 'floor' in props && 'ceiling' in props;
}

/**
 * Validates a `(valueFt, reference)` primitive pair into an
 * {@link AltitudeBound} shape. Used by the airspace source projection
 * (to flatten the source dataset's nested `floor` / `ceiling` objects
 * into MapLibre-roundtrip-safe primitives) and by the disambiguation
 * popover (to read those primitives back out of `queryRenderedFeatures`
 * results).
 *
 * Returns `undefined` for any malformed input - non-numeric value, an
 * unknown reference datum, or missing primitives. Callers swallow that
 * by hiding the corresponding row.
 */
export function readAltitudeBoundPrimitives(
  valueFt: unknown,
  reference: unknown,
): AltitudeBound | undefined {
  if (typeof valueFt !== 'number' || typeof reference !== 'string') {
    return undefined;
  }
  if (reference !== 'MSL' && reference !== 'AGL' && reference !== 'SFC') {
    return undefined;
  }
  return { valueFt, reference };
}

/**
 * Reads the floor / ceiling altitude primitives off a GeoJSON property
 * bag (synthetic ones added by `projectAirspaceSource`). Returns
 * `undefined` if either primitive is missing or malformed.
 *
 * Used by the inspector's "Also here" chip strip and the disambiguation
 * popover to drive altitude-descending sorts of stacked airspaces.
 */
export function readAirspaceAltitudeKey(
  properties: GeoJsonProperties,
): AirspaceAltitudeKey | undefined {
  if (properties === null) {
    return undefined;
  }
  const ceilingFt = properties[AIRSPACE_CEILING_FT_PROPERTY];
  const floorFt = properties[AIRSPACE_FLOOR_FT_PROPERTY];
  if (typeof ceilingFt !== 'number' || typeof floorFt !== 'number') {
    return undefined;
  }
  return { ceilingFt, floorFt };
}

/**
 * Reads the full floor / ceiling {@link AltitudeBound} pair off a
 * GeoJSON property bag. Returns `undefined` if either bound is missing
 * or malformed.
 *
 * Used by the disambiguation popover's compact altitude subtitle - the
 * subtitle disambiguates two airspace rows that share an identical
 * lateral polygon (e.g. an MOA's HIGH and LOW components) by showing
 * each row's altitude band.
 */
export function readAirspaceAltitudeBounds(
  properties: GeoJsonProperties,
): { floor: AltitudeBound; ceiling: AltitudeBound } | undefined {
  if (properties === null) {
    return undefined;
  }
  const floor = readAltitudeBoundPrimitives(
    properties[AIRSPACE_FLOOR_FT_PROPERTY],
    properties[AIRSPACE_FLOOR_REF_PROPERTY],
  );
  const ceiling = readAltitudeBoundPrimitives(
    properties[AIRSPACE_CEILING_FT_PROPERTY],
    properties[AIRSPACE_CEILING_REF_PROPERTY],
  );
  if (floor === undefined || ceiling === undefined) {
    return undefined;
  }
  return { floor, ceiling };
}

/**
 * Verbose altitude-bound formatter for the inspector's airspace panel.
 * Renders SFC floors as the literal `"SFC"`; everything else renders
 * as `"{N} ft {ref}"` (e.g. `"3000 ft MSL"`, `"700 ft AGL"`). Pilots
 * read the panel for full detail, so the verbose form is the right
 * default here.
 */
export function formatAltitudeBoundVerbose(bound: AltitudeBound): string {
  if (bound.reference === 'SFC') {
    return 'SFC';
  }
  return `${bound.valueFt} ft ${bound.reference}`;
}

/**
 * Compact altitude-bound formatter for the disambiguation popover's
 * altitude subtitle. SFC reference renders as the literal `"SFC"`;
 * MSL / AGL values that land on a clean thousand render as `"{N}k"`
 * (e.g. `"11k"`); other values render as `"{N}ft"` so an oddball
 * `"200 AGL"` floor is not silently rounded. AGL values append the
 * suffix; MSL is the implied default and stays bare to keep popover
 * rows narrow.
 */
export function formatAltitudeBoundCompact(bound: AltitudeBound): string {
  if (bound.reference === 'SFC') {
    return 'SFC';
  }
  const formatted = bound.valueFt % 1000 === 0 ? `${bound.valueFt / 1000}k` : `${bound.valueFt}ft`;
  return bound.reference === 'AGL' ? `${formatted} AGL` : formatted;
}

/**
 * Reads the floor / ceiling altitude primitives off a GeoJSON property
 * bag and renders them as a compact range like `"11k-18k"` or
 * `"SFC-10k"`. Returns `undefined` if either bound is missing or
 * malformed - the consumer (the disambiguation popover) hides the
 * subtitle in that case.
 */
export function formatAirspaceAltitudeRange(properties: GeoJsonProperties): string | undefined {
  const bounds = readAirspaceAltitudeBounds(properties);
  if (bounds === undefined) {
    return undefined;
  }
  return `${formatAltitudeBoundCompact(bounds.floor)}-${formatAltitudeBoundCompact(bounds.ceiling)}`;
}
