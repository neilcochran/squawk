import { describe, it, expect, assert } from 'vitest';

import type { CsvRecord } from '@squawk/build-shared';

import { buildNavaid } from './parse-navaids.js';

/**
 * Builds a NAV_BASE.csv record with the BOSTON VOR/DME baseline plus
 * caller-supplied overrides.
 *
 * @param overrides - Field overrides applied on top of the baseline.
 * @returns A CSV record matching NAV_BASE.csv columns.
 */
function baseRec(overrides: Partial<CsvRecord> = {}): CsvRecord {
  return {
    NAV_ID: 'BOS',
    NAME: 'BOSTON',
    STATE_CODE: 'MA',
    COUNTRY_CODE: 'US',
    LAT_DECIMAL: '42.357500',
    LONG_DECIMAL: '-70.989167',
    NAV_TYPE: 'VOR/DME',
    NAV_STATUS: 'OPERATIONAL IFR',
    ...overrides,
  };
}

describe('buildNavaid - all optional fields', () => {
  it('populates every optional field when populated', () => {
    const nav = buildNavaid(
      baseRec({
        MAG_VARN: '13.5',
        MAG_VARN_HEMIS: 'W',
        MAG_VARN_YEAR: '2020',
        LOW_ALT_ARTCC_ID: 'ZBW',
        HIGH_ALT_ARTCC_ID: 'ZNY',
        ALT_CODE: 'TERMINAL',
        DME_SSV: 'TERMINAL',
        PWR_OUTPUT: '200',
        SIMUL_VOICE_FLAG: 'Y',
        NDB_CLASS_CODE: 'HW',
        PUBLIC_USE_FLAG: 'Y',
        OPER_HOURS: 'CONT',
        NOTAM_ID: 'BOS',
        MKR_IDENT: 'BO',
        MKR_SHAPE: 'BONE',
        MKR_BRG: '40',
        TACAN_DME_LAT_DECIMAL: '42.358000',
        TACAN_DME_LONG_DECIMAL: '-70.990000',
      }),
    );
    assert(nav);
    expect(nav.magneticVariationDeg).toBe(13.5);
    expect(nav.magneticVariationDirection).toBe('W');
    expect(nav.magneticVariationYear).toBe(2020);
    expect(nav.lowArtccId).toBe('ZBW');
    expect(nav.highArtccId).toBe('ZNY');
    expect(nav.navaidClass).toBe('TERMINAL');
    expect(nav.dmeServiceVolume).toBe('TERMINAL');
    expect(nav.powerOutputWatts).toBe(200);
    expect(nav.simultaneousVoice).toBe(true);
    expect(nav.ndbClass).toBe('HW');
    expect(nav.publicUse).toBe(true);
    expect(nav.operatingHours).toBe('CONT');
    expect(nav.notamId).toBe('BOS');
    expect(nav.markerIdentifier).toBe('BO');
    expect(nav.markerShape).toBe('BONE');
    expect(nav.markerBearingDeg).toBe(40);
    expect(nav.dmeLat).toBe(42.358);
    expect(nav.dmeLon).toBe(-70.99);
  });

  it('omits dmeLat/dmeLon when they match the navaid coordinates', () => {
    const nav = buildNavaid(
      baseRec({
        TACAN_DME_LAT_DECIMAL: '42.357500',
        TACAN_DME_LONG_DECIMAL: '-70.989167',
      }),
    );
    assert(nav);
    expect(nav.dmeLat).toBe(undefined);
    expect(nav.dmeLon).toBe(undefined);
  });

  it('returns undefined when COUNTRY_CODE is missing', () => {
    expect(buildNavaid(baseRec({ COUNTRY_CODE: '' }))).toBe(undefined);
  });

  it('returns undefined when NAV_TYPE is missing entirely', () => {
    expect(buildNavaid(baseRec({ NAV_TYPE: '' }))).toBe(undefined);
  });

  it('returns undefined when NAV_STATUS is missing entirely', () => {
    expect(buildNavaid(baseRec({ NAV_STATUS: '' }))).toBe(undefined);
  });

  it('classifies an NDB frequency in kHz rather than MHz', () => {
    const nav = buildNavaid(
      baseRec({ NAV_TYPE: 'NDB', NAV_STATUS: 'OPERATIONAL IFR', FREQ: '380' }),
    );
    assert(nav);
    expect(nav.frequencyKhz).toBe(380);
    expect(nav.frequencyMhz).toBe(undefined);
  });

  it('captures TACAN channel and city', () => {
    const nav = buildNavaid(baseRec({ CHAN: '76X', CITY: 'BOSTON' }));
    assert(nav);
    expect(nav.tacanChannel).toBe('76X');
    expect(nav.city).toBe('BOSTON');
  });

  it('captures elevation when present', () => {
    const nav = buildNavaid(baseRec({ ELEV: '15' }));
    expect(nav?.elevationFt).toBe(15);
  });
});
