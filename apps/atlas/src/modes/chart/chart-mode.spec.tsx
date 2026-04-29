import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ChartMode } from './chart-mode.tsx';
import { AIRPORTS_LAYER_ID } from './layers/airports-layer.tsx';
import { NAVAIDS_LAYER_ID } from './layers/navaids-layer.tsx';
import { FIXES_LAYER_ID } from './layers/fixes-layer.tsx';
import { AIRWAYS_LAYER_ID } from './layers/airways-layer.tsx';
import { AIRSPACE_FILL_LAYER_ID, AIRSPACE_LINE_LAYER_ID } from './layers/airspace-layer.tsx';
import type { ChartSearch } from './url-state.ts';

/**
 * Captures the most recent `onMapClick` prop the test passes to the
 * mocked MapCanvas. Tests fire it with a synthetic MapLibre click
 * event so the click-handler logic in `chart-mode.tsx` runs against
 * a controllable Map stub.
 */
const onMapClickRef: { current: ((event: unknown) => void) | undefined } = {
  current: undefined,
};

const { useSearchMock, useNavigateMock, navigateMock } = vi.hoisted(() => ({
  useSearchMock: vi.fn(),
  useNavigateMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({ useSearch: useSearchMock }),
  useNavigate: useNavigateMock,
}));

vi.mock('@vis.gl/react-maplibre', () => ({
  MapProvider: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
}));

// MapCanvas: capture the onMapClick callback so the test can fire it
// with a controlled fake event. Render its children so any nested
// layer components mount (they're all stubbed below). `importOriginal`
// preserves the module's other exports (MAP_MAX_PITCH, view-state types)
// that other modules in the chart subtree pull from this file.
vi.mock('../../shared/map/map-canvas.tsx', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('../../shared/map/map-canvas.tsx');
  return {
    ...actual,
    MapCanvas: ({
      onMapClick,
      children,
    }: {
      onMapClick?: (event: unknown) => void;
      children?: ReactNode;
    }): ReactElement => {
      onMapClickRef.current = onMapClick;
      return <div data-testid="map-canvas">{children}</div>;
    },
  };
});

// Render-noop stubs for the surrounding chrome and overlay components
// so the test can mount <ChartMode /> without dragging in their real
// dependencies (MapLibre, datasets, etc).
vi.mock('../../shared/map/zoom-controls.tsx', () => ({ ZoomControls: () => null }));
vi.mock('../../shared/inspector/inspector.tsx', () => ({ EntityInspector: () => null }));
vi.mock('./chart-loading-indicator.tsx', () => ({ ChartLoadingIndicator: () => null }));
vi.mock('./disambiguation-popover.tsx', () => ({ DisambiguationPopover: () => null }));
vi.mock('./highlight-provider.tsx', () => ({
  HighlightProvider: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
}));
vi.mock('./inspectable-cursor.tsx', () => ({ InspectableHoverCursor: () => null }));
vi.mock('./view-reset-listener.tsx', () => ({ ChartViewResetListener: () => null }));
vi.mock('./layer-toggle.tsx', () => ({ LayerToggle: () => null }));
vi.mock('./layers/airports-layer.tsx', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('./layers/airports-layer.tsx');
  return { ...actual, AirportsLayer: () => null };
});
vi.mock('./layers/airspace-layer.tsx', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('./layers/airspace-layer.tsx');
  return {
    ...actual,
    AirspaceLayer: () => null,
    AirspaceExtrusionLayer: () => null,
    AirspaceFeatureOverlayLayers: () => null,
  };
});
vi.mock('./layers/airways-layer.tsx', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('./layers/airways-layer.tsx');
  return { ...actual, AirwaysLayer: () => null };
});
vi.mock('./layers/fixes-layer.tsx', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('./layers/fixes-layer.tsx');
  return { ...actual, FixesLayer: () => null };
});
vi.mock('./layers/navaids-layer.tsx', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('./layers/navaids-layer.tsx');
  return { ...actual, NavaidsLayer: () => null };
});

const DEFAULT_SEARCH: ChartSearch = {
  lat: 39.5,
  lon: -98.5,
  zoom: 4,
  pitch: 0,
  layers: ['airports', 'navaids', 'fixes', 'airways', 'airspace'],
  airspaceClasses: [
    'CLASS_B',
    'CLASS_C',
    'CLASS_D',
    'CLASS_E',
    'MOA',
    'RESTRICTED',
    'PROHIBITED',
    'WARNING',
    'ALERT',
    'NSA',
    'ARTCC',
  ],
  airwayCategories: ['LOW', 'HIGH', 'OCEANIC'],
};

/**
 * Build a fake `MapLayerMouseEvent`-shaped object with a `target` map
 * stub whose `getLayer` and `queryRenderedFeatures` behave the way
 * tests need. `registeredLayerIds` enumerates which layer ids the
 * map's style currently has; `getLayer` returns a truthy stub for
 * those and `undefined` for others.
 *
 * Mirrors the real-MapLibre throw: passing a non-registered layer id
 * to `queryRenderedFeatures` raises an error.
 */
