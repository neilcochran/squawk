import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  AIRSPACE_FLOOR_REF_PROPERTY,
  AIRSPACE_MATCH_KEY_PROPERTY,
} from '../../../shared/inspector/airspace-feature.ts';

import { AIRPORTS_HIGHLIGHT_LAYER_ID } from './airports-layer.tsx';
import { FT_TO_METERS, buildExtrusionHeightExpression } from './airspace-extrusion-scale.ts';
import {
  AIRSPACE_FEATURE_FOCUS_LAYER_ID,
  AIRSPACE_FILL_EXTRUSION_LAYER_ID,
  AIRSPACE_FILL_LAYER_ID,
  AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID,
  AIRSPACE_HIGHLIGHT_FILL_LAYER_ID,
  AIRSPACE_HIGHLIGHT_LAYER_ID,
  AIRSPACE_LINE_LAYER_ID,
  AirspaceExtrusionLayer,
  AirspaceFeatureOverlayLayers,
  AirspaceLayer,
} from './airspace-layer.tsx';
import { AIRSPACE_FEATURE_INDEX_PROPERTY } from './airspace-source-projection.ts';
import { AIRWAYS_HIGHLIGHT_LAYER_ID } from './airways-layer.tsx';
import { FIXES_HIGHLIGHT_LAYER_ID } from './fixes-layer.tsx';
import { NAVAIDS_HIGHLIGHT_LAYER_ID } from './navaids-layer.tsx';

const {
  useAirspaceDatasetMock,
  useSearchMock,
  useActiveHighlightRefMock,
  useHoveredFeatureIndexMock,
  useTopOfStackMock,
  layerPropsLog,
} = vi.hoisted(() => ({
  useAirspaceDatasetMock: vi.fn(),
  useSearchMock: vi.fn(),
  useActiveHighlightRefMock: vi.fn(),
  useHoveredFeatureIndexMock: vi.fn(),
  useTopOfStackMock: vi.fn(),
  layerPropsLog: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../../shared/data/airspace-dataset.ts', () => ({
  useAirspaceDataset: useAirspaceDatasetMock,
}));

vi.mock('../highlight-context.ts', () => ({
  useActiveHighlightRef: useActiveHighlightRefMock,
  useHoveredFeatureIndex: useHoveredFeatureIndexMock,
}));

// Capture the layer-id order handed to the top-of-stack hook so the
// draw order between the 2D overlays, the 3D boxes, and the point
// highlights can be asserted without a live map.
vi.mock('./use-top-of-stack.ts', () => ({
  useTopOfStack: useTopOfStackMock,
}));

// Mock the chart route api so `route.useSearch()` returns a controlled
// search-param shape without needing a TanStack router context.
vi.mock('@tanstack/react-router', () => ({
  getRouteApi: (): { useSearch: typeof useSearchMock } => ({ useSearch: useSearchMock }),
}));

// Stub MapLibre primitives. `Source` renders its children inside a
// findable container so the test can assert the layer mounted; `Layer`
// records the props it receives so tests can assert paint / filter
// values without a live map context. `useMap` is exported so the
// hatch-pattern and map-zoom hooks can resolve their map ref to
// undefined and short-circuit cleanly (the zoom hook then falls back
// to the URL zoom).
vi.mock('@vis.gl/react-maplibre', () => ({
  Source: ({ children }: { children?: ReactNode }): ReactElement => (
    <div data-testid="maplibre-source">{children}</div>
  ),
  Layer: (props: Record<string, unknown>): null => {
    layerPropsLog.push(props);
    return null;
  },
  useMap: (): { current: undefined; default: undefined } => ({
    current: undefined,
    default: undefined,
  }),
}));

const LOADED_DATASET = {
  status: 'loaded' as const,
  dataset: {
    type: 'FeatureCollection',
    features: [],
    properties: {
      nasrCycleDate: '2026-01-22',
      generatedAt: '2026-01-22T00:00:00Z',
      featureCount: 0,
    },
  },
};

const CLASS_B_SELECTION = { type: 'airspace', id: 'CLASS_B/JFK' };

/** Type filter the layers build for a `['CLASS_B']` airspace-class set. */
const CLASS_B_TYPE_FILTER = ['in', ['get', 'type'], ['literal', ['CLASS_B']]];

/** Match-key equality the selection overlays build for {@link CLASS_B_SELECTION}. */
const CLASS_B_SELECTION_MATCH = ['==', ['get', AIRSPACE_MATCH_KEY_PROPERTY], 'CLASS_B/JFK'];

