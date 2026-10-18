import { computeRouteDistance, extractRoutePoints } from '@squawk/flightplan/browser';
import type {
  FlightplanResolver,
  ParsedRoute,
  RouteDistanceResult,
  RoutePoint,
} from '@squawk/flightplan/browser';

/**
 * A place where the route files an airway somewhere it may not be flown as
 * filed: across a published gap, where the airway is not defined, or across
 * a segment the FAA marks unusable.
 */
export interface PlanAirwayIssue {
  /** `'gap'` for a published discontinuity, `'unusable'` for a segment the FAA marks unusable. */
  kind: 'gap' | 'unusable';
  /** Designation of the airway the route files (e.g. "J60"). */
  airway: string;
  /** Waypoint where the segment starts, in route order. */
  from: string;
  /** Waypoint where the segment ends, in route order. */
  to: string;
}

/**
 * A SID or STAR the route files at an airport that no published adaptation
 * of the procedure serves: a SID that does not depart the route's departure
 * airport, or a STAR that does not arrive at its arrival airport. The
 * procedure is still expanded from its first published adaptation, so the
 * route draws.
 */
export interface PlanProcedureIssue {
  /** Discriminator for a procedure filed at an airport it does not serve. */
  kind: 'airportMismatch';
  /** The procedure's CIFP identifier (e.g. "AALLE4"). */
  procedure: string;
  /** Whether the procedure is a departure (`'SID'`) or an arrival (`'STAR'`). */
  procedureType: 'SID' | 'STAR';
  /** The route's departure (SID) or arrival (STAR) airport the procedure does not serve. */
  airport: string;
}

/**
 * Something that makes the route invalid as filed, although it is still drawn
 * and measured: an airway filed across a gap or an unusable segment, or a
 * procedure filed at an airport it does not serve.
 */
export type PlanRouteIssue = PlanAirwayIssue | PlanProcedureIssue;

/**
 * Everything plan mode needs to render a resolved route string: the parsed
 * route, its drawable points, the distance / ETE breakdown, and anything
 * that makes it invalid as filed.
 */
export interface PlanRoute {
  /** The parsed route - ordered, classified, coordinate-resolved elements. */
  parsed: ParsedRoute;
  /** Ordered drawable points (airports, waypoints, expanded airway / procedure legs). */
  points: RoutePoint[];
  /** Per-leg and total distance plus the optional ETE; each leg is also what the map draws. */
  distance: RouteDistanceResult;
  /** Airway gaps, unusable segments and mismatched procedures the route files, in route order. */
  issues: PlanRouteIssue[];
}

/**
 * Lists what makes a parsed route invalid as filed, in route order: element
 * by element, and by segment position within an airway. That is each airway
 * gap and unusable segment it files across, and each SID or STAR it files at
 * an airport the procedure does not serve (the element's `airportMismatch`).
 *
 * @param parsed - The parsed route.
 * @returns One issue per problem; empty when the route is valid as filed.
 */
export function findRouteIssues(parsed: ParsedRoute): PlanRouteIssue[] {
  return parsed.elements.flatMap((element): PlanRouteIssue[] => {
    if (element.type === 'sid' || element.type === 'star') {
      return element.airportMismatch === undefined
        ? []
        : [
            {
              kind: 'airportMismatch',
              procedure: element.procedure.identifier,
              procedureType: element.type === 'sid' ? 'SID' : 'STAR',
              airport: element.airportMismatch,
            },
          ];
    }
    if (element.type !== 'airway') {
      return [];
    }
    const airway = element.airway.designation;
    const positioned: Array<[segmentIndex: number, issue: PlanRouteIssue]> = [
      ...element.gaps.map((segment): [number, PlanRouteIssue] => [
        segment.index,
        { kind: 'gap', airway, from: segment.from, to: segment.to },
      ]),
      ...element.unusable.map((segment): [number, PlanRouteIssue] => [
        segment.index,
        { kind: 'unusable', airway, from: segment.from, to: segment.to },
      ]),
    ];
    return positioned.sort((a, b) => a[0] - b[0]).map(([, issue]) => issue);
  });
}

/**
 * Resolves a flight-plan route string into the parsed route, its drawable
 * points, the distance / ETE breakdown, and its filing issues. Pure -
 * resolver and string in, a {@link PlanRoute} out, with no React, map, or
 * network - so it is unit-testable without a render harness.
 *
 * Returns `undefined` for a blank or whitespace-only route so callers can
 * render the empty state without forcing a parse.
 *
 * @param resolver - Composed flightplan resolver from {@link usePlanResolver}.
 * @param routeString - Raw route string, e.g. `KLAX DCT LAX J60 SAX DCT KJFK`.
 * @param groundSpeedKt - Optional ground speed in knots for the ETE estimate.
 * @returns The resolved route, or `undefined` when the route string is empty.
 */
export function buildPlanRoute(
  resolver: FlightplanResolver,
  routeString: string,
  groundSpeedKt?: number,
): PlanRoute | undefined {
  if (routeString.trim().length === 0) {
    return undefined;
  }
  const parsed = resolver.parse(routeString);
  return {
    parsed,
    points: extractRoutePoints(parsed),
    distance: computeRouteDistance(parsed, groundSpeedKt),
    issues: findRouteIssues(parsed),
  };
}
