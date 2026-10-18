import { render, screen, act } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PlanMode } from './plan-mode.tsx';
import type { PlanRoute } from './plan-route.ts';
import type { PlanSearch } from './url-state.ts';

const onViewStateChangeRef: { current: ((view: unknown) => void) | undefined } = {
  current: undefined,
};
const routeInputRef: { current: { value: string; onCommit: (route: string) => void } | undefined } =
  { current: undefined };
const summaryRef: {
  current: { onGroundSpeedChange: (gs: number | undefined) => void } | undefined;
} = { current: undefined };
const layerRef: { current: { points: unknown; legs: unknown } | undefined } = {
  current: undefined,
};

const { useSearchMock, useNavigateMock, navigateMock, usePlanResolverMock, usePlanRouteMock } =
  vi.hoisted(() => ({
    useSearchMock: vi.fn(),
    useNavigateMock: vi.fn(),
    navigateMock: vi.fn(),
    usePlanResolverMock: vi.fn(),
    usePlanRouteMock: vi.fn(),
  }));

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({ useSearch: useSearchMock }),
  useNavigate: useNavigateMock,
}));

vi.mock('@vis.gl/react-maplibre', () => ({
  MapProvider: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
}));

vi.mock('../../shared/map/map-canvas.tsx', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('../../shared/map/map-canvas.tsx');
  return {
    ...actual,
    MapCanvas: ({
      onViewStateChange,
      children,
    }: {
      onViewStateChange?: (view: unknown) => void;
      children?: ReactNode;
    }): ReactElement => {
      onViewStateChangeRef.current = onViewStateChange;
      return <div data-testid="map-canvas">{children}</div>;
    },
  };
});

vi.mock('../../shared/map/zoom-controls.tsx', () => ({ ZoomControls: () => null }));

vi.mock('./layers/plan-route-layer.tsx', () => ({
  PlanRouteLayer: (props: { points: unknown; legs: unknown }): ReactElement => {
    layerRef.current = props;
    return <div data-testid="plan-route-layer" />;
  },
}));

vi.mock('./plan-route-input.tsx', () => ({
  PlanRouteInput: (props: { value: string; onCommit: (route: string) => void }): ReactElement => {
    routeInputRef.current = props;
    return <div data-testid="plan-route-input" />;
  },
}));

vi.mock('./plan-summary-panel.tsx', () => ({
  PlanSummaryPanel: (props: {
    onGroundSpeedChange: (gs: number | undefined) => void;
  }): ReactElement => {
    summaryRef.current = props;
    return <div data-testid="plan-summary-panel" />;
  },
}));

vi.mock('./use-plan-resolver.ts', () => ({ usePlanResolver: usePlanResolverMock }));
vi.mock('./use-plan-route.ts', () => ({ usePlanRoute: usePlanRouteMock }));

const DEFAULT_SEARCH: PlanSearch = {
  lat: 39.5,
  lon: -98.5,
  zoom: 4,
  pitch: 0,
  route: '',
  gs: undefined,
};

const SAMPLE_ROUTE: PlanRoute = {
  parsed: { raw: 'A B', elements: [] },
  points: [{ label: 'A', lat: 0, lon: 0 }],
  distance: {
    legs: [],
    totalDistanceNm: 0,
    estimatedTimeEnrouteHrs: undefined,
    unresolvedElements: [],
  },
  issues: [],
};

describe('PlanMode', () => {
  beforeEach(() => {
    onViewStateChangeRef.current = undefined;
    routeInputRef.current = undefined;
    summaryRef.current = undefined;
    layerRef.current = undefined;
    useSearchMock.mockReturnValue(DEFAULT_SEARCH);
    useNavigateMock.mockReturnValue(navigateMock);
    navigateMock.mockReset();
    usePlanResolverMock.mockReturnValue({ parse: vi.fn() });
    usePlanRouteMock.mockReturnValue(undefined);
  });

  it('commits a new route string to the URL', () => {
    render(<PlanMode />);
    act(() => routeInputRef.current?.onCommit('KJFK DCT KLAX'));
    expect(navigateMock).toHaveBeenCalledTimes(1);
    const search = navigateMock.mock.calls[0]?.[0]?.search;
    expect(search({ route: '' }).route).toBe('KJFK DCT KLAX');
  });

  it('writes the ground speed to the URL', () => {
    render(<PlanMode />);
    act(() => summaryRef.current?.onGroundSpeedChange(450));
    const search = navigateMock.mock.calls[0]?.[0]?.search;
    expect(search({ gs: undefined }).gs).toBe(450);
  });

  it('writes the view state to the URL on move-end', () => {
    render(<PlanMode />);
    act(() => onViewStateChangeRef.current?.({ lat: 41, lon: -71, zoom: 8, pitch: 0 }));
    const search = navigateMock.mock.calls[0]?.[0]?.search;
    expect(search({})).toMatchObject({ lat: 41, lon: -71, zoom: 8, pitch: 0 });
  });

  it('draws the route layer when a route is resolved', () => {
    usePlanRouteMock.mockReturnValue(SAMPLE_ROUTE);
    render(<PlanMode />);
    expect(screen.getByTestId('plan-route-layer')).toBeInTheDocument();
    expect(layerRef.current?.points).toEqual(SAMPLE_ROUTE.points);
    expect(layerRef.current?.legs).toBe(SAMPLE_ROUTE.distance.legs);
  });

  it('does not draw the route layer when no route is resolved', () => {
    usePlanRouteMock.mockReturnValue(undefined);
    render(<PlanMode />);
    expect(screen.queryByTestId('plan-route-layer')).not.toBeInTheDocument();
  });

  it('shows the loading badge while the resolver is not ready', () => {
    usePlanResolverMock.mockReturnValue(undefined);
    render(<PlanMode />);
    expect(screen.getByText(/loading aeronautical data/i)).toBeInTheDocument();
  });

  it('hides the loading badge once the resolver is ready', () => {
    usePlanResolverMock.mockReturnValue({ parse: vi.fn() });
    render(<PlanMode />);
    expect(screen.queryByText(/loading aeronautical data/i)).not.toBeInTheDocument();
  });
});
