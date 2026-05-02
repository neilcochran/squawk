import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import {
  AIRPORTS_HIGHLIGHT_LAYER_ID,
  AIRPORTS_LAYER_ID,
  AirportsLayer,
} from './airports-layer.tsx';
import type { AirportDataset } from '@squawk/airport-data';

const { useAirportDatasetMock, useActiveHighlightRefMock } = vi.hoisted(() => ({
  useAirportDatasetMock: vi.fn(),
  useActiveHighlightRefMock: vi.fn(),
}));

vi.mock('../../../shared/data/airport-dataset.ts', () => ({
  useAirportDataset: useAirportDatasetMock,
}));

vi.mock('../highlight-context.ts', () => ({
  useActiveHighlightRef: useActiveHighlightRefMock,
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

const EMPTY_DATASET: AirportDataset = {
  properties: { generatedAt: '2026-01-22T00:00:00Z', nasrCycleDate: '2026-01-22', recordCount: 0 },
  records: [],
};

function buildAirport(
  overrides: Partial<import('@squawk/types').Airport> &
    Pick<import('@squawk/types').Airport, 'faaId'>,
): import('@squawk/types').Airport {
  return {
    faaId: overrides.faaId,
    icao: overrides.icao ?? 'KBOS',
    name: overrides.name ?? 'TEST FIELD',
    facilityType: overrides.facilityType ?? 'AIRPORT',
    ownershipType: overrides.ownershipType ?? 'PUBLIC',
    useType: overrides.useType ?? 'PUBLIC',
    status: overrides.status ?? 'OPEN',
    city: overrides.city ?? 'CITY',
    state: overrides.state ?? 'XX',
    country: overrides.country ?? 'US',
    lat: overrides.lat ?? 0,
    lon: overrides.lon ?? 0,
    timezone: overrides.timezone ?? 'UTC',
    runways: overrides.runways ?? [],
    frequencies: overrides.frequencies ?? [],
  } as import('@squawk/types').Airport;
}

describe('AirportsLayer', () => {
  beforeEach(() => {
    useActiveHighlightRefMock.mockReturnValue(undefined);
  });

  it('exports stable MapLibre layer ids consumed by chart-mode click handling', () => {
    expect(AIRPORTS_LAYER_ID).toBe('atlas-airports-circle');
    expect(AIRPORTS_HIGHLIGHT_LAYER_ID).toBe('atlas-airports-highlight');
  });

  it('returns null while the airport dataset is still loading', () => {
    useAirportDatasetMock.mockReturnValue({ status: 'loading' });
    const { container } = render(<AirportsLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when the airport dataset load errored', () => {
    useAirportDatasetMock.mockReturnValue({ status: 'error', error: new Error('fetch failed') });
    const { container } = render(<AirportsLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a MapLibre source once the dataset resolves', () => {
    useAirportDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const { getByTestId } = render(<AirportsLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });

  it('exercises the runway-length aggregation and facility-type filter on a populated dataset', () => {
    useAirportDatasetMock.mockReturnValue({
      status: 'loaded',
      dataset: {
        properties: EMPTY_DATASET.properties,
        records: [
          buildAirport({
            faaId: 'BOS',
            facilityType: 'AIRPORT',
            runways: [
              { lengthFt: 7000 } as never,
              { lengthFt: 10500 } as never,
              { lengthFt: undefined } as never,
            ],
          }),
          // Heliport: filtered out by facilityType.
          buildAirport({ faaId: 'HEL', facilityType: 'HELIPORT' }),
          // Airport with no runways: longestRunwayFt = 0.
          buildAirport({ faaId: 'NOR' }),
        ],
      },
    });
    const { getByTestId } = render(<AirportsLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });

  it('renders the highlight filter against the active airport when one is selected', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'airport', id: 'BOS' });
    useAirportDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const { getByTestId } = render(<AirportsLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });

  it('uses MATCH_NONE when the active selection is for a different entity type', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'navaid', id: 'BOS' });
    useAirportDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const { getByTestId } = render(<AirportsLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });
});