/**
 * Clause the ground-level layers add once the camera tilts: only
 * features whose floor datum the 3D extrusion anchors at the surface
 * keep a footprint on the ground.
 */
const GROUND_ANCHORED_CLAUSE = [
  'in',
  ['get', AIRSPACE_FLOOR_REF_PROPERTY],
  ['literal', ['SFC', 'AGL']],
];

/** Reads the recorded props of the MapLibre `Layer` with the given id. */
function recordedLayer(id: string): Record<string, unknown> | undefined {
  return layerPropsLog.find((props) => props.id === id);
}

/** Reads the `filter` prop of the recorded MapLibre `Layer` with the given id. */
function recordedFilter(id: string): unknown {
  return recordedLayer(id)?.filter;
}

/** Reads one paint property off the recorded MapLibre `Layer` with the given id. */
function recordedPaint(id: string, property: string): unknown {
  const paint = recordedLayer(id)?.paint;
  if (typeof paint !== 'object' || paint === null) {
    return undefined;
  }
  return Object.entries(paint).find(([key]) => key === property)?.[1];
}

/** Reads the `layout.visibility` of the recorded MapLibre `Layer` with the given id. */
function recordedVisibility(id: string): unknown {
  const layout = recordedLayer(id)?.layout;
  if (typeof layout !== 'object' || layout === null) {
    return undefined;
  }
  return Object.entries(layout).find(([key]) => key === 'visibility')?.[1];
}

