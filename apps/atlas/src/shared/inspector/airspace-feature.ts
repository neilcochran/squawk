import type { GeoJsonProperties } from 'geojson';

import type { AirspaceFeature, AirspaceVolume, AltitudeBound } from '@squawk/types';

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
 * booleans. The primitive split (Ft + Ref, plus Inclusive on an
 * exclusive bound) preserves enough fidelity to format an "11k-<18k" or
 * "700ft AGL" subtitle without re-fetching the source dataset.
 */
export const AIRSPACE_FLOOR_FT_PROPERTY = '__atlasFloorFt';
/** Reference datum for the floor altitude. One of `'MSL'`, `'AGL'`, `'SFC'`. */
export const AIRSPACE_FLOOR_REF_PROPERTY = '__atlasFloorRef';
/**
 * `false` when the floor excludes its own altitude (an area "above 5,000
 * ft MSL"). Written only for an exclusive bound, so an absent property
 * reads as inclusive, matching the dataset's own `inclusive` field.
 */
export const AIRSPACE_FLOOR_INCLUSIVE_PROPERTY = '__atlasFloorInclusive';
/** Ceiling altitude in feet. See {@link AIRSPACE_FLOOR_FT_PROPERTY}. */
export const AIRSPACE_CEILING_FT_PROPERTY = '__atlasCeilingFt';
/** Reference datum for the ceiling altitude. */
export const AIRSPACE_CEILING_REF_PROPERTY = '__atlasCeilingRef';
/**
 * `false` when the ceiling excludes its own altitude (a MOA "to but not
 * including FL 180", or a Class E area ending where Class A begins). See
 * {@link AIRSPACE_FLOOR_INCLUSIVE_PROPERTY}.
 */
export const AIRSPACE_CEILING_INCLUSIVE_PROPERTY = '__atlasCeilingInclusive';

/**
 * The dataset's sentinel for an upper limit the FAA leaves undefined or
 * unlimited, always carried as an MSL ceiling. The one published ceiling
 * above it (R-2535B's 100,000 ft MSL) is a real value, not the sentinel,
 * so only an exact match reads as unlimited.
 */
export const UNLIMITED_CEILING_FT = 99999;

/** Which end of an airspace volume a bound is, which decides how an exclusive bound reads. */
export type AltitudeBoundRole = 'floor' | 'ceiling';

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
 * Orders the features of one multi-feature airspace grouping into the
 * sequence both the inspector panel and the map badges present: highest
 * vertical layer first per {@link compareAirspaceByAltitudeDesc}, with
 * ties kept in input order. The panel's "Feature N" section titles and
 * the numbered badges on the map both take their N from a position in
 * this sequence, so every consumer must build it through this function
 * from the same dataset-ordered input; a second sort elsewhere is how
 * the two drift apart.
 *
 * @param features - The grouping's features in dataset order.
 * @param altitudeKey - Reads the floor / ceiling pair off one feature.
 * @returns A new array in presentation order.
 */
export function orderAirspaceFeatures<T>(
  features: readonly T[],
  altitudeKey: (feature: T) => AirspaceAltitudeKey,
): T[] {
  return [...features].sort((a, b) =>
    compareAirspaceByAltitudeDesc(altitudeKey(a), altitudeKey(b)),
  );
}

/**
 * {@link AirspaceAltitudeKey} of a full dataset record, for use with
 * {@link orderAirspaceFeatures} and {@link compareAirspaceByAltitudeDesc}.
 */
export function altitudeKeyOfAirspaceFeature(feature: AirspaceFeature): AirspaceAltitudeKey {
  return { ceilingFt: feature.ceiling.valueFt, floorFt: feature.floor.valueFt };
}

