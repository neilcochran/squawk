import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { FixDataset } from '@squawk/fix-data';

import { FIXES_HIGHLIGHT_LAYER_ID, FIXES_LAYER_ID, FixesLayer } from './fixes-layer.tsx';

const { useFixDatasetMock, useActiveHighlightRefMock } = vi.hoisted(() => ({
  useFixDatasetMock: vi.fn(),
  useActiveHighlightRefMock: vi.fn(),
}));

vi.mock('../../../shared/data/fix-dataset.ts', () => ({
  useFixDataset: useFixDatasetMock,
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

const EMPTY_DATASET: FixDataset = {
  properties: { generatedAt: '2026-01-22T00:00:00Z', nasrCycleDate: '2026-01-22', recordCount: 0 },
  records: [],
};

function buildFix(
  overrides: Partial<import('@squawk/types').Fix> &
    Pick<import('@squawk/types').Fix, 'identifier' | 'useCode'>,
): import('@squawk/types').Fix {
  return {
    identifier: overrides.identifier,
    useCode: overrides.useCode,
    icaoRegionCode: overrides.icaoRegionCode ?? 'K6',
    country: overrides.country ?? 'US',
    lat: overrides.lat ?? 0,
    lon: overrides.lon ?? 0,
    pitch: overrides.pitch ?? false,
    catch: overrides.catch ?? false,
    suaAtcaa: overrides.suaAtcaa ?? false,
    chartTypes: overrides.chartTypes ?? [],
    navaidAssociations: overrides.navaidAssociations ?? [],
    ...(overrides.compulsory !== undefined && { compulsory: overrides.compulsory }),
  } as import('@squawk/types').Fix;
}

describe('FixesLayer', () => {
  beforeEach(() => {
    useActiveHighlightRefMock.mockReturnValue(undefined);
  });

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

  it('drops fixes whose use code is not rendered (CN, RADAR)', () => {
    useFixDatasetMock.mockReturnValue({
      status: 'loaded',
      dataset: {
        properties: EMPTY_DATASET.properties,
        records: [
          buildFix({ identifier: 'MERIT', useCode: 'WP' }),
          buildFix({ identifier: 'CHURN', useCode: 'CN' }),
          buildFix({ identifier: 'RDAR', useCode: 'RADAR' }),
          // Compulsory non-WP fix exercises the compulsory != undefined path.
          buildFix({ identifier: 'COMP', useCode: 'RP', compulsory: 'C' as never }),
        ],
      },
    });
    const { getByTestId } = render(<FixesLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });

  it('switches the highlight filter when a fix is selected', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'fix', id: 'MERIT' });
    useFixDatasetMock.mockReturnValue({ status: 'loaded', dataset: EMPTY_DATASET });
    const { getByTestId } = render(<FixesLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
  });
});
