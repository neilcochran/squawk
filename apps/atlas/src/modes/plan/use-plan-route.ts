import { useMemo } from 'react';

import type { FlightplanResolver } from '@squawk/flightplan/browser';

import { buildPlanRoute } from './plan-route.ts';
import type { PlanRoute } from './plan-route.ts';

/**
 * React wrapper over {@link buildPlanRoute}, memoized on the resolver, route
 * string, and ground speed so a re-render that changes none of them reuses
 * the previous parse + geometry + distance computation.
 *
 * Returns `undefined` while the resolver is not ready or the route is blank.
 *
 * @param resolver - Composed flightplan resolver, or `undefined` while data loads.
 * @param routeString - Raw route string from URL state.
 * @param groundSpeedKt - Optional ground speed in knots for the ETE estimate.
 * @returns The resolved {@link PlanRoute}, or `undefined`.
 */
export function usePlanRoute(
  resolver: FlightplanResolver | undefined,
  routeString: string,
  groundSpeedKt: number | undefined,
): PlanRoute | undefined {
  return useMemo<PlanRoute | undefined>(() => {
    if (resolver === undefined) {
      return undefined;
    }
    return buildPlanRoute(resolver, routeString, groundSpeedKt);
  }, [resolver, routeString, groundSpeedKt]);
}
