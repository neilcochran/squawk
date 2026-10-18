import { describe, it, expect, vi } from 'vitest';

import type { FlightplanResolver, ParsedRoute } from '@squawk/flightplan/browser';
import type { Procedure } from '@squawk/types';

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

/** A minimal SID or STAR record published at one airport. */
function buildProcedure(type: 'SID' | 'STAR', identifier: string, airport: string): Procedure {
  return {
    name: identifier,
    identifier,
    type,
    airports: [airport],
    commonRoutes: [],
    transitions: [],
  };
}

describe('findRouteIssues', () => {
  it('lists a procedure filed at an airport it does not serve, in route order with airway issues', () => {
    const parsed: ParsedRoute = {
      raw: 'KBOS DEEZZ6 CANDR J60 DJB BBOTL AALLE4 KBOS',
      elements: [
        {
          type: 'sid',
          raw: 'DEEZZ6',
          procedure: buildProcedure('SID', 'DEEZZ6', 'KJFK'),
          legs: [],
          airportMismatch: 'KBOS',
        },
        {
          type: 'airway',
          raw: 'J60',
          airway: { designation: 'J60', type: 'JET', region: 'US', waypoints: [] },
          entryFix: 'CANDR',
          exitFix: 'DJB',
          waypoints: [],
          gaps: [{ index: 3, from: 'JOT', to: 'DJB' }],
          unusable: [],
        },
        {
          type: 'star',
          raw: 'AALLE4',
          procedure: buildProcedure('STAR', 'AALLE4', 'KDEN'),
          legs: [],
          airportMismatch: 'KBOS',
        },
      ],
    };
    expect(findRouteIssues(parsed)).toEqual([
      { kind: 'airportMismatch', procedure: 'DEEZZ6', procedureType: 'SID', airport: 'KBOS' },
      { kind: 'gap', airway: 'J60', from: 'JOT', to: 'DJB' },
      { kind: 'airportMismatch', procedure: 'AALLE4', procedureType: 'STAR', airport: 'KBOS' },
    ]);
  });

  it('lists nothing for a procedure that serves its airport', () => {
    const parsed: ParsedRoute = {
      raw: 'KJFK LUCIT3 KIGQ',
      elements: [
        {
          type: 'star',
          raw: 'LUCIT3',
          procedure: buildProcedure('STAR', 'LUCIT3', 'KIGQ'),
          legs: [],
        },
      ],
    };
    expect(findRouteIssues(parsed)).toEqual([]);
  });

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
