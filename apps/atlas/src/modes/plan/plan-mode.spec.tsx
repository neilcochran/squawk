import { render, screen, act } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PlanMode } from './plan-mode.tsx';
import type { PlanRoute } from './plan-route.ts';
import type { PlanSearch } from './url-state.ts';
import type { PlanResolverState } from './use-plan-resolver.ts';

const onViewStateChangeRef: { current: ((view: unknown) => void) | undefined } = {
  current: undefined,
};
const routeInputRef: { current: { value: string; onCommit: (route: string) => void } | undefined } =
  { current: undefined };
const summaryRef: {
  current:
    | {
        loading: boolean;
        onGroundSpeedChange: (gs: number | undefined) => void;
        sheetRef: unknown;
      }
    | undefined;
} = { current: undefined };
const layerRef: { current: { points: unknown; legs: unknown } | undefined } = {
  current: undefined,
};
const framerRef: {
  current: { request: unknown; routeInputRef: unknown; sheetRef: unknown } | undefined;
} = { current: undefined };

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
vi.mock('../../shared/map/view-reset-listener.tsx', () => ({ ViewResetListener: () => null }));

vi.mock('./layers/plan-route-layer.tsx', () => ({
  PlanRouteLayer: (props: { points: unknown; legs: unknown }): ReactElement => {
    layerRef.current = props;
    return <div data-testid="plan-route-layer" />;
  },
}));

vi.mock('./plan-route-framer.tsx', () => ({
  PlanRouteFramer: (props: {
    request: unknown;
    routeInputRef: unknown;
    sheetRef: unknown;
  }): null => {
    framerRef.current = props;
    return null;
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
    loading: boolean;
    onGroundSpeedChange: (gs: number | undefined) => void;
    sheetRef: unknown;
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

const READY: PlanResolverState = { status: 'ready', resolver: { parse: vi.fn() }, failed: [] };

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
    framerRef.current = undefined;
    useSearchMock.mockReturnValue(DEFAULT_SEARCH);
    useNavigateMock.mockReturnValue(navigateMock);
    navigateMock.mockReset();
    usePlanResolverMock.mockReturnValue(READY);
    usePlanRouteMock.mockReturnValue(undefined);
  });

  it('commits a new route string to the URL', () => {
    render(<PlanMode />);
    act(() => routeInputRef.current?.onCommit('KJFK DCT KLAX'));
    expect(navigateMock).toHaveBeenCalledTimes(1);
    const search = navigateMock.mock.calls[0]?.[0]?.search;
    expect(search({ route: '' }).route).toBe('KJFK DCT KLAX');
  });

  it('asks to frame a committed route', () => {
    render(<PlanMode />);
    expect(framerRef.current?.request).toBeUndefined();
    act(() => routeInputRef.current?.onCommit('KJFK DCT KLAX'));
    expect(framerRef.current?.request).toEqual({ route: 'KJFK DCT KLAX' });
  });

  it('does not ask to frame a cleared route', () => {
    useSearchMock.mockReturnValue({ ...DEFAULT_SEARCH, lat: 41, route: 'KJFK DCT KLAX' });
    render(<PlanMode />);
    act(() => routeInputRef.current?.onCommit(''));
    expect(framerRef.current?.request).toBeUndefined();
  });

  it('asks to frame a share-link route that opens on the default camera', () => {
    useSearchMock.mockReturnValue({ ...DEFAULT_SEARCH, route: ' KBOS DCT KJFK ' });
    render(<PlanMode />);
    expect(framerRef.current?.request).toEqual({ route: 'KBOS DCT KJFK' });
  });

  it('keeps the camera of a share link that carries its own', () => {
    useSearchMock.mockReturnValue({ ...DEFAULT_SEARCH, zoom: 7, route: 'KBOS DCT KJFK' });
    render(<PlanMode />);
    expect(framerRef.current?.request).toBeUndefined();
  });

  it('hands the framer the route input bar to keep the route below', () => {
    render(<PlanMode />);
    expect(framerRef.current?.routeInputRef).toEqual({ current: null });
  });

  it('hands the framer the same sheet ref the summary panel attaches to', () => {
    render(<PlanMode />);
    expect(framerRef.current?.sheetRef).toBeDefined();
    expect(framerRef.current?.sheetRef).toBe(summaryRef.current?.sheetRef);
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
    usePlanResolverMock.mockReturnValue({ status: 'loading' });
    render(<PlanMode />);
    expect(screen.getByText(/loading aeronautical data/i)).toBeInTheDocument();
  });

  it('hides the loading badge once the resolver is ready', () => {
    render(<PlanMode />);
    expect(screen.queryByText(/loading aeronautical data/i)).not.toBeInTheDocument();
  });

  it('names a failed dataset once the rest have loaded', () => {
    usePlanResolverMock.mockReturnValue({ ...READY, failed: ['procedures'] });
    render(<PlanMode />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load procedures.");
  });

  it('parses against the resolver from the ready state', () => {
    render(<PlanMode />);
    expect(usePlanRouteMock).toHaveBeenLastCalledWith(READY.resolver, '', undefined);
  });

  it('does not parse while the resolver is loading', () => {
    usePlanResolverMock.mockReturnValue({ status: 'loading' });
    render(<PlanMode />);
    expect(usePlanRouteMock).toHaveBeenLastCalledWith(undefined, '', undefined);
  });

  it('flags the summary as loading when a route is waiting on the data', () => {
    usePlanResolverMock.mockReturnValue({ status: 'loading' });
    useSearchMock.mockReturnValue({ ...DEFAULT_SEARCH, route: 'KBOS DCT KJFK' });
    render(<PlanMode />);
    expect(summaryRef.current?.loading).toBe(true);
  });

  it('does not flag the summary as loading when there is no route', () => {
    usePlanResolverMock.mockReturnValue({ status: 'loading' });
    render(<PlanMode />);
    expect(summaryRef.current?.loading).toBe(false);
  });

  it('does not flag the summary as loading once the data is ready', () => {
    useSearchMock.mockReturnValue({ ...DEFAULT_SEARCH, route: 'KBOS DCT KJFK' });
    render(<PlanMode />);
    expect(summaryRef.current?.loading).toBe(false);
  });
});
