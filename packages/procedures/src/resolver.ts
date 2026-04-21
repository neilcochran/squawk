import type {
  ApproachType,
  Procedure,
  ProcedureCommonRoute,
  ProcedureLeg,
  ProcedureTransition,
  ProcedureType,
} from '@squawk/types';

/**
 * Options for creating a procedure resolver.
 */
export interface ProcedureResolverOptions {
  /** Array of {@link Procedure} records to index for queries. */
  data: Procedure[];
}

/**
 * Result of expanding a procedure into an ordered leg sequence.
 */
export interface ProcedureExpansionResult {
  /** The procedure that was expanded. */
  procedure: Procedure;
  /** Ordered legs for the expansion (common route + optional transition). */
  legs: ProcedureLeg[];
}

/**
 * Options for a text search query against procedure names and identifiers.
 */
export interface ProcedureSearchQuery {
  /** Case-insensitive substring matched against name and identifier. */
  text: string;
  /** Maximum number of results to return. Defaults to 20. */
  limit?: number;
  /** Optional procedure type to filter by. */
  type?: ProcedureType;
  /** Optional approach type filter (applied only when matching IAPs). */
  approachType?: ApproachType;
}

/**
 * A stateless resolver providing instrument procedure lookup, filtering,
 * and expansion methods against a pre-indexed dataset.
 */
export interface ProcedureResolver {
  /**
   * Looks up every procedure matching a CIFP identifier. The identifier
   * alone is not globally unique in CIFP data - the same name (for
   * example `SARDI1` or `I04L`) is published separately for every
   * adapted airport. This method returns all of them.
   */
  byIdentifier(identifier: string): Procedure[];

  /**
   * Looks up a single procedure by (airport, identifier). Returns
   * `undefined` when the airport does not adapt the identifier.
   */
  byAirportAndIdentifier(airportId: string, identifier: string): Procedure | undefined;

  /**
   * Returns every procedure adapted at the given airport (SIDs, STARs,
   * and IAPs).
   */
  byAirport(airportId: string): Procedure[];

  /**
   * Returns every procedure at an airport that serves a specific runway.
   *
   * - For IAPs this matches the `runway` field directly.
   * - For SIDs and STARs this matches procedures that publish a runway transition named `RW<runway>` (e.g. `RW04L`).
   */
  byAirportAndRunway(airportId: string, runway: string): Procedure[];

  /**
   * Returns every procedure of a given type.
   */
  byType(type: ProcedureType): Procedure[];

  /**
   * Returns every IAP of a given approach classification (ILS, RNAV, etc.).
   */
  byApproachType(approachType: ApproachType): Procedure[];

  /**
   * Expands a procedure into an ordered leg sequence. When `transitionName`
   * is omitted the expansion is the procedure's first common route. When
   * `transitionName` is provided, the named transition's legs are merged
   * with the common route in flying order:
   *
   * - SID, enroute exit transition - common route first, then transition.
   * - SID, runway transition (`RW*` name) - transition first, then common route.
   * - STAR, enroute entry transition - transition first, then common route.
   * - STAR, runway transition (`RW*` name) - common route first, then transition.
   * - IAP, approach transition - transition first, then common route (final approach segment).
   *
   * The connecting fix between transition and common route is
   * deduplicated when both segments reference it.
   *
   * Returns `undefined` when the procedure, airport, or transition is
   * not found.
   */
  expand(
    airportId: string,
    identifier: string,
    transitionName?: string,
  ): ProcedureExpansionResult | undefined;

  /**
   * Searches procedures by name or identifier using case-insensitive
   * substring matching. Results are returned sorted by airport then
   * identifier.
   */
  search(query: ProcedureSearchQuery): Procedure[];
}

/**
 * Default maximum number of results for text search queries.
 */
const DEFAULT_SEARCH_LIMIT = 20;

