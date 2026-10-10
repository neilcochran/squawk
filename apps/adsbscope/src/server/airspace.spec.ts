import { describe, expect, it, vi } from 'vitest';

import type { AirspaceFeature, AirspaceType } from '@squawk/types';

import {
  createAirspaceProvider,
  isReportedAirspaceType,
  loadBundledAirspace,
  toScopeAirspace,
} from './airspace.js';
import type { AirspaceSource } from './airspace.js';

function feature(
  type: AirspaceType,
  identifier: string,
  name: string,
  floorFt = 0,
  ceilingFt = 99_999,
): AirspaceFeature {
  return {
    type,
    identifier,
    name,
    floor: { valueFt: floorFt, reference: floorFt === 0 ? 'SFC' : 'MSL' },
    ceiling: { valueFt: ceilingFt, reference: 'MSL' },
    boundary: { type: 'Polygon', coordinates: [] },
    state: null,
    controllingFacility: null,
    scheduleDescription: null,
    artccStratum: null,
  };
}

const BOS_SHELLS = [
  feature('CLASS_B', 'BOS', 'BOSTON CLASS B', 0, 7000),
  feature('CLASS_B', 'BOS', 'BOSTON CLASS B', 2000, 7000),
  feature('CLASS_B', 'BOS', 'BOSTON CLASS B', 3000, 7000),
];

describe('toScopeAirspace', () => {
  it('reports one airspace for the nested shells of a Class B, named by its airport', () => {
    expect(toScopeAirspace(BOS_SHELLS)).toEqual([{ kind: 'classB', name: 'BOS' }]);
  });

  it('names a special-use area as charted, without the state the data appends', () => {
    expect(
      toScopeAirspace([
        feature('RESTRICTED', 'R4001A', 'R-4001A BRUNSWICK, ME'),
        feature('MOA', 'MYANKEE1', 'YANKEE 1 MOA, VT'),
        feature('PROHIBITED', 'P56B', 'P-56B DISTRICT OF COLUMBIA'),
      ]),
    ).toEqual([
      { kind: 'prohibited', name: 'P-56B DISTRICT OF COLUMBIA' },
      { kind: 'restricted', name: 'R-4001A BRUNSWICK' },
      { kind: 'moa', name: 'YANKEE 1 MOA' },
    ]);
  });

  it('lists special-use areas before classes, each kind in a fixed order, then by name', () => {
    expect(
      toScopeAirspace([
        feature('CLASS_D', 'NHZ', 'BRUNSWICK CLASS D'),
        feature('WARNING', 'W102L', 'W-102L LOW, MACHIAS, ME'),
        feature('CLASS_B', 'BOS', 'BOSTON CLASS B'),
        feature('NSA', 'NEVERETT', 'EVERETT NSA, WA'),
        feature('ALERT', 'A291C', 'A-291C MIAMI, FL'),
        feature('CLASS_C', 'PWM', 'PORTLAND INTL JETPORT CLASS C'),
        feature('CLASS_D', 'BXM', 'BRUNSWICK EXECUTIVE CLASS D'),
      ]).map((entry) => entry.kind + ' ' + entry.name),
    ).toEqual([
      'warning W-102L LOW',
      'alert A-291C MIAMI',
      'nationalSecurity EVERETT NSA',
      'classB BOS',
      'classC PWM',
      'classD BXM',
      'classD NHZ',
    ]);
  });

  it('falls back to the name for a class with no airport identifier', () => {
    expect(toScopeAirspace([feature('CLASS_D', '', 'SOMEWHERE CLASS D')])).toEqual([
      { kind: 'classD', name: 'SOMEWHERE CLASS D' },
    ]);
  });

  it('leaves out the types the scope does not report', () => {
    expect(
      toScopeAirspace([
        feature('CLASS_E5', '', 'HILLSBORO CLASS E5'),
        feature('CLASS_E2', 'GNV', 'GAINESVILLE CLASS E2'),
        feature('ARTCC', 'ZBW', 'BOSTON'),
      ]),
    ).toEqual([]);
  });

  it('reports nothing for an aircraft in no feature at all', () => {
    expect(toScopeAirspace([])).toEqual([]);
  });
});

describe('isReportedAirspaceType', () => {
  it('accepts the classes and special-use areas the scope reports', () => {
    for (const type of ['CLASS_B', 'CLASS_D', 'RESTRICTED', 'MOA', 'NSA']) {
      expect(isReportedAirspaceType(type)).toBe(true);
    }
  });

  it('rejects Class E, the ARTCC boundaries, and anything that is not a type', () => {
    for (const type of ['CLASS_E5', 'ARTCC', 'CLASS_X', '', undefined, 42, null]) {
      expect(isReportedAirspaceType(type)).toBe(false);
    }
  });
});

describe('createAirspaceProvider', () => {
  const source: AirspaceSource = {
    query: vi.fn((point: { lat: number }) => (point.lat === 42.36 ? BOS_SHELLS : [])),
  };

  it('answers nothing, and loads nothing, until it is told to load', () => {
    const loadAirspace = vi.fn(() => Promise.resolve(source));

    const provider = createAirspaceProvider({ loadAirspace });

    expect(provider.lookup({ lat: 42.36, lon: -71.01 }, 5000)).toBeUndefined();
    expect(loadAirspace).not.toHaveBeenCalled();
  });

  it('asks its source about the position and altitude once loaded, and reduces the answer', async () => {
    const provider = createAirspaceProvider({ loadAirspace: () => Promise.resolve(source) });

    await provider.load();

    expect(provider.lookup({ lat: 42.36, lon: -71.01 }, 5000)).toEqual([
      { kind: 'classB', name: 'BOS' },
    ]);
    expect(source.query).toHaveBeenCalledWith({ lat: 42.36, lon: -71.01, altitudeFt: 5000 });
    expect(provider.lookup({ lat: 45, lon: -70 }, 5000)).toEqual([]);
  });

  it('rejects a failed load, and goes on answering nothing', async () => {
    const provider = createAirspaceProvider({
      loadAirspace: () => Promise.reject(new Error('snapshot unreadable')),
    });

    await expect(provider.load()).rejects.toThrow('snapshot unreadable');
    expect(provider.lookup({ lat: 42.36, lon: -71.01 }, 5000)).toBeUndefined();
  });
});

describe('loadBundledAirspace', () => {
  it('loads the bundled FAA airspace, which is what the provider uses by default', async () => {
    const source = await loadBundledAirspace();
    const provider = createAirspaceProvider();
    await provider.load();

    const overBoston = source.query({ lat: 42.3656, lon: -71.0096, altitudeFt: 5000 });
    expect(overBoston.length).toBeGreaterThan(1);
    expect(
      overBoston.every((entry) => entry.type === 'CLASS_B' && entry.identifier === 'BOS'),
    ).toBe(true);
    expect(provider.lookup({ lat: 42.3656, lon: -71.0096 }, 5000)).toEqual([
      { kind: 'classB', name: 'BOS' },
    ]);
  }, 30_000);

  it('indexes none of the types the scope does not report', async () => {
    const source = await loadBundledAirspace();

    const everywhere = source.query({ lat: 42.3656, lon: -71.0096, altitudeFt: 5000 });
    expect(everywhere.some((entry) => entry.type.startsWith('CLASS_E'))).toBe(false);
    expect(everywhere.some((entry) => entry.type === 'ARTCC')).toBe(false);
  }, 30_000);
});