describe('AirspaceLayer', () => {
  beforeEach(() => {
    useActiveHighlightRefMock.mockReturnValue(undefined);
    useHoveredFeatureIndexMock.mockReturnValue(undefined);
    layerPropsLog.length = 0;
  });

  it('exports stable MapLibre layer ids consumed by chart-mode click handling and stacking', () => {
    expect(AIRSPACE_FILL_LAYER_ID).toBe('atlas-airspace-fill');
    expect(AIRSPACE_LINE_LAYER_ID).toBe('atlas-airspace-line');
    expect(AIRSPACE_FILL_EXTRUSION_LAYER_ID).toBe('atlas-airspace-fill-extrusion');
    expect(AIRSPACE_HIGHLIGHT_LAYER_ID).toBe('atlas-airspace-highlight');
    expect(AIRSPACE_HIGHLIGHT_FILL_LAYER_ID).toBe('atlas-airspace-highlight-fill');
    expect(AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID).toBe('atlas-airspace-highlight-extrusion');
    expect(AIRSPACE_FEATURE_FOCUS_LAYER_ID).toBe('atlas-airspace-feature-focus');
  });

  it('draws every enabled airspace footprint and the whole selection in plan view', () => {
    useActiveHighlightRefMock.mockReturnValue(CLASS_B_SELECTION);
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 0, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceLayer />);
    expect(recordedFilter(AIRSPACE_FILL_LAYER_ID)).toEqual(CLASS_B_TYPE_FILTER);
    expect(recordedFilter(AIRSPACE_LINE_LAYER_ID)).toEqual(CLASS_B_TYPE_FILTER);
    expect(recordedFilter(AIRSPACE_HIGHLIGHT_FILL_LAYER_ID)).toEqual(CLASS_B_SELECTION_MATCH);
    expect(recordedFilter(AIRSPACE_HIGHLIGHT_LAYER_ID)).toEqual(CLASS_B_SELECTION_MATCH);
  });

  it('keeps only ground-anchored footprints and selection overlays once the camera tilts', () => {
    useActiveHighlightRefMock.mockReturnValue(CLASS_B_SELECTION);
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 45, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceLayer />);
    const groundedTypeFilter = ['all', CLASS_B_TYPE_FILTER, GROUND_ANCHORED_CLAUSE];
    const groundedSelection = ['all', CLASS_B_SELECTION_MATCH, GROUND_ANCHORED_CLAUSE];
    expect(recordedFilter(AIRSPACE_FILL_LAYER_ID)).toEqual(groundedTypeFilter);
    expect(recordedFilter(AIRSPACE_LINE_LAYER_ID)).toEqual(groundedTypeFilter);
    expect(recordedFilter(AIRSPACE_HIGHLIGHT_FILL_LAYER_ID)).toEqual(groundedSelection);
    expect(recordedFilter(AIRSPACE_HIGHLIGHT_LAYER_ID)).toEqual(groundedSelection);
  });

  it('matches nothing in the selection overlays when the active entity is not an airspace', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'airport', id: 'BOS' });
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B', 'CLASS_E'], pitch: 45, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceLayer />);
    const noMatch = ['==', ['get', AIRSPACE_MATCH_KEY_PROPERTY], expect.any(String)];
    expect(recordedFilter(AIRSPACE_HIGHLIGHT_FILL_LAYER_ID)).toEqual(noMatch);
    expect(recordedFilter(AIRSPACE_HIGHLIGHT_LAYER_ID)).toEqual(noMatch);
  });

  it('returns null while the airspace dataset is still loading', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 0, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue({ status: 'loading' });
    const { container } = render(<AirspaceLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when the airspace dataset load errored', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 0, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue({ status: 'error', error: new Error('fetch failed') });
    const { container } = render(<AirspaceLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a MapLibre source once the dataset resolves', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 0, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    const { getByTestId } = render(<AirspaceLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });
});

describe('AirspaceExtrusionLayer', () => {
  beforeEach(() => {
    useActiveHighlightRefMock.mockReturnValue(undefined);
    useHoveredFeatureIndexMock.mockReturnValue(undefined);
    layerPropsLog.length = 0;
  });

  it('returns null while the airspace dataset is still loading', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 60, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue({ status: 'loading' });
    const { container } = render(<AirspaceExtrusionLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides both boxes in plan view and shows them once the camera tilts', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 0, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceExtrusionLayer />);
    expect(recordedVisibility(AIRSPACE_FILL_EXTRUSION_LAYER_ID)).toBe('none');
    expect(recordedVisibility(AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID)).toBe('none');

    layerPropsLog.length = 0;
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 45, zoom: 8 });
    render(<AirspaceExtrusionLayer />);
    expect(recordedVisibility(AIRSPACE_FILL_EXTRUSION_LAYER_ID)).toBe('visible');
    expect(recordedVisibility(AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID)).toBe('visible');
  });

  it('bakes the zoom exaggeration into the heights as a constant with no zoom expression', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 45, zoom: 4 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceExtrusionLayer />);
    const height = recordedPaint(AIRSPACE_FILL_EXTRUSION_LAYER_ID, 'fill-extrusion-height');
    expect(JSON.stringify(height)).not.toContain('zoom');
    // Zoom 4 is the 20x stop of the exaggeration curve.
    expect(height).toEqual(buildExtrusionHeightExpression(20));
    // The selection box draws with the same heights, so it can never
    // poke out of or sink into the regular box it replaces.
    expect(recordedPaint(AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID, 'fill-extrusion-height')).toEqual(
      height,
    );
  });

  it('leaves the selected airspace out of the regular boxes so its own color cannot tint the highlight', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 45, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceExtrusionLayer />);
    expect(recordedFilter(AIRSPACE_FILL_EXTRUSION_LAYER_ID)).toEqual(CLASS_B_TYPE_FILTER);

    layerPropsLog.length = 0;
    useActiveHighlightRefMock.mockReturnValue(CLASS_B_SELECTION);
    render(<AirspaceExtrusionLayer />);
    expect(recordedFilter(AIRSPACE_FILL_EXTRUSION_LAYER_ID)).toEqual([
      'all',
      CLASS_B_TYPE_FILTER,
      ['!=', ['get', AIRSPACE_MATCH_KEY_PROPERTY], 'CLASS_B/JFK'],
    ]);
  });

  it('flattens the exaggeration to true scale at airport zooms', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 45, zoom: 12 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceExtrusionLayer />);
    const base = recordedPaint(AIRSPACE_FILL_EXTRUSION_LAYER_ID, 'fill-extrusion-base');
    if (!Array.isArray(base)) {
      throw new Error('expected a match expression');
    }
    const scaled = base[4];
    if (!Array.isArray(scaled)) {
      throw new Error('expected a multiply expression');
    }
    expect(scaled[2]).toBeCloseTo(FT_TO_METERS, 10);
  });

  it('boxes the whole selection regardless of floor datum so floating features stay highlighted', () => {
    useActiveHighlightRefMock.mockReturnValue(CLASS_B_SELECTION);
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 45, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceExtrusionLayer />);
    expect(recordedFilter(AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID)).toEqual(CLASS_B_SELECTION_MATCH);
  });

  it('paints the whole selection box in one color when no inspector section is hovered', () => {
    useActiveHighlightRefMock.mockReturnValue(CLASS_B_SELECTION);
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 45, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceExtrusionLayer />);
    expect(recordedPaint(AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID, 'fill-extrusion-color')).toEqual(
      expect.any(String),
    );
  });

  it('paints the hovered feature in the focus color and its siblings in the primary color', () => {
    useActiveHighlightRefMock.mockReturnValue(CLASS_B_SELECTION);
    useHoveredFeatureIndexMock.mockReturnValue(1);
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 45, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceExtrusionLayer />);
    const color = recordedPaint(AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID, 'fill-extrusion-color');
    expect(color).toEqual([
      'case',
      ['==', ['get', AIRSPACE_FEATURE_INDEX_PROPERTY], 1],
      expect.any(String),
      expect.any(String),
    ]);
    if (!Array.isArray(color)) {
      throw new Error('expected a case expression');
    }
    expect(color[2]).not.toBe(color[3]);
  });
});

