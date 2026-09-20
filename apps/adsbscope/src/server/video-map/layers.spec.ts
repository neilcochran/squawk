import { describe, expect, it } from 'vitest';

import {
  areFixLabelsShown,
  areRunwaysShown,
  isAirportShown,
  isFixShown,
  isNavaidShown,
  shownAirspaceClass,
  VIDEO_MAP_LAYER_MAX_RANGE_NM as LIMITS,
} from './layers.js';
import { makeAirport, makeFix, makeNavaid } from './test-utils.js';

describe('isAirportShown', () => {
  it('shows a towered airport at every range', () => {
    const towered = makeAirport({ towerType: 'ATCT-TRACON' });

    expect(isAirportShown(towered, 5)).toBe(true);
    expect(isAirportShown(towered, 250)).toBe(true);
  });

  it('shows a non-towered airport with an ICAO code only up to the regional limit', () => {
    const regional = makeAirport({ icao: 'KTST' });

    expect(isAirportShown(regional, LIMITS.icaoAirports)).toBe(true);
    expect(isAirportShown(regional, LIMITS.icaoAirports + 1)).toBe(false);
  });

  it('treats an airport with no tower type as non-towered', () => {
    const untyped = makeAirport();
    delete untyped.towerType;

    expect(isAirportShown(untyped, LIMITS.publicAirports)).toBe(true);
    expect(isAirportShown(untyped, LIMITS.publicAirports + 1)).toBe(false);
  });

  it('shows a small public-use airport only close in, and a private one never', () => {
    expect(isAirportShown(makeAirport(), LIMITS.publicAirports)).toBe(true);
    expect(isAirportShown(makeAirport(), LIMITS.publicAirports + 1)).toBe(false);
    expect(isAirportShown(makeAirport({ useType: 'PRIVATE' }), 5)).toBe(false);
  });

  it('never shows heliports, seaplane bases, or closed airports, even towered ones', () => {
    expect(isAirportShown(makeAirport({ facilityType: 'HELIPORT', towerType: 'ATCT' }), 5)).toBe(
      false,
    );
    expect(isAirportShown(makeAirport({ facilityType: 'SEAPLANE_BASE' }), 5)).toBe(false);
    expect(
      isAirportShown(makeAirport({ status: 'CLOSED_INDEFINITELY', towerType: 'ATCT' }), 5),
    ).toBe(false);
  });
});

describe('areRunwaysShown', () => {
  it('draws runways up to the runway limit', () => {
    expect(areRunwaysShown(LIMITS.runways)).toBe(true);
    expect(areRunwaysShown(LIMITS.runways + 1)).toBe(false);
  });
});

describe('isNavaidShown', () => {
  it('shows the VOR family up to its limit', () => {
    for (const type of ['VOR', 'VORTAC', 'VOR/DME', 'TACAN'] as const) {
      expect(isNavaidShown(makeNavaid({ type }), LIMITS.vorNavaids)).toBe(true);
      expect(isNavaidShown(makeNavaid({ type }), LIMITS.vorNavaids + 1)).toBe(false);
    }
  });

  it('shows NDBs only close in', () => {
    for (const type of ['NDB', 'NDB/DME'] as const) {
      expect(isNavaidShown(makeNavaid({ type }), LIMITS.ndbNavaids)).toBe(true);
      expect(isNavaidShown(makeNavaid({ type }), LIMITS.ndbNavaids + 1)).toBe(false);
    }
  });

  it('never shows DME-only facilities, test facilities, or markers', () => {
    for (const type of ['DME', 'VOT', 'FAN_MARKER', 'MARINE_NDB'] as const) {
      expect(isNavaidShown(makeNavaid({ type }), 5)).toBe(false);
    }
  });
});

describe('isFixShown', () => {
  it('shows fixes charted on enroute charts, SIDs, and STARs, up to the fix limit', () => {
    for (const chartType of ['ENROUTE LOW', 'ENROUTE HIGH', 'SID', 'STAR']) {
      expect(isFixShown(makeFix({ chartTypes: ['IAP', chartType] }), LIMITS.fixes)).toBe(true);
    }
    expect(isFixShown(makeFix(), LIMITS.fixes + 1)).toBe(false);
  });

  it('never shows approach-only or uncharted fixes', () => {
    expect(isFixShown(makeFix({ chartTypes: ['IAP', 'SPECIAL IAP'] }), 5)).toBe(false);
    expect(isFixShown(makeFix({ chartTypes: [] }), 5)).toBe(false);
  });
});

describe('areFixLabelsShown', () => {
  it('labels fixes only close in, well inside the range at which they are shown', () => {
    expect(areFixLabelsShown(LIMITS.fixLabels)).toBe(true);
    expect(areFixLabelsShown(LIMITS.fixLabels + 1)).toBe(false);
    expect(LIMITS.fixLabels).toBeLessThan(LIMITS.fixes);
  });
});

describe('shownAirspaceClass', () => {
  it('shows Class B and C at every range', () => {
    expect(shownAirspaceClass('CLASS_B', 250)).toBe('classB');
    expect(shownAirspaceClass('CLASS_C', 250)).toBe('classC');
  });

  it('shows Class D up to its limit', () => {
    expect(shownAirspaceClass('CLASS_D', LIMITS.classD)).toBe('classD');
    expect(shownAirspaceClass('CLASS_D', LIMITS.classD + 1)).toBeUndefined();
  });

  it('shows restricted and prohibited areas, as special use, up to the special-use limit', () => {
    for (const type of ['RESTRICTED', 'PROHIBITED']) {
      expect(shownAirspaceClass(type, LIMITS.specialUse)).toBe('specialUse');
      expect(shownAirspaceClass(type, LIMITS.specialUse + 1)).toBeUndefined();
    }
  });

  it('never shows Class E, MOAs, warning areas, or ARTCC boundaries', () => {
    for (const type of ['CLASS_E5', 'MOA', 'WARNING', 'ALERT', 'ARTCC', 'NSA']) {
      expect(shownAirspaceClass(type, 5)).toBeUndefined();
    }
  });
});
