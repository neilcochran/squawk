import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { NavaidDataset } from '@squawk/navaid-data';
import { createNavaidResolver } from '@squawk/navaids/browser';
import type { Fix, Navaid } from '@squawk/types';

import type { NavaidDatasetState } from '../data/navaid-dataset.ts';

import type { AmbiguousPointIdentifiers } from './entity.ts';
import {
  navaidSelectionForAssociation,
  useFixAssociationSelections,
} from './fix-association-selection.ts';

const { useNavaidDatasetMock, useAmbiguousPointIdentifiersMock } = vi.hoisted(() => ({
  useNavaidDatasetMock: vi.fn<() => NavaidDatasetState>(),
  useAmbiguousPointIdentifiersMock: vi.fn<() => AmbiguousPointIdentifiers>(),
}));

vi.mock(import('../data/navaid-dataset.ts'), async (importOriginal) => ({
  ...(await importOriginal()),
  useNavaidDataset: useNavaidDatasetMock,
}));

vi.mock(import('./entity-resolver.ts'), async (importOriginal) => ({
  ...(await importOriginal()),
  useAmbiguousPointIdentifiers: useAmbiguousPointIdentifiersMock,
}));

function buildNavaid(overrides: Partial<Navaid> & Pick<Navaid, 'identifier' | 'type'>): Navaid {
  return {
    name: overrides.identifier,
    status: 'OPERATIONAL_IFR',
    lat: 0,
    lon: 0,
    country: 'US',
    ...overrides,
  };
}

/** A fix near St. Louis, defined by a localizer, its outer marker and a VORTAC. */
const ACORE: Fix = {
  identifier: 'ACORE',
  icaoRegionCode: 'K5',
  country: 'US',
  lat: 38.5,
  lon: -90.1,
  useCode: 'RP',
  pitch: false,
  catch: false,
  suaAtcaa: false,
  chartTypes: [],
  navaidAssociations: [
    { navaidId: 'CPS', navaidType: 'LOC', magneticBearingDeg: 122.22 },
    { navaidId: 'CPS', navaidType: 'OM' },
    { navaidId: 'TOY', navaidType: 'VORTAC', magneticBearingDeg: 202.71 },
  ],
};

const NAVAIDS: Navaid[] = [
  // An unrelated VOR sharing the localizer's identifier: an id-only match would land here.
  buildNavaid({ identifier: 'CPS', type: 'VOR', lat: 45, lon: -100 }),
  buildNavaid({ identifier: 'TOY', type: 'VORTAC', lat: 38.7, lon: -90.0 }),
  // The same identifier on two NDBs; the one nearer the fix should win.
  buildNavaid({ identifier: 'DUP', type: 'NDB', lat: 10, lon: 10 }),
  buildNavaid({ identifier: 'DUP', type: 'NDB', lat: 38.6, lon: -90.2 }),
];

const NO_AMBIGUITY: AmbiguousPointIdentifiers = { navaids: new Set(), fixes: new Set() };

describe('navaidSelectionForAssociation', () => {
  const resolver = createNavaidResolver({ data: NAVAIDS });

  it('links a navaid-family association to the navaid with that identifier and type', () => {
    expect(
      navaidSelectionForAssociation(
        { navaidId: 'TOY', navaidType: 'VORTAC', magneticBearingDeg: 202.71 },
        ACORE,
        resolver,
        new Set(),
      ),
    ).toBe('navaid:TOY');
  });

  it('does not link a localizer or marker to a navaid that only shares its identifier', () => {
    expect(
      navaidSelectionForAssociation(
        { navaidId: 'CPS', navaidType: 'LOC' },
        ACORE,
        resolver,
        new Set(),
      ),
    ).toBeUndefined();
    expect(
      navaidSelectionForAssociation(
        { navaidId: 'CPS', navaidType: 'OM' },
        ACORE,
        resolver,
        new Set(),
      ),
    ).toBeUndefined();
  });

  it('returns undefined for a navaid the dataset does not carry', () => {
    expect(
      navaidSelectionForAssociation(
        { navaidId: 'ZZZ', navaidType: 'VOR' },
        ACORE,
        resolver,
        new Set(),
      ),
    ).toBeUndefined();
  });

  it('picks the nearest record and encodes its position when the identifier is shared', () => {
    expect(
      navaidSelectionForAssociation(
        { navaidId: 'DUP', navaidType: 'NDB' },
        ACORE,
        resolver,
        new Set(['DUP']),
      ),
    ).toBe('navaid:DUP/c:-90.20000,38.60000');
  });
});

describe('useFixAssociationSelections', () => {
  beforeEach(() => {
    useAmbiguousPointIdentifiersMock.mockReturnValue(NO_AMBIGUITY);
  });

  it('returns one selection per association once the navaid dataset has loaded', () => {
    const dataset: NavaidDataset = {
      properties: {
        generatedAt: '2026-10-01T00:00:00Z',
        nasrCycleDate: '2026-10-01',
        recordCount: NAVAIDS.length,
      },
      records: NAVAIDS,
    };
    useNavaidDatasetMock.mockReturnValue({ status: 'loaded', dataset });
    const { result } = renderHook(() => useFixAssociationSelections(ACORE));
    expect(result.current).toEqual([undefined, undefined, 'navaid:TOY']);
  });

  it('links nothing while the navaid dataset is loading', () => {
    useNavaidDatasetMock.mockReturnValue({ status: 'loading' });
    const { result } = renderHook(() => useFixAssociationSelections(ACORE));
    expect(result.current).toEqual([undefined, undefined, undefined]);
  });
});
