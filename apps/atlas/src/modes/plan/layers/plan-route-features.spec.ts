import type { LineString } from 'geojson';
import { describe, it, expect } from 'vitest';

import type { RoutePoint } from '@squawk/flightplan/browser';

import {
  PLAN_ROUTE_LINE_LAYER_ID,
  PLAN_WAYPOINTS_LABEL_LAYER_ID,
  PLAN_WAYPOINTS_LAYER_ID,
  toRouteLineCollection,
  toWaypointCollection,
} from './plan-route-features.ts';

describe('toRouteLineCollection', () => {
  it('returns an empty collection when the line is undefined', () => {
    expect(toRouteLineCollection(undefined).features).toEqual([]);
  });

  it('wraps a LineString in a single feature', () => {
    const line: LineString = {
      type: 'LineString',
      coordinates: [
        [-71, 42],
        [-70, 43],
      ],
    };
    const fc = toRouteLineCollection(line);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]?.geometry).toBe(line);
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
    expect(PLAN_WAYPOINTS_LAYER_ID).toBe('atlas-plan-waypoints-circle');
    expect(PLAN_WAYPOINTS_LABEL_LAYER_ID).toBe('atlas-plan-waypoints-label');
  });
});
