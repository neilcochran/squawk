import type { Fix, FixUseCode } from '@squawk/types';
import { greatCircle } from '@squawk/geo';

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
 * Options for a text search query against fix identifiers.
 */
export interface FixSearchQuery {
  /** Case-insensitive substring to match against fix identifier. */
  text: string;
  /** Maximum number of results to return. Defaults to 20. */
  limit?: number;
  /** Optional set of use codes to include. When omitted, all use codes are included. */
  useCodes?: ReadonlySet<FixUseCode>;
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
   * Finds fixes nearest to a geographic position, sorted by distance.
   * Results are filtered by max distance and limited to the requested count.
   */
  nearest(query: NearestFixQuery): NearestFixResult[];

  /**
   * Searches fixes by identifier using case-insensitive substring matching.
   * Results are returned in alphabetical order by identifier.
   */
  search(query: FixSearchQuery): Fix[];
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

    search(query: FixSearchQuery): Fix[] {
      const limit = query.limit ?? DEFAULT_SEARCH_LIMIT;
      const needle = query.text.toUpperCase();

      if (needle.length === 0) {
        return [];
      }

      const results: Fix[] = [];

      for (const fix of fixes) {
        if (query.useCodes && !query.useCodes.has(fix.useCode)) {
          continue;
        }

        if (fix.identifier.toUpperCase().includes(needle)) {
          results.push(fix);
        }
      }

      results.sort((a, b) => a.identifier.localeCompare(b.identifier));
      return results.slice(0, limit);
    },
  };
}
