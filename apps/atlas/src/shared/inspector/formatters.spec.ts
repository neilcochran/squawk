import { describe, it, expect } from 'vitest';
import type { Airport, Airway, AirwayWaypoint, Fix, Navaid } from '@squawk/types';
import {
  formatAirportFacilityType,
  formatAirportRunway,
  formatAirportStatus,
  formatAirwayRegion,
  formatAirwayType,
  formatAirwayWaypointAltitude,
  formatFixUseCode,
  formatNavaidFrequency,
  formatNavaidMagVariation,
  formatNavaidStatus,
} from './formatters.ts';

describe('formatAirportFacilityType', () => {
  it('returns sentence-cased labels for every variant', () => {
    const cases: ReadonlyArray<[Airport['facilityType'], string]> = [
      ['AIRPORT', 'Airport'],
      ['HELIPORT', 'Heliport'],
      ['SEAPLANE_BASE', 'Seaplane base'],
      ['GLIDERPORT', 'Gliderport'],
      ['ULTRALIGHT', 'Ultralight'],
      ['BALLOONPORT', 'Balloonport'],
    ];
    for (const [input, expected] of cases) {
      expect(formatAirportFacilityType(input)).toBe(expected);
    }
  });
});

describe('formatAirportStatus', () => {
  it('returns sentence-cased labels for every variant', () => {
    expect(formatAirportStatus('OPEN')).toBe('Open');
    expect(formatAirportStatus('CLOSED_INDEFINITELY')).toBe('Closed (indefinite)');
    expect(formatAirportStatus('CLOSED_PERMANENTLY')).toBe('Closed (permanent)');
  });
});

describe('formatAirportRunway', () => {
  it('combines length and width when both are present', () => {
    expect(formatAirportRunway(7000, 150, 'ASPH')).toBe('7000 x 150 ft, ASPH');
  });

  it('falls back to length-only when width is missing', () => {
    expect(formatAirportRunway(5000, undefined, 'TURF')).toBe('5000 ft, TURF');
  });

  it('renders just the surface when both length and width are missing', () => {
    expect(formatAirportRunway(undefined, undefined, 'CONC')).toBe('CONC');
  });

  it('renders just the dimensions when surface is missing', () => {
    expect(formatAirportRunway(7000, 150, undefined)).toBe('7000 x 150 ft');
  });

  it('returns "-" when nothing is set', () => {
    expect(formatAirportRunway(undefined, undefined, undefined)).toBe('-');
  });

  it('skips length-only when width is set without length', () => {
    // Width-only without length is meaningless; the helper drops both
    // so the output does not mislead with a half-dimension.
    expect(formatAirportRunway(undefined, 150, 'ASPH')).toBe('ASPH');
  });
});

function buildNavaid(overrides: Partial<Navaid>): Navaid {
  return {
    identifier: 'BOS',
    name: 'BOSTON',
    type: 'VOR',
    status: 'OPERATIONAL_IFR',
    location: { latitude: 0, longitude: 0 },
    ...overrides,
  } as Navaid;
}

describe('formatNavaidFrequency', () => {
  it('renders MHz to two decimal places when frequencyMhz is set', () => {
    expect(formatNavaidFrequency(buildNavaid({ frequencyMhz: 112.7 }))).toBe('112.70 MHz');
  });

  it('renders kHz when frequencyKhz is set', () => {
    expect(formatNavaidFrequency(buildNavaid({ frequencyKhz: 215 }))).toBe('215 kHz');
  });

  it('returns null when neither frequency is set', () => {
    expect(formatNavaidFrequency(buildNavaid({}))).toBeNull();
  });

  it('prefers MHz when both are set (VOR-family records carry MHz)', () => {
    expect(formatNavaidFrequency(buildNavaid({ frequencyMhz: 110.5, frequencyKhz: 215 }))).toBe(
      '110.50 MHz',
    );
  });
});

