import { describe, it, expect } from 'vitest';

import type { ProcedureDataset } from '@squawk/procedure-data';

import { getProcedureResolver } from './procedure-dataset.ts';

/**
 * Minimal empty dataset - `getProcedureResolver` only reads `records`, but the
 * full `properties` shape is supplied so the fixture matches the real type.
 */
const EMPTY_DATASET: ProcedureDataset = {
  properties: {
    generatedAt: '2026-03-25T00:00:00Z',
    cifpCycleDate: '2026-03-25',
    recordCount: 0,
    sidCount: 0,
    starCount: 0,
    iapCount: 0,
    legCount: 0,
  },
  records: [],
};

describe('getProcedureResolver', () => {
  it('builds a working resolver from a dataset', () => {
    const resolver = getProcedureResolver(EMPTY_DATASET);
    expect(typeof resolver.byAirport).toBe('function');
    expect(resolver.byAirport('KJFK')).toEqual([]);
  });

  it('returns the same cached resolver for the same dataset reference', () => {
    const first = getProcedureResolver(EMPTY_DATASET);
    const second = getProcedureResolver(EMPTY_DATASET);
    expect(second).toBe(first);
  });
});
