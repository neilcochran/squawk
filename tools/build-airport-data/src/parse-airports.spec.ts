import { describe, it, expect, assert } from 'vitest';

import type { CsvRecord } from '@squawk/build-shared';

import { buildAirport } from './parse-airports.js';

function baseRec(overrides: Partial<CsvRecord> = {}): CsvRecord {
  return {
    ARPT_ID: 'JFK',
    ARPT_NAME: 'JOHN F KENNEDY INTL',
    CITY: 'NEW YORK',
    STATE_CODE: 'NY',
    COUNTRY_CODE: 'US',
    SITE_NO: '15793.*A',
    LAT_DECIMAL: '40.6398',
    LONG_DECIMAL: '-73.7789',
    SITE_TYPE_CODE: 'A',
    OWNERSHIP_TYPE_CODE: 'PU',
    FACILITY_USE_CODE: 'PU',
    ARPT_STATUS: 'O',
    ...overrides,
  };
}

describe('buildAirport', () => {
  describe('required field validation', () => {
    it('builds a minimal valid airport', () => {
      const airport = buildAirport(baseRec(), [], [], [], [], [], []);
      assert(airport);
      expect(airport.faaId).toBe('JFK');
      expect(airport.name).toBe('JOHN F KENNEDY INTL');
      expect(airport.facilityType).toBe('AIRPORT');
      expect(airport.ownershipType).toBe('PUBLIC');
      expect(airport.useType).toBe('PUBLIC');
      expect(airport.status).toBe('OPEN');
      expect(airport.city).toBe('NEW YORK');
      expect(airport.state).toBe('NY');
      expect(airport.country).toBe('US');
      expect(airport.lat).toBe(40.6398);
      expect(airport.lon).toBe(-73.7789);
      expect(airport.timezone).toBe('America/New_York');
      expect(airport.runways).toEqual([]);
      expect(airport.frequencies).toEqual([]);
    });

    it('resolves timezones for airports across US time zones', () => {
      const la = buildAirport(
        baseRec({ ARPT_ID: 'LAX', LAT_DECIMAL: '33.9425', LONG_DECIMAL: '-118.4081' }),
        [],
        [],
        [],
        [],
        [],
        [],
      );
      expect(la?.timezone).toBe('America/Los_Angeles');

      const honolulu = buildAirport(
        baseRec({ ARPT_ID: 'HNL', LAT_DECIMAL: '21.3187', LONG_DECIMAL: '-157.9225' }),
        [],
        [],
        [],
        [],
        [],
        [],
      );
      expect(honolulu?.timezone).toBe('Pacific/Honolulu');

      const anchorage = buildAirport(
        baseRec({ ARPT_ID: 'ANC', LAT_DECIMAL: '61.1743', LONG_DECIMAL: '-149.9982' }),
        [],
        [],
        [],
        [],
        [],
        [],
      );
      expect(anchorage?.timezone).toBe('America/Anchorage');
    });

    it('returns undefined when ARPT_ID is missing', () => {
      expect(buildAirport(baseRec({ ARPT_ID: '' }), [], [], [], [], [], [])).toBe(undefined);
    });

    it('returns undefined when ARPT_NAME is missing', () => {
      expect(buildAirport(baseRec({ ARPT_NAME: '' }), [], [], [], [], [], [])).toBe(undefined);
    });

    it('returns undefined when LAT_DECIMAL is missing', () => {
      expect(buildAirport(baseRec({ LAT_DECIMAL: '' }), [], [], [], [], [], [])).toBe(undefined);
    });

    it('returns undefined when SITE_NO is missing', () => {
      expect(buildAirport(baseRec({ SITE_NO: '' }), [], [], [], [], [], [])).toBe(undefined);
    });

    it('returns undefined when SITE_TYPE_CODE is unknown', () => {
      expect(buildAirport(baseRec({ SITE_TYPE_CODE: 'ZZ' }), [], [], [], [], [], [])).toBe(
        undefined,
      );
    });

    it('returns undefined when OWNERSHIP_TYPE_CODE is unknown', () => {
      expect(buildAirport(baseRec({ OWNERSHIP_TYPE_CODE: 'ZZ' }), [], [], [], [], [], [])).toBe(
        undefined,
      );
    });

    it('maps facility type codes correctly', () => {
      expect(
        buildAirport(baseRec({ SITE_TYPE_CODE: 'H' }), [], [], [], [], [], [])?.facilityType,
      ).toBe('HELIPORT');
      expect(
        buildAirport(baseRec({ SITE_TYPE_CODE: 'C' }), [], [], [], [], [], [])?.facilityType,
      ).toBe('SEAPLANE_BASE');
    });

    it('maps all private ownership variants to PRIVATE', () => {
      for (const code of ['PR', 'MA', 'MN', 'MR', 'CG']) {
        const airport = buildAirport(
          baseRec({ OWNERSHIP_TYPE_CODE: code }),
          [],
          [],
          [],
          [],
          [],
          [],
        );
        expect(airport?.ownershipType, `code=${code}`).toBe('PRIVATE');
      }
    });
  });

  describe('optional base fields', () => {
    it('includes ICAO, elevation, and magnetic variation when present', () => {
      const airport = buildAirport(
        baseRec({
          ICAO_ID: 'KJFK',
          ELEV: '13',
          MAG_VARN: '13',
          MAG_HEMIS: 'W',
          MAG_VARN_YEAR: '2020',
          TPA: '1500',
        }),
        [],
        [],
        [],
        [],
        [],
        [],
      );
      assert(airport);
      expect(airport.icao).toBe('KJFK');
      expect(airport.elevationFt).toBe(13);
      expect(airport.magneticVariationDeg).toBe(13);
      expect(airport.magneticVariationDirection).toBe('W');
      expect(airport.magneticVariationYear).toBe(2020);
      expect(airport.trafficPatternAltitudeFt).toBe(1500);
    });

    it('omits state when blank', () => {
      const airport = buildAirport(baseRec({ STATE_CODE: '' }), [], [], [], [], [], []);
      assert(airport);
      expect(airport.state).toBe(undefined);
    });

    it('sets hasLandingFee true only when LNDG_FEE_FLAG is "Y"', () => {
      const yes = buildAirport(baseRec({ LNDG_FEE_FLAG: 'Y' }), [], [], [], [], [], []);
      const no = buildAirport(baseRec({ LNDG_FEE_FLAG: 'N' }), [], [], [], [], [], []);
      expect(yes?.hasLandingFee).toBe(true);
      expect(no?.hasLandingFee).toBe(undefined);
    });
  });

  describe('runway association', () => {
    it('includes only runways whose SITE_NO matches the airport', () => {
      const base = baseRec({ SITE_NO: 'SITE1' });
      const rwys: CsvRecord[] = [
        { SITE_NO: 'SITE1', RWY_ID: '04L/22R', RWY_LEN: '11351', RWY_WIDTH: '150' },
        { SITE_NO: 'OTHER', RWY_ID: 'OTHER', RWY_LEN: '1000' },
      ];
      const airport = buildAirport(base, rwys, [], [], [], [], []);
      expect(airport?.runways.length).toBe(1);
      expect(airport?.runways[0]?.id).toBe('04L/22R');
      expect(airport?.runways[0]?.lengthFt).toBe(11351);
      expect(airport?.runways[0]?.widthFt).toBe(150);
    });

    it('attaches runway ends to their parent runway via (SITE_NO, RWY_ID)', () => {
      const base = baseRec({ SITE_NO: 'SITE1' });
      const rwys: CsvRecord[] = [{ SITE_NO: 'SITE1', RWY_ID: '04L/22R' }];
      const ends: CsvRecord[] = [
        { SITE_NO: 'SITE1', RWY_ID: '04L/22R', RWY_END_ID: '04L', TRUE_ALIGNMENT: '40' },
        { SITE_NO: 'SITE1', RWY_ID: '04L/22R', RWY_END_ID: '22R', TRUE_ALIGNMENT: '220' },
      ];
      const airport = buildAirport(base, rwys, ends, [], [], [], []);
      const rwy = airport?.runways[0];
      expect(rwy?.ends.length).toBe(2);
      expect(rwy?.ends[0]?.id).toBe('04L');
      expect(rwy?.ends[0]?.trueHeadingDeg).toBe(40);
      expect(rwy?.ends[1]?.id).toBe('22R');
    });

    it('maps surface condition, treatment, and lighting codes', () => {
      const base = baseRec({ SITE_NO: 'S' });
      const rwys: CsvRecord[] = [
        {
          SITE_NO: 'S',
          RWY_ID: '1/19',
          COND: 'EXCELLENT',
          TREATMENT_CODE: 'GRVD',
          RWY_LGT_CODE: 'HIGH',
        },
      ];
      const airport = buildAirport(base, rwys, [], [], [], [], []);
      const rwy = airport?.runways[0];
      expect(rwy?.condition).toBe('EXCELLENT');
      expect(rwy?.treatment).toBe('GROOVED');
      expect(rwy?.lighting).toBe('HIGH');
    });
  });

  describe('runway end features', () => {
    it('sets hasRvr, hasReil, hasCenterlineLights, hasTdzLights only when flags are "Y"', () => {
      const base = baseRec({ SITE_NO: 'S' });
      const rwys: CsvRecord[] = [{ SITE_NO: 'S', RWY_ID: 'RWY' }];
      const ends: CsvRecord[] = [
        {
          SITE_NO: 'S',
          RWY_ID: 'RWY',
          RWY_END_ID: '04',
          RWY_VISUAL_RANGE_EQUIP_CODE: 'Y',
          RWY_END_LGTS_FLAG: 'Y',
          CNTRLN_LGTS_AVBL_FLAG: 'Y',
          TDZ_LGT_AVBL_FLAG: 'N',
        },
      ];
      const airport = buildAirport(base, rwys, ends, [], [], [], []);
      const end = airport?.runways[0]?.ends[0];
      expect(end?.hasRvr).toBe(true);
      expect(end?.hasReil).toBe(true);
      expect(end?.hasCenterlineLights).toBe(true);
      expect(end?.hasTdzLights).toBe(undefined);
    });

    it('populates declared distances', () => {
      const base = baseRec({ SITE_NO: 'S' });
      const rwys: CsvRecord[] = [{ SITE_NO: 'S', RWY_ID: 'R' }];
      const ends: CsvRecord[] = [
        {
          SITE_NO: 'S',
          RWY_ID: 'R',
          RWY_END_ID: '04',
          TKOF_RUN_AVBL: '10000',
          TKOF_DIST_AVBL: '10500',
          ACLT_STOP_DIST_AVBL: '10200',
          LNDG_DIST_AVBL: '9500',
        },
      ];
      const airport = buildAirport(base, rwys, ends, [], [], [], []);
      const end = airport?.runways[0]?.ends[0];
      expect(end?.toraFt).toBe(10000);
      expect(end?.todaFt).toBe(10500);
      expect(end?.asdaFt).toBe(10200);
      expect(end?.ldaFt).toBe(9500);
    });
  });

  describe('ILS system construction', () => {
    it('attaches an ILS system to the matching runway end', () => {
      const base = baseRec({ SITE_NO: 'S' });
      const rwys: CsvRecord[] = [{ SITE_NO: 'S', RWY_ID: 'R' }];
      const ends: CsvRecord[] = [{ SITE_NO: 'S', RWY_ID: 'R', RWY_END_ID: '04L' }];
      const ilsBase: CsvRecord[] = [
        {
          SITE_NO: 'S',
          RWY_END_ID: '04L',
          SYSTEM_TYPE_CODE: 'LS',
          ILS_LOC_ID: 'JFK',
          CATEGORY: 'II',
          LOC_FREQ: '110.9',
          APCH_BEAR: '042',
          COMPONENT_STATUS: 'OP',
        },
      ];
      const ilsGs: CsvRecord[] = [
        { SITE_NO: 'S', RWY_END_ID: '04L', G_S_ANGLE: '3.00', G_S_TYPE_CODE: 'GS' },
      ];
      const ilsDme: CsvRecord[] = [{ SITE_NO: 'S', RWY_END_ID: '04L', CHANNEL: '46X' }];

      const airport = buildAirport(base, rwys, ends, [], ilsBase, ilsGs, ilsDme);
      const ils = airport?.runways[0]?.ends[0]?.ils;
      assert(ils);
      expect(ils.systemType).toBe('ILS');
      expect(ils.identifier).toBe('I-JFK');
      expect(ils.category).toBe('II');
      expect(ils.localizerFrequencyMhz).toBe(110.9);
      expect(ils.localizerMagneticCourseDeg).toBe(42);
      expect(ils.glideSlopeAngleDeg).toBe(3);
      expect(ils.glideSlopeType).toBe('GLIDE SLOPE');
      expect(ils.dmeChannel).toBe('46X');
    });

    it('skips ILS systems with unknown SYSTEM_TYPE_CODE', () => {
      const base = baseRec({ SITE_NO: 'S' });
      const rwys: CsvRecord[] = [{ SITE_NO: 'S', RWY_ID: 'R' }];
      const ends: CsvRecord[] = [{ SITE_NO: 'S', RWY_ID: 'R', RWY_END_ID: '04L' }];
      const ilsBase: CsvRecord[] = [{ SITE_NO: 'S', RWY_END_ID: '04L', SYSTEM_TYPE_CODE: 'ZZ' }];

      const airport = buildAirport(base, rwys, ends, [], ilsBase, [], []);
      expect(airport?.runways[0]?.ends[0]?.ils).toBe(undefined);
    });

    it('skips ILS systems whose COMPONENT_STATUS is SHUTDOWN', () => {
      const base = baseRec({ SITE_NO: 'S' });
      const rwys: CsvRecord[] = [{ SITE_NO: 'S', RWY_ID: 'R' }];
      const ends: CsvRecord[] = [{ SITE_NO: 'S', RWY_ID: 'R', RWY_END_ID: '04L' }];
      const ilsBase: CsvRecord[] = [
        {
          SITE_NO: 'S',
          RWY_END_ID: '04L',
          SYSTEM_TYPE_CODE: 'LS',
          COMPONENT_STATUS: 'SHUTDOWN',
        },
      ];

      const airport = buildAirport(base, rwys, ends, [], ilsBase, [], []);
      expect(airport?.runways[0]?.ends[0]?.ils).toBe(undefined);
    });
  });

  describe('frequencies', () => {
    it('builds frequency entries from FRQ records', () => {
      const freqs: CsvRecord[] = [
        { FREQ: '118.725', FREQ_USE: 'TWR', SECTORIZATION: 'ALL/CD' },
        { FREQ: '121.9', FREQ_USE: 'GND' },
      ];
      const airport = buildAirport(baseRec(), [], [], freqs, [], [], []);
      expect(airport?.frequencies.length).toBe(2);
      expect(airport?.frequencies[0]).toEqual({
        frequencyMhz: 118.725,
        use: 'TWR',
        sectorization: 'ALL/CD',
      });
      expect(airport?.frequencies[1]).toEqual({
        frequencyMhz: 121.9,
        use: 'GND',
      });
    });

    it('skips frequency records missing FREQ or FREQ_USE', () => {
      const freqs: CsvRecord[] = [
        { FREQ: '', FREQ_USE: 'TWR' },
        { FREQ: '121.9', FREQ_USE: '' },
        { FREQ: '118.1', FREQ_USE: 'TWR' },
      ];
      const airport = buildAirport(baseRec(), [], [], freqs, [], [], []);
      expect(airport?.frequencies.length).toBe(1);
      expect(airport?.frequencies[0]?.frequencyMhz).toBe(118.1);
    });
  });
});