/**
 * Creates a stateless procedure resolver. The resolver accepts an array
 * of {@link Procedure} records at initialization (typically from
 * `@squawk/procedure-data`) and returns an object with query methods.
 *
 * The resolver builds internal indexes at creation time for fast lookup
 * by identifier, by airport, by (airport, identifier), by type, and by
 * approach type.
 *
 * ```typescript
 * import { usBundledProcedures } from '@squawk/procedure-data';
 * import { createProcedureResolver } from '@squawk/procedures';
 *
 * const resolver = createProcedureResolver({ data: usBundledProcedures.records });
 *
 * const allSardi = resolver.byIdentifier('SARDI1');
 * const denAalle = resolver.byAirportAndIdentifier('KDEN', 'AALLE4');
 * const jfkApproaches = resolver.byAirport('KJFK').filter((p) => p.type === 'IAP');
 * const jfk04LApproaches = resolver.byAirportAndRunway('KJFK', '04L');
 * const allIls = resolver.byApproachType('ILS');
 * const expanded = resolver.expand('KDEN', 'AALLE4', 'BBOTL');
 * ```
 */
export function createProcedureResolver(options: ProcedureResolverOptions): ProcedureResolver {
  const procedures = options.data;

  const byIdentifierMap = new Map<string, Procedure[]>();
  const byAirportMap = new Map<string, Procedure[]>();
  const byAirportIdentifierMap = new Map<string, Procedure>();
  const sidList: Procedure[] = [];
  const starList: Procedure[] = [];
  const iapList: Procedure[] = [];
  const byApproachTypeMap = new Map<ApproachType, Procedure[]>();

  for (const proc of procedures) {
    const identKey = proc.identifier.toUpperCase();
    appendToMap(byIdentifierMap, identKey, proc);

    for (const airport of proc.airports) {
      const airportKey = airport.toUpperCase();
      appendToMap(byAirportMap, airportKey, proc);
      byAirportIdentifierMap.set(`${airportKey}::${identKey}`, proc);
    }

    if (proc.type === 'SID') {
      sidList.push(proc);
    } else if (proc.type === 'STAR') {
      starList.push(proc);
    } else {
      iapList.push(proc);
    }

    if (proc.approachType !== undefined) {
      appendToMap(byApproachTypeMap, proc.approachType, proc);
    }
  }

  return {
    byIdentifier(identifier: string): Procedure[] {
      return byIdentifierMap.get(identifier.toUpperCase()) ?? [];
    },

    byAirportAndIdentifier(airportId: string, identifier: string): Procedure | undefined {
      return byAirportIdentifierMap.get(`${airportId.toUpperCase()}::${identifier.toUpperCase()}`);
    },

    byAirport(airportId: string): Procedure[] {
      return byAirportMap.get(airportId.toUpperCase()) ?? [];
    },

    byAirportAndRunway(airportId: string, runway: string): Procedure[] {
      const candidates = byAirportMap.get(airportId.toUpperCase()) ?? [];
      const runwayUpper = runway.toUpperCase();
      const runwayTransitionName = `RW${runwayUpper}`;
      return candidates.filter((proc) => {
        if (proc.runway !== undefined && proc.runway.toUpperCase() === runwayUpper) {
          return true;
        }
        for (const transition of proc.transitions) {
          if (transition.name.toUpperCase() === runwayTransitionName) {
            return true;
          }
        }
        return false;
      });
    },

    byType(type: ProcedureType): Procedure[] {
      if (type === 'SID') {
        return sidList;
      }
      if (type === 'STAR') {
        return starList;
      }
      return iapList;
    },

    byApproachType(approachType: ApproachType): Procedure[] {
      return byApproachTypeMap.get(approachType) ?? [];
    },

    expand(
      airportId: string,
      identifier: string,
      transitionName?: string,
    ): ProcedureExpansionResult | undefined {
      const proc = byAirportIdentifierMap.get(
        `${airportId.toUpperCase()}::${identifier.toUpperCase()}`,
      );
      if (proc === undefined) {
        return undefined;
      }

      const commonRoute = proc.commonRoutes[0];
      if (transitionName === undefined) {
        if (commonRoute === undefined) {
          return undefined;
        }
        return { procedure: proc, legs: commonRoute.legs };
      }

      const transition = proc.transitions.find(
        (t) => t.name.toUpperCase() === transitionName.toUpperCase(),
      );
      if (transition === undefined) {
        return undefined;
      }

      if (commonRoute === undefined) {
        return { procedure: proc, legs: transition.legs };
      }

      const legs = mergeTransitionAndRoute(transition, commonRoute, proc.type);
      return { procedure: proc, legs };
    },

    search(query: ProcedureSearchQuery): Procedure[] {
      const limit = query.limit ?? DEFAULT_SEARCH_LIMIT;
      const needle = query.text.toUpperCase();
      if (needle.length === 0) {
        return [];
      }

      const results: Procedure[] = [];
      for (const proc of procedures) {
        if (query.type !== undefined && proc.type !== query.type) {
          continue;
        }
        if (query.approachType !== undefined && proc.approachType !== query.approachType) {
          continue;
        }
        if (
          proc.identifier.toUpperCase().includes(needle) ||
          proc.name.toUpperCase().includes(needle)
        ) {
          results.push(proc);
        }
      }

      results.sort((a, b) => {
        const airportDiff = (a.airports[0] ?? '').localeCompare(b.airports[0] ?? '');
        if (airportDiff !== 0) {
          return airportDiff;
        }
        return a.identifier.localeCompare(b.identifier);
      });
      return results.slice(0, limit);
    },
  };
}

