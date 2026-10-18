import { describe, it, expect, vi } from 'vitest';

import type { FlightplanResolver, ParsedRoute } from '@squawk/flightplan/browser';

import { buildPlanRoute, findRouteIssues } from './plan-route.ts';

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

  it('resolves points, distance, and filing issues from the parsed route', () => {
    const route = buildPlanRoute(stubResolver(TWO_POINT_ROUTE), 'A B');
    expect(route?.points).toHaveLength(2);
    expect(route?.issues).toEqual([]);
    expect(route?.distance.legs).toHaveLength(1);
    expect(route?.distance.totalDistanceNm).toBeGreaterThan(0);
    expect(route?.distance.estimatedTimeEnrouteHrs).toBeUndefined();
  });

  it('computes an ETE when a ground speed is supplied', () => {
    const route = buildPlanRoute(stubResolver(TWO_POINT_ROUTE), 'A B', 120);
    expect(route?.distance.estimatedTimeEnrouteHrs).toBeGreaterThan(0);
  });
});

describe('findRouteIssues', () => {
  it('lists the gaps and unusable segments of each airway in traversal order', () => {
    const parsed: ParsedRoute = {
      raw: 'LAX J60 SAX',
      elements: [
        { type: 'coordinate', raw: 'A', lat: 34, lon: -118 },
        {
          type: 'airway',
          raw: 'J60',
          airway: { designation: 'J60', type: 'JET', region: 'US', waypoints: [] },
          entryFix: 'LAX',
          exitFix: 'SAX',
          waypoints: [],
          gaps: [{ index: 2, from: 'JOT', to: 'DJB' }],
          unusable: [{ index: 0, from: 'LAX', to: 'PGS' }],
        },
      ],
    };
    expect(findRouteIssues(parsed)).toEqual([
      { kind: 'unusable', airway: 'J60', from: 'LAX', to: 'PGS' },
      { kind: 'gap', airway: 'J60', from: 'JOT', to: 'DJB' },
    ]);
  });

  it('returns no issues for a route without airways', () => {
    expect(findRouteIssues(TWO_POINT_ROUTE)).toEqual([]);
  });
});
