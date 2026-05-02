import { describe, it, expect, assert } from 'vitest';
import { buildAirport } from './parse-airports.js';
import type { CsvRecord } from '@squawk/build-shared';

/**
 * Builds a minimal valid APT_BASE.csv record with optional overrides.
 *
 * @param overrides - Field overrides applied on top of the JFK baseline.
 * @returns A CSV record matching APT_BASE.csv columns.
 */
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

describe('buildAirport - optional base fields', () => {
  it('populates every optional APT_BASE field when present', () => {
    const airport = buildAirport(
      baseRec({
        ICAO_ID: 'KJFK',
        ELEV: '13',
        MAG_VARN: '13.5',
        MAG_HEMIS: 'W',
        MAG_VARN_YEAR: '2020',
        TPA: '1000',
        CHART_NAME: 'NEW YORK',
        RESP_ARTCC_ID: 'ZNY',
        TWR_TYPE_CODE: 'T',
        FUEL_TYPES: '100LL,JETA',
        AIRFRAME_REPAIR_SER_CODE: 'MAJOR',
        PWR_PLANT_REPAIR_SER: 'MAJOR',
        BOTTLED_OXY_TYPE: 'HIGH/LOW',
        BULK_OXY_TYPE: 'HIGH/LOW',
        LGT_SKED: 'SS-SR',
        BCN_LENS_COLOR: 'CG',
        LNDG_FEE_FLAG: 'Y',
        ACTIVATION_DATE: '07/1948',
        OTHER_SERVICES: 'CARGO',
        NOTAM_ID: 'JFK',
        COUNTY_NAME: 'QUEENS',
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
    expect(airport.magneticVariationDeg).toBe(13.5);
    expect(airport.magneticVariationDirection).toBe('W');
    expect(airport.magneticVariationYear).toBe(2020);
    expect(airport.trafficPatternAltitudeFt).toBe(1000);
    expect(airport.sectionChart).toBe('NEW YORK');
    expect(airport.artccId).toBe('ZNY');
    expect(airport.towerType).toBe('T');
    expect(airport.fuelTypes).toBe('100LL,JETA');
    expect(airport.airframeRepair).toBe('MAJOR');
    expect(airport.powerplantRepair).toBe('MAJOR');
    expect(airport.bottledOxygen).toBe('HIGH/LOW');
    expect(airport.bulkOxygen).toBe('HIGH/LOW');
    expect(airport.lightingSchedule).toBe('SS-SR');
    expect(airport.beaconColor).toBe('CG');
    expect(airport.hasLandingFee).toBe(true);
    expect(airport.activationDate).toBe('07/1948');
    expect(airport.otherServices).toBe('CARGO');
    expect(airport.notamId).toBe('JFK');
    expect(airport.county).toBe('QUEENS');
  });

  it('omits state when STATE_CODE is empty', () => {
    const airport = buildAirport(baseRec({ STATE_CODE: '' }), [], [], [], [], [], []);
    assert(airport);
    expect(airport.state).toBe(undefined);
  });

  it('returns undefined when status code is unknown', () => {
    expect(buildAirport(baseRec({ ARPT_STATUS: 'XX' }), [], [], [], [], [], [])).toBe(undefined);
  });

  it('returns undefined when ownership code is unknown', () => {
    expect(buildAirport(baseRec({ OWNERSHIP_TYPE_CODE: 'ZZ' }), [], [], [], [], [], [])).toBe(
      undefined,
    );
  });

  it('returns undefined when use code is unknown', () => {
    expect(buildAirport(baseRec({ FACILITY_USE_CODE: 'ZZ' }), [], [], [], [], [], [])).toBe(
      undefined,
    );
  });

  it('returns undefined when COUNTRY_CODE is missing', () => {
    expect(buildAirport(baseRec({ COUNTRY_CODE: '' }), [], [], [], [], [], [])).toBe(undefined);
  });

  it('returns undefined when CITY is missing', () => {
    expect(buildAirport(baseRec({ CITY: '' }), [], [], [], [], [], [])).toBe(undefined);
  });

  it('returns undefined when LONG_DECIMAL is missing', () => {
    expect(buildAirport(baseRec({ LONG_DECIMAL: '' }), [], [], [], [], [], [])).toBe(undefined);
  });

  it('returns undefined when SITE_TYPE_CODE is missing entirely', () => {
    expect(buildAirport(baseRec({ SITE_TYPE_CODE: '' }), [], [], [], [], [], [])).toBe(undefined);
  });

  it('returns undefined when OWNERSHIP_TYPE_CODE is missing entirely', () => {
    expect(buildAirport(baseRec({ OWNERSHIP_TYPE_CODE: '' }), [], [], [], [], [], [])).toBe(
      undefined,
    );
  });

  it('returns undefined when FACILITY_USE_CODE is missing entirely', () => {
    expect(buildAirport(baseRec({ FACILITY_USE_CODE: '' }), [], [], [], [], [], [])).toBe(
      undefined,
    );
  });

  it('returns undefined when ARPT_STATUS is missing entirely', () => {
    expect(buildAirport(baseRec({ ARPT_STATUS: '' }), [], [], [], [], [], [])).toBe(undefined);
  });
});

describe('buildAirport - runways with full optional fields', () => {
  it('builds a runway with all optional metadata', () => {
    const runway = {
      SITE_NO: '15793.*A',
      RWY_ID: '04L/22R',
      RWY_LEN: '12079',
      RWY_WIDTH: '200',
      SURFACE_TYPE_CODE: 'ASPH-CONC',
      COND: 'EXCELLENT',
      TREATMENT_CODE: 'GRVD',
      PCN: '99/F/A/W/T',
      RWY_LGT_CODE: 'HIGH',
      GROSS_WT_SW: '100.0',
      GROSS_WT_DW: '210.0',
      GROSS_WT_DTW: '358.0',
      GROSS_WT_DDTW: '900.0',
    };
    const airport = buildAirport(baseRec(), [runway], [], [], [], [], []);
    assert(airport);
    expect(airport.runways.length).toBe(1);
    const r = airport.runways[0];
    assert(r);
    expect(r.lengthFt).toBe(12079);
    expect(r.widthFt).toBe(200);
    expect(r.surfaceType).toBe('ASPH-CONC');
    expect(r.condition).toBe('EXCELLENT');
    expect(r.treatment).toBe('GROOVED');
    expect(r.pcn).toBe('99/F/A/W/T');
    expect(r.lighting).toBe('HIGH');
    expect(r.weightLimitSingleWheelKlb).toBe(100);
    expect(r.weightLimitDualWheelKlb).toBe(210);
    expect(r.weightLimitDualTandemKlb).toBe(358);
    expect(r.weightLimitDdtKlb).toBe(900);
  });

  it('skips runway records with mismatched SITE_NO or empty RWY_ID', () => {
    const wrongSite = { SITE_NO: 'OTHER', RWY_ID: '04L/22R' };
    const noId = { SITE_NO: '15793.*A', RWY_ID: '' };
    const airport = buildAirport(baseRec(), [wrongSite, noId], [], [], [], [], []);
    assert(airport);
    expect(airport.runways.length).toBe(0);
  });

  it('builds a runway end with full optional metadata and includes only matched ends', () => {
    const runway = { SITE_NO: '15793.*A', RWY_ID: '04L/22R' };
    const end = {
      SITE_NO: '15793.*A',
      RWY_ID: '04L/22R',
      RWY_END_ID: '04L',
      TRUE_ALIGNMENT: '40',
      RIGHT_HAND_TRAFFIC_PAT_FLAG: 'Y',
      RWY_MARKING_TYPE_CODE: 'PIR',
      RWY_MARKING_COND: 'GOOD',
      LAT_DECIMAL: '40.6500',
      LONG_DECIMAL: '-73.8000',
      RWY_END_ELEV: '13',
      THR_CROSSING_HGT: '60',
      VISUAL_GLIDE_PATH_ANGLE: '3.0',
      DISPLACED_THR_LEN: '500',
      DISPLACED_THR_ELEV: '13',
      TDZ_ELEV: '13',
      VGSI_CODE: 'P4L',
      RWY_VISUAL_RANGE_EQUIP_CODE: 'Y',
      APCH_LGT_SYSTEM_CODE: 'ALSF2',
      RWY_END_LGTS_FLAG: 'Y',
      CNTRLN_LGTS_AVBL_FLAG: 'Y',
      TDZ_LGT_AVBL_FLAG: 'Y',
      TKOF_RUN_AVBL: '12079',
      TKOF_DIST_AVBL: '12079',
      ACLT_STOP_DIST_AVBL: '12079',
      LNDG_DIST_AVBL: '11579',
      LAHSO_ALD: '8500',
      RWY_END_INTERSECT_LAHSO: '13L/31R',
    };
    // End with empty SITE_NO is skipped during indexing
    const orphanEnd = { SITE_NO: '', RWY_ID: '04L/22R', RWY_END_ID: 'ORPHAN' };
    const airport = buildAirport(baseRec(), [runway], [end, orphanEnd], [], [], [], []);
    assert(airport);
    const r = airport.runways[0];
    assert(r);
    expect(r.ends.length).toBe(1);
    const e = r.ends[0];
    assert(e);
    expect(e.id).toBe('04L');
    expect(e.trueHeadingDeg).toBe(40);
    expect(e.rightTraffic).toBe(true);
    expect(e.markingType).toBe('PIR');
    expect(e.markingCondition).toBe('GOOD');
    expect(e.lat).toBe(40.65);
    expect(e.lon).toBe(-73.8);
    expect(e.elevationFt).toBe(13);
    expect(e.thresholdCrossingHeightFt).toBe(60);
    expect(e.glidepathAngleDeg).toBe(3.0);
    expect(e.displacedThresholdFt).toBe(500);
    expect(e.displacedThresholdElevationFt).toBe(13);
    expect(e.tdzElevationFt).toBe(13);
    expect(e.vgsiType).toBe('PAPI-4L');
    expect(e.hasRvr).toBe(true);
    expect(e.approachLights).toBe('ALSF2');
    expect(e.hasReil).toBe(true);
    expect(e.hasCenterlineLights).toBe(true);
    expect(e.hasTdzLights).toBe(true);
    expect(e.toraFt).toBe(12079);
    expect(e.todaFt).toBe(12079);
    expect(e.asdaFt).toBe(12079);
    expect(e.ldaFt).toBe(11579);
    expect(e.lahsoDistanceFt).toBe(8500);
    expect(e.lahsoEntity).toBe('13L/31R');
  });

  it('ignores unknown marking type, marking condition, and VGSI codes', () => {
    const runway = { SITE_NO: '15793.*A', RWY_ID: '04L/22R' };
    const end = {
      SITE_NO: '15793.*A',
      RWY_ID: '04L/22R',
      RWY_END_ID: '04L',
      RWY_MARKING_TYPE_CODE: 'XX',
      RWY_MARKING_COND: 'YY',
      VGSI_CODE: 'ZZ',
    };
    const airport = buildAirport(baseRec(), [runway], [end], [], [], [], []);
    assert(airport);
    const e = airport.runways[0]?.ends[0];
    assert(e);
    expect(e.markingType).toBe(undefined);
    expect(e.markingCondition).toBe(undefined);
    expect(e.vgsiType).toBe(undefined);
  });

  it('ignores unknown surface condition, treatment, and lighting codes on a runway', () => {
    const runway = {
      SITE_NO: '15793.*A',
      RWY_ID: '04L/22R',
      COND: 'XXX',
      TREATMENT_CODE: 'YYY',
      RWY_LGT_CODE: 'ZZZ',
    };
    const airport = buildAirport(baseRec(), [runway], [], [], [], [], []);
    const r = airport?.runways[0];
    assert(r);
    expect(r.condition).toBe(undefined);
    expect(r.treatment).toBe(undefined);
    expect(r.lighting).toBe(undefined);
  });
});

describe('buildAirport - frequencies', () => {
  it('builds a frequency record with sectorization', () => {
    const freq = {
      FREQ: '128.725',
      FREQ_USE: 'ATIS',
      SECTORIZATION: 'ARRIVAL',
    };
    const airport = buildAirport(baseRec(), [], [], [freq], [], [], []);
    assert(airport);
    expect(airport.frequencies.length).toBe(1);
    expect(airport.frequencies[0]?.frequencyMhz).toBe(128.725);
    expect(airport.frequencies[0]?.use).toBe('ATIS');
    expect(airport.frequencies[0]?.sectorization).toBe('ARRIVAL');
  });

  it('skips frequency records missing FREQ or FREQ_USE', () => {
    const noFreq = { FREQ_USE: 'ATIS' };
    const noUse = { FREQ: '128.725' };
    const airport = buildAirport(baseRec(), [], [], [noFreq, noUse], [], [], []);
    assert(airport);
    expect(airport.frequencies.length).toBe(0);
  });
});

describe('buildAirport - ILS systems', () => {
  it('builds a CAT III ILS with localizer, glide slope, and DME components', () => {
    const runway = { SITE_NO: '15793.*A', RWY_ID: '04L/22R' };
    const end = { SITE_NO: '15793.*A', RWY_ID: '04L/22R', RWY_END_ID: '04L' };
    const ilsBase = {
      SITE_NO: '15793.*A',
      RWY_END_ID: '04L',
      SYSTEM_TYPE_CODE: 'LS',
      ILS_LOC_ID: 'IJFK',
      CATEGORY: 'IIIB',
      LOC_FREQ: '109.5',
      APCH_BEAR: '040',
      COMPONENT_STATUS: 'OPERATIONAL',
    };
    const ilsGs = {
      SITE_NO: '15793.*A',
      RWY_END_ID: '04L',
      G_S_ANGLE: '3.0',
      G_S_TYPE_CODE: 'GS',
    };
    const ilsDme = {
      SITE_NO: '15793.*A',
      RWY_END_ID: '04L',
      CHANNEL: '32X',
    };
    const airport = buildAirport(baseRec(), [runway], [end], [], [ilsBase], [ilsGs], [ilsDme]);
    const e = airport?.runways[0]?.ends[0];
    assert(e);
    assert(e.ils);
    expect(e.ils.identifier).toBe('I-IJFK');
    expect(e.ils.localizerFrequencyMhz).toBe(109.5);
    expect(e.ils.localizerMagneticCourseDeg).toBe(40);
    expect(e.ils.glideSlopeAngleDeg).toBe(3);
    expect(e.ils.glideSlopeType).toBe('GLIDE SLOPE');
    expect(e.ils.dmeChannel).toBe('32X');
  });

  it('omits the GS type when the code is unknown', () => {
    const runway = { SITE_NO: '15793.*A', RWY_ID: '04L/22R' };
    const end = { SITE_NO: '15793.*A', RWY_ID: '04L/22R', RWY_END_ID: '04L' };
    const ilsBase = {
      SITE_NO: '15793.*A',
      RWY_END_ID: '04L',
      SYSTEM_TYPE_CODE: 'LS',
    };
    const ilsGs = {
      SITE_NO: '15793.*A',
      RWY_END_ID: '04L',
      G_S_TYPE_CODE: 'XX',
    };
    const airport = buildAirport(baseRec(), [runway], [end], [], [ilsBase], [ilsGs], []);
    const e = airport?.runways[0]?.ends[0];
    assert(e?.ils);
    expect(e.ils.glideSlopeType).toBe(undefined);
  });

  it('drops ILS systems whose component status is SHUTDOWN', () => {
    const runway = { SITE_NO: '15793.*A', RWY_ID: '04L/22R' };
    const end = { SITE_NO: '15793.*A', RWY_ID: '04L/22R', RWY_END_ID: '04L' };
    const ilsBase = {
      SITE_NO: '15793.*A',
      RWY_END_ID: '04L',
      SYSTEM_TYPE_CODE: 'LS',
      COMPONENT_STATUS: 'SHUTDOWN',
    };
    const airport = buildAirport(baseRec(), [runway], [end], [], [ilsBase], [], []);
    const e = airport?.runways[0]?.ends[0];
    assert(e);
    expect(e.ils).toBe(undefined);
  });

  it('drops ILS systems with an unknown SYSTEM_TYPE_CODE', () => {
    const runway = { SITE_NO: '15793.*A', RWY_ID: '04L/22R' };
    const end = { SITE_NO: '15793.*A', RWY_ID: '04L/22R', RWY_END_ID: '04L' };
    const ilsBase = {
      SITE_NO: '15793.*A',
      RWY_END_ID: '04L',
      SYSTEM_TYPE_CODE: 'BOGUS',
    };
    const airport = buildAirport(baseRec(), [runway], [end], [], [ilsBase], [], []);
    const e = airport?.runways[0]?.ends[0];
    assert(e);
    expect(e.ils).toBe(undefined);
  });

  it('drops ILS systems with a missing SYSTEM_TYPE_CODE', () => {
    const runway = { SITE_NO: '15793.*A', RWY_ID: '04L/22R' };
    const end = { SITE_NO: '15793.*A', RWY_ID: '04L/22R', RWY_END_ID: '04L' };
    const ilsBase = { SITE_NO: '15793.*A', RWY_END_ID: '04L', SYSTEM_TYPE_CODE: '' };
    const airport = buildAirport(baseRec(), [runway], [end], [], [ilsBase], [], []);
    const e = airport?.runways[0]?.ends[0];
    assert(e);
    expect(e.ils).toBe(undefined);
  });

  it('skips ILS records with no RWY_END_ID', () => {
    const runway = { SITE_NO: '15793.*A', RWY_ID: '04L/22R' };
    const end = { SITE_NO: '15793.*A', RWY_ID: '04L/22R', RWY_END_ID: '04L' };
    const ilsBase = { SITE_NO: '15793.*A', RWY_END_ID: '', SYSTEM_TYPE_CODE: 'LS' };
    const ilsGs = { SITE_NO: '15793.*A', RWY_END_ID: '', G_S_TYPE_CODE: 'GS' };
    const ilsDme = { SITE_NO: '15793.*A', RWY_END_ID: '', CHANNEL: '32X' };
    const airport = buildAirport(baseRec(), [runway], [end], [], [ilsBase], [ilsGs], [ilsDme]);
    const e = airport?.runways[0]?.ends[0];
    assert(e);
    expect(e.ils).toBe(undefined);
  });

  it('omits localizer course and frequency when the values are missing', () => {
    const runway = { SITE_NO: '15793.*A', RWY_ID: '04L/22R' };
    const end = { SITE_NO: '15793.*A', RWY_ID: '04L/22R', RWY_END_ID: '04L' };
    const ilsBase = { SITE_NO: '15793.*A', RWY_END_ID: '04L', SYSTEM_TYPE_CODE: 'LS' };
    const airport = buildAirport(baseRec(), [runway], [end], [], [ilsBase], [], []);
    const ils = airport?.runways[0]?.ends[0]?.ils;
    assert(ils);
    expect(ils.identifier).toBe(undefined);
    expect(ils.category).toBe(undefined);
    expect(ils.localizerFrequencyMhz).toBe(undefined);
    expect(ils.localizerMagneticCourseDeg).toBe(undefined);
  });

  it('omits ILS category when the code is unknown', () => {
    const runway = { SITE_NO: '15793.*A', RWY_ID: '04L/22R' };
    const end = { SITE_NO: '15793.*A', RWY_ID: '04L/22R', RWY_END_ID: '04L' };
    const ilsBase = {
      SITE_NO: '15793.*A',
      RWY_END_ID: '04L',
      SYSTEM_TYPE_CODE: 'LS',
      CATEGORY: 'BOGUS',
    };
    const airport = buildAirport(baseRec(), [runway], [end], [], [ilsBase], [], []);
    const ils = airport?.runways[0]?.ends[0]?.ils;
    assert(ils);
    expect(ils.category).toBe(undefined);
  });
});
