import { describe, it, expect, vi } from 'vitest';

import type { FlightplanResolver, ParsedRoute } from '@squawk/flightplan/browser';

import { buildPlanRoute } from './plan-route.ts';

/** Builds a stub flightplan resolver whose `parse` returns a fixed route. */
function stubResolver(parsed: ParsedRoute): FlightplanResolver {
  return { parse: vi.fn(() => parsed) };
}

/** A two-point route built from coordinate elements (no resolver records needed). */
const TWO_POINT_ROUTE: ParsedRoute = {
  raw: 'A B',
  elements: [
    { type: 'coordinate', raw: 'A', lat: 40, lon: -74 },
    { type: 'coordinate', raw: 'B', lat: 41, lon: -73 },
  ],
};

describe('buildPlanRoute', () => {
  it('returns undefined for a blank route without parsing', () => {
    const resolver = stubResolver(TWO_POINT_ROUTE);
    expect(buildPlanRoute(resolver, '   ')).toBeUndefined();
    expect(resolver.parse).not.toHaveBeenCalled();
  });

  it('resolves points, line, and distance from the parsed route', () => {
    const route = buildPlanRoute(stubResolver(TWO_POINT_ROUTE), 'A B');
    expect(route?.points).toHaveLength(2);
    expect(route?.line?.type).toBe('LineString');
    expect(route?.distance.legs).toHaveLength(1);
    expect(route?.distance.totalDistanceNm).toBeGreaterThan(0);
    expect(route?.distance.estimatedTimeEnrouteHrs).toBeUndefined();
  });

  it('computes an ETE when a ground speed is supplied', () => {
    const route = buildPlanRoute(stubResolver(TWO_POINT_ROUTE), 'A B', 120);
    expect(route?.distance.estimatedTimeEnrouteHrs).toBeGreaterThan(0);
  });
});