describe('AirspaceFeatureOverlayLayers', () => {
  beforeEach(() => {
    useActiveHighlightRefMock.mockReturnValue(undefined);
    useHoveredFeatureIndexMock.mockReturnValue(undefined);
    useTopOfStackMock.mockReset();
    layerPropsLog.length = 0;
  });

  it('returns null while the airspace dataset is still loading', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 0, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue({ status: 'loading' });
    const { container } = render(<AirspaceFeatureOverlayLayers />);
    expect(container).toBeEmptyDOMElement();
  });

  it('draws no focus ring until an inspector section is hovered', () => {
    useActiveHighlightRefMock.mockReturnValue(CLASS_B_SELECTION);
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 0, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceFeatureOverlayLayers />);
    expect(recordedFilter(AIRSPACE_FEATURE_FOCUS_LAYER_ID)).toEqual([
      '==',
      ['get', AIRSPACE_MATCH_KEY_PROPERTY],
      expect.any(String),
    ]);
  });

  it('focuses the hovered feature on the ground in plan view', () => {
    useActiveHighlightRefMock.mockReturnValue(CLASS_B_SELECTION);
    useHoveredFeatureIndexMock.mockReturnValue(1);
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 0, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceFeatureOverlayLayers />);
    expect(recordedFilter(AIRSPACE_FEATURE_FOCUS_LAYER_ID)).toEqual([
      'all',
      CLASS_B_SELECTION_MATCH,
      ['==', ['get', AIRSPACE_FEATURE_INDEX_PROPERTY], 1],
    ]);
  });

  it('restricts the ground focus ring to ground-anchored floors once the camera tilts', () => {
    useActiveHighlightRefMock.mockReturnValue(CLASS_B_SELECTION);
    useHoveredFeatureIndexMock.mockReturnValue(1);
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 45, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceFeatureOverlayLayers />);
    expect(recordedFilter(AIRSPACE_FEATURE_FOCUS_LAYER_ID)).toEqual([
      'all',
      ['all', CLASS_B_SELECTION_MATCH, ['==', ['get', AIRSPACE_FEATURE_INDEX_PROPERTY], 1]],
      GROUND_ANCHORED_CLAUSE,
    ]);
  });

  it('pins the 2D airspace overlays below the 3D boxes and the point highlights above them', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 0, zoom: 8 });
    useAirspaceDatasetMock.mockReturnValue(LOADED_DATASET);
    render(<AirspaceFeatureOverlayLayers />);
    const order: unknown = useTopOfStackMock.mock.calls[0]?.[0];
    if (!Array.isArray(order)) {
      throw new Error('expected the top-of-stack hook to receive a layer-id array');
    }
    const position = (id: string): number => order.indexOf(id);
    const groundOverlays = [
      AIRSPACE_HIGHLIGHT_FILL_LAYER_ID,
      AIRSPACE_HIGHLIGHT_LAYER_ID,
      AIRSPACE_FEATURE_FOCUS_LAYER_ID,
    ];
    const boxes = [AIRSPACE_FILL_EXTRUSION_LAYER_ID, AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID];
    const pointHighlights = [
      AIRPORTS_HIGHLIGHT_LAYER_ID,
      NAVAIDS_HIGHLIGHT_LAYER_ID,
      FIXES_HIGHLIGHT_LAYER_ID,
      AIRWAYS_HIGHLIGHT_LAYER_ID,
    ];
    for (const overlay of groundOverlays) {
      for (const box of boxes) {
        expect(position(overlay)).toBeLessThan(position(box));
      }
    }
    for (const box of boxes) {
      for (const highlight of pointHighlights) {
        expect(position(box)).toBeLessThan(position(highlight));
      }
    }
    // The selection box is drawn first so the regular boxes in front of
    // it blend over it instead of hiding it.
    expect(position(AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID)).toBeLessThan(
      position(AIRSPACE_FILL_EXTRUSION_LAYER_ID),
    );
  });
});
