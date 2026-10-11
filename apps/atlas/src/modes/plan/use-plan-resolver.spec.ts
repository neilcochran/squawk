import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { usePlanResolver } from './use-plan-resolver.ts';

const {
  useAirportDatasetMock,
  getAirportResolverMock,
  useNavaidDatasetMock,
  getNavaidResolverMock,
  useFixDatasetMock,
  getFixResolverMock,
  useAirwayDatasetMock,
  getAirwayResolverMock,
  useProcedureDatasetMock,
  getProcedureResolverMock,
  createFlightplanResolverMock,
} = vi.hoisted(() => ({
  useAirportDatasetMock: vi.fn(),
  getAirportResolverMock: vi.fn(() => ({ tag: 'airport' })),
  useNavaidDatasetMock: vi.fn(),
  getNavaidResolverMock: vi.fn(() => ({ tag: 'navaid' })),
  useFixDatasetMock: vi.fn(),
  getFixResolverMock: vi.fn(() => ({ tag: 'fix' })),
  useAirwayDatasetMock: vi.fn(),
  getAirwayResolverMock: vi.fn(() => ({ tag: 'airway' })),
  useProcedureDatasetMock: vi.fn(),
  getProcedureResolverMock: vi.fn(() => ({ tag: 'procedure' })),
  createFlightplanResolverMock: vi.fn(() => ({ parse: vi.fn() })),
}));

vi.mock('../../shared/data/airport-dataset.ts', () => ({
  useAirportDataset: useAirportDatasetMock,
  getAirportResolver: getAirportResolverMock,
}));
vi.mock('../../shared/data/navaid-dataset.ts', () => ({
  useNavaidDataset: useNavaidDatasetMock,
  getNavaidResolver: getNavaidResolverMock,
}));
vi.mock('../../shared/data/fix-dataset.ts', () => ({
  useFixDataset: useFixDatasetMock,
  getFixResolver: getFixResolverMock,
}));
vi.mock('../../shared/data/airway-dataset.ts', () => ({
  useAirwayDataset: useAirwayDatasetMock,
  getAirwayResolver: getAirwayResolverMock,
}));
vi.mock('../../shared/data/procedure-dataset.ts', () => ({
  useProcedureDataset: useProcedureDatasetMock,
  getProcedureResolver: getProcedureResolverMock,
}));
vi.mock('@squawk/flightplan/browser', () => ({
  createFlightplanResolver: createFlightplanResolverMock,
}));

function loaded(tag: string): { status: 'loaded'; dataset: { tag: string } } {
  return { status: 'loaded', dataset: { tag } };
}

describe('usePlanResolver', () => {
  beforeEach(() => {
    useAirportDatasetMock.mockReturnValue(loaded('airport'));
    useNavaidDatasetMock.mockReturnValue(loaded('navaid'));
    useFixDatasetMock.mockReturnValue(loaded('fix'));
    useAirwayDatasetMock.mockReturnValue(loaded('airway'));
    useProcedureDatasetMock.mockReturnValue(loaded('procedure'));
    createFlightplanResolverMock.mockClear();
  });

  it('returns undefined while any dataset is still loading', () => {
    useProcedureDatasetMock.mockReturnValue({ status: 'loading' });
    const { result } = renderHook(() => usePlanResolver());
    expect(result.current).toBeUndefined();
    expect(createFlightplanResolverMock).not.toHaveBeenCalled();
  });

  it('returns undefined when a dataset load errored', () => {
    useFixDatasetMock.mockReturnValue({ status: 'error', error: new Error('boom') });
    const { result } = renderHook(() => usePlanResolver());
    expect(result.current).toBeUndefined();
  });

  it('composes a flightplan resolver from all five resolvers once loaded', () => {
    const { result } = renderHook(() => usePlanResolver());
    expect(result.current).toBeDefined();
    expect(createFlightplanResolverMock).toHaveBeenCalledWith({
      airports: { tag: 'airport' },
      navaids: { tag: 'navaid' },
      fixes: { tag: 'fix' },
      airways: { tag: 'airway' },
      procedures: { tag: 'procedure' },
    });
  });
});
