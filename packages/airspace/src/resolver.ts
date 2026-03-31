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
 * An airspace feature with its pre-parsed polygon coordinates stored
 * alongside the original AirspaceFeature properties for query use.
 */
interface IndexedFeature {
  /** The parsed AirspaceFeature properties. */
  feature: AirspaceFeature;
  /** The polygon exterior ring coordinates as [lon, lat] pairs. */
  ring: number[][];
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

  return { feature, ring };
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

    for (const { feature, ring } of indexed) {
      if (!pointInPolygon(query.lon, query.lat, ring)) continue;
      if (!altitudeMatches(query.altitudeFt, feature.floor, feature.ceiling)) continue;
      results.push(feature);
    }

    return results;
  };
}
