/**
 * @packageDocumentation
 * @squawk/geo - Geospatial utilities for aviation applications.
 *
 * Exports are grouped by domain namespace to keep call sites self-documenting:
 *
 * @example
 * ```ts
 * import { greatCircle, polygon } from '@squawk/geo';
 *
 * // Great-circle calculations
 * const d = greatCircle.distanceNm(40.6413, -73.7781, 33.9425, -118.4081);
 * const b = greatCircle.bearing(40.6413, -73.7781, 33.9425, -118.4081);
 * const mid = greatCircle.midpoint(40.6413, -73.7781, 33.9425, -118.4081);
 * const dest = greatCircle.destination(40.6413, -73.7781, 270, 100);
 *
 * // Polygon containment (raw `number[][]` ring API)
 * const box = polygon.boundingBox(ring);
 * if (polygon.pointInBoundingBox(lon, lat, box)) {
 *   if (polygon.pointInPolygon(lon, lat, ring)) {
 *     // ...
 *   }
 * }
 *
 * // Polygon containment (GeoJSON `Polygon` API, multi-ring aware)
 * const bbox = polygonGeoJson.polygonBoundingBox(geojsonPolygon);
 * if (polygonGeoJson.pointInBoundingBox([lon, lat], bbox)) {
 *   if (polygonGeoJson.pointInPolygon([lon, lat], geojsonPolygon)) {
 *     // ...
 *   }
 * }
 * ```
 */

export * as greatCircle from './great-circle.js';
export * as polygon from './polygon.js';
export * as polygonGeoJson from './geojson.js';
export type { BearingAndDistance } from './great-circle.js';
export type { BoundingBox } from './polygon.js';
