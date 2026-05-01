import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import {
  AIRPORTS_HIGHLIGHT_LAYER_ID,
  AIRPORTS_LAYER_ID,
  AirportsLayer,
} from './airports-layer.tsx';
import type { AirportDataset } from '@squawk/airport-data';

const { useAirportDatasetMock } = vi.hoisted(() => ({ useAirportDatasetMock: vi.fn() }));

vi.mock('../../../shared/data/airport-dataset.ts', () => ({
  useAirportDataset: useAirportDatasetMock,
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

describe('AirportsLayer', () => {
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
});
