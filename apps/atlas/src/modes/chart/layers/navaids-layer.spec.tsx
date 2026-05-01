import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { NAVAIDS_HIGHLIGHT_LAYER_ID, NAVAIDS_LAYER_ID, NavaidsLayer } from './navaids-layer.tsx';
import type { NavaidDataset } from '@squawk/navaid-data';

const { useNavaidDatasetMock } = vi.hoisted(() => ({ useNavaidDatasetMock: vi.fn() }));

vi.mock('../../../shared/data/navaid-dataset.ts', () => ({
  useNavaidDataset: useNavaidDatasetMock,
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

const EMPTY_DATASET: NavaidDataset = {
  properties: { generatedAt: '2026-01-22T00:00:00Z', nasrCycleDate: '2026-01-22', recordCount: 0 },
  records: [],
};

describe('NavaidsLayer', () => {
  it('exports stable MapLibre layer ids consumed by chart-mode click handling', () => {
    expect(NAVAIDS_LAYER_ID).toBe('atlas-navaids-circle');
    expect(NAVAIDS_HIGHLIGHT_LAYER_ID).toBe('atlas-navaids-highlight');
  });

  it('returns null while the navaid dataset is still loading', () => {
    useNavaidDatasetMock.mockReturnValue({ status: 'loading' });
    const { container } = render(<NavaidsLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when the navaid dataset load errored', () => {
    useNavaidDatasetMock.mockReturnValue({ status: 'error', error: new Error('fetch failed') });
    const { container } = render(<NavaidsLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a MapLibre source once the dataset resolves', () => {
    useNavaidDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const { getByTestId } = render(<NavaidsLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });
});
