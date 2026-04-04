import type { Navaid, NavaidType } from '@squawk/types';
import { distance } from '@squawk/units';

const { greatCircleDistanceNm } = distance;

/**
 * Options for creating a navaid resolver.
 */
export interface NavaidResolverOptions {
  /** Array of Navaid records to index for queries. */
  data: Navaid[];
}

/**
 * A query to find navaids near a geographic position.
 */
export interface NearestNavaidQuery {
  /** Latitude in decimal degrees (WGS84). */
  lat: number;
  /** Longitude in decimal degrees (WGS84). */
  lon: number;
  /** Maximum distance in nautical miles. Defaults to 30. */
  maxDistanceNm?: number;
  /** Maximum number of results to return. Defaults to 10. */
  limit?: number;
  /** Optional set of navaid types to include. When omitted, all types are included. */
  types?: ReadonlySet<NavaidType>;
}

/**
 * A navaid result with distance information from a nearest-navaid query.
 */
export interface NearestNavaidResult {
  /** The matched navaid record. */
  navaid: Navaid;
  /** Distance in nautical miles from the query position. */
  distanceNm: number;
}

/**
 * A query to find navaids by frequency.
 */
export interface NavaidFrequencyQuery {
  /** Frequency value to match. For VOR-family navaids this is MHz, for NDB-family this is kHz. */
  frequency: number;
  /** Optional set of navaid types to include. When omitted, all types are included. */
  types?: ReadonlySet<NavaidType>;
  /** Maximum number of results to return. Defaults to 20. */
  limit?: number;
}

/**
 * Options for a text search query against navaid names and identifiers.
 */
export interface NavaidSearchQuery {
  /** Case-insensitive substring to match against navaid name or identifier. */
  text: string;
  /** Maximum number of results to return. Defaults to 20. */
  limit?: number;
  /** Optional set of navaid types to include. When omitted, all types are included. */
  types?: ReadonlySet<NavaidType>;
}

/**
 * A stateless resolver providing navaid lookup methods.
 */
export interface NavaidResolver {
  /**
   * Looks up navaids by identifier (e.g. "BOS", "JFK").
   * Multiple navaids can share the same identifier (e.g. an NDB and a VOR).
   * Returns an empty array if no match is found.
   */
  byIdent(ident: string): Navaid[];

  /**
   * Finds navaids operating on a given frequency.
   * For VOR-family navaids, frequency is in MHz. For NDB-family, frequency is in kHz.
   * Results are sorted alphabetically by identifier.
   */
  byFrequency(query: NavaidFrequencyQuery): Navaid[];

  /**
   * Finds navaids nearest to a geographic position, sorted by distance.
   * Results are filtered by max distance and limited to the requested count.
   */
  nearest(query: NearestNavaidQuery): NearestNavaidResult[];

  /**
   * Finds all navaids of the given type(s).
   * Results are sorted alphabetically by identifier.
   */
  byType(types: ReadonlySet<NavaidType>): Navaid[];

  /**
   * Searches navaids by name or identifier using case-insensitive substring matching.
   * Results are returned in alphabetical order by name.
   */
  search(query: NavaidSearchQuery): Navaid[];
}

/**
 * Default maximum distance in nautical miles for nearest-navaid queries.
 */
const DEFAULT_MAX_DISTANCE_NM = 30;

/**
 * Default maximum number of results for nearest-navaid queries.
 */
const DEFAULT_NEAREST_LIMIT = 10;

/**
 * Default maximum number of results for text search and frequency queries.
 */
const DEFAULT_SEARCH_LIMIT = 20;

/** Navaid types that use MHz frequencies. */
const MHZ_TYPES: ReadonlySet<NavaidType> = new Set([
  'VOR',
  'VORTAC',
  'VOR/DME',
  'TACAN',
  'DME',
  'VOT',
]);

/**
 * Creates a stateless navaid resolver. The resolver accepts an array of
 * Navaid records at initialization (typically from `@squawk/navaid-data`)
 * and returns an object with methods for looking up navaids by identifier,
 * frequency, proximity, type, or name search.
 *
 * The resolver builds internal indexes at creation time for fast lookups
 * by identifier. Proximity, frequency, and text searches iterate over the
 * full dataset.
 *
 * ```typescript
 * import { usBundledNavaids } from '@squawk/navaid-data';
 * import { createNavaidResolver } from '@squawk/navaids';
 *
 * const resolver = createNavaidResolver({ data: usBundledNavaids.records });
 *
 * const bos = resolver.byIdent('BOS');
 * const nearby = resolver.nearest({ lat: 42.3656, lon: -71.0096 });
 * const vors = resolver.byType(new Set(['VOR', 'VORTAC']));
 * ```
 */
export function createNavaidResolver(options: NavaidResolverOptions): NavaidResolver {
  const navaids = options.data;

  const byIdentMap = new Map<string, Navaid[]>();

  for (const navaid of navaids) {
    const key = navaid.identifier.toUpperCase();
    let arr = byIdentMap.get(key);
    if (!arr) {
      arr = [];
      byIdentMap.set(key, arr);
    }
    arr.push(navaid);
  }

  return {
    byIdent(ident: string): Navaid[] {
      return byIdentMap.get(ident.toUpperCase()) ?? [];
    },

    byFrequency(query: NavaidFrequencyQuery): Navaid[] {
      const limit = query.limit ?? DEFAULT_SEARCH_LIMIT;
      const results: Navaid[] = [];

      for (const navaid of navaids) {
        if (query.types && !query.types.has(navaid.type)) {
          continue;
        }

        const freq = MHZ_TYPES.has(navaid.type) ? navaid.frequencyMhz : navaid.frequencyKhz;
        if (freq === query.frequency) {
          results.push(navaid);
        }
      }

      results.sort((a, b) => a.identifier.localeCompare(b.identifier));
      return results.slice(0, limit);
    },

    nearest(query: NearestNavaidQuery): NearestNavaidResult[] {
      const maxDist = query.maxDistanceNm ?? DEFAULT_MAX_DISTANCE_NM;
      const limit = query.limit ?? DEFAULT_NEAREST_LIMIT;
      const results: NearestNavaidResult[] = [];

      for (const navaid of navaids) {
        if (query.types && !query.types.has(navaid.type)) {
          continue;
        }

        const dist = greatCircleDistanceNm(query.lat, query.lon, navaid.lat, navaid.lon);
        if (dist <= maxDist) {
          results.push({ navaid, distanceNm: Math.round(dist * 100) / 100 });
        }
      }

      results.sort((a, b) => a.distanceNm - b.distanceNm);
      return results.slice(0, limit);
    },

    byType(types: ReadonlySet<NavaidType>): Navaid[] {
      const results: Navaid[] = [];

      for (const navaid of navaids) {
        if (types.has(navaid.type)) {
          results.push(navaid);
        }
      }

      results.sort((a, b) => a.identifier.localeCompare(b.identifier));
      return results;
    },

    search(query: NavaidSearchQuery): Navaid[] {
      const limit = query.limit ?? DEFAULT_SEARCH_LIMIT;
      const needle = query.text.toLowerCase();

      if (needle.length === 0) {
        return [];
      }

      const results: Navaid[] = [];

      for (const navaid of navaids) {
        if (query.types && !query.types.has(navaid.type)) {
          continue;
        }

        if (
          navaid.name.toLowerCase().includes(needle) ||
          navaid.identifier.toLowerCase().includes(needle)
        ) {
          results.push(navaid);
        }
      }

      results.sort((a, b) => a.name.localeCompare(b.name));
      return results.slice(0, limit);
    },
  };
}
