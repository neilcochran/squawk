import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFix, buildNavaidAssociation } from './parse-fixes.js';
import type { CsvRecord } from './parse-csv.js';

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
      assert.ok(fix);
      assert.equal(fix.identifier, 'OBAAK');
      assert.equal(fix.icaoRegionCode, 'K6');
      assert.equal(fix.state, 'NY');
      assert.equal(fix.country, 'US');
      assert.equal(fix.useCode, 'WP');
      assert.equal(fix.lat, 40.123456);
      assert.equal(fix.lon, -73.987654);
      assert.deepEqual(fix.chartTypes, []);
      assert.deepEqual(fix.navaidAssociations, []);
    });

    it('returns undefined when FIX_ID is missing', () => {
      assert.equal(buildFix(baseRec({ FIX_ID: '' })), undefined);
    });

    it('returns undefined when ICAO_REGION_CODE is missing', () => {
      assert.equal(buildFix(baseRec({ ICAO_REGION_CODE: '' })), undefined);
    });

    it('returns undefined when coordinates are missing', () => {
      assert.equal(buildFix(baseRec({ LAT_DECIMAL: '' })), undefined);
      assert.equal(buildFix(baseRec({ LONG_DECIMAL: '' })), undefined);
    });

    it('returns undefined when FIX_USE_CODE is missing or unknown', () => {
      assert.equal(buildFix(baseRec({ FIX_USE_CODE: '' })), undefined);
      assert.equal(buildFix(baseRec({ FIX_USE_CODE: 'ZZ' })), undefined);
    });

    it('trims the FIX_USE_CODE before lookup', () => {
      const fix = buildFix(baseRec({ FIX_USE_CODE: '  WP  ' }));
      assert.equal(fix?.useCode, 'WP');
    });

    it('accepts each valid FIX_USE_CODE', () => {
      for (const code of ['WP', 'RP', 'MW', 'MR', 'CN', 'VFR', 'NRS', 'RADAR']) {
        assert.equal(buildFix(baseRec({ FIX_USE_CODE: code }))?.useCode, code);
      }
    });
  });

  describe('boolean flags', () => {
    it('sets pitch, catch, and suaAtcaa to true only when the flag is "Y"', () => {
      const yes = buildFix(baseRec({ PITCH_FLAG: 'Y', CATCH_FLAG: 'Y', SUA_ATCAA_FLAG: 'Y' }));
      const no = buildFix(baseRec({ PITCH_FLAG: 'N', CATCH_FLAG: 'N', SUA_ATCAA_FLAG: 'N' }));
      assert.equal(yes?.pitch, true);
      assert.equal(yes?.catch, true);
      assert.equal(yes?.suaAtcaa, true);
      assert.equal(no?.pitch, false);
      assert.equal(no?.catch, false);
      assert.equal(no?.suaAtcaa, false);
    });
  });

  describe('optional fields', () => {
    it('populates ARTCC identifiers', () => {
      const fix = buildFix(baseRec({ ARTCC_ID_HIGH: 'ZNY', ARTCC_ID_LOW: 'ZBW' }));
      assert.equal(fix?.highArtccId, 'ZNY');
      assert.equal(fix?.lowArtccId, 'ZBW');
    });

    it('parses MIN_RECEP_ALT as integer feet', () => {
      const fix = buildFix(baseRec({ MIN_RECEP_ALT: '3000' }));
      assert.equal(fix?.minimumReceptionAltitudeFt, 3000);
    });

    it('maps the COMPULSORY field', () => {
      assert.equal(buildFix(baseRec({ COMPULSORY: 'HIGH' }))?.compulsory, 'HIGH');
      assert.equal(buildFix(baseRec({ COMPULSORY: 'LOW' }))?.compulsory, 'LOW');
      assert.equal(buildFix(baseRec({ COMPULSORY: 'LOW/HIGH' }))?.compulsory, 'LOW/HIGH');
    });

    it('ignores unknown COMPULSORY values silently', () => {
      const fix = buildFix(baseRec({ COMPULSORY: 'MAYBE' }));
      assert.equal(fix?.compulsory, undefined);
    });

    it('captures previousIdentifier and chartingRemark', () => {
      const fix = buildFix(baseRec({ FIX_ID_OLD: 'OLD01', CHARTING_REMARK: 'See remark.' }));
      assert.equal(fix?.previousIdentifier, 'OLD01');
      assert.equal(fix?.chartingRemark, 'See remark.');
    });

    it('parses CHARTS field into trimmed, non-empty chart types', () => {
      const fix = buildFix(baseRec({ CHARTS: 'LOW,HIGH ,, DP' }));
      assert.deepEqual(fix?.chartTypes, ['LOW', 'HIGH', 'DP']);
    });

    it('omits state when blank', () => {
      const fix = buildFix(baseRec({ STATE_CODE: '' }));
      assert.equal(fix?.state, undefined);
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
    assert.deepEqual(assoc, {
      navaidId: 'BOS',
      navaidType: 'VOR/DME',
      bearingDeg: 240,
      distanceNm: 17.3,
    });
  });

  it('returns undefined when NAV_ID is missing', () => {
    assert.equal(
      buildNavaidAssociation({ NAV_ID: '', NAV_TYPE: 'VOR', BEARING: '1', DISTANCE: '2' }),
      undefined,
    );
  });

  it('returns undefined when NAV_TYPE is missing', () => {
    assert.equal(
      buildNavaidAssociation({ NAV_ID: 'BOS', NAV_TYPE: '', BEARING: '1', DISTANCE: '2' }),
      undefined,
    );
  });

  it('returns undefined when bearing or distance is missing or non-numeric', () => {
    assert.equal(
      buildNavaidAssociation({
        NAV_ID: 'BOS',
        NAV_TYPE: 'VOR',
        BEARING: '',
        DISTANCE: '5',
      }),
      undefined,
    );
    assert.equal(
      buildNavaidAssociation({
        NAV_ID: 'BOS',
        NAV_TYPE: 'VOR',
        BEARING: 'nope',
        DISTANCE: '5',
      }),
      undefined,
    );
  });
});