function buildClickEvent(
  registeredLayerIds: readonly string[],
  queriedFeatures: unknown[] = [],
  zoom = 12,
) {
  const queryRenderedFeatures = vi.fn((_bbox: unknown, options: { layers?: string[] }) => {
    const requested = options.layers ?? [];
    for (const id of requested) {
      if (!registeredLayerIds.includes(id)) {
        throw new Error(
          `The layer '${id}' does not exist in the map's style and cannot be queried for features.`,
        );
      }
    }
    return queriedFeatures;
  });
  const target = {
    getLayer: vi.fn((id: string) => (registeredLayerIds.includes(id) ? { id } : undefined)),
    getZoom: vi.fn(() => zoom),
    queryRenderedFeatures,
  };
  return {
    event: { point: { x: 100, y: 100 }, target },
    queryRenderedFeatures,
    getLayer: target.getLayer,
    getZoom: target.getZoom,
  };
}

describe('ChartMode', () => {
  beforeEach(() => {
    onMapClickRef.current = undefined;
    useSearchMock.mockReturnValue(DEFAULT_SEARCH);
    useNavigateMock.mockReturnValue(navigateMock);
    navigateMock.mockReset();
  });

  it('does not throw when a click happens before a layer has registered (race during initial dataset load)', () => {
    render(<ChartMode />);
    const clickHandler = onMapClickRef.current;
    expect(clickHandler).toBeDefined();

    // Only the airports layer is registered yet (e.g. its dataset
    // resolved first; the others are still loading and their layer
    // components rendered null).
    const { event, queryRenderedFeatures } = buildClickEvent([AIRPORTS_LAYER_ID]);

    // The bug this regression test pins: previously the click handler
    // passed every id from INSPECTABLE_LAYER_IDS, which made
    // `queryRenderedFeatures` throw for the not-yet-registered layers
    // and crashed the click flow.
    expect(() => clickHandler?.(event)).not.toThrow();

    // The click handler should have queried only the registered layer.
    expect(queryRenderedFeatures).toHaveBeenCalledTimes(1);
    const callArgs = queryRenderedFeatures.mock.calls[0]?.[1];
    expect(callArgs?.layers).toEqual([AIRPORTS_LAYER_ID]);
  });

  it('queries every inspectable layer once they are all registered', () => {
    render(<ChartMode />);
    const clickHandler = onMapClickRef.current;
    expect(clickHandler).toBeDefined();

    const { event, queryRenderedFeatures } = buildClickEvent([
      AIRPORTS_LAYER_ID,
      NAVAIDS_LAYER_ID,
      FIXES_LAYER_ID,
      AIRWAYS_LAYER_ID,
      AIRSPACE_FILL_LAYER_ID,
      AIRSPACE_LINE_LAYER_ID,
    ]);

    expect(() => clickHandler?.(event)).not.toThrow();
    expect(queryRenderedFeatures).toHaveBeenCalledTimes(1);
    const callArgs = queryRenderedFeatures.mock.calls[0]?.[1];
    expect(callArgs?.layers).toEqual(
      expect.arrayContaining([
        AIRPORTS_LAYER_ID,
        NAVAIDS_LAYER_ID,
        FIXES_LAYER_ID,
        AIRWAYS_LAYER_ID,
        AIRSPACE_FILL_LAYER_ID,
        AIRSPACE_LINE_LAYER_ID,
      ]),
    );
  });

  it('uses a zero-radius point query at low zoom', () => {
    render(<ChartMode />);
    const clickHandler = onMapClickRef.current;
    expect(clickHandler).toBeDefined();

    const { event, queryRenderedFeatures } = buildClickEvent([AIRPORTS_LAYER_ID], [], 4);
    clickHandler?.(event);

    // At zoom 4 the bbox collapses to a single pixel: every corner of
    // the query bbox equals the click point. This keeps low-zoom
    // clicks from sweeping in dozens of unrelated features that share
    // the click radius across thousands of square miles.
    expect(queryRenderedFeatures).toHaveBeenCalledTimes(1);
    const bbox = queryRenderedFeatures.mock.calls[0]?.[0] as [[number, number], [number, number]];
    expect(bbox[0]).toEqual([100, 100]);
    expect(bbox[1]).toEqual([100, 100]);
  });

  it('uses the full 10-pixel bbox at high zoom', () => {
    render(<ChartMode />);
    const clickHandler = onMapClickRef.current;
    expect(clickHandler).toBeDefined();

    const { event, queryRenderedFeatures } = buildClickEvent([AIRPORTS_LAYER_ID], [], 12);
    clickHandler?.(event);

    expect(queryRenderedFeatures).toHaveBeenCalledTimes(1);
    const bbox = queryRenderedFeatures.mock.calls[0]?.[0] as [[number, number], [number, number]];
    expect(bbox[0]).toEqual([90, 90]);
    expect(bbox[1]).toEqual([110, 110]);
  });

  it('skips the query entirely when no inspectable layer is registered yet', () => {
    render(<ChartMode />);
    const clickHandler = onMapClickRef.current;
    expect(clickHandler).toBeDefined();

    const { event, queryRenderedFeatures } = buildClickEvent([]);

    expect(() => clickHandler?.(event)).not.toThrow();
    // No layers registered -> no point asking; the URL should not
    // change either.
    expect(queryRenderedFeatures).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
