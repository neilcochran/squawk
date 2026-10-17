import { describe, it, expect, assert } from 'vitest';

import type { CsvRecord } from '@squawk/build-shared';
import type { Navaid } from '@squawk/types';

import {
  attachNavaidCheckpoints,
  attachNavaidRemarks,
  buildNavaid,
  buildNavaidCheckpoint,
  buildNavaidRemark,
  navaidKey,
} from './parse-navaids.js';

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

describe('buildNavaid - DME status', () => {
  it('maps the status of the distance component', () => {
    const nav = buildNavaid(
      baseRec({ NAV_STATUS: 'OPERATIONAL RESTRICTED', TACAN_DME_STATUS: 'OPERATIONAL IFR' }),
    );
    expect(nav?.status).toBe('OPERATIONAL_RESTRICTED');
    expect(nav?.dmeStatus).toBe('OPERATIONAL_IFR');
  });

  it('leaves the DME status unset when the column is blank', () => {
    expect(buildNavaid(baseRec({ TACAN_DME_STATUS: '' }))?.dmeStatus).toBe(undefined);
    expect(buildNavaid(baseRec())?.dmeStatus).toBe(undefined);
  });

  it('keeps the navaid and leaves the DME status unset when the value is unknown', () => {
    const nav = buildNavaid(baseRec({ TACAN_DME_STATUS: 'NOT A STATUS' }));
    assert(nav);
    expect(nav.dmeStatus).toBe(undefined);
  });
});

describe('navaidKey', () => {
  it('joins the identifier, type, state, city and country', () => {
    expect(navaidKey(baseRec({ CITY: 'BOSTON' }))).toBe('BOS|VOR/DME|MA|BOSTON|US');
  });

  it('tells apart navaids that share an identifier and type', () => {
    const texas = navaidKey(baseRec({ NAV_ID: 'IL', NAV_TYPE: 'NDB', STATE_CODE: 'TX' }));
    const ohio = navaidKey(baseRec({ NAV_ID: 'IL', NAV_TYPE: 'NDB', STATE_CODE: 'OH' }));
    expect(texas).not.toBe(ohio);
  });

  it('treats a missing state, city or country as blank', () => {
    expect(navaidKey({ NAV_ID: 'YBC', NAV_TYPE: 'VOR/DME' })).toBe('YBC|VOR/DME|||');
  });

  it('returns undefined without an identifier or type', () => {
    expect(navaidKey(baseRec({ NAV_ID: '' }))).toBe(undefined);
    expect(navaidKey(baseRec({ NAV_TYPE: '' }))).toBe(undefined);
  });
});

describe('buildNavaidRemark', () => {
  it('returns the trimmed remark text', () => {
    expect(
      buildNavaidRemark({
        REF_COL_NAME: 'GENERAL_REMARK',
        REMARK: ' VOR UNUSBL 163-236 BYD 40 NM BLW 18000 FT. ',
      }),
    ).toBe('VOR UNUSBL 163-236 BYD 40 NM BLW 18000 FT.');
  });

  it('keeps a remark attached to a specific column', () => {
    expect(
      buildNavaidRemark({
        REF_COL_NAME: 'OPER_HOURS',
        REMARK: 'TACAN OPR ONLY DUR NOTAM HR CLASS D AIRSPACE.',
      }),
    ).toBe('TACAN OPR ONLY DUR NOTAM HR CLASS D AIRSPACE.');
  });

  it('drops a note on how the position or elevation was surveyed', () => {
    expect(
      buildNavaidRemark({ REF_COL_NAME: 'LAT_LONG_SOURCE_CODE', REMARK: '3RD PARTY SURVEY.' }),
    ).toBe(undefined);
    expect(buildNavaidRemark({ REF_COL_NAME: 'ELEV', REMARK: '3RD PARTY.' })).toBe(undefined);
  });

  it('keeps a remark that names no reference column', () => {
    expect(buildNavaidRemark({ REMARK: 'NDB UNUSBL BYD 15 NM.' })).toBe('NDB UNUSBL BYD 15 NM.');
  });

  it('returns undefined for an empty or missing remark', () => {
    expect(buildNavaidRemark({ REF_COL_NAME: 'GENERAL_REMARK', REMARK: '   ' })).toBe(undefined);
    expect(buildNavaidRemark({ REF_COL_NAME: 'GENERAL_REMARK' })).toBe(undefined);
  });
});

