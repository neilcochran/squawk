import { describe, it, expect, assert } from 'vitest';

import type { CsvRecord } from '@squawk/build-shared';

import {
  buildAirport,
  buildFrequency,
  buildPavementClassification,
  isAirportFrequencyRecord,
  parseFrequencyField,
  parseRvrLocations,
} from './parse-airports.js';

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
    ELEV: '13',
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
      expect(airport.trafficPatternAltitudeFtAgl).toBe(1500);
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
    it('sets hasReil, hasCenterlineLights and hasTdzLights only when flags are "Y" and RVR from its locations', () => {
      const base = baseRec({ SITE_NO: 'S' });
      const rwys: CsvRecord[] = [{ SITE_NO: 'S', RWY_ID: 'RWY' }];
      const ends: CsvRecord[] = [
        {
          SITE_NO: 'S',
          RWY_ID: 'RWY',
          RWY_END_ID: '04',
          RWY_VISUAL_RANGE_EQUIP_CODE: 'TR',
          RWY_END_LGTS_FLAG: 'Y',
          CNTRLN_LGTS_AVBL_FLAG: 'Y',
          TDZ_LGT_AVBL_FLAG: 'N',
        },
      ];
      const airport = buildAirport(base, rwys, ends, [], [], [], []);
      const end = airport?.runways[0]?.ends[0];
      expect(end?.hasRvr).toBe(true);
      expect(end?.rvrLocations).toEqual(['TOUCHDOWN', 'ROLLOUT']);
      expect(end?.hasReil).toBe(true);
      expect(end?.hasCenterlineLights).toBe(true);
      expect(end?.hasTdzLights).toBe(undefined);
    });

    it('leaves RVR unset when the FAA publishes N or nothing', () => {
      const base = baseRec({ SITE_NO: 'S' });
      const rwys: CsvRecord[] = [{ SITE_NO: 'S', RWY_ID: 'RWY' }];
      const ends: CsvRecord[] = [
        { SITE_NO: 'S', RWY_ID: 'RWY', RWY_END_ID: '04', RWY_VISUAL_RANGE_EQUIP_CODE: 'N' },
        { SITE_NO: 'S', RWY_ID: 'RWY', RWY_END_ID: '22' },
      ];
      const airport = buildAirport(base, rwys, ends, [], [], [], []);
      for (const end of airport?.runways[0]?.ends ?? []) {
        expect('hasRvr' in end).toBe(false);
        expect('rvrLocations' in end).toBe(false);
      }
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

    it('drops rows the FAA publishes twice and keeps rows that differ', () => {
      const row: CsvRecord = {
        FREQ: '122.8',
        FREQ_USE: 'CTAF',
        FACILITY: 'ABC',
        FACILITY_TYPE: 'NON-ATCT',
      };
      const freqs: CsvRecord[] = [row, { ...row }, { ...row, FREQ_USE: 'UNICOM' }];
      const airport = buildAirport(baseRec(), [], [], freqs, [], [], []);
      expect(airport?.frequencies.map((f) => f.use)).toEqual(['CTAF', 'UNICOM']);
    });
  });

  describe('required fields', () => {
    it('returns undefined when the field elevation is missing', () => {
      expect(buildAirport(baseRec({ ELEV: '' }), [], [], [], [], [], [])).toBe(undefined);
    });
  });

  describe('runway dimensions', () => {
    it('leaves a length or width unset where the FAA publishes 0', () => {
      const rwys: CsvRecord[] = [
        { SITE_NO: '15793.*A', RWY_ID: '04L/22R', RWY_LEN: '0', RWY_WIDTH: '0' },
        { SITE_NO: '15793.*A', RWY_ID: '13L/31R', RWY_LEN: '10000', RWY_WIDTH: '150' },
      ];
      const airport = buildAirport(baseRec(), rwys, [], [], [], [], []);
      const [unknown, known] = airport?.runways ?? [];
      assert(unknown && known);
      expect('lengthFt' in unknown).toBe(false);
      expect('widthFt' in unknown).toBe(false);
      expect(known.lengthFt).toBe(10000);
      expect(known.widthFt).toBe(150);
    });
  });
});