/**
 * Validates a `(valueFt, reference, inclusive)` primitive triple into an
 * {@link AltitudeBound} shape. Used by the airspace source projection
 * (to flatten the source dataset's nested `floor` / `ceiling` objects
 * into MapLibre-roundtrip-safe primitives) and by the disambiguation
 * popover (to read those primitives back out of `queryRenderedFeatures`
 * results).
 *
 * Returns `undefined` for any malformed input - non-numeric value, an
 * unknown reference datum, or missing primitives. Callers swallow that
 * by hiding the corresponding row. Only an explicit `false` marks the
 * bound exclusive; anything else leaves `inclusive` unset, which the
 * dataset reads as inclusive.
 */
export function readAltitudeBoundPrimitives(
  valueFt: unknown,
  reference: unknown,
  inclusive?: unknown,
): AltitudeBound | undefined {
  if (typeof valueFt !== 'number' || typeof reference !== 'string') {
    return undefined;
  }
  if (reference !== 'MSL' && reference !== 'AGL' && reference !== 'SFC') {
    return undefined;
  }
  return inclusive === false ? { valueFt, reference, inclusive } : { valueFt, reference };
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
    properties[AIRSPACE_FLOOR_INCLUSIVE_PROPERTY],
  );
  const ceiling = readAltitudeBoundPrimitives(
    properties[AIRSPACE_CEILING_FT_PROPERTY],
    properties[AIRSPACE_CEILING_REF_PROPERTY],
    properties[AIRSPACE_CEILING_INCLUSIVE_PROPERTY],
  );
  if (floor === undefined || ceiling === undefined) {
    return undefined;
  }
  return { floor, ceiling };
}

/** Whether a bound is the dataset's unlimited sentinel ({@link UNLIMITED_CEILING_FT} MSL). */
function isUnlimitedAltitudeBound(bound: AltitudeBound): boolean {
  return bound.reference === 'MSL' && bound.valueFt === UNLIMITED_CEILING_FT;
}

/**
 * Verbose altitude-bound formatter for the inspector's airspace panel.
 * Renders SFC as the literal `"SFC"`, the unlimited sentinel as
 * `"Unlimited"`, and everything else as `"{N} ft {ref}"` (e.g.
 * `"3000 ft MSL"`, `"700 ft AGL"`). A bound that excludes its own value
 * reads from the inside of the volume: an exclusive ceiling as
 * `"Below 18000 ft MSL"`, an exclusive floor as `"Above 5000 ft MSL"`.
 * An exclusive SFC floor stays `"SFC"`, since the qualifier adds nothing
 * there. Pilots read the panel for full detail, so the verbose form is
 * the right default here.
 *
 * @param bound - The floor or ceiling to format.
 * @param role - Which end of the volume the bound is.
 */
export function formatAltitudeBoundVerbose(bound: AltitudeBound, role: AltitudeBoundRole): string {
  if (bound.reference === 'SFC') {
    return 'SFC';
  }
  if (isUnlimitedAltitudeBound(bound)) {
    return 'Unlimited';
  }
  const value = `${bound.valueFt} ft ${bound.reference}`;
  if (bound.inclusive === false) {
    return role === 'ceiling' ? `Below ${value}` : `Above ${value}`;
  }
  return value;
}

/**
 * Compact altitude-bound formatter for the disambiguation popover's
 * altitude subtitle. SFC reference renders as the literal `"SFC"` and
 * the unlimited sentinel as `"UNL"`, the charted abbreviation; MSL /
 * AGL values that land on a clean thousand render as `"{N}k"` (e.g.
 * `"11k"`); other values render as `"{N}ft"` so an oddball `"200 AGL"`
 * floor is not silently rounded. AGL values append the suffix; MSL is
 * the implied default and stays bare to keep popover rows narrow. An
 * exclusive bound takes a `<` (ceiling) or `>` (floor) prefix, so a MOA
 * up to but not including FL180 reads `"<18k"`.
 *
 * @param bound - The floor or ceiling to format.
 * @param role - Which end of the volume the bound is.
 */