/**
 * Appends a procedure to a keyed array within a map, lazily creating
 * the array on first insertion.
 */
function appendToMap<K>(map: Map<K, Procedure[]>, key: K, procedure: Procedure): void {
  let arr = map.get(key);
  if (arr === undefined) {
    arr = [];
    map.set(key, arr);
  }
  arr.push(procedure);
}

/**
 * Merges a transition's legs with a common route's legs in the order
 * an aircraft flies the procedure. The direction depends on both the
 * procedure type and whether the transition is a runway transition
 * (name prefixed with `RW`).
 *
 * - SID + enroute transition - common route first, transition last.
 * - SID + runway transition - transition first, common route last.
 * - STAR + enroute transition - transition first, common route last.
 * - STAR + runway transition - common route first, transition last.
 * - IAP + approach transition - transition first, common route last.
 *
 * The connecting fix between the two segments is deduplicated when
 * both segments reference it with the same identifier.
 */
function mergeTransitionAndRoute(
  transition: ProcedureTransition,
  route: ProcedureCommonRoute,
  procedureType: ProcedureType,
): ProcedureLeg[] {
  if (transition.legs.length === 0) {
    return route.legs;
  }
  if (route.legs.length === 0) {
    return transition.legs;
  }

  const isRunwayTransition = transition.name.toUpperCase().startsWith('RW');
  let transitionFirst: boolean;
  if (procedureType === 'SID') {
    transitionFirst = isRunwayTransition;
  } else if (procedureType === 'STAR') {
    transitionFirst = !isRunwayTransition;
  } else {
    transitionFirst = true;
  }

  if (transitionFirst) {
    return joinSegments(transition.legs, route.legs);
  }
  return joinSegments(route.legs, transition.legs);
}

/**
 * Joins two leg segments, deduplicating the connecting fix when the
 * last leg of `first` and the first leg of `second` terminate at the
 * same fix identifier.
 */
function joinSegments(first: ProcedureLeg[], second: ProcedureLeg[]): ProcedureLeg[] {
  const last = first[first.length - 1];
  const next = second[0];
  if (
    last !== undefined &&
    next !== undefined &&
    last.fixIdentifier !== undefined &&
    next.fixIdentifier !== undefined &&
    last.fixIdentifier.toUpperCase() === next.fixIdentifier.toUpperCase()
  ) {
    return [...first, ...second.slice(1)];
  }
  return [...first, ...second];
}
