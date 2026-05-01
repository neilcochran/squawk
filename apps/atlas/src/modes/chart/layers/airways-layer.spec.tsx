import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import {
  AIRWAYS_HIGHLIGHT_LAYER_ID,
  AIRWAYS_LAYER_ID,
  AirwayLegFocusLayer,
  AirwaysLayer,
} from './airways-layer.tsx';
import type { AirwayDataset } from '@squawk/airway-data';

const { useAirwayDatasetMock, useSearchMock } = vi.hoisted(() => ({
  useAirwayDatasetMock: vi.fn(),
  useSearchMock: vi.fn(),
}));

vi.mock('../../../shared/data/airway-dataset.ts', () => ({
  useAirwayDataset: useAirwayDatasetMock,
}));

// Mock the chart route api so `route.useSearch()` returns a controlled
// search-param shape without needing a TanStack router context.
vi.mock('@tanstack/react-router', () => ({
  getRouteApi: (): { useSearch: typeof useSearchMock } => ({ useSearch: useSearchMock }),
}));

// Stub MapLibre primitives. `Source` renders its children inside a
// findable container so the test can assert the layer mounted; `Layer`
// is a no-op since real MapLibre paint props need a live map context.
vi.mock('@vis.gl/react-maplibre', () => ({
  Source: ({ children }: { children?: ReactNode }): ReactElement => (
    <div data-testid="maplibre-source">{children}</div>
  ),
  Layer: (): null => null,
}));

const EMPTY_DATASET: AirwayDataset = {
  properties: {
    generatedAt: '2026-01-22T00:00:00Z',
    nasrCycleDate: '2026-01-22',
    recordCount: 0,
    waypointCount: 0,
  },
  records: [],
};

describe('AirwaysLayer', () => {
  it('exports stable MapLibre layer ids consumed by chart-mode click handling', () => {
    expect(AIRWAYS_LAYER_ID).toBe('atlas-airways-line');
    expect(AIRWAYS_HIGHLIGHT_LAYER_ID).toBe('atlas-airways-highlight');
  });

  it('returns null while the airway dataset is still loading', () => {
    useSearchMock.mockReturnValue({ airwayCategories: ['LOW', 'HIGH', 'OCEANIC'] });
    useAirwayDatasetMock.mockReturnValue({ status: 'loading' });
    const { container } = render(<AirwaysLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when the airway dataset load errored', () => {
    useSearchMock.mockReturnValue({ airwayCategories: ['LOW', 'HIGH', 'OCEANIC'] });
    useAirwayDatasetMock.mockReturnValue({ status: 'error', error: new Error('fetch failed') });
    const { container } = render(<AirwaysLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a MapLibre source once the dataset resolves', () => {
    useSearchMock.mockReturnValue({ airwayCategories: ['LOW', 'HIGH', 'OCEANIC'] });
    useAirwayDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const { getByTestId } = render(<AirwaysLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });
});

describe('AirwayLegFocusLayer', () => {
  it('returns null when there is no active airway selection', () => {
    useSearchMock.mockReturnValue({ airwayCategories: ['LOW', 'HIGH', 'OCEANIC'] });
    useAirwayDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const { container } = render(<AirwayLegFocusLayer />);
    expect(container).toBeEmptyDOMElement();
  });
});
