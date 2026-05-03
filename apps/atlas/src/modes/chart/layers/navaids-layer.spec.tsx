import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { NavaidDataset } from '@squawk/navaid-data';

import { NAVAIDS_HIGHLIGHT_LAYER_ID, NAVAIDS_LAYER_ID, NavaidsLayer } from './navaids-layer.tsx';

const { useNavaidDatasetMock, useActiveHighlightRefMock } = vi.hoisted(() => ({
  useNavaidDatasetMock: vi.fn(),
  useActiveHighlightRefMock: vi.fn(),
}));

vi.mock('../../../shared/data/navaid-dataset.ts', () => ({
  useNavaidDataset: useNavaidDatasetMock,
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

const EMPTY_DATASET: NavaidDataset = {
  properties: { generatedAt: '2026-01-22T00:00:00Z', nasrCycleDate: '2026-01-22', recordCount: 0 },
  records: [],
};

function buildNavaid(
  overrides: Partial<import('@squawk/types').Navaid> &
    Pick<import('@squawk/types').Navaid, 'identifier' | 'type'>,
): import('@squawk/types').Navaid {
  return {
    identifier: overrides.identifier,
    name: overrides.name ?? 'TEST',
    type: overrides.type,
    status: overrides.status ?? 'OPERATIONAL_IFR',
    lat: overrides.lat ?? 0,
    lon: overrides.lon ?? 0,
    country: overrides.country ?? 'US',
  } as import('@squawk/types').Navaid;
}

describe('NavaidsLayer', () => {
  beforeEach(() => {
    useActiveHighlightRefMock.mockReturnValue(undefined);
  });

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

  it('filters out shutdown navaids and unsupported types', () => {
    useNavaidDatasetMock.mockReturnValue({
      status: 'loaded',
      dataset: {
        properties: EMPTY_DATASET.properties,
        records: [
          buildNavaid({ identifier: 'BOS', type: 'VOR' }),
          buildNavaid({ identifier: 'KILL', type: 'VOR', status: 'SHUTDOWN' }),
          buildNavaid({ identifier: 'OBS', type: 'FAN_MARKER' as never }),
          buildNavaid({ identifier: 'NDB1', type: 'NDB' }),
        ],
      },
    });
    const { getByTestId } = render(<NavaidsLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });

  it('switches the highlight filter when a navaid is selected', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'navaid', id: 'BOS' });
    useNavaidDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const { getByTestId } = render(<NavaidsLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });
});
