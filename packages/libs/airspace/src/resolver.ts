import type { FeatureCollection, Feature } from 'geojson';

import { polygon, type BoundingBox } from '@squawk/geo';
import type { AirspaceFeature, AirspaceType, AltitudeBound, ArtccStratum } from '@squawk/types';

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
 * Stateless resolver exposing airspace query methods.
 */
export interface AirspaceResolver {
  /**
   * Returns every airspace feature whose lateral polygon contains the given
   * position and whose vertical bounds contain the given altitude.
   *
   * @param query - Position, altitude, and optional type filter.
   * @returns All matching features, in no particular order.
   */
  query(query: AirspaceQuery): AirspaceFeature[];

  /**
   * Returns every airspace feature associated with the given identifier,
   * independent of position or altitude. Lookup is case-insensitive.
   *
   * For Class B/C/D/E2 airspace, the feature `identifier` is the associated
   * airport's FAA location identifier (e.g. "JFK" for the NY Class B). For
   * Special Use Airspace, it is the NASR designator (e.g. "R-2508"). Pass
   * only the bare identifier - ICAO-prefixed codes like "KJFK" will not
   * match; resolve to an FAA ID first via `@squawk/airports` if needed.
   *
   * Note: ARTCC features share the identifier-keyed index but are typically
   * looked up via {@link byArtcc} for clearer ergonomics. ARTCC features are
   * excluded from `byAirport` results since their identifier is a center code
   * (e.g. "ZNY"), not an airport identifier.
   *
   * @param identifier - FAA identifier or NASR designator.
   * @param types - Optional type filter. Only features whose type is in this
   *                set are returned. When omitted, all non-ARTCC types are
   *                returned.
   * @returns All features whose identifier matches, or an empty array.
   */
  byAirport(identifier: string, types?: ReadonlySet<AirspaceType>): AirspaceFeature[];

  /**
   * Returns every ARTCC feature associated with the given center identifier,
   * independent of position or altitude. Lookup is case-insensitive.
   *
   * Each US ARTCC is published as multiple features - one per stratum (LOW,
   * HIGH, UTA, CTA, FIR, CTA/FIR) - because the lateral extent can vary
   * between strata. Pass an optional stratum filter to narrow results to a
   * single stratum.
   *
   * @param identifier - Three-letter ARTCC code (e.g. "ZNY", "ZBW").
   * @param stratum - Optional stratum filter. When provided, only features
   *                  whose `artccStratum` matches are returned.
   * @returns All matching ARTCC features, or an empty array.
   */
  byArtcc(identifier: string, stratum?: ArtccStratum): AirspaceFeature[];
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
 * Parses a GeoJSON Feature into an IndexedFeature, extracting the
 * AirspaceFeature properties and polygon ring. Returns null if the
 * feature cannot be parsed (missing geometry, invalid type, etc.).
 */
function parseFeature(geoFeature: Feature): IndexedFeature | null {
  const geom = geoFeature.geometry;
  if (!geom || geom.type !== 'Polygon') {
    return null;
  }

  const ring = geom.coordinates[0];
  if (!ring || ring.length < 4) {
    return null;
  }

  const props = geoFeature.properties;
  if (!props) {
    return null;
  }

  const feature: AirspaceFeature = {
    type: props.type as AirspaceType,
    name: (props.name as string) ?? '',
    identifier: (props.identifier as string) ?? '',
    floor: props.floor as AltitudeBound,
    ceiling: props.ceiling as AltitudeBound,
    boundary: geom,
    state: (props.state as string) ?? null,
    controllingFacility: (props.controllingFacility as string) ?? null,
    scheduleDescription: (props.scheduleDescription as string) ?? null,
    artccStratum: (props.artccStratum as ArtccStratum) ?? null,
  };

  return { feature, ring, boundingBox: polygon.boundingBox(ring) };
}

/**
 * Creates a stateless airspace resolver. The resolver accepts a GeoJSON
 * FeatureCollection at initialization (typically from `@squawk/airspace-data`)
 * and returns an object with methods for querying by position and altitude
 * or by associated airport / SUA identifier.
 *
 * Position queries perform two checks per feature:
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
 * const resolver = createAirspaceResolver({ data: usBundledAirspace });
 * const overhead = resolver.query({ lat: 33.9425, lon: -118.4081, altitudeFt: 3000 });
 * const laxShells = resolver.byAirport('LAX');
 * const newYorkArtcc = resolver.byArtcc('ZNY');
 * ```
 */
export function createAirspaceResolver(options: AirspaceResolverOptions): AirspaceResolver {
  const indexed: IndexedFeature[] = [];
  const byIdentifierMap = new Map<string, AirspaceFeature[]>();

  for (const geoFeature of options.data.features) {
    const parsed = parseFeature(geoFeature);
    if (parsed) {
      indexed.push(parsed);
      const key = parsed.feature.identifier.toUpperCase();
      if (key.length > 0) {
        const bucket = byIdentifierMap.get(key);
        if (bucket === undefined) {
          byIdentifierMap.set(key, [parsed.feature]);
        } else {
          bucket.push(parsed.feature);
        }
      }
    }
  }

  return {
    query(query: AirspaceQuery): AirspaceFeature[] {
      const results: AirspaceFeature[] = [];
      const { lon, lat, altitudeFt, types } = query;

      for (const { feature, ring, boundingBox } of indexed) {
        if (types && !types.has(feature.type)) {
          continue;
        }
        if (!polygon.pointInBoundingBox(lon, lat, boundingBox)) {
          continue;
        }
        if (!polygon.pointInPolygon(lon, lat, ring)) {
          continue;
        }
        if (!altitudeMatches(altitudeFt, feature.floor, feature.ceiling)) {
          continue;
        }
        results.push(feature);
      }

      return results;
    },

    byAirport(identifier: string, types?: ReadonlySet<AirspaceType>): AirspaceFeature[] {
      const bucket = byIdentifierMap.get(identifier.toUpperCase());
      if (bucket === undefined) {
        return [];
      }
      if (types === undefined) {
        return bucket.filter((f) => f.type !== 'ARTCC');
      }
      return bucket.filter((f) => f.type !== 'ARTCC' && types.has(f.type));
    },

    byArtcc(identifier: string, stratum?: ArtccStratum): AirspaceFeature[] {
      const bucket = byIdentifierMap.get(identifier.toUpperCase());
      if (bucket === undefined) {
        return [];
      }
      const artccFeatures = bucket.filter((f) => f.type === 'ARTCC');
      if (stratum === undefined) {
        return artccFeatures;
      }
      return artccFeatures.filter((f) => f.artccStratum === stratum);
    },
  };
}
