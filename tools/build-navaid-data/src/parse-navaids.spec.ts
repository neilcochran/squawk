import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { buildNavaid } from './parse-navaids.js';
import type { CsvRecord } from '@squawk/build-shared';

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

describe('buildNavaid', () => {
  describe('required field validation', () => {
    it('builds a minimal valid navaid', () => {
      const nav = buildNavaid(baseRec());
      assert.ok(nav);
      assert.equal(nav.identifier, 'BOS');
      assert.equal(nav.name, 'BOSTON');
      assert.equal(nav.type, 'VOR/DME');
      assert.equal(nav.status, 'OPERATIONAL_IFR');
      assert.equal(nav.lat, 42.3575);
      assert.equal(nav.lon, -70.989167);
      assert.equal(nav.state, 'MA');
      assert.equal(nav.country, 'US');
    });

    it('returns undefined when NAV_ID is missing', () => {
      assert.equal(buildNavaid(baseRec({ NAV_ID: '' })), undefined);
    });

    it('returns undefined when NAME is missing', () => {
      assert.equal(buildNavaid(baseRec({ NAME: '' })), undefined);
    });

    it('returns undefined when coordinates are missing', () => {
      assert.equal(buildNavaid(baseRec({ LAT_DECIMAL: '' })), undefined);
      assert.equal(buildNavaid(baseRec({ LONG_DECIMAL: '' })), undefined);
    });

    it('returns undefined when NAV_TYPE is unknown', () => {
      assert.equal(buildNavaid(baseRec({ NAV_TYPE: 'UNKNOWN' })), undefined);
    });

    it('returns undefined when NAV_STATUS is unknown', () => {
      assert.equal(buildNavaid(baseRec({ NAV_STATUS: 'UNKNOWN' })), undefined);
    });

    it('maps NAVAID status codes correctly', () => {
      assert.equal(
        buildNavaid(baseRec({ NAV_STATUS: 'OPERATIONAL RESTRICTED' }))?.status,
        'OPERATIONAL_RESTRICTED',
      );
      assert.equal(
        buildNavaid(baseRec({ NAV_STATUS: 'OPERATIONAL VFR ONLY' }))?.status,
        'OPERATIONAL_VFR',
      );
      assert.equal(buildNavaid(baseRec({ NAV_STATUS: 'SHUTDOWN' }))?.status, 'SHUTDOWN');
    });

    it('maps navaid types correctly', () => {
      assert.equal(buildNavaid(baseRec({ NAV_TYPE: 'VOR' }))?.type, 'VOR');
      assert.equal(buildNavaid(baseRec({ NAV_TYPE: 'VORTAC' }))?.type, 'VORTAC');
      assert.equal(buildNavaid(baseRec({ NAV_TYPE: 'NDB' }))?.type, 'NDB');
      assert.equal(buildNavaid(baseRec({ NAV_TYPE: 'NDB/DME' }))?.type, 'NDB/DME');
      assert.equal(buildNavaid(baseRec({ NAV_TYPE: 'FAN MARKER' }))?.type, 'FAN_MARKER');
      assert.equal(buildNavaid(baseRec({ NAV_TYPE: 'MARINE NDB' }))?.type, 'MARINE_NDB');
    });
  });

  describe('frequency routing', () => {
    it('stores frequency as MHz for VOR-family types', () => {
      const vor = buildNavaid(baseRec({ NAV_TYPE: 'VOR', FREQ: '112.7' }));
      assert.equal(vor?.frequencyMhz, 112.7);
      assert.equal(vor?.frequencyKhz, undefined);

      const tacan = buildNavaid(baseRec({ NAV_TYPE: 'TACAN', FREQ: '108.9' }));
      assert.equal(tacan?.frequencyMhz, 108.9);
    });

    it('stores frequency as kHz for NDB-family types', () => {
      const ndb = buildNavaid(baseRec({ NAV_TYPE: 'NDB', FREQ: '394' }));
      assert.equal(ndb?.frequencyKhz, 394);
      assert.equal(ndb?.frequencyMhz, undefined);

      const ndbDme = buildNavaid(baseRec({ NAV_TYPE: 'NDB/DME', FREQ: '245' }));
      assert.equal(ndbDme?.frequencyKhz, 245);
    });

    it('leaves frequency undefined when FREQ is blank', () => {
      const nav = buildNavaid(baseRec({ NAV_TYPE: 'VOR', FREQ: '' }));
      assert.equal(nav?.frequencyMhz, undefined);
      assert.equal(nav?.frequencyKhz, undefined);
    });
  });

  describe('optional fields', () => {
    it('includes city, elevation, and TACAN channel when present', () => {
      const nav = buildNavaid(
        baseRec({
          CITY: 'BOSTON',
          ELEV: '19',
          CHAN: '110X',
        }),
      );
      assert.equal(nav?.city, 'BOSTON');
      assert.equal(nav?.elevationFt, 19);
      assert.equal(nav?.tacanChannel, '110X');
    });

    it('includes magnetic variation fields', () => {
      const nav = buildNavaid(
        baseRec({ MAG_VARN: '14', MAG_VARN_HEMIS: 'W', MAG_VARN_YEAR: '2020' }),
      );
      assert.equal(nav?.magneticVariationDeg, 14);
      assert.equal(nav?.magneticVariationDirection, 'W');
      assert.equal(nav?.magneticVariationYear, 2020);
    });

    it('sets simultaneousVoice and publicUse from Y flags only', () => {
      const yes = buildNavaid(baseRec({ SIMUL_VOICE_FLAG: 'Y', PUBLIC_USE_FLAG: 'Y' }));
      const no = buildNavaid(baseRec({ SIMUL_VOICE_FLAG: 'N', PUBLIC_USE_FLAG: 'N' }));
      assert.equal(yes?.simultaneousVoice, true);
      assert.equal(yes?.publicUse, true);
      assert.equal(no?.simultaneousVoice, undefined);
      assert.equal(no?.publicUse, undefined);
    });

    it('includes low/high ARTCC identifiers and marker fields', () => {
      const nav = buildNavaid(
        baseRec({
          LOW_ALT_ARTCC_ID: 'ZBW',
          HIGH_ALT_ARTCC_ID: 'ZNY',
          MKR_IDENT: 'BM',
          MKR_SHAPE: 'FAN',
          MKR_BRG: '90',
        }),
      );
      assert.equal(nav?.lowArtccId, 'ZBW');
      assert.equal(nav?.highArtccId, 'ZNY');
      assert.equal(nav?.markerIdentifier, 'BM');
      assert.equal(nav?.markerShape, 'FAN');
      assert.equal(nav?.markerBearingDeg, 90);
    });

    it('omits state when blank', () => {
      const nav = buildNavaid(baseRec({ STATE_CODE: '' }));
      assert.equal(nav?.state, undefined);
    });
  });

  describe('DME sub-component location', () => {
    it('sets dmeLat/dmeLon when they differ from the primary lat/lon', () => {
      const nav = buildNavaid(
        baseRec({
          LAT_DECIMAL: '42.000',
          LONG_DECIMAL: '-70.000',
          TACAN_DME_LAT_DECIMAL: '42.001',
          TACAN_DME_LONG_DECIMAL: '-70.001',
        }),
      );
      assert.equal(nav?.dmeLat, 42.001);
      assert.equal(nav?.dmeLon, -70.001);
    });

    it('omits dmeLat/dmeLon when they match the primary lat/lon', () => {
      const nav = buildNavaid(
        baseRec({
          LAT_DECIMAL: '42.000',
          LONG_DECIMAL: '-70.000',
          TACAN_DME_LAT_DECIMAL: '42.000',
          TACAN_DME_LONG_DECIMAL: '-70.000',
        }),
      );
      assert.equal(nav?.dmeLat, undefined);
      assert.equal(nav?.dmeLon, undefined);
    });
  });
});