describe('isAirportFrequencyRecord', () => {
  it('keeps rows serviced to the airport itself and to its weather, RCO, FSS and radio services', () => {
    for (const siteType of [
      'AIRPORT',
      'HELIPORT',
      'SEAPLANE BASE',
      'AWOS-3PT',
      'ASOS',
      'RCO',
      'FSS',
      'RADIO',
    ]) {
      expect(
        isAirportFrequencyRecord({ SERVICED_SITE_TYPE: siteType, FACILITY_TYPE: 'NON-ATCT' }),
      ).toBe(true);
    }
  });

  it('drops navaid rows that share the airport identifier and rows serviced to other site types', () => {
    expect(isAirportFrequencyRecord({ SERVICED_SITE_TYPE: 'NDB', FACILITY_TYPE: 'NAVAID' })).toBe(
      false,
    );
    expect(
      isAirportFrequencyRecord({ SERVICED_SITE_TYPE: 'VOR/DME', FACILITY_TYPE: 'NAVAID' }),
    ).toBe(false);
    expect(
      isAirportFrequencyRecord({ SERVICED_SITE_TYPE: 'AIRPORT', FACILITY_TYPE: 'NAVAID' }),
    ).toBe(false);
    expect(isAirportFrequencyRecord({ SERVICED_SITE_TYPE: 'RCAG', FACILITY_TYPE: 'RCAG' })).toBe(
      false,
    );
    expect(
      isAirportFrequencyRecord({ SERVICED_SITE_TYPE: 'TRACON', FACILITY_TYPE: 'TRACON' }),
    ).toBe(false);
    expect(isAirportFrequencyRecord({ FACILITY_TYPE: 'ATCT' })).toBe(false);
  });
});

describe('parseFrequencyField', () => {
  it('parses a plain MHz value', () => {
    expect(parseFrequencyField('118.725')).toEqual({
      frequencyMhz: 118.725,
      receiveOnly: false,
      onRequest: false,
      note: undefined,
    });
  });

  it('reads the receive-only and on-request qualifiers', () => {
    expect(parseFrequencyField('122.1R')?.receiveOnly).toBe(true);
    expect(parseFrequencyField('122.1R')?.frequencyMhz).toBe(122.1);
    expect(parseFrequencyField('8903X')).toEqual({
      frequencyMhz: 8.903,
      receiveOnly: false,
      onRequest: true,
      note: undefined,
    });
  });

  it('converts HF values published in kHz to MHz', () => {
    expect(parseFrequencyField('5696.0')?.frequencyMhz).toBe(5.696);
    expect(parseFrequencyField('6735.0')?.frequencyMhz).toBe(6.735);
    expect(parseFrequencyField('21964')?.frequencyMhz).toBe(21.964);
    expect(parseFrequencyField('399.9')?.frequencyMhz).toBe(399.9);
  });

  it('keeps text the FAA appends to the value as a note', () => {
    expect(parseFrequencyField('11387 CARIBBEAN FAMILY B')).toEqual({
      frequencyMhz: 11.387,
      receiveOnly: false,
      onRequest: false,
      note: 'CARIBBEAN FAMILY B',
    });
  });

  it('rejects paired navaid values, blanks and zero', () => {
    expect(parseFrequencyField('116.65/113Y')).toBe(undefined);
    expect(parseFrequencyField('')).toBe(undefined);
    expect(parseFrequencyField('0')).toBe(undefined);
    expect(parseFrequencyField('ABC')).toBe(undefined);
  });
});

