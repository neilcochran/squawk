import { describe, it, expect } from 'vitest';

import type { RouteLeg, RoutePoint } from '@squawk/flightplan/browser';

import {
  PLAN_ROUTE_INVALID_LINE_LAYER_ID,
  PLAN_ROUTE_LINE_LAYER_ID,
  PLAN_WAYPOINTS_LABEL_LAYER_ID,
  PLAN_WAYPOINTS_LAYER_ID,
  planLegStatus,
  toLegCollection,
  toWaypointCollection,
} from './plan-route-features.ts';

function buildLeg(overrides: Partial<RouteLeg> = {}): RouteLeg {
  return {
    from: 'A',
    to: 'B',
    fromLat: 42,
    fromLon: -71,
    toLat: 43,
    toLon: -70,
    distanceNm: 70,
    cumulativeDistanceNm: 70,
    crossesGap: false,
    unusable: false,
    procedureAirportMismatch: false,
    ...overrides,
  };
}

describe('planLegStatus', () => {
  it('reads a leg as valid, a gap, or unusable', () => {
    expect(planLegStatus(buildLeg())).toBe('valid');
    expect(planLegStatus(buildLeg({ crossesGap: true }))).toBe('gap');
    expect(planLegStatus(buildLeg({ unusable: true }))).toBe('unusable');
  });

  it('reads a leg along or into a mismatched procedure as airportMismatch', () => {
    expect(planLegStatus(buildLeg({ procedureAirportMismatch: true }))).toBe('airportMismatch');
  });

  it('prefers an unusable segment over a mismatched procedure on the same leg', () => {
    expect(planLegStatus(buildLeg({ unusable: true, procedureAirportMismatch: true }))).toBe(
      'unusable',
    );
  });

  it('reads a leg flagged both ways as a gap', () => {
    expect(planLegStatus(buildLeg({ crossesGap: true, unusable: true }))).toBe('gap');
  });
});

describe('toLegCollection', () => {
  it('returns an empty collection for a route with no legs', () => {
    expect(toLegCollection([]).features).toEqual([]);
  });

  it('draws each leg as a two-point line tagged with its status', () => {
    const fc = toLegCollection([buildLeg(), buildLeg({ from: 'B', to: 'C', crossesGap: true })]);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0]?.geometry.coordinates).toEqual([
      [-71, 42],
      [-70, 43],
    ]);
    expect(fc.features.map((feature) => feature.properties.status)).toEqual(['valid', 'gap']);
  });
});

describe('toWaypointCollection', () => {
  it('maps points to [lon, lat] features carrying label and index', () => {
    const points: RoutePoint[] = [
      { label: 'KJFK', lat: 40.6, lon: -73.7 },
      { label: 'MERIT', lat: 40.5, lon: -73.0 },
    ];
    const fc = toWaypointCollection(points);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0]?.geometry.coordinates).toEqual([-73.7, 40.6]);
    expect(fc.features[0]?.properties).toEqual({ label: 'KJFK', index: 0 });
    expect(fc.features[1]?.properties.index).toBe(1);
  });

  it('returns an empty collection for no points', () => {
    expect(toWaypointCollection([]).features).toEqual([]);
  });
});

describe('layer ids', () => {
  it('are stable atlas-prefixed ids (preserved across basemap theme swaps)', () => {
    expect(PLAN_ROUTE_LINE_LAYER_ID).toBe('atlas-plan-route-line');
    expect(PLAN_ROUTE_INVALID_LINE_LAYER_ID).toBe('atlas-plan-route-invalid-line');
    expect(PLAN_WAYPOINTS_LAYER_ID).toBe('atlas-plan-waypoints-circle');
    expect(PLAN_WAYPOINTS_LABEL_LAYER_ID).toBe('atlas-plan-waypoints-label');
  });
});
