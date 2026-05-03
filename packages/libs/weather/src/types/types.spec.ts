import { describe, it, expect } from 'vitest';

import {
  AIRMET_SERIES_MAP,
  AIRMET_HAZARD_TYPE_MAP,
  AIRMET_CONDITION_STATUS_MAP,
} from './airmet.js';
import { PRESSURE_TENDENCY_MAP } from './metar.js';
import {
  PIREP_TURBULENCE_INTENSITY_MAP,
  TURBULENCE_TYPE_MAP,
  TURBULENCE_FREQUENCY_MAP,
  PIREP_ICING_INTENSITY_MAP,
  ICING_TYPE_MAP,
} from './pirep.js';
import { WEATHER_DESCRIPTOR_MAP, WEATHER_PHENOMENON_MAP, CLOUD_COVERAGE_MAP } from './shared.js';
import {
  SIGMET_FORMAT_MAP,
  SIGMET_HAZARD_TYPE_MAP,
  CONVECTIVE_SIGMET_REGION_MAP,
  CONVECTIVE_THUNDERSTORM_TYPE_MAP,
  SIGMET_INTENSITY_CHANGE_MAP,
} from './sigmet.js';
import { TAF_CHANGE_TYPE_MAP, TURBULENCE_INTENSITY_MAP, ICING_INTENSITY_MAP } from './taf.js';

describe('AIRMET type maps', () => {
  it('AIRMET_SERIES_MAP has SIERRA / TANGO / ZULU entries', () => {
    expect(AIRMET_SERIES_MAP.SIERRA).toMatch(/IFR/);
    expect(AIRMET_SERIES_MAP.TANGO).toMatch(/Turbulence/);
    expect(AIRMET_SERIES_MAP.ZULU).toMatch(/Icing/);
  });

  it('AIRMET_HAZARD_TYPE_MAP covers expected hazards', () => {
    expect(AIRMET_HAZARD_TYPE_MAP.IFR).toBe('IFR');
    expect(AIRMET_HAZARD_TYPE_MAP.MTN_OBSCN).toBe('Mountain Obscuration');
    expect(AIRMET_HAZARD_TYPE_MAP.TURB).toBe('Turbulence');
    expect(AIRMET_HAZARD_TYPE_MAP.STG_SFC_WND).toBe('Strong Surface Winds');
    expect(AIRMET_HAZARD_TYPE_MAP.LLWS).toBe('Low-Level Wind Shear');
    expect(AIRMET_HAZARD_TYPE_MAP.ICE).toBe('Icing');
  });

  it('AIRMET_CONDITION_STATUS_MAP covers DEVELOPING / CONTINUING / ENDING', () => {
    expect(AIRMET_CONDITION_STATUS_MAP.DEVELOPING).toBe('Developing');
    expect(AIRMET_CONDITION_STATUS_MAP.CONTINUING).toBe('Continuing');
    expect(AIRMET_CONDITION_STATUS_MAP.ENDING).toBe('Ending');
  });
});

describe('METAR type maps', () => {
  it('PRESSURE_TENDENCY_MAP covers all 9 character codes', () => {
    for (const code of [0, 1, 2, 3, 4, 5, 6, 7, 8] as const) {
      expect(PRESSURE_TENDENCY_MAP[code]).toBeTypeOf('string');
      expect(PRESSURE_TENDENCY_MAP[code].length).toBeGreaterThan(0);
    }
  });
});

describe('PIREP type maps', () => {
  it('PIREP_TURBULENCE_INTENSITY_MAP has at least one entry', () => {
    expect(Object.keys(PIREP_TURBULENCE_INTENSITY_MAP).length).toBeGreaterThan(0);
  });

  it('TURBULENCE_TYPE_MAP has at least one entry', () => {
    expect(Object.keys(TURBULENCE_TYPE_MAP).length).toBeGreaterThan(0);
  });

  it('TURBULENCE_FREQUENCY_MAP has at least one entry', () => {
    expect(Object.keys(TURBULENCE_FREQUENCY_MAP).length).toBeGreaterThan(0);
  });

  it('PIREP_ICING_INTENSITY_MAP has at least one entry', () => {
    expect(Object.keys(PIREP_ICING_INTENSITY_MAP).length).toBeGreaterThan(0);
  });

  it('ICING_TYPE_MAP has at least one entry', () => {
    expect(Object.keys(ICING_TYPE_MAP).length).toBeGreaterThan(0);
  });
});

describe('shared type maps', () => {
  it('WEATHER_DESCRIPTOR_MAP has at least one entry', () => {
    expect(Object.keys(WEATHER_DESCRIPTOR_MAP).length).toBeGreaterThan(0);
  });

  it('WEATHER_PHENOMENON_MAP has at least one entry', () => {
    expect(Object.keys(WEATHER_PHENOMENON_MAP).length).toBeGreaterThan(0);
  });

  it('CLOUD_COVERAGE_MAP has at least one entry', () => {
    expect(Object.keys(CLOUD_COVERAGE_MAP).length).toBeGreaterThan(0);
  });
});

describe('TAF type maps', () => {
  it('TAF_CHANGE_TYPE_MAP has at least one entry', () => {
    expect(Object.keys(TAF_CHANGE_TYPE_MAP).length).toBeGreaterThan(0);
  });

  it('TURBULENCE_INTENSITY_MAP has at least one entry', () => {
    expect(Object.keys(TURBULENCE_INTENSITY_MAP).length).toBeGreaterThan(0);
  });

  it('ICING_INTENSITY_MAP has at least one entry', () => {
    expect(Object.keys(ICING_INTENSITY_MAP).length).toBeGreaterThan(0);
  });
});

describe('SIGMET type maps', () => {
  it('SIGMET_FORMAT_MAP has at least one entry', () => {
    expect(Object.keys(SIGMET_FORMAT_MAP).length).toBeGreaterThan(0);
  });

  it('SIGMET_HAZARD_TYPE_MAP has at least one entry', () => {
    expect(Object.keys(SIGMET_HAZARD_TYPE_MAP).length).toBeGreaterThan(0);
  });

  it('CONVECTIVE_SIGMET_REGION_MAP has at least one entry', () => {
    expect(Object.keys(CONVECTIVE_SIGMET_REGION_MAP).length).toBeGreaterThan(0);
  });

  it('CONVECTIVE_THUNDERSTORM_TYPE_MAP has at least one entry', () => {
    expect(Object.keys(CONVECTIVE_THUNDERSTORM_TYPE_MAP).length).toBeGreaterThan(0);
  });

  it('SIGMET_INTENSITY_CHANGE_MAP has at least one entry', () => {
    expect(Object.keys(SIGMET_INTENSITY_CHANGE_MAP).length).toBeGreaterThan(0);
  });
});
