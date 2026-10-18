import { describe, it, expect } from 'vitest';

import type { RouteLeg, RoutePoint } from '@squawk/flightplan/browser';

import {
  LEG_ARC_STEP_NM,
  PLAN_ROUTE_INVALID_LINE_LAYER_ID,
  PLAN_ROUTE_LINE_LAYER_ID,
  PLAN_WAYPOINTS_LABEL_LAYER_ID,
  PLAN_WAYPOINTS_LAYER_ID,
  planLegStatus,
  toLegCollection,
  toWaypointCollection,
  unwrapLongitude,
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

  it('tags each leg with its status', () => {
    const fc = toLegCollection([buildLeg(), buildLeg({ from: 'B', to: 'C', crossesGap: true })]);
    expect(fc.features).toHaveLength(2);
    expect(fc.features.map((feature) => feature.properties.status)).toEqual(['valid', 'gap']);
  });

  it('draws a leg shorter than the arc step as its two endpoints', () => {
    const fc = toLegCollection([buildLeg({ toLat: 42.2, toLon: -71 })]);
    expect(fc.features[0]?.geometry.coordinates).toEqual([
      [-71, 42],
      [-71, 42.2],
    ]);
  });

  it('draws a long leg along its great-circle arc, endpoints exact', () => {
    // KJFK to KLAX, ~2,144 nm.
    const leg = buildLeg({ fromLat: 40.64, fromLon: -73.78, toLat: 33.94, toLon: -118.41 });
    const coordinates = toLegCollection([leg]).features[0]?.geometry.coordinates ?? [];
    expect(coordinates.length).toBe(Math.ceil(2144 / LEG_ARC_STEP_NM) + 1);
    expect(coordinates[0]).toEqual([-73.78, 40.64]);
    expect(coordinates.at(-1)).toEqual([-118.41, 33.94]);
    // Mid-route the arc runs well north of the straight Mercator line between
    // the endpoints, which is what a two-point line would have drawn.
    const [midLon = 0, midLat = 0] = coordinates[Math.floor(coordinates.length / 2)] ?? [];
    const straightLat = 40.64 + ((midLon + 73.78) / (-118.41 + 73.78)) * (33.94 - 40.64);
    expect(midLat - straightLat).toBeGreaterThan(1);
  });

  it('keeps a leg across the antimeridian one continuous line', () => {
    const leg = buildLeg({ fromLat: 51.88, fromLon: -176.65, toLat: 52.71, toLon: 174.11 });
    const coordinates = toLegCollection([leg]).features[0]?.geometry.coordinates ?? [];
    for (let i = 1; i < coordinates.length; i++) {
      const step = Math.abs((coordinates[i]?.[0] ?? 0) - (coordinates[i - 1]?.[0] ?? 0));
      expect(step).toBeLessThan(1);
    }
    expect(coordinates.at(-1)?.[0]).toBeCloseTo(174.11 - 360, 6);
  });
});

describe('unwrapLongitude', () => {
  it('returns a longitude that needs no shift exactly', () => {
    expect(unwrapLongitude(-73.78, -71.01)).toBe(-73.78);
  });

  it('shifts across the antimeridian to stay near the previous longitude', () => {
    expect(unwrapLongitude(-179, 179)).toBe(181);
    expect(unwrapLongitude(179, -179)).toBe(-181);
  });

  it('follows a path that has already been unwrapped', () => {
    expect(unwrapLongitude(-170, 185)).toBe(190);
  });
});

describe('toWaypointCollection', () => {
  it('maps points to [lon, lat] features carrying their label, in route order', () => {
    const points: RoutePoint[] = [
      { label: 'KJFK', lat: 40.6, lon: -73.7 },
      { label: 'MERIT', lat: 40.5, lon: -73.0 },
    ];
    const fc = toWaypointCollection(points);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0]?.geometry.coordinates).toEqual([-73.7, 40.6]);
    expect(fc.features[0]?.properties).toEqual({ label: 'KJFK' });
    expect(fc.features[1]?.properties).toEqual({ label: 'MERIT' });
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
