import type { FeatureCollection, Feature, Polygon } from 'geojson';
import type { AirspaceFeature, AirspaceType, AltitudeBound } from '@squawk/types';
import { pointInPolygon } from './point-in-polygon.js';
import { altitudeMatches } from './vertical-filter.js';

/**
 * A query describing a geographic position and altitude to resolve
 * against loaded airspace data.
 */
export interface AirspaceQuery {
  /** Latitude in decimal degrees (WGS84). */
  lat: number;
  /** Longitude in decimal degrees (WGS84). */
  lon: number;
  /** Altitude in feet MSL to compare against airspace vertical bounds. */
  altitudeFt: number;
  /**
   * Optional set of airspace types to include in the results. When provided,
   * only features whose type is in this set are considered. Features of other
   * types are skipped before any geometry or altitude checks, improving query
   * performance when only specific airspace classes are needed.
   *
   * When omitted, all airspace types are included.
   */
  types?: ReadonlySet<AirspaceType>;
}

/**
 * Options for creating an airspace resolver.
 */
export interface AirspaceResolverOptions {
  /** GeoJSON FeatureCollection containing airspace features. */
  data: FeatureCollection;
}

/**
 * A function that accepts a position and altitude and returns all
 * airspace features that contain that point laterally and vertically.
 */
export type AirspaceResolver = (query: AirspaceQuery) => AirspaceFeature[];

/**
 * Axis-aligned bounding box for fast rejection before point-in-polygon.
 */
interface BoundingBox {
  /** Minimum longitude. */
  minLon: number;
  /** Maximum longitude. */
  maxLon: number;
  /** Minimum latitude. */
  minLat: number;
  /** Maximum latitude. */
  maxLat: number;
}

/**
 * An airspace feature with its pre-parsed polygon coordinates and bounding
 * box stored alongside the original AirspaceFeature properties for query use.
 */
interface IndexedFeature {
  /** The parsed AirspaceFeature properties. */
  feature: AirspaceFeature;
  /** The polygon exterior ring coordinates as [lon, lat] pairs. */
  ring: number[][];
  /** Axis-aligned bounding box computed from the ring. */
  boundingBox: BoundingBox;
}

/**
 * Computes an axis-aligned bounding box from a polygon exterior ring.
 */
function computeBoundingBox(ring: number[][]): BoundingBox {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const coord of ring) {
    const lon = coord[0]!;
    const lat = coord[1]!;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Parses a GeoJSON Feature into an IndexedFeature, extracting the
 * AirspaceFeature properties and polygon ring. Returns null if the
 * feature cannot be parsed (missing geometry, invalid type, etc.).
 */
function parseFeature(geoFeature: Feature): IndexedFeature | null {
  const geom = geoFeature.geometry;
  if (!geom || geom.type !== 'Polygon') return null;

  const polygon = geom as Polygon;
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) return null;

  const props = geoFeature.properties;
  if (!props) return null;

  const feature: AirspaceFeature = {
    type: props.type as AirspaceType,
    name: (props.name as string) ?? '',
    identifier: (props.identifier as string) ?? '',
    floor: props.floor as AltitudeBound,
    ceiling: props.ceiling as AltitudeBound,
    boundary: polygon,
    state: (props.state as string) ?? null,
    controllingFacility: (props.controllingFacility as string) ?? null,
    scheduleDescription: (props.scheduleDescription as string) ?? null,
  };

  return { feature, ring, boundingBox: computeBoundingBox(ring) };
}

/**
 * Creates a stateless airspace resolver function. The resolver accepts a
 * GeoJSON FeatureCollection at initialization (typically from
 * `@squawk/airspace-data`) and returns a function that, given a position
 * and altitude, returns all matching airspace features.
 *
 * The resolver performs two checks for each feature:
 * 1. **Lateral** - point-in-polygon test against the feature boundary
 * 2. **Vertical** - altitude comparison against floor/ceiling bounds
 *
 * AGL-referenced altitude bounds are handled conservatively: when the
 * resolver cannot determine the MSL equivalent (because it has no terrain
 * data), it includes the feature rather than silently excluding it. This
 * means the resolver may return features whose AGL bounds do not actually
 * contain the queried altitude. Consumers can inspect the returned
 * AltitudeBound references and apply their own terrain lookup if needed.
 *
 * ```typescript
 * import { usBundledAirspace } from '@squawk/airspace-data';
 * import { createAirspaceResolver } from '@squawk/airspace';
 *
 * const resolve = createAirspaceResolver({ data: usBundledAirspace });
 * const features = resolve({ lat: 33.9425, lon: -118.4081, altitudeFt: 3000 });
 * ```
 */
export function createAirspaceResolver(options: AirspaceResolverOptions): AirspaceResolver {
  const indexed: IndexedFeature[] = [];

  for (const geoFeature of options.data.features) {
    const parsed = parseFeature(geoFeature);
    if (parsed) indexed.push(parsed);
  }

  return (query: AirspaceQuery): AirspaceFeature[] => {
    const results: AirspaceFeature[] = [];
    const { lon, lat, altitudeFt, types } = query;

    for (const { feature, ring, boundingBox } of indexed) {
      if (types && !types.has(feature.type)) continue;
      if (
        lon < boundingBox.minLon ||
        lon > boundingBox.maxLon ||
        lat < boundingBox.minLat ||
        lat > boundingBox.maxLat
      )
        continue;
      if (!pointInPolygon(lon, lat, ring)) continue;
      if (!altitudeMatches(altitudeFt, feature.floor, feature.ceiling)) continue;
      results.push(feature);
    }

    return results;
  };
}
