import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import {
  AIRSPACE_FILL_EXTRUSION_LAYER_ID,
  AIRSPACE_FILL_LAYER_ID,
  AIRSPACE_LINE_LAYER_ID,
  AirspaceExtrusionLayer,
  AirspaceFeatureOverlayLayers,
  AirspaceLayer,
} from './airspace-layer.tsx';

const { useAirspaceDatasetMock, useSearchMock } = vi.hoisted(() => ({
  useAirspaceDatasetMock: vi.fn(),
  useSearchMock: vi.fn(),
}));

vi.mock('../../../shared/data/airspace-dataset.ts', () => ({
  useAirspaceDataset: useAirspaceDatasetMock,
}));

// Mock the chart route api so `route.useSearch()` returns a controlled
// search-param shape without needing a TanStack router context.
vi.mock('@tanstack/react-router', () => ({
  getRouteApi: (): { useSearch: typeof useSearchMock } => ({ useSearch: useSearchMock }),
}));

// Stub MapLibre primitives. `Source` renders its children inside a
// findable container so the test can assert the layer mounted; `Layer`
// is a no-op since real MapLibre paint props need a live map context.
// `useMap` is exported so the hatch-pattern and top-of-stack hooks can
// resolve their map ref to undefined and short-circuit cleanly.
vi.mock('@vis.gl/react-maplibre', () => ({
  Source: ({ children }: { children?: ReactNode }): ReactElement => (
    <div data-testid="maplibre-source">{children}</div>
  ),
  Layer: (): null => null,
  useMap: (): { current: undefined; default: undefined } => ({
    current: undefined,
    default: undefined,
  }),
}));

describe('AirspaceLayer', () => {
  it('exports stable MapLibre layer ids consumed by chart-mode click handling', () => {
    expect(AIRSPACE_FILL_LAYER_ID).toBe('atlas-airspace-fill');
    expect(AIRSPACE_LINE_LAYER_ID).toBe('atlas-airspace-line');
    expect(AIRSPACE_FILL_EXTRUSION_LAYER_ID).toBe('atlas-airspace-fill-extrusion');
  });

  it('returns null while the airspace dataset is still loading', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 0 });
    useAirspaceDatasetMock.mockReturnValue({ status: 'loading' });
    const { container } = render(<AirspaceLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when the airspace dataset load errored', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 0 });
    useAirspaceDatasetMock.mockReturnValue({ status: 'error', error: new Error('fetch failed') });
    const { container } = render(<AirspaceLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a MapLibre source once the dataset resolves', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 0 });
    useAirspaceDatasetMock.mockReturnValue({
      status: 'loaded',
      dataset: {
        type: 'FeatureCollection',
        features: [],
        properties: {
          nasrCycleDate: '2026-01-22',
          generatedAt: '2026-01-22T00:00:00Z',
          featureCount: 0,
        },
      },
    });
    const { getByTestId } = render(<AirspaceLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });
});

describe('AirspaceExtrusionLayer', () => {
  it('returns null while the airspace dataset is still loading', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 60 });
    useAirspaceDatasetMock.mockReturnValue({ status: 'loading' });
    const { container } = render(<AirspaceExtrusionLayer />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AirspaceFeatureOverlayLayers', () => {
  it('returns null while the airspace dataset is still loading', () => {
    useSearchMock.mockReturnValue({ airspaceClasses: ['CLASS_B'], pitch: 0 });
    useAirspaceDatasetMock.mockReturnValue({ status: 'loading' });
    const { container } = render(<AirspaceFeatureOverlayLayers />);
    expect(container).toBeEmptyDOMElement();
  });
});