describe('buildFrequency', () => {
  it('copies the qualifiers, provider, call signs and remark', () => {
    const freq = buildFrequency({
      FREQ: '122.1R',
      FREQ_USE: 'RCO',
      FACILITY: 'ABERDEEN',
      FACILITY_TYPE: 'RCO',
      TOWER_OR_COMM_CALL: 'HURON RADIO',
      PRIMARY_APPROACH_RADIO_CALL: 'MINNEAPOLIS',
      SECTORIZATION: 'NORTH',
      REMARK: 'OPER 0600-2200',
    });
    expect(freq).toEqual({
      frequencyMhz: 122.1,
      use: 'RCO',
      sectorization: 'NORTH',
      receiveOnly: true,
      provider: 'ABERDEEN',
      providerType: 'RCO',
      callSign: 'HURON RADIO',
      approachCallSign: 'MINNEAPOLIS',
      remark: 'OPER 0600-2200',
    });
  });

  it('joins the text appended to the frequency with the remark column', () => {
    const freq = buildFrequency({
      FREQ: '8903X',
      FREQ_USE: 'HNL RADIO',
      REMARK: 'CENTRAL WEST PACIFIC FAMILY.',
    });
    expect(freq?.onRequest).toBe(true);
    expect(freq?.remark).toBe('CENTRAL WEST PACIFIC FAMILY.');
    const family = buildFrequency({
      FREQ: '11387 CARIBBEAN FAMILY B',
      FREQ_USE: 'ISP RADIO',
      REMARK: 'NIGHT',
    });
    expect(family?.remark).toBe('CARIBBEAN FAMILY B; NIGHT');
  });

  it('omits every optional field that is blank', () => {
    expect(
      buildFrequency({ FREQ: '121.9', FREQ_USE: 'GND/P', SECTORIZATION: '', REMARK: '' }),
    ).toEqual({
      frequencyMhz: 121.9,
      use: 'GND/P',
    });
  });
});

describe('parseRvrLocations', () => {
  it('decodes each location letter in touchdown, midpoint, rollout order', () => {
    expect(parseRvrLocations('TMR')).toEqual(['TOUCHDOWN', 'MIDPOINT', 'ROLLOUT']);
    expect(parseRvrLocations('TR')).toEqual(['TOUCHDOWN', 'ROLLOUT']);
    expect(parseRvrLocations('M')).toEqual(['MIDPOINT']);
  });

  it('returns no locations for N, blank or unknown letters', () => {
    expect(parseRvrLocations('N')).toEqual([]);
    expect(parseRvrLocations('')).toEqual([]);
    expect(parseRvrLocations(undefined)).toEqual([]);
    expect(parseRvrLocations('Y')).toEqual([]);
  });
});

describe('buildPavementClassification', () => {
  const complete: CsvRecord = {
    PAVEMENT_CLASSIFICATION: 'PCR',
    PCN_PCR_NUMBER: '1102',
    PAVEMENT_TYPE_CODE: 'F',
    SUBGRADE_STRENGTH_CODE: 'D',
    TIRE_PRES_CODE: 'X',
    DTRM_METHOD_CODE: 'U',
  };

  it('builds the rating from its six columns', () => {
    expect(buildPavementClassification(complete)).toEqual({
      system: 'PCR',
      value: 1102,
      pavementType: 'FLEXIBLE',
      subgradeStrength: 'D',
      tirePressure: 'X',
      evaluationMethod: 'USING_AIRCRAFT',
    });
  });

  it('returns undefined for a runway without a rating or with a missing part', () => {
    expect(buildPavementClassification({})).toBe(undefined);
    expect(buildPavementClassification({ ...complete, PCN_PCR_NUMBER: '' })).toBe(undefined);
    expect(buildPavementClassification({ ...complete, TIRE_PRES_CODE: '' })).toBe(undefined);
  });

  it('returns undefined for an unknown code', () => {
    expect(buildPavementClassification({ ...complete, PAVEMENT_TYPE_CODE: 'Q' })).toBe(undefined);
    expect(buildPavementClassification({ ...complete, PAVEMENT_CLASSIFICATION: 'ACN' })).toBe(
      undefined,
    );
  });
});
