import type {
  Procedure,
  ProcedureType,
  ProcedureWaypoint,
  ProcedureCommonRoute,
} from '@squawk/types';

/**
 * Options for creating a procedure resolver.
 */
export interface ProcedureResolverOptions {
  /** Array of Procedure records to index for queries. */
  data: Procedure[];
}

/**
 * Result of expanding a procedure into a waypoint sequence.
 */
export interface ProcedureExpansionResult {
  /** The procedure that was expanded. */
  procedure: Procedure;
  /** Ordered sequence of waypoints for the selected route. */
  waypoints: ProcedureWaypoint[];
}

/**
 * Options for a text search query against procedure names and computer codes.
 */
export interface ProcedureSearchQuery {
  /** Case-insensitive substring to match against procedure name or computer code. */
  text: string;
  /** Maximum number of results to return. Defaults to 20. */
  limit?: number;
  /** Optional procedure type to filter by (SID or STAR). */
  type?: ProcedureType;
}

/**
 * A stateless resolver providing instrument procedure lookup, filtering, and
 * expansion methods.
 */
export interface ProcedureResolver {
  /**
   * Looks up a procedure by its FAA computer code (e.g. "AALLE4", "ACCRA5").
   * Case-insensitive. Returns undefined if no match is found.
   */
  byName(computerCode: string): Procedure | undefined;

  /**
   * Finds all procedures associated with a given airport identifier.
   * Case-insensitive. Returns an empty array if no match is found.
   */
  byAirport(airportId: string): Procedure[];

  /**
   * Returns all procedures of a given type (SID or STAR).
   */
  byType(type: ProcedureType): Procedure[];

  /**
   * Expands a procedure into an ordered waypoint sequence.
   *
   * When called without a transition name, returns the first common route.
   * When called with a transition name, returns the matching transition's
   * waypoints followed by the first common route's waypoints (with any
   * overlapping connecting fix deduplicated).
   *
   * Returns undefined if the procedure or transition is not found.
   */
  expand(computerCode: string, transitionName?: string): ProcedureExpansionResult | undefined;

  /**
   * Searches procedures by name or computer code using case-insensitive
   * substring matching. Results are returned in alphabetical order by
   * computer code.
   */
  search(query: ProcedureSearchQuery): Procedure[];
}

/**
 * Default maximum number of results for text search queries.
 */
const DEFAULT_SEARCH_LIMIT = 20;

/**
 * Creates a stateless procedure resolver. The resolver accepts an array of
 * Procedure records at initialization (typically from `@squawk/procedure-data`)
 * and returns an object with methods for looking up procedures by computer code,
 * airport, type, expanding route segments, and searching by name.
 *
 * The resolver builds internal indexes at creation time for fast lookups
 * by computer code and by airport identifier.
 *
 * ```typescript
 * import { usBundledProcedures } from '@squawk/procedure-data';
 * import { createProcedureResolver } from '@squawk/procedures';
 *
 * const resolver = createProcedureResolver({ data: usBundledProcedures.records });
 *
 * const aalle = resolver.byName('AALLE4');
 * const denProcedures = resolver.byAirport('DEN');
 * const stars = resolver.byType('STAR');
 * const expanded = resolver.expand('AALLE4', 'BBOTL');
 * const results = resolver.search({ text: 'AALLE' });
 * ```
 */
export function createProcedureResolver(options: ProcedureResolverOptions): ProcedureResolver {
  const procedures = options.data;

  const byCodeMap = new Map<string, Procedure>();
  const byAirportMap = new Map<string, Procedure[]>();
  const sidList: Procedure[] = [];
  const starList: Procedure[] = [];

  for (const proc of procedures) {
    byCodeMap.set(proc.computerCode.toUpperCase(), proc);

    for (const airport of proc.airports) {
      const key = airport.toUpperCase();
      let arr = byAirportMap.get(key);
      if (!arr) {
        arr = [];
        byAirportMap.set(key, arr);
      }
      arr.push(proc);
    }

    if (proc.type === 'SID') {
      sidList.push(proc);
    } else {
      starList.push(proc);
    }
  }

  return {
    byName(computerCode: string): Procedure | undefined {
      return byCodeMap.get(computerCode.toUpperCase());
    },

    byAirport(airportId: string): Procedure[] {
      return byAirportMap.get(airportId.toUpperCase()) ?? [];
    },

    byType(type: ProcedureType): Procedure[] {
      return type === 'SID' ? sidList : starList;
    },

    expand(computerCode: string, transitionName?: string): ProcedureExpansionResult | undefined {
      const proc = byCodeMap.get(computerCode.toUpperCase());
      if (!proc) {
        return undefined;
      }

      if (transitionName === undefined) {
        const firstRoute = proc.commonRoutes[0];
        if (!firstRoute) {
          return undefined;
        }
        return {
          procedure: proc,
          waypoints: firstRoute.waypoints,
        };
      }

      const upperTransition = transitionName.toUpperCase();
      const transition = proc.transitions.find((t) => t.name.toUpperCase() === upperTransition);
      if (!transition) {
        return undefined;
      }

      const firstRoute = proc.commonRoutes[0];
      if (!firstRoute) {
        return {
          procedure: proc,
          waypoints: transition.waypoints,
        };
      }

      const waypoints = mergeTransitionAndRoute(transition.waypoints, firstRoute);
      return {
        procedure: proc,
        waypoints,
      };
    },

    search(query: ProcedureSearchQuery): Procedure[] {
      const limit = query.limit ?? DEFAULT_SEARCH_LIMIT;
      const needle = query.text.toUpperCase();

      if (needle.length === 0) {
        return [];
      }

      const results: Procedure[] = [];

      for (const proc of procedures) {
        if (query.type && proc.type !== query.type) {
          continue;
        }

        if (
          proc.computerCode.toUpperCase().includes(needle) ||
          proc.name.toUpperCase().includes(needle)
        ) {
          results.push(proc);
        }
      }

      results.sort((a, b) => a.computerCode.localeCompare(b.computerCode));
      return results.slice(0, limit);
    },
  };
}

/**
 * Merges a transition's waypoints with a common route's waypoints.
 * If the last waypoint of the transition matches the first waypoint of the
 * common route (by fix identifier), the duplicate is removed.
 */
function mergeTransitionAndRoute(
  transitionWaypoints: ProcedureWaypoint[],
  route: ProcedureCommonRoute,
): ProcedureWaypoint[] {
  if (transitionWaypoints.length === 0) {
    return route.waypoints;
  }
  if (route.waypoints.length === 0) {
    return transitionWaypoints;
  }

  const lastTransition = transitionWaypoints[transitionWaypoints.length - 1]!;
  const firstRoute = route.waypoints[0]!;

  if (lastTransition.fixIdentifier.toUpperCase() === firstRoute.fixIdentifier.toUpperCase()) {
    return [...transitionWaypoints, ...route.waypoints.slice(1)];
  }

  return [...transitionWaypoints, ...route.waypoints];
}
