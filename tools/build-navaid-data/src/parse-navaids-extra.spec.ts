import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { buildNavaid } from './parse-navaids.js';
import type { CsvRecord } from '@squawk/build-shared';

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
    assert.ok(nav);
    assert.equal(nav.magneticVariationDeg, 13.5);
    assert.equal(nav.magneticVariationDirection, 'W');
    assert.equal(nav.magneticVariationYear, 2020);
    assert.equal(nav.lowArtccId, 'ZBW');
    assert.equal(nav.highArtccId, 'ZNY');
    assert.equal(nav.navaidClass, 'TERMINAL');
    assert.equal(nav.dmeServiceVolume, 'TERMINAL');
    assert.equal(nav.powerOutputWatts, 200);
    assert.equal(nav.simultaneousVoice, true);
    assert.equal(nav.ndbClass, 'HW');
    assert.equal(nav.publicUse, true);
    assert.equal(nav.operatingHours, 'CONT');
    assert.equal(nav.notamId, 'BOS');
    assert.equal(nav.markerIdentifier, 'BO');
    assert.equal(nav.markerShape, 'BONE');
    assert.equal(nav.markerBearingDeg, 40);
    assert.equal(nav.dmeLat, 42.358);
    assert.equal(nav.dmeLon, -70.99);
  });

  it('omits dmeLat/dmeLon when they match the navaid coordinates', () => {
    const nav = buildNavaid(
      baseRec({
        TACAN_DME_LAT_DECIMAL: '42.357500',
        TACAN_DME_LONG_DECIMAL: '-70.989167',
      }),
    );
    assert.ok(nav);
    assert.equal(nav.dmeLat, undefined);
    assert.equal(nav.dmeLon, undefined);
  });

  it('returns undefined when COUNTRY_CODE is missing', () => {
    assert.equal(buildNavaid(baseRec({ COUNTRY_CODE: '' })), undefined);
  });

  it('returns undefined when NAV_TYPE is missing entirely', () => {
    assert.equal(buildNavaid(baseRec({ NAV_TYPE: '' })), undefined);
  });

  it('returns undefined when NAV_STATUS is missing entirely', () => {
    assert.equal(buildNavaid(baseRec({ NAV_STATUS: '' })), undefined);
  });

  it('classifies an NDB frequency in kHz rather than MHz', () => {
    const nav = buildNavaid(
      baseRec({ NAV_TYPE: 'NDB', NAV_STATUS: 'OPERATIONAL IFR', FREQ: '380' }),
    );
    assert.ok(nav);
    assert.equal(nav.frequencyKhz, 380);
    assert.equal(nav.frequencyMhz, undefined);
  });

  it('captures TACAN channel and city', () => {
    const nav = buildNavaid(baseRec({ CHAN: '76X', CITY: 'BOSTON' }));
    assert.ok(nav);
    assert.equal(nav.tacanChannel, '76X');
    assert.equal(nav.city, 'BOSTON');
  });

  it('captures elevation when present', () => {
    const nav = buildNavaid(baseRec({ ELEV: '15' }));
    assert.equal(nav?.elevationFt, 15);
  });
});
