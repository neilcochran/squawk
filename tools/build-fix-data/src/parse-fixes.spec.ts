import { describe, it, expect, assert } from 'vitest';
import { buildFix, buildNavaidAssociation } from './parse-fixes.js';
import type { CsvRecord } from '@squawk/build-shared';

function baseRec(overrides: Partial<CsvRecord> = {}): CsvRecord {
  return {
    FIX_ID: 'OBAAK',
    ICAO_REGION_CODE: 'K6',
    STATE_CODE: 'NY',
    COUNTRY_CODE: 'US',
    LAT_DECIMAL: '40.123456',
    LONG_DECIMAL: '-73.987654',
    FIX_USE_CODE: 'WP',
    ...overrides,
  };
}

describe('buildFix', () => {
  describe('required field validation', () => {
    it('builds a minimal fix', () => {
      const fix = buildFix(baseRec());
      assert(fix);
      expect(fix.identifier).toBe('OBAAK');
      expect(fix.icaoRegionCode).toBe('K6');
      expect(fix.state).toBe('NY');
      expect(fix.country).toBe('US');
      expect(fix.useCode).toBe('WP');
      expect(fix.lat).toBe(40.123456);
      expect(fix.lon).toBe(-73.987654);
      expect(fix.chartTypes).toEqual([]);
      expect(fix.navaidAssociations).toEqual([]);
    });

    it('returns undefined when FIX_ID is missing', () => {
      expect(buildFix(baseRec({ FIX_ID: '' }))).toBe(undefined);
    });

    it('returns undefined when ICAO_REGION_CODE is missing', () => {
      expect(buildFix(baseRec({ ICAO_REGION_CODE: '' }))).toBe(undefined);
    });

    it('returns undefined when coordinates are missing', () => {
      expect(buildFix(baseRec({ LAT_DECIMAL: '' }))).toBe(undefined);
      expect(buildFix(baseRec({ LONG_DECIMAL: '' }))).toBe(undefined);
    });

    it('returns undefined when FIX_USE_CODE is missing or unknown', () => {
      expect(buildFix(baseRec({ FIX_USE_CODE: '' }))).toBe(undefined);
      expect(buildFix(baseRec({ FIX_USE_CODE: 'ZZ' }))).toBe(undefined);
    });

    it('trims the FIX_USE_CODE before lookup', () => {
      const fix = buildFix(baseRec({ FIX_USE_CODE: '  WP  ' }));
      expect(fix?.useCode).toBe('WP');
    });

    it('accepts each valid FIX_USE_CODE', () => {
      for (const code of ['WP', 'RP', 'MW', 'MR', 'CN', 'VFR', 'NRS', 'RADAR']) {
        expect(buildFix(baseRec({ FIX_USE_CODE: code }))?.useCode).toBe(code);
      }
    });
  });

  describe('boolean flags', () => {
    it('sets pitch, catch, and suaAtcaa to true only when the flag is "Y"', () => {
      const yes = buildFix(baseRec({ PITCH_FLAG: 'Y', CATCH_FLAG: 'Y', SUA_ATCAA_FLAG: 'Y' }));
      const no = buildFix(baseRec({ PITCH_FLAG: 'N', CATCH_FLAG: 'N', SUA_ATCAA_FLAG: 'N' }));
      expect(yes?.pitch).toBe(true);
      expect(yes?.catch).toBe(true);
      expect(yes?.suaAtcaa).toBe(true);
      expect(no?.pitch).toBe(false);
      expect(no?.catch).toBe(false);
      expect(no?.suaAtcaa).toBe(false);
    });
  });

  describe('optional fields', () => {
    it('populates ARTCC identifiers', () => {
      const fix = buildFix(baseRec({ ARTCC_ID_HIGH: 'ZNY', ARTCC_ID_LOW: 'ZBW' }));
      expect(fix?.highArtccId).toBe('ZNY');
      expect(fix?.lowArtccId).toBe('ZBW');
    });

    it('parses MIN_RECEP_ALT as integer feet', () => {
      const fix = buildFix(baseRec({ MIN_RECEP_ALT: '3000' }));
      expect(fix?.minimumReceptionAltitudeFt).toBe(3000);
    });

    it('maps the COMPULSORY field', () => {
      expect(buildFix(baseRec({ COMPULSORY: 'HIGH' }))?.compulsory).toBe('HIGH');
      expect(buildFix(baseRec({ COMPULSORY: 'LOW' }))?.compulsory).toBe('LOW');
      expect(buildFix(baseRec({ COMPULSORY: 'LOW/HIGH' }))?.compulsory).toBe('LOW/HIGH');
    });

    it('ignores unknown COMPULSORY values silently', () => {
      const fix = buildFix(baseRec({ COMPULSORY: 'MAYBE' }));
      expect(fix?.compulsory).toBe(undefined);
    });

    it('captures previousIdentifier and chartingRemark', () => {
      const fix = buildFix(baseRec({ FIX_ID_OLD: 'OLD01', CHARTING_REMARK: 'See remark.' }));
      expect(fix?.previousIdentifier).toBe('OLD01');
      expect(fix?.chartingRemark).toBe('See remark.');
    });

    it('parses CHARTS field into trimmed, non-empty chart types', () => {
      const fix = buildFix(baseRec({ CHARTS: 'LOW,HIGH ,, DP' }));
      expect(fix?.chartTypes).toEqual(['LOW', 'HIGH', 'DP']);
    });

    it('omits state when blank', () => {
      const fix = buildFix(baseRec({ STATE_CODE: '' }));
      expect(fix?.state).toBe(undefined);
    });
  });
});

describe('buildNavaidAssociation', () => {
  it('builds an association from complete fields', () => {
    const assoc = buildNavaidAssociation({
      NAV_ID: 'BOS',
      NAV_TYPE: 'VOR/DME',
      BEARING: '240.0',
      DISTANCE: '17.3',
    });
    expect(assoc).toEqual({
      navaidId: 'BOS',
      navaidType: 'VOR/DME',
      bearingDeg: 240,
      distanceNm: 17.3,
    });
  });

  it('returns undefined when NAV_ID is missing', () => {
    expect(
      buildNavaidAssociation({ NAV_ID: '', NAV_TYPE: 'VOR', BEARING: '1', DISTANCE: '2' }),
    ).toBe(undefined);
  });

  it('returns undefined when NAV_TYPE is missing', () => {
    expect(
      buildNavaidAssociation({ NAV_ID: 'BOS', NAV_TYPE: '', BEARING: '1', DISTANCE: '2' }),
    ).toBe(undefined);
  });

  it('returns undefined when bearing or distance is missing or non-numeric', () => {
    expect(
      buildNavaidAssociation({
        NAV_ID: 'BOS',
        NAV_TYPE: 'VOR',
        BEARING: '',
        DISTANCE: '5',
      }),
    ).toBe(undefined);
    expect(
      buildNavaidAssociation({
        NAV_ID: 'BOS',
        NAV_TYPE: 'VOR',
        BEARING: 'nope',
        DISTANCE: '5',
      }),
    ).toBe(undefined);
  });
});