export function formatAltitudeBoundCompact(bound: AltitudeBound, role: AltitudeBoundRole): string {
  if (bound.reference === 'SFC') {
    return 'SFC';
  }
  if (isUnlimitedAltitudeBound(bound)) {
    return 'UNL';
  }
  const formatted = bound.valueFt % 1000 === 0 ? `${bound.valueFt / 1000}k` : `${bound.valueFt}ft`;
  const value = bound.reference === 'AGL' ? `${formatted} AGL` : formatted;
  if (bound.inclusive === false) {
    return role === 'ceiling' ? `<${value}` : `>${value}`;
  }
  return value;
}

/**
 * Renders a floor / ceiling pair as one band for a row that has no room
 * for two, such as an excluded volume: `"SFC to 1500 ft AGL"`. Each end
 * reads as {@link formatAltitudeBoundVerbose} renders it, lower-cased
 * after "to" so an exclusive or unlimited ceiling stays a phrase
 * (`"SFC to below 10000 ft MSL"`, `"18000 ft MSL to unlimited"`).
 */
export function formatAltitudeBand(floor: AltitudeBound, ceiling: AltitudeBound): string {
  const ceilingText = formatAltitudeBoundVerbose(ceiling, 'ceiling');
  const ceilingPhrase =
    ceilingText === 'SFC'
      ? ceilingText
      : ceilingText.charAt(0).toLowerCase() + ceilingText.slice(1);
  return `${formatAltitudeBoundVerbose(floor, 'floor')} to ${ceilingPhrase}`;
}

/**
 * Feet above the surface-or-sea datum a bound sits at, for comparing two
 * bounds on the same reference: SFC reads as 0.
 */
function boundHeightFt(bound: AltitudeBound): number {
  return bound.reference === 'SFC' ? 0 : bound.valueFt;
}

/**
 * Whether an excluded volume spans its airspace feature's whole height,
 * so the airspace does not apply anywhere above the volume's footprint.
 * The floor is covered when the volume starts at the surface or at or
 * below the feature's floor on the same datum; the ceiling when the
 * volume reaches at or above the feature's ceiling on the same datum.
 * Bounds on different datums (MSL against AGL) cannot be compared
 * without terrain, so they read as not covered.
 */
export function exclusionSpansFullHeight(
  exclusion: Pick<AirspaceVolume, 'floor' | 'ceiling'>,
  feature: Pick<AirspaceFeature, 'floor' | 'ceiling'>,
): boolean {
  const floorCovered =
    exclusion.floor.reference === 'SFC' ||
    (exclusion.floor.reference === feature.floor.reference &&
      boundHeightFt(exclusion.floor) <= boundHeightFt(feature.floor));
  const ceilingCovered =
    exclusion.ceiling.reference === feature.ceiling.reference &&
    exclusion.ceiling.valueFt >= feature.ceiling.valueFt;
  return floorCovered && ceilingCovered;
}

/**
 * Key naming one excluded volume of the selected airspace grouping: the
 * feature's position in presentation order (the panel's "Feature N" and
 * the map badge, see {@link orderAirspaceFeatures}) and the volume's
 * position in that feature's `exclusions`. The inspector writes it on
 * row hover and the exclusion layer reads it to focus the matching
 * outline, so both build it here.
 */
export function airspaceExclusionKey(featureIndex: number, exclusionIndex: number): string {
  return `${featureIndex}:${exclusionIndex}`;
}

/**
 * Reads the floor / ceiling altitude primitives off a GeoJSON property
 * bag and renders them as a compact range like `"11k-18k"`,
 * `"SFC-<18k"` or `"SFC-UNL"`. Returns `undefined` if either bound is
 * missing or malformed - the consumer (the disambiguation popover) hides
 * the subtitle in that case.
 */
export function formatAirspaceAltitudeRange(properties: GeoJsonProperties): string | undefined {
  const bounds = readAirspaceAltitudeBounds(properties);
  if (bounds === undefined) {
    return undefined;
  }
  return `${formatAltitudeBoundCompact(bounds.floor, 'floor')}-${formatAltitudeBoundCompact(bounds.ceiling, 'ceiling')}`;
}
