import type { FeatureCollection, Feature } from 'geojson';

import { polygon, polygonGeoJson, type BoundingBox } from '@squawk/geo';
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
 * A query describing a geographic position and tolerance for a centroid-based
 * airspace lookup.
 */
export interface AirspaceCentroidQuery {
  /** Longitude in decimal degrees (WGS84). */
  lon: number;
  /** Latitude in decimal degrees (WGS84). */
  lat: number;
  /**
   * Optional tolerance in degrees for the centroid match. A feature is
   * returned when both `|centroidLon - lon|` and `|centroidLat - lat|`
   * fall below this value. Defaults to `0.0001` (~11 m), generous enough to
   * absorb floating-point round-trips through URL parsing for centroids
   * encoded to ~5 decimal places.
   */
  toleranceDeg?: number;
}

/**
 * Options accepted by {@link AirspaceResolver.byIdentifier}.
 */
export interface AirspaceByIdentifierOptions {
  /**
   * Optional set of airspace types to include in the results. When provided,
   * acts as an inclusion filter and overrides the partition between ARTCC and
   * non-ARTCC features: callers who want ARTCC results in addition to the
   * usual partition include `'ARTCC'` in this set explicitly, and callers who
   * want only non-ARTCC results pass a set of the non-ARTCC types. When
   * omitted, every type is eligible (subject to {@link includeArtcc}).
   */
  types?: ReadonlySet<AirspaceType>;
  /**
   * When `true` (the default), ARTCC features for the identifier are included
   * alongside the airport-associated and SUA features. When `false`, ARTCC
   * features are excluded - useful when you only want the non-ARTCC partition
   * for an identifier without enumerating every non-ARTCC type yourself.
   *
   * Ignored when {@link types} is provided: `types` is the authoritative
   * inclusion list in that case.
   */
  includeArtcc?: boolean;
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

  /**
   * Returns every airspace feature whose polygon centroid lies within the
   * given tolerance of the query coordinates. Useful for resolving features
   * that have an empty `identifier` (some Class E5 surfaces) and therefore
   * have no stable identifier-keyed lookup - the polygon centroid is the
   * fallback handle.
   *
   * Reach for this when you have a centroid encoded into a URL or other
   * external string and want to recover the original feature(s); for
   * identifier-keyed lookups, prefer {@link byIdentifier} (or the more
   * specific {@link byAirport} / {@link byArtcc}). Centroid is computed
   * per call - no internal caching - so this is O(n) over the indexed
   * corpus, suitable for occasional URL-driven lookups but not for
   * tight loops.
   *
   * @param query - Query coordinates and optional tolerance.
   * @returns All features whose centroid is within tolerance, in dataset order.
   */
  byCentroid(query: AirspaceCentroidQuery): AirspaceFeature[];

  /**
   * Returns every airspace feature for the given identifier across both the
   * ARTCC and non-ARTCC partitions, independent of position or altitude.
   * Lookup is case-insensitive.
   *
   * Reach for this when you have an identifier whose airspace type is not
   * known up-front (e.g. parsed from a URL) and you want a single call that
   * returns the matching feature(s) regardless of partition. For ergonomic
   * shortcuts when the partition is known, prefer {@link byAirport} (returns
   * non-ARTCC features only) or {@link byArtcc} (returns ARTCC features
   * only) - those wrappers encode the common "shells for this airport" /
   * "stratums for this center" questions and stay available alongside this
   * type-agnostic form.
   *
   * @param identifier - FAA identifier, NASR designator, or ARTCC code.
   * @param options - Optional `types` inclusion filter and `includeArtcc`
   *                  toggle. See {@link AirspaceByIdentifierOptions}.
   * @returns All matching features, or an empty array.
   */
  byIdentifier(identifier: string, options?: AirspaceByIdentifierOptions): AirspaceFeature[];

  /**
   * Returns every airspace feature whose pre-indexed bounding box overlaps
   * the given bounding box. Reuses the bounding box computed once at
   * resolver creation time rather than recomputing per call, so this is
   * suitable for tight loops over the corpus (e.g. a chip rebuild against
   * a selection footprint).
   *
   * Bounding-box overlap is a coarse spatial filter: it matches any feature
   * whose axis-aligned rectangle intersects the query rectangle, including
   * features whose actual polygon does not. Callers that need true
   * polygon-polygon intersection should follow up with their own geometry
   * test on the returned features.
   *
   * @param bbox - Query bounding box.
   * @returns All features whose pre-indexed bounding box overlaps, in dataset order.
   */
  withinBbox(bbox: BoundingBox): AirspaceFeature[];

  /**
   * Iterates the indexed corpus in dataset order, invoking `callback` once
   * per feature with the parsed feature, its exterior ring, and its
   * pre-computed bounding box. Exposes the resolver's pre-parsed shape so
   * callers that need to filter the corpus themselves do not have to
   * reparse the source GeoJSON or recompute geometry per call.
   *
   * The `ring` and `boundingBox` arguments are the resolver's internal
   * caches and must not be mutated by the callback - copy them first if a
   * mutation is needed.
   *
   * @param callback - Function invoked once per indexed feature.
   */
  forEachIndexed(
    callback: (
      feature: AirspaceFeature,
      ring: readonly number[][],
      boundingBox: BoundingBox,
    ) => void,
  ): void;
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
 * const anyZnyFeature = resolver.byIdentifier('ZNY');
 * const nearbyByCentroid = resolver.byCentroid({ lon: -118.4, lat: 33.9 });
 * const overlapping = resolver.withinBbox({ minLon: -119, minLat: 33, maxLon: -118, maxLat: 35 });
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

    byCentroid(query: AirspaceCentroidQuery): AirspaceFeature[] {
      const tolerance = query.toleranceDeg ?? 0.0001;
      const results: AirspaceFeature[] = [];
      for (const { feature } of indexed) {
        const centroid = polygonGeoJson.polygonCentroid(feature.boundary);
        if (centroid === undefined) {
          continue;
        }
        if (
          Math.abs(centroid[0] - query.lon) < tolerance &&
          Math.abs(centroid[1] - query.lat) < tolerance
        ) {
          results.push(feature);
        }
      }
      return results;
    },

    byIdentifier(identifier: string, options?: AirspaceByIdentifierOptions): AirspaceFeature[] {
      const bucket = byIdentifierMap.get(identifier.toUpperCase());
      if (bucket === undefined) {
        return [];
      }
      const types = options?.types;
      if (types !== undefined) {
        return bucket.filter((f) => types.has(f.type));
      }
      const includeArtcc = options?.includeArtcc ?? true;
      if (includeArtcc) {
        return bucket.slice();
      }
      return bucket.filter((f) => f.type !== 'ARTCC');
    },

    withinBbox(bbox: BoundingBox): AirspaceFeature[] {
      const results: AirspaceFeature[] = [];
      for (const { feature, boundingBox } of indexed) {
        if (polygonGeoJson.boundingBoxesOverlap(bbox, boundingBox)) {
          results.push(feature);
        }
      }
      return results;
    },

    forEachIndexed(
      callback: (
        feature: AirspaceFeature,
        ring: readonly number[][],
        boundingBox: BoundingBox,
      ) => void,
    ): void {
      for (const { feature, ring, boundingBox } of indexed) {
        callback(feature, ring, boundingBox);
      }
    },
  };
}