describe('buildNavaidCheckpoint', () => {
  it('builds a ground checkpoint', () => {
    expect(
      buildNavaidCheckpoint({
        AIR_GND_CODE: 'G',
        BRG: '242',
        ALTITUDE: '',
        ARPT_ID: 'ACK',
        CHK_DESC: '1.9 NM ON RUNUP AREA AT APCH END RWY 24. ',
      }),
    ).toEqual({
      type: 'GROUND',
      magneticBearingDeg: 242,
      airportId: 'ACK',
      description: '1.9 NM ON RUNUP AREA AT APCH END RWY 24.',
    });
  });

  it('maps the second ground checkpoint code to a ground checkpoint', () => {
    const checkpoint = buildNavaidCheckpoint({
      AIR_GND_CODE: 'G1',
      BRG: '30',
      ARPT_ID: 'GTF',
      CHK_DESC: '2.9 NM AT INTERSECTION OF TWY A/A3.',
    });
    expect(checkpoint?.type).toBe('GROUND');
  });

  it('builds an airborne checkpoint with its altitude', () => {
    expect(
      buildNavaidCheckpoint({
        AIR_GND_CODE: 'A',
        BRG: '90',
        ALTITUDE: '2500',
        ARPT_ID: '',
        CHK_DESC: 'OVER WATER TANK 6 NM EAST.',
      }),
    ).toEqual({
      type: 'AIRBORNE',
      magneticBearingDeg: 90,
      altitudeFt: 2500,
      description: 'OVER WATER TANK 6 NM EAST.',
    });
  });

  it('returns undefined when the code, bearing or description is missing', () => {
    const complete = { AIR_GND_CODE: 'G', BRG: '242', CHK_DESC: 'ON RAMP.' };
    expect(buildNavaidCheckpoint({ ...complete, AIR_GND_CODE: '' })).toBe(undefined);
    expect(buildNavaidCheckpoint({ ...complete, BRG: '' })).toBe(undefined);
    expect(buildNavaidCheckpoint({ ...complete, CHK_DESC: '  ' })).toBe(undefined);
  });

  it('returns undefined for an unknown checkpoint code', () => {
    expect(buildNavaidCheckpoint({ AIR_GND_CODE: 'Z', BRG: '242', CHK_DESC: 'ON RAMP.' })).toBe(
      undefined,
    );
  });
});

describe('attaching remarks and checkpoints', () => {
  /**
   * Builds the BOSTON VOR/DME and a map holding it under its key.
   *
   * @returns The navaid and the keyed map the attach functions take.
   */
  function bostonByKey(): { navaid: Navaid; navaidsByKey: Map<string, Navaid> } {
    const rec = baseRec({ CITY: 'BOSTON' });
    const navaid = buildNavaid(rec);
    const key = navaidKey(rec);
    assert(navaid && key !== undefined);
    return { navaid, navaidsByKey: new Map([[key, navaid]]) };
  }

  it('attaches remarks to the matching navaid in file order', () => {
    const { navaid, navaidsByKey } = bostonByKey();
    const attached = attachNavaidRemarks(navaidsByKey, [
      baseRec({ CITY: 'BOSTON', REF_COL_NAME: 'GENERAL_REMARK', REMARK: 'VOR UNUSBL 010-020.' }),
      baseRec({ CITY: 'BOSTON', REF_COL_NAME: 'LAT_LONG_SOURCE_CODE', REMARK: '3RD PARTY.' }),
      baseRec({ CITY: 'BOSTON', REF_COL_NAME: 'GENERAL_REMARK', REMARK: 'DME UNUSBL 030-040.' }),
    ]);
    expect(attached).toBe(2);
    expect(navaid.remarks).toEqual(['VOR UNUSBL 010-020.', 'DME UNUSBL 030-040.']);
  });

  it('skips remarks for a navaid that is not in the map', () => {
    const { navaid, navaidsByKey } = bostonByKey();
    const attached = attachNavaidRemarks(navaidsByKey, [
      baseRec({ NAV_ID: 'XYZ', CITY: 'BOSTON', REF_COL_NAME: 'GENERAL_REMARK', REMARK: 'X.' }),
      { REF_COL_NAME: 'GENERAL_REMARK', REMARK: 'NO KEY.' },
    ]);
    expect(attached).toBe(0);
    expect(navaid.remarks).toBe(undefined);
  });

  it('attaches checkpoints to the matching navaid', () => {
    const { navaid, navaidsByKey } = bostonByKey();
    const attached = attachNavaidCheckpoints(navaidsByKey, [
      baseRec({ CITY: 'BOSTON', AIR_GND_CODE: 'G', BRG: '133', ARPT_ID: 'BOS', CHK_DESC: 'A.' }),
      baseRec({ CITY: 'BOSTON', AIR_GND_CODE: 'G', BRG: '225', ARPT_ID: 'BOS', CHK_DESC: 'B.' }),
    ]);
    expect(attached).toBe(2);
    expect(navaid.checkpoints?.map((c) => c.magneticBearingDeg)).toEqual([133, 225]);
  });

  it('skips checkpoints that are incomplete or belong to another navaid', () => {
    const { navaid, navaidsByKey } = bostonByKey();
    const attached = attachNavaidCheckpoints(navaidsByKey, [
      baseRec({ CITY: 'BOSTON', AIR_GND_CODE: 'G', BRG: '', CHK_DESC: 'NO BEARING.' }),
      baseRec({ NAV_ID: 'XYZ', CITY: 'BOSTON', AIR_GND_CODE: 'G', BRG: '1', CHK_DESC: 'X.' }),
      { AIR_GND_CODE: 'G', BRG: '1', CHK_DESC: 'NO KEY.' },
    ]);
    expect(attached).toBe(0);
    expect(navaid.checkpoints).toBe(undefined);
  });
});
