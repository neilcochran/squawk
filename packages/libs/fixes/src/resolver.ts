import { greatCircle } from '@squawk/geo';
import { fuzzySearch } from '@squawk/search';
import type { FuzzySearchOptions, MatchRange } from '@squawk/search';
import type { Fix, FixUseCode } from '@squawk/types';

/**
 * Options for creating a fix resolver.
 */
export interface FixResolverOptions {
  /** Array of Fix records to index for queries. */
  data: Fix[];
}

/**
 * A query to find fixes near a geographic position.
 */
export interface NearestFixQuery {
  /** Latitude in decimal degrees (WGS84). */
  lat: number;
  /** Longitude in decimal degrees (WGS84). */
  lon: number;
  /** Maximum distance in nautical miles. Defaults to 30. */
  maxDistanceNm?: number;
  /** Maximum number of results to return. Defaults to 10. */
  limit?: number;
  /** Optional set of use codes to include. When omitted, all use codes are included. */
  useCodes?: ReadonlySet<FixUseCode>;
}

/**
 * A fix result with distance information from a nearest-fix query.
 */
export interface NearestFixResult {
  /** The matched fix record. */
  fix: Fix;
  /** Distance in nautical miles from the query position. */
  distanceNm: number;
}

/**
 * The searchable field a {@link FixSearchResult} can match on.
 */
export type FixSearchField = 'identifier';

/**
 * Options for a fuzzy text search query against fix identifiers.
 */
export interface FixSearchQuery {
  /** Search text, matched fuzzily and case-insensitively against each fix's identifier. */
  text: string;
  /** Maximum number of results to return. Defaults to 20. */
  limit?: number;
  /** Optional set of use codes to include. When omitted, all use codes are included. */
  useCodes?: ReadonlySet<FixUseCode>;
  /** Minimum match score (exclusive) in `[0, 1]` a result must reach. Defaults to 0, which keeps every match. Raise it to drop weak fuzzy matches. */
  minScore?: number;
}

/**
 * A scored fix result from a fuzzy {@link FixResolver.search}.
 */
export interface FixSearchResult {
  /** The matched fix record. */
  fix: Fix;
  /** Match strength in `[0, 1]`, where 1 is an exact identifier match. */
  score: number;
  /** Which field produced the best match, identifying what {@link FixSearchResult.ranges} index into. */
  matchedField: FixSearchField;
  /** Matched character ranges within the best-matching field's text, for highlighting. */
  ranges: MatchRange[];
}

/**
 * A stateless resolver providing fix lookup methods.
 */
export interface FixResolver {
  /**
   * Looks up fixes by identifier (e.g. "MERIT", "BOSCO").
   * Multiple fixes can share the same identifier in different ICAO regions.
   * Returns an empty array if no match is found.
   */
  byIdent(ident: string): Fix[];

  /**
   * Looks up the single fix sharing the given identifier that lies nearest
   * to a geographic position. The same fix identifier can be published in
   * more than one ICAO region; this disambiguates the collision by proximity
   * to a known point such as a map-click location or an adjacent route
   * waypoint.
   *
   * Returns the nearest matching fix by great-circle distance. When
   * `toleranceNm` is provided, matches farther than that distance are
   * excluded and the method returns `undefined` if none qualify. When
   * `toleranceNm` is omitted, the nearest match is returned regardless of
   * distance. Returns `undefined` when no fix carries the identifier.
   *
   * @param ident - Fix identifier (case-insensitive).
   * @param lat - Latitude of the reference position in decimal degrees (WGS84).
   * @param lon - Longitude of the reference position in decimal degrees (WGS84).
   * @param toleranceNm - Optional maximum great-circle distance in nautical miles. When omitted, the nearest match wins regardless of distance.
   * @returns The nearest matching fix, or `undefined` when none match or none fall within `toleranceNm`.
   */
  byIdentAtPosition(
    ident: string,
    lat: number,
    lon: number,
    toleranceNm?: number,
  ): Fix | undefined;

  /**
   * Finds fixes nearest to a geographic position, sorted by distance.
   * Results are filtered by max distance and limited to the requested count.
   */
  nearest(query: NearestFixQuery): NearestFixResult[];

