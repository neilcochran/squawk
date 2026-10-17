import { describe, it, expect } from 'vitest';

import {
  AIRSPACE_CEILING_FT_PROPERTY,
  AIRSPACE_CEILING_INCLUSIVE_PROPERTY,
  AIRSPACE_CEILING_REF_PROPERTY,
  AIRSPACE_FLOOR_FT_PROPERTY,
  AIRSPACE_FLOOR_INCLUSIVE_PROPERTY,
  AIRSPACE_FLOOR_REF_PROPERTY,
  compareAirspaceByAltitudeDesc,
  formatAirspaceAltitudeRange,
  formatAltitudeBoundCompact,
  formatAltitudeBoundVerbose,
  readAltitudeBoundPrimitives,
} from './airspace-feature.ts';
import type { AirspaceAltitudeKey } from './airspace-feature.ts';

describe('compareAirspaceByAltitudeDesc', () => {
  it('sorts higher ceilings before lower ceilings', () => {
    const high: AirspaceAltitudeKey = { ceilingFt: 18000, floorFt: 0 };
    const low: AirspaceAltitudeKey = { ceilingFt: 10000, floorFt: 0 };
    const ordered = [low, high].sort(compareAirspaceByAltitudeDesc);
    expect(ordered).toEqual([high, low]);
  });

  it('breaks ties by higher floor first', () => {
    // Two Class B rings sharing the same ceiling: the outer ring (higher
    // floor) should come before the inner ring (SFC floor). This matches
    // the "top-down altitude stack" mental model the inspector renders.
    const outerRing: AirspaceAltitudeKey = { ceilingFt: 10000, floorFt: 3000 };
    const innerRing: AirspaceAltitudeKey = { ceilingFt: 10000, floorFt: 0 };
    const ordered = [innerRing, outerRing].sort(compareAirspaceByAltitudeDesc);
    expect(ordered).toEqual([outerRing, innerRing]);
  });

  it('returns 0 for two identical altitude keys', () => {
    // Stable sort: identical keys preserve input order.
    const same: AirspaceAltitudeKey = { ceilingFt: 5000, floorFt: 1000 };
    expect(compareAirspaceByAltitudeDesc(same, same)).toBe(0);
  });

  it('orders an ARTCC stack as HIGH then LOW', () => {
    // ARTCC sectors come in stratums; HIGH sits above LOW. Sorting a
    // dataset-order pair should always land HIGH first regardless of
    // the input order.
    const low: AirspaceAltitudeKey = { ceilingFt: 18000, floorFt: 0 };
    const high: AirspaceAltitudeKey = { ceilingFt: 60000, floorFt: 18000 };
    expect([low, high].sort(compareAirspaceByAltitudeDesc)).toEqual([high, low]);
    expect([high, low].sort(compareAirspaceByAltitudeDesc)).toEqual([high, low]);
  });
});

describe('readAltitudeBoundPrimitives', () => {
  it('builds a bound from a valid value and datum', () => {
    expect(readAltitudeBoundPrimitives(3000, 'MSL')).toEqual({ valueFt: 3000, reference: 'MSL' });
  });

  it('marks the bound exclusive only for an explicit false', () => {
    expect(readAltitudeBoundPrimitives(18000, 'MSL', false)).toEqual({
      valueFt: 18000,
      reference: 'MSL',
      inclusive: false,
    });
    expect(readAltitudeBoundPrimitives(18000, 'MSL', true)).toEqual({
      valueFt: 18000,
      reference: 'MSL',
    });
    expect(readAltitudeBoundPrimitives(18000, 'MSL', 'false')).toEqual({
      valueFt: 18000,
      reference: 'MSL',
    });
  });

  it('rejects a non-numeric value or an unknown datum', () => {
    expect(readAltitudeBoundPrimitives('3000', 'MSL')).toBeUndefined();
    expect(readAltitudeBoundPrimitives(3000, 'STD')).toBeUndefined();
  });
});

