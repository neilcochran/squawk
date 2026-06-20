import { fuzzySearch } from '@squawk/search';
import type { FuzzySearchOptions, MatchRange } from '@squawk/search';
import type { Airway, AirwayType, AirwayWaypoint } from '@squawk/types';

/**
 * Options for creating an airway resolver.
 */
export interface AirwayResolverOptions {
  /** Array of Airway records to index for queries. */
  data: Airway[];
}

/**
 * Result of an airway expansion between two fixes.
 */
export interface AirwayExpansionResult {
  /** The airway that was expanded. */
  airway: Airway;
  /** Ordered sequence of waypoints from the entry fix to the exit fix (inclusive). */
  waypoints: AirwayWaypoint[];
}

/**
 * The searchable field an {@link AirwaySearchResult} can match on.
 */
export type AirwaySearchField = 'designation';

/**
 * Options for a fuzzy text search query against airway designations.
 */
export interface AirwaySearchQuery {
  /** Search text, matched fuzzily and case-insensitively against each airway's designation. */
  text: string;
  /** Maximum number of results to return. Defaults to 20. */
  limit?: number;
  /** Optional set of airway types to filter by. When omitted, all types are included. */
  types?: ReadonlySet<AirwayType>;
  /** Minimum match score (exclusive) in `[0, 1]` a result must reach. Defaults to 0, which keeps every match. Raise it to drop weak fuzzy matches. */
  minScore?: number;
}

/**
 * A scored airway result from a fuzzy {@link AirwayResolver.search}.
 */
export interface AirwaySearchResult {
  /** The matched airway record. */
  airway: Airway;
  /** Match strength in `[0, 1]`, where 1 is an exact designation match. */
  score: number;
  /** Which field produced the best match, identifying what {@link AirwaySearchResult.ranges} index into. */
  matchedField: AirwaySearchField;
  /** Matched character ranges within the best-matching field's text, for highlighting. */
  ranges: MatchRange[];
}

/**
 * Result from a reverse lookup of airways passing through a given fix.
 */
export interface AirwayByFixResult {
  /** The airway passing through the fix. */
  airway: Airway;
  /** The index of the matching waypoint within the airway's waypoint array. */
  waypointIndex: number;
}

/**
 * A stateless resolver providing airway lookup and traversal methods.
 */
export interface AirwayResolver {
  /**
   * Looks up airways by designation (e.g. "V16", "J60", "Q1").
   * Multiple airways can share the same designation in different regions
   * (e.g. V16 exists in both the contiguous US and Hawaii).
   * Case-insensitive. Returns an empty array if no match is found.
   */
  byDesignation(designation: string): Airway[];

  /**
   * Expands an airway between two fixes, returning the ordered sequence
   * of waypoints from the entry fix to the exit fix (inclusive).
   *
   * Airways can be traversed in either direction. When the entry fix
   * appears after the exit fix in the stored waypoint order, the returned
   * waypoints are reversed so they always run entry-to-exit.
   *
   * Matches waypoint identifiers case-insensitively. Returns undefined if
   * either fix is not found on the airway.
   */
  expand(designation: string, entryFix: string, exitFix: string): AirwayExpansionResult | undefined;

  /**
   * Finds all airways that pass through a given fix or navaid identifier.
   * Case-insensitive. Returns an empty array if no match is found.
   */
  byFix(ident: string): AirwayByFixResult[];

  /**
   * Fuzzy-searches airways by designation. Results are scored and returned
   * best-match first, each carrying the matched field and character ranges
   * for highlighting.
   */
  search(query: AirwaySearchQuery): AirwaySearchResult[];
}

/**
 * Default maximum number of results for text search queries.
 */
const DEFAULT_SEARCH_LIMIT = 20;

/**
 * Creates a stateless airway resolver. The resolver accepts an array of
 * Airway records at initialization (typically from `@squawk/airway-data`)
 * and returns an object with methods for looking up airways by designation,
 * expanding route segments, finding airways through a fix, and searching
 * by designation.
 *
 * The resolver builds internal indexes at creation time for fast lookups
 * by designation and by fix identifier.
 *
 * ```typescript
 * import { usBundledAirways } from '@squawk/airway-data';
 * import { createAirwayResolver } from '@squawk/airways';
 *
 * const resolver = createAirwayResolver({ data: usBundledAirways.records });
 *
 * const v16 = resolver.byDesignation('V16');
 * const segment = resolver.expand('J60', 'MERIT', 'MARTN');
 * const throughBos = resolver.byFix('BOS');
 * const results = resolver.search({ text: 'V1' });
 * ```
 */
export function createAirwayResolver(options: AirwayResolverOptions): AirwayResolver {
  const airways = options.data;

  const byDesignationMap = new Map<string, Airway[]>();
  const byFixMap = new Map<string, AirwayByFixResult[]>();

  for (const airway of airways) {
    const desigKey = airway.designation.toUpperCase();
    let desigArr = byDesignationMap.get(desigKey);
    if (!desigArr) {
      desigArr = [];
      byDesignationMap.set(desigKey, desigArr);
    }
    desigArr.push(airway);

    for (let i = 0; i < airway.waypoints.length; i++) {
      const wp = airway.waypoints[i]!;
      if (wp.identifier) {
        const key = wp.identifier.toUpperCase();
        let arr = byFixMap.get(key);
        if (!arr) {
          arr = [];
          byFixMap.set(key, arr);
        }
        arr.push({ airway, waypointIndex: i });
      }
    }
  }

  return {
    byDesignation(designation: string): Airway[] {
      return byDesignationMap.get(designation.toUpperCase()) ?? [];
    },

    expand(
      designation: string,
      entryFix: string,
      exitFix: string,
    ): AirwayExpansionResult | undefined {
      const candidates = byDesignationMap.get(designation.toUpperCase());
      if (!candidates) {
        return undefined;
      }

      const entryUpper = entryFix.toUpperCase();
      const exitUpper = exitFix.toUpperCase();

      for (const airway of candidates) {
        let entryIndex = -1;
        let exitIndex = -1;

        for (let i = 0; i < airway.waypoints.length; i++) {
          const wp = airway.waypoints[i]!;
          const wpIdent = wp.identifier?.toUpperCase();
          if (wpIdent === entryUpper && entryIndex === -1) {
            entryIndex = i;
          }
          if (wpIdent === exitUpper) {
            exitIndex = i;
          }
        }

        if (entryIndex !== -1 && exitIndex !== -1 && entryIndex !== exitIndex) {
          if (entryIndex < exitIndex) {
            return {
              airway,
              waypoints: airway.waypoints.slice(entryIndex, exitIndex + 1),
            };
          }
          // Reverse traversal: entry fix comes after exit fix in stored order
          return {
            airway,
            waypoints: airway.waypoints.slice(exitIndex, entryIndex + 1).reverse(),
          };
        }
      }

      return undefined;
    },

    byFix(ident: string): AirwayByFixResult[] {
      return byFixMap.get(ident.toUpperCase()) ?? [];
    },

    search(query: AirwaySearchQuery): AirwaySearchResult[] {
      const options: FuzzySearchOptions<Airway, AirwaySearchField> = {
        keys: (airway) => [{ name: 'designation', text: airway.designation }],
        limit: query.limit ?? DEFAULT_SEARCH_LIMIT,
        minScore: query.minScore ?? 0,
      };

      const types = query.types;
      if (types) {
        options.filter = (airway) => types.has(airway.type);
      }

      return fuzzySearch(airways, query.text, options).map((match) => ({
        airway: match.item,
        score: match.score,
        matchedField: match.field,
        ranges: match.ranges,
      }));
    },
  };
}