  /**
   * Fuzzy-searches fixes by identifier. Results are scored and returned
   * best-match first, each carrying the matched field and character ranges
   * for highlighting.
   */
  search(query: FixSearchQuery): FixSearchResult[];
}

/**
 * Default maximum distance in nautical miles for nearest-fix queries.
 */
const DEFAULT_MAX_DISTANCE_NM = 30;

/**
 * Default maximum number of results for nearest-fix queries.
 */
const DEFAULT_NEAREST_LIMIT = 10;

/**
 * Default maximum number of results for text search queries.
 */
const DEFAULT_SEARCH_LIMIT = 20;

/**
 * Creates a stateless fix resolver. The resolver accepts an array of
 * Fix records at initialization (typically from `@squawk/fix-data`)
 * and returns an object with methods for looking up fixes by identifier,
 * proximity, or identifier search.
 *
 * The resolver builds internal indexes at creation time for fast lookups
 * by identifier. Proximity and text searches iterate over the full dataset.
 *
 * ```typescript
 * import { usBundledFixes } from '@squawk/fix-data';
 * import { createFixResolver } from '@squawk/fixes';
 *
 * const resolver = createFixResolver({ data: usBundledFixes.records });
 *
 * const merit = resolver.byIdent('MERIT');
 * const nearby = resolver.nearest({ lat: 40.6413, lon: -73.7781 });
 * const results = resolver.search({ text: 'BOS' });
 * ```
 */
export function createFixResolver(options: FixResolverOptions): FixResolver {
  const fixes = options.data;

  const byIdentMap = new Map<string, Fix[]>();

  for (const fix of fixes) {
    const key = fix.identifier.toUpperCase();
    let arr = byIdentMap.get(key);
    if (!arr) {
      arr = [];
      byIdentMap.set(key, arr);
    }
    arr.push(fix);
  }

  return {
    byIdent(ident: string): Fix[] {
      return byIdentMap.get(ident.toUpperCase()) ?? [];
    },

    byIdentAtPosition(
      ident: string,
      lat: number,
      lon: number,
      toleranceNm?: number,
    ): Fix | undefined {
      const matches = byIdentMap.get(ident.toUpperCase());
      if (matches === undefined || matches.length === 0) {
        return undefined;
      }

      let nearest: Fix | undefined;
      let nearestDistNm = Infinity;
      for (const fix of matches) {
        const distNm = greatCircle.distanceNm(lat, lon, fix.lat, fix.lon);
        if (distNm < nearestDistNm) {
          nearest = fix;
          nearestDistNm = distNm;
        }
      }

      if (toleranceNm !== undefined && nearestDistNm > toleranceNm) {
        return undefined;
      }
      return nearest;
    },

    nearest(query: NearestFixQuery): NearestFixResult[] {
      const maxDist = query.maxDistanceNm ?? DEFAULT_MAX_DISTANCE_NM;
      const limit = query.limit ?? DEFAULT_NEAREST_LIMIT;
      const results: NearestFixResult[] = [];

      for (const fix of fixes) {
        if (query.useCodes && !query.useCodes.has(fix.useCode)) {
          continue;
        }

        const dist = greatCircle.distanceNm(query.lat, query.lon, fix.lat, fix.lon);
        if (dist <= maxDist) {
          results.push({ fix, distanceNm: Math.round(dist * 100) / 100 });
        }
      }

      results.sort((a, b) => a.distanceNm - b.distanceNm);
      return results.slice(0, limit);
    },

    search(query: FixSearchQuery): FixSearchResult[] {
      const options: FuzzySearchOptions<Fix, FixSearchField> = {
        keys: (fix) => [{ name: 'identifier', text: fix.identifier }],
        limit: query.limit ?? DEFAULT_SEARCH_LIMIT,
        minScore: query.minScore ?? 0,
      };

      const useCodes = query.useCodes;
      if (useCodes) {
        options.filter = (fix) => useCodes.has(fix.useCode);
      }

      return fuzzySearch(fixes, query.text, options).map((match) => ({
        fix: match.item,
        score: match.score,
        matchedField: match.field,
        ranges: match.ranges,
      }));
    },
  };
}
