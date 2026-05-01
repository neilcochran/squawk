import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
    assert.ok(airport);
    assert.equal(airport.icao, 'KJFK');
    assert.equal(airport.elevationFt, 13);
    assert.equal(airport.magneticVariationDeg, 13.5);
    assert.equal(airport.magneticVariationDirection, 'W');
    assert.equal(airport.magneticVariationYear, 2020);
    assert.equal(airport.trafficPatternAltitudeFt, 1000);
    assert.equal(airport.sectionChart, 'NEW YORK');
    assert.equal(airport.artccId, 'ZNY');
    assert.equal(airport.towerType, 'T');
    assert.equal(airport.fuelTypes, '100LL,JETA');
    assert.equal(airport.airframeRepair, 'MAJOR');
    assert.equal(airport.powerplantRepair, 'MAJOR');
    assert.equal(airport.bottledOxygen, 'HIGH/LOW');
    assert.equal(airport.bulkOxygen, 'HIGH/LOW');
    assert.equal(airport.lightingSchedule, 'SS-SR');
    assert.equal(airport.beaconColor, 'CG');
    assert.equal(airport.hasLandingFee, true);
    assert.equal(airport.activationDate, '07/1948');
    assert.equal(airport.otherServices, 'CARGO');
    assert.equal(airport.notamId, 'JFK');
    assert.equal(airport.county, 'QUEENS');
  });

  it('omits state when STATE_CODE is empty', () => {
    const airport = buildAirport(baseRec({ STATE_CODE: '' }), [], [], [], [], [], []);
    assert.ok(airport);
    assert.equal(airport.state, undefined);
  });

  it('returns undefined when status code is unknown', () => {
    assert.equal(buildAirport(baseRec({ ARPT_STATUS: 'XX' }), [], [], [], [], [], []), undefined);
  });

  it('returns undefined when ownership code is unknown', () => {
    assert.equal(
      buildAirport(baseRec({ OWNERSHIP_TYPE_CODE: 'ZZ' }), [], [], [], [], [], []),
      undefined,
    );
  });

  it('returns undefined when use code is unknown', () => {
    assert.equal(
      buildAirport(baseRec({ FACILITY_USE_CODE: 'ZZ' }), [], [], [], [], [], []),
      undefined,
    );
  });

  it('returns undefined when COUNTRY_CODE is missing', () => {
    assert.equal(buildAirport(baseRec({ COUNTRY_CODE: '' }), [], [], [], [], [], []), undefined);
  });

  it('returns undefined when CITY is missing', () => {
    assert.equal(buildAirport(baseRec({ CITY: '' }), [], [], [], [], [], []), undefined);
  });

  it('returns undefined when LONG_DECIMAL is missing', () => {
    assert.equal(buildAirport(baseRec({ LONG_DECIMAL: '' }), [], [], [], [], [], []), undefined);
  });

  it('returns undefined when SITE_TYPE_CODE is missing entirely', () => {
    assert.equal(buildAirport(baseRec({ SITE_TYPE_CODE: '' }), [], [], [], [], [], []), undefined);
  });

  it('returns undefined when OWNERSHIP_TYPE_CODE is missing entirely', () => {
    assert.equal(
      buildAirport(baseRec({ OWNERSHIP_TYPE_CODE: '' }), [], [], [], [], [], []),
      undefined,
    );
  });

  it('returns undefined when FACILITY_USE_CODE is missing entirely', () => {
    assert.equal(
      buildAirport(baseRec({ FACILITY_USE_CODE: '' }), [], [], [], [], [], []),
      undefined,
    );
  });

  it('returns undefined when ARPT_STATUS is missing entirely', () => {
    assert.equal(buildAirport(baseRec({ ARPT_STATUS: '' }), [], [], [], [], [], []), undefined);
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
    assert.ok(airport);
    assert.equal(airport.runways.length, 1);
    const r = airport.runways[0];
    assert.ok(r);
    assert.equal(r.lengthFt, 12079);
    assert.equal(r.widthFt, 200);
    assert.equal(r.surfaceType, 'ASPH-CONC');
    assert.equal(r.condition, 'EXCELLENT');
    assert.equal(r.treatment, 'GROOVED');
    assert.equal(r.pcn, '99/F/A/W/T');
    assert.equal(r.lighting, 'HIGH');
    assert.equal(r.weightLimitSingleWheelKlb, 100);
    assert.equal(r.weightLimitDualWheelKlb, 210);
    assert.equal(r.weightLimitDualTandemKlb, 358);
    assert.equal(r.weightLimitDdtKlb, 900);
  });

  it('skips runway records with mismatched SITE_NO or empty RWY_ID', () => {
    const wrongSite = { SITE_NO: 'OTHER', RWY_ID: '04L/22R' };
    const noId = { SITE_NO: '15793.*A', RWY_ID: '' };
    const airport = buildAirport(baseRec(), [wrongSite, noId], [], [], [], [], []);
    assert.ok(airport);
    assert.equal(airport.runways.length, 0);
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
    assert.ok(airport);
    const r = airport.runways[0];
    assert.ok(r);
    assert.equal(r.ends.length, 1);
    const e = r.ends[0];
    assert.ok(e);
    assert.equal(e.id, '04L');
    assert.equal(e.trueHeadingDeg, 40);
    assert.equal(e.rightTraffic, true);
    assert.equal(e.markingType, 'PIR');
    assert.equal(e.markingCondition, 'GOOD');
    assert.equal(e.lat, 40.65);
    assert.equal(e.lon, -73.8);
    assert.equal(e.elevationFt, 13);
    assert.equal(e.thresholdCrossingHeightFt, 60);
    assert.equal(e.glidepathAngleDeg, 3.0);
    assert.equal(e.displacedThresholdFt, 500);
    assert.equal(e.displacedThresholdElevationFt, 13);
    assert.equal(e.tdzElevationFt, 13);
    assert.equal(e.vgsiType, 'PAPI-4L');
    assert.equal(e.hasRvr, true);
    assert.equal(e.approachLights, 'ALSF2');
    assert.equal(e.hasReil, true);
    assert.equal(e.hasCenterlineLights, true);
    assert.equal(e.hasTdzLights, true);
    assert.equal(e.toraFt, 12079);
    assert.equal(e.todaFt, 12079);
    assert.equal(e.asdaFt, 12079);
    assert.equal(e.ldaFt, 11579);
    assert.equal(e.lahsoDistanceFt, 8500);
    assert.equal(e.lahsoEntity, '13L/31R');
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
    assert.ok(airport);
    const e = airport.runways[0]?.ends[0];
    assert.ok(e);
    assert.equal(e.markingType, undefined);
    assert.equal(e.markingCondition, undefined);
    assert.equal(e.vgsiType, undefined);
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
    assert.ok(r);
    assert.equal(r.condition, undefined);
    assert.equal(r.treatment, undefined);
    assert.equal(r.lighting, undefined);
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
    assert.ok(airport);
    assert.equal(airport.frequencies.length, 1);
    assert.equal(airport.frequencies[0]?.frequencyMhz, 128.725);
    assert.equal(airport.frequencies[0]?.use, 'ATIS');
    assert.equal(airport.frequencies[0]?.sectorization, 'ARRIVAL');
  });

  it('skips frequency records missing FREQ or FREQ_USE', () => {
    const noFreq = { FREQ_USE: 'ATIS' };
    const noUse = { FREQ: '128.725' };
    const airport = buildAirport(baseRec(), [], [], [noFreq, noUse], [], [], []);
    assert.ok(airport);
    assert.equal(airport.frequencies.length, 0);
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
    assert.ok(e);
    assert.ok(e.ils);
    assert.equal(e.ils.identifier, 'I-IJFK');
    assert.equal(e.ils.localizerFrequencyMhz, 109.5);
    assert.equal(e.ils.localizerMagneticCourseDeg, 40);
    assert.equal(e.ils.glideSlopeAngleDeg, 3);
    assert.equal(e.ils.glideSlopeType, 'GLIDE SLOPE');
    assert.equal(e.ils.dmeChannel, '32X');
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
    assert.ok(e?.ils);
    assert.equal(e.ils.glideSlopeType, undefined);
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
    assert.ok(e);
    assert.equal(e.ils, undefined);
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
    assert.ok(e);
    assert.equal(e.ils, undefined);
  });

  it('drops ILS systems with a missing SYSTEM_TYPE_CODE', () => {
    const runway = { SITE_NO: '15793.*A', RWY_ID: '04L/22R' };
    const end = { SITE_NO: '15793.*A', RWY_ID: '04L/22R', RWY_END_ID: '04L' };
    const ilsBase = { SITE_NO: '15793.*A', RWY_END_ID: '04L', SYSTEM_TYPE_CODE: '' };
    const airport = buildAirport(baseRec(), [runway], [end], [], [ilsBase], [], []);
    const e = airport?.runways[0]?.ends[0];
    assert.ok(e);
    assert.equal(e.ils, undefined);
  });

  it('skips ILS records with no RWY_END_ID', () => {
    const runway = { SITE_NO: '15793.*A', RWY_ID: '04L/22R' };
    const end = { SITE_NO: '15793.*A', RWY_ID: '04L/22R', RWY_END_ID: '04L' };
    const ilsBase = { SITE_NO: '15793.*A', RWY_END_ID: '', SYSTEM_TYPE_CODE: 'LS' };
    const ilsGs = { SITE_NO: '15793.*A', RWY_END_ID: '', G_S_TYPE_CODE: 'GS' };
    const ilsDme = { SITE_NO: '15793.*A', RWY_END_ID: '', CHANNEL: '32X' };
    const airport = buildAirport(baseRec(), [runway], [end], [], [ilsBase], [ilsGs], [ilsDme]);
    const e = airport?.runways[0]?.ends[0];
    assert.ok(e);
    assert.equal(e.ils, undefined);
  });

  it('omits localizer course and frequency when the values are missing', () => {
    const runway = { SITE_NO: '15793.*A', RWY_ID: '04L/22R' };
    const end = { SITE_NO: '15793.*A', RWY_ID: '04L/22R', RWY_END_ID: '04L' };
    const ilsBase = { SITE_NO: '15793.*A', RWY_END_ID: '04L', SYSTEM_TYPE_CODE: 'LS' };
    const airport = buildAirport(baseRec(), [runway], [end], [], [ilsBase], [], []);
    const ils = airport?.runways[0]?.ends[0]?.ils;
    assert.ok(ils);
    assert.equal(ils.identifier, undefined);
    assert.equal(ils.category, undefined);
    assert.equal(ils.localizerFrequencyMhz, undefined);
    assert.equal(ils.localizerMagneticCourseDeg, undefined);
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
    assert.ok(ils);
    assert.equal(ils.category, undefined);
  });
});
