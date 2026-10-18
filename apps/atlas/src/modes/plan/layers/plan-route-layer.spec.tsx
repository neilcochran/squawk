import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { RouteLeg, RoutePoint } from '@squawk/flightplan/browser';

import {
  PLAN_ROUTE_INVALID_LINE_LAYER_ID,
  PLAN_ROUTE_LINE_LAYER_ID,
  PLAN_WAYPOINTS_LABEL_LAYER_ID,
  PLAN_WAYPOINTS_LAYER_ID,
} from './plan-route-features.ts';
import { PlanRouteLayer } from './plan-route-layer.tsx';

const { layerPropsLog } = vi.hoisted(() => ({
  layerPropsLog: [] as Array<Record<string, unknown>>,
}));

vi.mock('@vis.gl/react-maplibre', () => ({
  Source: ({ children }: { children?: ReactNode }): ReactElement => (
    <div data-testid="maplibre-source">{children}</div>
  ),
  Layer: (props: Record<string, unknown>): null => {
    layerPropsLog.push(props);
    return null;
  },
}));

const POINTS: RoutePoint[] = [
  { label: 'KJFK', lat: 40.6, lon: -73.7 },
  { label: 'KLAX', lat: 34.0, lon: -118.4 },
];

const LEGS: RouteLeg[] = [
  {
    from: 'KJFK',
    to: 'KLAX',
    fromLat: 40.6,
    fromLon: -73.7,
    toLat: 34.0,
    toLon: -118.4,
    distanceNm: 2150,
    cumulativeDistanceNm: 2150,
    crossesGap: false,
    unusable: false,
    procedureAirportMismatch: false,
  },
];

describe('PlanRouteLayer', () => {
  beforeEach(() => {
    layerPropsLog.length = 0;
  });

  it('renders a leg source and a waypoint source', () => {
    const { getAllByTestId } = render(<PlanRouteLayer points={POINTS} legs={LEGS} />);
    expect(getAllByTestId('maplibre-source')).toHaveLength(2);
  });

  it('registers the valid and invalid leg layers, the waypoint, and the label layers', () => {
    render(<PlanRouteLayer points={POINTS} legs={LEGS} />);
    const ids = layerPropsLog.map((props) => props.id);
    expect(ids).toContain(PLAN_ROUTE_LINE_LAYER_ID);
    expect(ids).toContain(PLAN_ROUTE_INVALID_LINE_LAYER_ID);
    expect(ids).toContain(PLAN_WAYPOINTS_LAYER_ID);
    expect(ids).toContain(PLAN_WAYPOINTS_LABEL_LAYER_ID);
  });

  it('still mounts the line layer when the route has no legs', () => {
    render(<PlanRouteLayer points={POINTS} legs={[]} />);
    expect(layerPropsLog.some((props) => props.id === PLAN_ROUTE_LINE_LAYER_ID)).toBe(true);
  });

  it('splits the legs between the two line layers by status', () => {
    render(<PlanRouteLayer points={POINTS} legs={LEGS} />);
    const valid = layerPropsLog.find((props) => props.id === PLAN_ROUTE_LINE_LAYER_ID);
    const invalid = layerPropsLog.find((props) => props.id === PLAN_ROUTE_INVALID_LINE_LAYER_ID);
    expect(valid?.filter).toEqual(['==', ['get', 'status'], 'valid']);
    expect(invalid?.filter).toEqual(['!=', ['get', 'status'], 'valid']);
  });
});
