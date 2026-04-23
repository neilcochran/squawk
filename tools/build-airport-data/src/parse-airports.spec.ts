import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAirport } from './parse-airports.js';
import type { CsvRecord } from './parse-csv.js';

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
      assert.ok(airport);
      assert.equal(airport.faaId, 'JFK');
      assert.equal(airport.name, 'JOHN F KENNEDY INTL');
      assert.equal(airport.facilityType, 'AIRPORT');
      assert.equal(airport.ownershipType, 'PUBLIC');
      assert.equal(airport.useType, 'PUBLIC');
      assert.equal(airport.status, 'OPEN');
      assert.equal(airport.city, 'NEW YORK');
      assert.equal(airport.state, 'NY');
      assert.equal(airport.country, 'US');
      assert.equal(airport.lat, 40.6398);
      assert.equal(airport.lon, -73.7789);
      assert.equal(airport.timezone, 'America/New_York');
      assert.deepEqual(airport.runways, []);
      assert.deepEqual(airport.frequencies, []);
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
      assert.equal(la?.timezone, 'America/Los_Angeles');

      const honolulu = buildAirport(
        baseRec({ ARPT_ID: 'HNL', LAT_DECIMAL: '21.3187', LONG_DECIMAL: '-157.9225' }),
        [],
        [],
        [],
        [],
        [],
        [],
      );
      assert.equal(honolulu?.timezone, 'Pacific/Honolulu');

      const anchorage = buildAirport(
        baseRec({ ARPT_ID: 'ANC', LAT_DECIMAL: '61.1743', LONG_DECIMAL: '-149.9982' }),
        [],
        [],
        [],
        [],
        [],
        [],
      );
      assert.equal(anchorage?.timezone, 'America/Anchorage');
    });

    it('returns undefined when ARPT_ID is missing', () => {
      assert.equal(buildAirport(baseRec({ ARPT_ID: '' }), [], [], [], [], [], []), undefined);
    });

    it('returns undefined when ARPT_NAME is missing', () => {
      assert.equal(buildAirport(baseRec({ ARPT_NAME: '' }), [], [], [], [], [], []), undefined);
    });

    it('returns undefined when LAT_DECIMAL is missing', () => {
      assert.equal(buildAirport(baseRec({ LAT_DECIMAL: '' }), [], [], [], [], [], []), undefined);
    });

    it('returns undefined when SITE_NO is missing', () => {
      assert.equal(buildAirport(baseRec({ SITE_NO: '' }), [], [], [], [], [], []), undefined);
    });

    it('returns undefined when SITE_TYPE_CODE is unknown', () => {
      assert.equal(
        buildAirport(baseRec({ SITE_TYPE_CODE: 'ZZ' }), [], [], [], [], [], []),
        undefined,
      );
    });

    it('returns undefined when OWNERSHIP_TYPE_CODE is unknown', () => {
      assert.equal(
        buildAirport(baseRec({ OWNERSHIP_TYPE_CODE: 'ZZ' }), [], [], [], [], [], []),
        undefined,
      );
    });

    it('maps facility type codes correctly', () => {
      assert.equal(
        buildAirport(baseRec({ SITE_TYPE_CODE: 'H' }), [], [], [], [], [], [])?.facilityType,
        'HELIPORT',
      );
      assert.equal(
        buildAirport(baseRec({ SITE_TYPE_CODE: 'C' }), [], [], [], [], [], [])?.facilityType,
        'SEAPLANE_BASE',
      );
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
        assert.equal(airport?.ownershipType, 'PRIVATE', `code=${code}`);
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
      assert.ok(airport);
      assert.equal(airport.icao, 'KJFK');
      assert.equal(airport.elevationFt, 13);
      assert.equal(airport.magneticVariationDeg, 13);
      assert.equal(airport.magneticVariationDirection, 'W');
      assert.equal(airport.magneticVariationYear, 2020);
      assert.equal(airport.trafficPatternAltitudeFt, 1500);
    });

    it('omits state when blank', () => {
      const airport = buildAirport(baseRec({ STATE_CODE: '' }), [], [], [], [], [], []);
      assert.ok(airport);
      assert.equal(airport.state, undefined);
    });

    it('sets hasLandingFee true only when LNDG_FEE_FLAG is "Y"', () => {
      const yes = buildAirport(baseRec({ LNDG_FEE_FLAG: 'Y' }), [], [], [], [], [], []);
      const no = buildAirport(baseRec({ LNDG_FEE_FLAG: 'N' }), [], [], [], [], [], []);
      assert.equal(yes?.hasLandingFee, true);
      assert.equal(no?.hasLandingFee, undefined);
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
      assert.equal(airport?.runways.length, 1);
      assert.equal(airport?.runways[0]?.id, '04L/22R');
      assert.equal(airport?.runways[0]?.lengthFt, 11351);
      assert.equal(airport?.runways[0]?.widthFt, 150);
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
      assert.equal(rwy?.ends.length, 2);
      assert.equal(rwy?.ends[0]?.id, '04L');
      assert.equal(rwy?.ends[0]?.trueHeadingDeg, 40);
      assert.equal(rwy?.ends[1]?.id, '22R');
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
      assert.equal(rwy?.condition, 'EXCELLENT');
      assert.equal(rwy?.treatment, 'GROOVED');
      assert.equal(rwy?.lighting, 'HIGH');
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
      assert.equal(end?.hasRvr, true);
      assert.equal(end?.hasReil, true);
      assert.equal(end?.hasCenterlineLights, true);
      assert.equal(end?.hasTdzLights, undefined);
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
      assert.equal(end?.toraFt, 10000);
      assert.equal(end?.todaFt, 10500);
      assert.equal(end?.asdaFt, 10200);
      assert.equal(end?.ldaFt, 9500);
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
      assert.ok(ils);
      assert.equal(ils.systemType, 'ILS');
      assert.equal(ils.identifier, 'I-JFK');
      assert.equal(ils.category, 'II');
      assert.equal(ils.localizerFrequencyMhz, 110.9);
      assert.equal(ils.localizerMagneticCourseDeg, 42);
      assert.equal(ils.glideSlopeAngleDeg, 3);
      assert.equal(ils.glideSlopeType, 'GLIDE SLOPE');
      assert.equal(ils.dmeChannel, '46X');
    });

    it('skips ILS systems with unknown SYSTEM_TYPE_CODE', () => {
      const base = baseRec({ SITE_NO: 'S' });
      const rwys: CsvRecord[] = [{ SITE_NO: 'S', RWY_ID: 'R' }];
      const ends: CsvRecord[] = [{ SITE_NO: 'S', RWY_ID: 'R', RWY_END_ID: '04L' }];
      const ilsBase: CsvRecord[] = [{ SITE_NO: 'S', RWY_END_ID: '04L', SYSTEM_TYPE_CODE: 'ZZ' }];

      const airport = buildAirport(base, rwys, ends, [], ilsBase, [], []);
      assert.equal(airport?.runways[0]?.ends[0]?.ils, undefined);
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
      assert.equal(airport?.runways[0]?.ends[0]?.ils, undefined);
    });
  });

  describe('frequencies', () => {
    it('builds frequency entries from FRQ records', () => {
      const freqs: CsvRecord[] = [
        { FREQ: '118.725', FREQ_USE: 'TWR', SECTORIZATION: 'ALL/CD' },
        { FREQ: '121.9', FREQ_USE: 'GND' },
      ];
      const airport = buildAirport(baseRec(), [], [], freqs, [], [], []);
      assert.equal(airport?.frequencies.length, 2);
      assert.deepEqual(airport?.frequencies[0], {
        frequencyMhz: 118.725,
        use: 'TWR',
        sectorization: 'ALL/CD',
      });
      assert.deepEqual(airport?.frequencies[1], {
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
      assert.equal(airport?.frequencies.length, 1);
      assert.equal(airport?.frequencies[0]?.frequencyMhz, 118.1);
    });
  });
});
