import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { FIXES_HIGHLIGHT_LAYER_ID, FIXES_LAYER_ID, FixesLayer } from './fixes-layer.tsx';
import type { FixDataset } from '@squawk/fix-data';

const { useFixDatasetMock } = vi.hoisted(() => ({ useFixDatasetMock: vi.fn() }));

vi.mock('../../../shared/data/fix-dataset.ts', () => ({
  useFixDataset: useFixDatasetMock,
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

const EMPTY_DATASET: FixDataset = {
  properties: { generatedAt: '2026-01-22T00:00:00Z', nasrCycleDate: '2026-01-22', recordCount: 0 },
  records: [],
};

describe('FixesLayer', () => {
  it('exports stable MapLibre layer ids consumed by chart-mode click handling', () => {
    expect(FIXES_LAYER_ID).toBe('atlas-fixes-circle');
    expect(FIXES_HIGHLIGHT_LAYER_ID).toBe('atlas-fixes-highlight');
  });

  it('returns null while the fix dataset is still loading', () => {
    useFixDatasetMock.mockReturnValue({ status: 'loading' });
    const { container } = render(<FixesLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when the fix dataset load errored', () => {
    useFixDatasetMock.mockReturnValue({ status: 'error', error: new Error('fetch failed') });
    const { container } = render(<FixesLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a MapLibre source once the dataset resolves', () => {
    useFixDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const { getByTestId } = render(<FixesLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });
});
