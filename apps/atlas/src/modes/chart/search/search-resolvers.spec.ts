import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useChartSearchResolvers } from './search-resolvers.ts';

const {
  useDatasetStatesMock,
  getAirportResolverMock,
  getNavaidResolverMock,
  getFixResolverMock,
  getAirwayResolverMock,
  getAirspaceResolverMock,
} = vi.hoisted(() => ({
  useDatasetStatesMock: vi.fn(),
  getAirportResolverMock: vi.fn(),
  getNavaidResolverMock: vi.fn(),
  getFixResolverMock: vi.fn(),
  getAirwayResolverMock: vi.fn(),
  getAirspaceResolverMock: vi.fn(),
}));

vi.mock('../../../shared/inspector/entity-resolver.ts', () => ({
  useDatasetStates: useDatasetStatesMock,
}));
vi.mock('../../../shared/data/airport-dataset.ts', () => ({
  getAirportResolver: getAirportResolverMock,
}));
vi.mock('../../../shared/data/navaid-dataset.ts', () => ({
  getNavaidResolver: getNavaidResolverMock,
}));
vi.mock('../../../shared/data/fix-dataset.ts', () => ({ getFixResolver: getFixResolverMock }));
vi.mock('../../../shared/data/airway-dataset.ts', () => ({
  getAirwayResolver: getAirwayResolverMock,
}));
vi.mock('../../../shared/data/airspace-dataset.ts', () => ({
  getAirspaceResolver: getAirspaceResolverMock,
}));

// Sentinel resolvers returned by the mocked factories so the test can assert
// the hook wires each loaded dataset to the matching factory's output.
const airportResolver = { search: vi.fn(() => []) };
const navaidResolver = { search: vi.fn(() => []) };
const fixResolver = { search: vi.fn(() => []) };
const airwayResolver = { search: vi.fn(() => []) };
const airspaceResolver = { search: vi.fn(() => []) };

/** Builds an all-loaded dataset-states object with sentinel datasets per kind. */
function loadedStates(): unknown {
  return {
    airport: { status: 'loaded', dataset: { kind: 'airport' } },
    navaid: { status: 'loaded', dataset: { kind: 'navaid' } },
    fix: { status: 'loaded', dataset: { kind: 'fix' } },
    airway: { status: 'loaded', dataset: { kind: 'airway' } },
    airspace: { status: 'loaded', dataset: { kind: 'airspace' } },
  };
}

/** Builds an all-loading dataset-states object (no dataset slots resolved). */
function loadingStates(): unknown {
  return {
    airport: { status: 'loading' },
    navaid: { status: 'loading' },
    fix: { status: 'loading' },
    airway: { status: 'loading' },
    airspace: { status: 'loading' },
  };
}

describe('useChartSearchResolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAirportResolverMock.mockReturnValue(airportResolver);
    getNavaidResolverMock.mockReturnValue(navaidResolver);
    getFixResolverMock.mockReturnValue(fixResolver);
    getAirwayResolverMock.mockReturnValue(airwayResolver);
    getAirspaceResolverMock.mockReturnValue(airspaceResolver);
  });

  it('exposes each loaded dataset resolver built from its dataset', () => {
    useDatasetStatesMock.mockReturnValue(loadedStates());
    const { result } = renderHook(() => useChartSearchResolvers());

    expect(result.current.airports).toBe(airportResolver);
    expect(result.current.navaids).toBe(navaidResolver);
    expect(result.current.fixes).toBe(fixResolver);
    expect(result.current.airways).toBe(airwayResolver);
    expect(result.current.airspace).toBe(airspaceResolver);
    expect(getAirportResolverMock).toHaveBeenCalledWith({ kind: 'airport' });
    expect(getAirspaceResolverMock).toHaveBeenCalledWith({ kind: 'airspace' });
  });

  it('falls back to an empty-result stub for datasets that have not loaded', () => {
    useDatasetStatesMock.mockReturnValue(loadingStates());
    const { result } = renderHook(() => useChartSearchResolvers());

    expect(result.current.airports.search({ text: 'BOS' })).toEqual([]);
    expect(result.current.navaids.search({ text: 'BOS' })).toEqual([]);
    expect(result.current.fixes.search({ text: 'MERIT' })).toEqual([]);
    expect(result.current.airways.search({ text: 'V1' })).toEqual([]);
    expect(result.current.airspace.search({ text: 'BOS' })).toEqual([]);
    expect(getAirportResolverMock).not.toHaveBeenCalled();
    expect(getNavaidResolverMock).not.toHaveBeenCalled();
  });

  it('returns a stable resolver object across renders while the states are unchanged', () => {
    const states = loadedStates();
    useDatasetStatesMock.mockReturnValue(states);
    const { result, rerender } = renderHook(() => useChartSearchResolvers());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
