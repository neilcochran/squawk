import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { NavaidDataset } from '@squawk/navaid-data';

import { NAVAIDS_HIGHLIGHT_LAYER_ID, NAVAIDS_LAYER_ID, NavaidsLayer } from './navaids-layer.tsx';

const { useNavaidDatasetMock, useActiveHighlightRefMock, layerPropsLog } = vi.hoisted(() => ({
  useNavaidDatasetMock: vi.fn(),
  useActiveHighlightRefMock: vi.fn(),
  layerPropsLog: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../../shared/data/navaid-dataset.ts', () => ({
  useNavaidDataset: useNavaidDatasetMock,
}));

vi.mock('../highlight-context.ts', () => ({
  useActiveHighlightRef: useActiveHighlightRefMock,
}));

// Stub MapLibre primitives. `Source` renders its children inside a
// findable container so the test can assert the layer mounted; `Layer`
// records the props it receives so tests can assert paint / filter values
// without a live map context.
vi.mock('@vis.gl/react-maplibre', () => ({
  Source: ({ children }: { children?: ReactNode }): ReactElement => (
    <div data-testid="maplibre-source">{children}</div>
  ),
  Layer: (props: Record<string, unknown>): null => {
    layerPropsLog.push(props);
    return null;
  },
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
    layerPropsLog.length = 0;
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
    const highlight = renderAndReadHighlightFilter();
    expect(highlight).toEqual(['==', ['get', 'identifier'], 'BOS']);
  });

  it('strips a position suffix from the highlight filter so it matches the bare identifier', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'navaid', id: 'DUPE/c:-71.00472,42.35778' });
    useNavaidDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const highlight = renderAndReadHighlightFilter();
    expect(highlight).toEqual(['==', ['get', 'identifier'], 'DUPE']);
  });
});

/**
 * Renders the layer and returns the `filter` prop of the highlight layer,
 * read from the captured MapLibre `Layer` props.
 */
function renderAndReadHighlightFilter(): unknown {
  render(<NavaidsLayer />);
  const highlightLayer = layerPropsLog.find((props) => props.id === NAVAIDS_HIGHLIGHT_LAYER_ID);
  return highlightLayer?.filter;
}
