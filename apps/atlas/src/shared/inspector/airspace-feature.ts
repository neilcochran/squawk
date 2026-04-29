import type { Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson';
import type { AirspaceFeature } from '@squawk/types';

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
