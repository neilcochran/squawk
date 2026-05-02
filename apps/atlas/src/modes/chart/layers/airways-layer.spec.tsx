import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import {
  AIRWAYS_HIGHLIGHT_LAYER_ID,
  AIRWAYS_LAYER_ID,
  AirwayLegFocusLayer,
  AirwaysLayer,
} from './airways-layer.tsx';
import type { AirwayDataset } from '@squawk/airway-data';

const {
  useAirwayDatasetMock,
  useSearchMock,
  useActiveHighlightRefMock,
  useHoveredAirwayWaypointIndexMock,
} = vi.hoisted(() => ({
  useAirwayDatasetMock: vi.fn(),
  useSearchMock: vi.fn(),
  useActiveHighlightRefMock: vi.fn(),
  useHoveredAirwayWaypointIndexMock: vi.fn(),
}));

vi.mock('../../../shared/data/airway-dataset.ts', () => ({
  useAirwayDataset: useAirwayDatasetMock,
}));

vi.mock('../highlight-context.ts', () => ({
  useActiveHighlightRef: useActiveHighlightRefMock,
  useHoveredAirwayWaypointIndex: useHoveredAirwayWaypointIndexMock,
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

function buildAirway(
  overrides: Partial<import('@squawk/types').Airway> &
    Pick<import('@squawk/types').Airway, 'designation'>,
): import('@squawk/types').Airway {
  return {
    designation: overrides.designation,
    type: overrides.type ?? 'VICTOR',
    region: overrides.region ?? 'US',
    waypoints: overrides.waypoints ?? [
      { identifier: 'A', lat: 0, lon: 0 } as never,
      { identifier: 'B', lat: 1, lon: 1 } as never,
      { identifier: 'C', lat: 2, lon: 2 } as never,
    ],
  } as import('@squawk/types').Airway;
}

describe('AirwaysLayer', () => {
  beforeEach(() => {
    useActiveHighlightRefMock.mockReturnValue(undefined);
    useHoveredAirwayWaypointIndexMock.mockReturnValue(undefined);
  });

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

  it('skips airways with fewer than two waypoints', () => {
    useSearchMock.mockReturnValue({ airwayCategories: ['LOW', 'HIGH', 'OCEANIC'] });
    useAirwayDatasetMock.mockReturnValue({
      status: 'loaded',
      dataset: {
        properties: EMPTY_DATASET.properties,
        records: [
          buildAirway({ designation: 'V16' }),
          buildAirway({
            designation: 'TINY',
            waypoints: [{ identifier: 'X', lat: 0, lon: 0 } as never],
          }),
        ],
      },
    });
    const { getByTestId } = render(<AirwaysLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });

  it('switches the highlight filter when an airway is selected', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'airway', id: 'V16' });
    useSearchMock.mockReturnValue({ airwayCategories: ['LOW', 'HIGH', 'OCEANIC'] });
    useAirwayDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const { getByTestId } = render(<AirwaysLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });
});

describe('AirwayLegFocusLayer', () => {
  beforeEach(() => {
    useActiveHighlightRefMock.mockReturnValue(undefined);
    useHoveredAirwayWaypointIndexMock.mockReturnValue(undefined);
  });

  it('returns null when there is no active airway selection', () => {
    useSearchMock.mockReturnValue({ airwayCategories: ['LOW', 'HIGH', 'OCEANIC'] });
    useAirwayDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const { container } = render(<AirwayLegFocusLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null for a non-airway selection', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'airport', id: 'BOS' });
    useSearchMock.mockReturnValue({ airwayCategories: ['LOW', 'HIGH', 'OCEANIC'] });
    useAirwayDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const { container } = render(<AirwayLegFocusLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when the airway dataset is still loading', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'airway', id: 'V16' });
    useSearchMock.mockReturnValue({ airwayCategories: ['LOW', 'HIGH', 'OCEANIC'] });
    useAirwayDatasetMock.mockReturnValue({ status: 'loading' });
    const { container } = render(<AirwayLegFocusLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when the airway has no matching record', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'airway', id: 'V99' });
    useSearchMock.mockReturnValue({ airwayCategories: ['LOW', 'HIGH', 'OCEANIC'] });
    useAirwayDatasetMock.mockReturnValue({
      status: 'loaded',
      dataset: {
        properties: EMPTY_DATASET.properties,
        records: [buildAirway({ designation: 'V16' })],
      },
    });
    const { container } = render(<AirwayLegFocusLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null for an empty active airway id', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'airway', id: '' });
    useSearchMock.mockReturnValue({ airwayCategories: ['LOW', 'HIGH', 'OCEANIC'] });
    useAirwayDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const { container } = render(<AirwayLegFocusLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('builds waypoint and leg features when an airway is selected', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'airway', id: 'V16' });
    useSearchMock.mockReturnValue({ airwayCategories: ['LOW', 'HIGH', 'OCEANIC'] });
    useAirwayDatasetMock.mockReturnValue({
      status: 'loaded',
      dataset: {
        properties: EMPTY_DATASET.properties,
        records: [buildAirway({ designation: 'V16' })],
      },
    });
    const { getByTestId } = render(<AirwayLegFocusLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });

  it('uses the index filter when a waypoint row is hovered', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'airway', id: 'V16' });
    useHoveredAirwayWaypointIndexMock.mockReturnValue(1);
    useSearchMock.mockReturnValue({ airwayCategories: ['LOW', 'HIGH', 'OCEANIC'] });
    useAirwayDatasetMock.mockReturnValue({
      status: 'loaded',
      dataset: {
        properties: EMPTY_DATASET.properties,
        records: [buildAirway({ designation: 'V16' })],
      },
    });
    const { getByTestId } = render(<AirwayLegFocusLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });
});
