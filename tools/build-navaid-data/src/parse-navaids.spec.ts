import { describe, it, expect, assert } from 'vitest';
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
      assert(nav);
      expect(nav.identifier).toBe('BOS');
      expect(nav.name).toBe('BOSTON');
      expect(nav.type).toBe('VOR/DME');
      expect(nav.status).toBe('OPERATIONAL_IFR');
      expect(nav.lat).toBe(42.3575);
      expect(nav.lon).toBe(-70.989167);
      expect(nav.state).toBe('MA');
      expect(nav.country).toBe('US');
    });

    it('returns undefined when NAV_ID is missing', () => {
      expect(buildNavaid(baseRec({ NAV_ID: '' }))).toBe(undefined);
    });

    it('returns undefined when NAME is missing', () => {
      expect(buildNavaid(baseRec({ NAME: '' }))).toBe(undefined);
    });

    it('returns undefined when coordinates are missing', () => {
      expect(buildNavaid(baseRec({ LAT_DECIMAL: '' }))).toBe(undefined);
      expect(buildNavaid(baseRec({ LONG_DECIMAL: '' }))).toBe(undefined);
    });

    it('returns undefined when NAV_TYPE is unknown', () => {
      expect(buildNavaid(baseRec({ NAV_TYPE: 'UNKNOWN' }))).toBe(undefined);
    });

    it('returns undefined when NAV_STATUS is unknown', () => {
      expect(buildNavaid(baseRec({ NAV_STATUS: 'UNKNOWN' }))).toBe(undefined);
    });

    it('maps NAVAID status codes correctly', () => {
      expect(buildNavaid(baseRec({ NAV_STATUS: 'OPERATIONAL RESTRICTED' }))?.status).toBe(
        'OPERATIONAL_RESTRICTED',
      );
      expect(buildNavaid(baseRec({ NAV_STATUS: 'OPERATIONAL VFR ONLY' }))?.status).toBe(
        'OPERATIONAL_VFR',
      );
      expect(buildNavaid(baseRec({ NAV_STATUS: 'SHUTDOWN' }))?.status).toBe('SHUTDOWN');
    });

    it('maps navaid types correctly', () => {
      expect(buildNavaid(baseRec({ NAV_TYPE: 'VOR' }))?.type).toBe('VOR');
      expect(buildNavaid(baseRec({ NAV_TYPE: 'VORTAC' }))?.type).toBe('VORTAC');
      expect(buildNavaid(baseRec({ NAV_TYPE: 'NDB' }))?.type).toBe('NDB');
      expect(buildNavaid(baseRec({ NAV_TYPE: 'NDB/DME' }))?.type).toBe('NDB/DME');
      expect(buildNavaid(baseRec({ NAV_TYPE: 'FAN MARKER' }))?.type).toBe('FAN_MARKER');
      expect(buildNavaid(baseRec({ NAV_TYPE: 'MARINE NDB' }))?.type).toBe('MARINE_NDB');
    });
  });

  describe('frequency routing', () => {
    it('stores frequency as MHz for VOR-family types', () => {
      const vor = buildNavaid(baseRec({ NAV_TYPE: 'VOR', FREQ: '112.7' }));
      expect(vor?.frequencyMhz).toBe(112.7);
      expect(vor?.frequencyKhz).toBe(undefined);

      const tacan = buildNavaid(baseRec({ NAV_TYPE: 'TACAN', FREQ: '108.9' }));
      expect(tacan?.frequencyMhz).toBe(108.9);
    });

    it('stores frequency as kHz for NDB-family types', () => {
      const ndb = buildNavaid(baseRec({ NAV_TYPE: 'NDB', FREQ: '394' }));
      expect(ndb?.frequencyKhz).toBe(394);
      expect(ndb?.frequencyMhz).toBe(undefined);

      const ndbDme = buildNavaid(baseRec({ NAV_TYPE: 'NDB/DME', FREQ: '245' }));
      expect(ndbDme?.frequencyKhz).toBe(245);
    });

    it('leaves frequency undefined when FREQ is blank', () => {
      const nav = buildNavaid(baseRec({ NAV_TYPE: 'VOR', FREQ: '' }));
      expect(nav?.frequencyMhz).toBe(undefined);
      expect(nav?.frequencyKhz).toBe(undefined);
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
      expect(nav?.city).toBe('BOSTON');
      expect(nav?.elevationFt).toBe(19);
      expect(nav?.tacanChannel).toBe('110X');
    });

    it('includes magnetic variation fields', () => {
      const nav = buildNavaid(
        baseRec({ MAG_VARN: '14', MAG_VARN_HEMIS: 'W', MAG_VARN_YEAR: '2020' }),
      );
      expect(nav?.magneticVariationDeg).toBe(14);
      expect(nav?.magneticVariationDirection).toBe('W');
      expect(nav?.magneticVariationYear).toBe(2020);
    });

    it('sets simultaneousVoice and publicUse from Y flags only', () => {
      const yes = buildNavaid(baseRec({ SIMUL_VOICE_FLAG: 'Y', PUBLIC_USE_FLAG: 'Y' }));
      const no = buildNavaid(baseRec({ SIMUL_VOICE_FLAG: 'N', PUBLIC_USE_FLAG: 'N' }));
      expect(yes?.simultaneousVoice).toBe(true);
      expect(yes?.publicUse).toBe(true);
      expect(no?.simultaneousVoice).toBe(undefined);
      expect(no?.publicUse).toBe(undefined);
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
      expect(nav?.lowArtccId).toBe('ZBW');
      expect(nav?.highArtccId).toBe('ZNY');
      expect(nav?.markerIdentifier).toBe('BM');
      expect(nav?.markerShape).toBe('FAN');
      expect(nav?.markerBearingDeg).toBe(90);
    });

    it('omits state when blank', () => {
      const nav = buildNavaid(baseRec({ STATE_CODE: '' }));
      expect(nav?.state).toBe(undefined);
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
      expect(nav?.dmeLat).toBe(42.001);
      expect(nav?.dmeLon).toBe(-70.001);
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
      expect(nav?.dmeLat).toBe(undefined);
      expect(nav?.dmeLon).toBe(undefined);
    });
  });
});