describe('formatNavaidMagVariation', () => {
  it('returns null when undefined', () => {
    expect(formatNavaidMagVariation(buildNavaid({}))).toBeNull();
  });

  it('renders without direction when direction is missing', () => {
    expect(formatNavaidMagVariation(buildNavaid({ magneticVariationDeg: 14 }))).toBe('14 deg');
  });

  it('renders with direction when both are set', () => {
    expect(
      formatNavaidMagVariation(
        buildNavaid({ magneticVariationDeg: 14, magneticVariationDirection: 'W' }),
      ),
    ).toBe('14 deg W');
  });
});

describe('formatNavaidStatus', () => {
  it('returns sentence-cased labels for every variant', () => {
    expect(formatNavaidStatus('OPERATIONAL_IFR')).toBe('Operational (IFR)');
    expect(formatNavaidStatus('OPERATIONAL_RESTRICTED')).toBe('Operational (restricted)');
    expect(formatNavaidStatus('OPERATIONAL_VFR')).toBe('Operational (VFR only)');
    expect(formatNavaidStatus('SHUTDOWN')).toBe('Shutdown');
  });
});

describe('formatFixUseCode', () => {
  it('returns sentence-cased labels for every variant', () => {
    const cases: ReadonlyArray<[Fix['useCode'], string]> = [
      ['WP', 'Waypoint'],
      ['RP', 'Reporting point'],
      ['MW', 'Military waypoint'],
      ['MR', 'Military reporting point'],
      ['CN', 'Computer nav'],
      ['VFR', 'VFR waypoint'],
      ['NRS', 'NRS waypoint'],
      ['RADAR', 'Radar fix'],
    ];
    for (const [input, expected] of cases) {
      expect(formatFixUseCode(input)).toBe(expected);
    }
  });
});

describe('formatAirwayType', () => {
  it('returns sentence-cased labels for every variant', () => {
    const cases: ReadonlyArray<[Airway['type'], string]> = [
      ['VICTOR', 'Victor (low altitude)'],
      ['JET', 'Jet (high altitude)'],
      ['RNAV_T', 'RNAV T (low altitude)'],
      ['RNAV_Q', 'RNAV Q (high altitude)'],
      ['ATLANTIC', 'Atlantic'],
      ['BAHAMA', 'Bahama'],
      ['PACIFIC', 'Pacific'],
      ['PUERTO_RICO', 'Puerto Rico'],
      ['GREEN', 'Green'],
      ['RED', 'Red'],
      ['AMBER', 'Amber'],
      ['BLUE', 'Blue'],
    ];
    for (const [input, expected] of cases) {
      expect(formatAirwayType(input)).toBe(expected);
    }
  });
});

describe('formatAirwayRegion', () => {
  it('returns sentence-cased labels for every variant', () => {
    expect(formatAirwayRegion('US')).toBe('US');
    expect(formatAirwayRegion('ALASKA')).toBe('Alaska');
    expect(formatAirwayRegion('HAWAII')).toBe('Hawaii');
  });
});

function buildWaypoint(overrides: Partial<AirwayWaypoint>): AirwayWaypoint {
  return {
    identifier: 'WPT',
    location: { latitude: 0, longitude: 0 },
    ...overrides,
  } as AirwayWaypoint;
}

describe('formatAirwayWaypointAltitude', () => {
  it('renders MEA - MAA when both are present', () => {
    expect(
      formatAirwayWaypointAltitude(
        buildWaypoint({ minimumEnrouteAltitudeFt: 6000, maximumAuthorizedAltitudeFt: 18000 }),
      ),
    ).toBe('6000 - 18000');
  });

  it('renders MEA only when MAA is missing', () => {
    expect(formatAirwayWaypointAltitude(buildWaypoint({ minimumEnrouteAltitudeFt: 6000 }))).toBe(
      'MEA 6000',
    );
  });

  it('falls back to MOCA when MEA is missing', () => {
    expect(
      formatAirwayWaypointAltitude(buildWaypoint({ minimumObstructionClearanceAltitudeFt: 4500 })),
    ).toBe('MOCA 4500');
  });

  it('returns "-" when no altitudes are set', () => {
    expect(formatAirwayWaypointAltitude(buildWaypoint({}))).toBe('-');
  });
});