describe('formatAltitudeBoundVerbose', () => {
  it('renders an inclusive bound as value and datum', () => {
    expect(formatAltitudeBoundVerbose({ valueFt: 3000, reference: 'MSL' }, 'floor')).toBe(
      '3000 ft MSL',
    );
    expect(formatAltitudeBoundVerbose({ valueFt: 700, reference: 'AGL' }, 'floor')).toBe(
      '700 ft AGL',
    );
  });

  it('renders the surface as SFC, exclusive or not', () => {
    expect(formatAltitudeBoundVerbose({ valueFt: 0, reference: 'SFC' }, 'floor')).toBe('SFC');
    expect(
      formatAltitudeBoundVerbose({ valueFt: 0, reference: 'SFC', inclusive: false }, 'floor'),
    ).toBe('SFC');
  });

  it('renders the unlimited sentinel as Unlimited', () => {
    expect(formatAltitudeBoundVerbose({ valueFt: 99999, reference: 'MSL' }, 'ceiling')).toBe(
      'Unlimited',
    );
  });

  it('keeps a published ceiling above the sentinel as a number', () => {
    // R-2535B is designated to 100,000 ft MSL; that is a real value, not the sentinel.
    expect(formatAltitudeBoundVerbose({ valueFt: 100000, reference: 'MSL' }, 'ceiling')).toBe(
      '100000 ft MSL',
    );
  });

  it('reads an exclusive ceiling as below its value', () => {
    expect(
      formatAltitudeBoundVerbose({ valueFt: 18000, reference: 'MSL', inclusive: false }, 'ceiling'),
    ).toBe('Below 18000 ft MSL');
  });

  it('reads an exclusive floor as above its value', () => {
    expect(
      formatAltitudeBoundVerbose({ valueFt: 5000, reference: 'MSL', inclusive: false }, 'floor'),
    ).toBe('Above 5000 ft MSL');
  });
});

describe('formatAltitudeBoundCompact', () => {
  it('renders clean thousands as k and other values in feet', () => {
    expect(formatAltitudeBoundCompact({ valueFt: 11000, reference: 'MSL' }, 'floor')).toBe('11k');
    expect(formatAltitudeBoundCompact({ valueFt: 1500, reference: 'AGL' }, 'floor')).toBe(
      '1500ft AGL',
    );
  });

  it('renders the unlimited sentinel as UNL', () => {
    expect(formatAltitudeBoundCompact({ valueFt: 99999, reference: 'MSL' }, 'ceiling')).toBe('UNL');
  });

  it('prefixes an exclusive ceiling with < and an exclusive floor with >', () => {
    expect(
      formatAltitudeBoundCompact({ valueFt: 18000, reference: 'MSL', inclusive: false }, 'ceiling'),
    ).toBe('<18k');
    expect(
      formatAltitudeBoundCompact({ valueFt: 5000, reference: 'MSL', inclusive: false }, 'floor'),
    ).toBe('>5k');
  });
});

describe('formatAirspaceAltitudeRange', () => {
  it('carries the exclusive flags from the synthetic properties into the range', () => {
    expect(
      formatAirspaceAltitudeRange({
        [AIRSPACE_FLOOR_FT_PROPERTY]: 0,
        [AIRSPACE_FLOOR_REF_PROPERTY]: 'SFC',
        [AIRSPACE_CEILING_FT_PROPERTY]: 18000,
        [AIRSPACE_CEILING_REF_PROPERTY]: 'MSL',
        [AIRSPACE_CEILING_INCLUSIVE_PROPERTY]: false,
      }),
    ).toBe('SFC-<18k');
    expect(
      formatAirspaceAltitudeRange({
        [AIRSPACE_FLOOR_FT_PROPERTY]: 5000,
        [AIRSPACE_FLOOR_REF_PROPERTY]: 'MSL',
        [AIRSPACE_FLOOR_INCLUSIVE_PROPERTY]: false,
        [AIRSPACE_CEILING_FT_PROPERTY]: 99999,
        [AIRSPACE_CEILING_REF_PROPERTY]: 'MSL',
      }),
    ).toBe('>5k-UNL');
  });

  it('returns undefined when a bound is missing', () => {
    expect(formatAirspaceAltitudeRange({ [AIRSPACE_FLOOR_FT_PROPERTY]: 0 })).toBeUndefined();
    expect(formatAirspaceAltitudeRange(null)).toBeUndefined();
  });
});
