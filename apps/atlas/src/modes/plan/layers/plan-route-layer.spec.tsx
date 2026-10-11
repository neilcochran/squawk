import { render } from '@testing-library/react';
import type { LineString } from 'geojson';
import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { RoutePoint } from '@squawk/flightplan/browser';

import {
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

const LINE: LineString = {
  type: 'LineString',
  coordinates: [
    [-73.7, 40.6],
    [-118.4, 34.0],
  ],
};

describe('PlanRouteLayer', () => {
  beforeEach(() => {
    layerPropsLog.length = 0;
  });

  it('renders a line source and a waypoint source', () => {
    const { getAllByTestId } = render(<PlanRouteLayer points={POINTS} line={LINE} />);
    expect(getAllByTestId('maplibre-source')).toHaveLength(2);
  });

  it('registers the line, waypoint, and label layers', () => {
    render(<PlanRouteLayer points={POINTS} line={LINE} />);
    const ids = layerPropsLog.map((props) => props.id);
    expect(ids).toContain(PLAN_ROUTE_LINE_LAYER_ID);
    expect(ids).toContain(PLAN_WAYPOINTS_LAYER_ID);
    expect(ids).toContain(PLAN_WAYPOINTS_LABEL_LAYER_ID);
  });

  it('still mounts the line layer when the line is undefined', () => {
    render(<PlanRouteLayer points={POINTS} line={undefined} />);
    expect(layerPropsLog.some((props) => props.id === PLAN_ROUTE_LINE_LAYER_ID)).toBe(true);
  });
});
