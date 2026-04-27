import type { Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson';
import type { AirspaceFeature } from '@squawk/types';

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
