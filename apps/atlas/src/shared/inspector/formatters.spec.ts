import { describe, it, expect } from 'vitest';

import type { Airport, Airway, AirwayWaypoint, Fix, Navaid } from '@squawk/types';

import {
  airportApproachCallSign,
  airportTowerCallSign,
  formatAirportFacilityType,
  formatAirportFrequency,
  formatAirportRunway,
  formatAirportStatus,
  formatAirwayRegion,
  formatAirwayType,
  formatAirwayWaypointAltitudes,
  formatFixNavaidAssociation,
  formatFixUseCode,
  formatFrequencyProvider,
  formatNavaidCheckpoint,
  formatNavaidFrequency,
  formatNavaidMagVariation,
  formatNavaidStatus,
  formatPavementClassification,
  formatRunwayRvr,
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

describe('formatAirportFrequency', () => {
  it('keeps the third decimal a 25 kHz channel needs and drops it otherwise', () => {
    expect(formatAirportFrequency({ use: 'CD/P', frequencyMhz: 121.725 })).toBe('121.725 MHz');
    expect(formatAirportFrequency({ use: 'LCL/P', frequencyMhz: 119.1 })).toBe('119.10 MHz');
  });

  it('prints an HF frequency to three decimals', () => {
    expect(formatAirportFrequency({ use: 'HNL RADIO', frequencyMhz: 5.68 })).toBe('5.680 MHz');
  });

  it('spells out the receive-only and on-request qualifiers', () => {
    expect(formatAirportFrequency({ use: 'RCO', frequencyMhz: 122.1, receiveOnly: true })).toBe(
      '122.10 MHz, receive only',
    );
    expect(formatAirportFrequency({ use: 'HF', frequencyMhz: 8.903, onRequest: true })).toBe(
      '8.903 MHz, on request',
    );
  });
});

describe('formatFrequencyProvider', () => {
  it('names the facility by call sign when published, then its type in words', () => {
    expect(
      formatFrequencyProvider({
        use: 'PRC RADIO',
        frequencyMhz: 125.3,
        provider: 'PRC',
        providerType: 'FSS',
        callSign: 'PRESCOTT',
      }),
    ).toBe('PRESCOTT FSS');
    expect(
      formatFrequencyProvider({
        use: 'CD/P',
        frequencyMhz: 121.725,
        provider: 'BHM',
        providerType: 'ATCT-TRACON',
      }),
    ).toBe('BHM tower & TRACON');
  });

  it('falls back to the raw type code it does not know, and to the name alone without one', () => {
    expect(
      formatFrequencyProvider({ use: 'X', frequencyMhz: 1, provider: 'ABC', providerType: 'NEW' }),
    ).toBe('ABC NEW');
    expect(formatFrequencyProvider({ use: 'X', frequencyMhz: 1, provider: 'ABC' })).toBe('ABC');
  });

  it('returns null when no provider is published', () => {
    expect(formatFrequencyProvider({ use: 'CTAF', frequencyMhz: 122.8 })).toBeNull();
  });
});

describe('airportTowerCallSign and airportApproachCallSign', () => {
  const airport: Airport = {
    faaId: 'EET',
    name: 'SHELBY COUNTY',
    facilityType: 'AIRPORT',
    ownershipType: 'PUBLIC',
    useType: 'PUBLIC',
    status: 'OPEN',
    city: 'ALABASTER',
    state: 'AL',
    country: 'US',
    lat: 33.18,
    lon: -86.78,
    timezone: 'America/Chicago',
    elevationFt: 586,
    runways: [],
    frequencies: [
      { use: 'CTAF', frequencyMhz: 123.0, provider: 'EET', providerType: 'NON-ATCT' },
      {
        use: 'CD/P',
        frequencyMhz: 121.725,
        provider: 'BHM',
        providerType: 'ATCT-TRACON',
        callSign: 'BIRMINGHAM',
        approachCallSign: 'BIRMINGHAM',
      },
    ],
  };

  it('takes the tower call sign only from the airport own tower', () => {
    expect(airportTowerCallSign(airport)).toBeNull();
    expect(
      airportTowerCallSign({
        ...airport,
        frequencies: [
          ...airport.frequencies,
          {
            use: 'LCL/P',
            frequencyMhz: 118.3,
            provider: 'EET',
            providerType: 'ATCT',
            callSign: 'SHELBY',
          },
        ],
      }),
    ).toBe('SHELBY');
  });

  it('takes the first published approach call sign', () => {
    expect(airportApproachCallSign(airport)).toBe('BIRMINGHAM');
    expect(airportApproachCallSign({ ...airport, frequencies: [] })).toBeNull();
  });
});

describe('formatPavementClassification', () => {
  it('writes the rating in the FAA form with its four codes', () => {
    expect(
      formatPavementClassification({
        system: 'PCN',
        value: 10,
        pavementType: 'FLEXIBLE',
        subgradeStrength: 'C',
        tirePressure: 'X',
        evaluationMethod: 'USING_AIRCRAFT',
      }),
    ).toBe('PCN 10 F/C/X/U');
  });
});

describe('formatRunwayRvr', () => {
  it('lists each end that measures RVR with its sites', () => {
    expect(
      formatRunwayRvr({
        id: '04L/22R',
        ends: [{ id: '04L', rvrLocations: ['TOUCHDOWN', 'ROLLOUT'] }, { id: '22R' }],
      }),
    ).toBe('04L RVR-TR');
  });

  it('returns null when no end measures RVR', () => {
    expect(
      formatRunwayRvr({ id: '09/27', ends: [{ id: '09', rvrLocations: [] }, { id: '27' }] }),
    ).toBeNull();
  });
});

describe('formatNavaidCheckpoint', () => {
  it('reads a ground checkpoint as its three-digit radial', () => {
    expect(
      formatNavaidCheckpoint({ type: 'GROUND', magneticBearingDeg: 5, description: 'RUNUP' }),
    ).toBe('R-005, ground');
  });

  it('adds the altitude to an airborne checkpoint when one is published', () => {
    expect(
      formatNavaidCheckpoint({
        type: 'AIRBORNE',
        magneticBearingDeg: 270,
        altitudeFt: 2500,
        description: 'OVER BRIDGE',
      }),
    ).toBe('R-270, airborne at 2500 ft MSL');
    expect(
      formatNavaidCheckpoint({ type: 'AIRBORNE', magneticBearingDeg: 270, description: 'X' }),
    ).toBe('R-270, airborne');
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

describe('formatFixNavaidAssociation', () => {
  it('prints the bearing and distance when both are published', () => {
    expect(
      formatFixNavaidAssociation({
        navaidId: 'BOS',
        navaidType: 'VOR/DME',
        magneticBearingDeg: 270.4,
        distanceNm: 14.62,
      }),
    ).toBe('270 deg M / 14.6 nm');
  });

  it('prints the bearing alone for a radial or localizer course without a distance', () => {
    expect(
      formatFixNavaidAssociation({ navaidId: 'PDK', navaidType: 'LOC', magneticBearingDeg: 25.51 }),
    ).toBe('26 deg M');
  });

  it('prints the distance alone for a DME arc', () => {
    expect(
      formatFixNavaidAssociation({ navaidId: 'CZF', navaidType: 'DME', distanceNm: 1.8 }),
    ).toBe('1.8 nm');
  });

  it('prints a hyphen when neither is published, since the row label carries the type', () => {
    expect(formatFixNavaidAssociation({ navaidId: 'CPS', navaidType: 'OM' })).toBe('-');
  });

  it('prints a published bearing or distance of zero', () => {
    expect(
      formatFixNavaidAssociation({
        navaidId: 'LNK',
        navaidType: 'VORTAC',
        magneticBearingDeg: 0,
        distanceNm: 0,
      }),
    ).toBe('0 deg M / 0.0 nm');
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
      ['SPECIAL', 'Special (non-regulatory)'],
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
    name: 'WPT',
    identifier: 'WPT',
    waypointType: 'FIX',
    lat: 0,
    lon: 0,
    ...overrides,
  };
}

describe('formatAirwayWaypointAltitudes', () => {
  it('lists every published altitude as its own labeled line, in reading order', () => {
    expect(
      formatAirwayWaypointAltitudes(
        buildWaypoint({
          maximumAuthorizedAltitudeFt: 17500,
          minimumObstructionClearanceAltitudeFt: 3400,
          gnssMinimumEnrouteAltitudeFt: 3000,
          minimumEnrouteAltitudeFt: 6000,
          dmeDmeIruMinimumEnrouteAltitudeFt: 5000,
          minimumCrossingAltitudeFt: 6000,
          minimumCrossingAltitudeDirection: 'S BND',
        }),
      ),
    ).toEqual([
      'MEA 6000',
      'GNSS MEA 3000',
      'DME/DME/IRU MEA 5000',
      'MOCA 3400',
      'MAA 17500',
      'MCA 6000 S BND',
    ]);
  });

  it('shows a directional MEA with its bound and the opposite direction after a slash', () => {
    expect(
      formatAirwayWaypointAltitudes(
        buildWaypoint({
          minimumEnrouteAltitudeFt: 2100,
          minimumEnrouteAltitudeDirection: 'NE BND',
          minimumEnrouteAltitudeOppositeFt: 5000,
          minimumEnrouteAltitudeOppositeDirection: 'SW BND',
        }),
      ),
    ).toEqual(['MEA 2100 NE BND / 5000 SW BND']);
  });

  it('shows a directional GNSS MEA and an opposite-direction MCA the same way', () => {
    expect(
      formatAirwayWaypointAltitudes(
        buildWaypoint({
          gnssMinimumEnrouteAltitudeFt: 3000,
          gnssMinimumEnrouteAltitudeDirection: 'SW BND',
          gnssMinimumEnrouteAltitudeOppositeFt: 3500,
          gnssMinimumEnrouteAltitudeOppositeDirection: 'NE BND',
          minimumCrossingAltitudeFt: 6000,
          minimumCrossingAltitudeDirection: 'S BND',
          minimumCrossingAltitudeOppositeFt: 2600,
          minimumCrossingAltitudeOppositeDirection: 'N BND',
        }),
      ),
    ).toEqual(['GNSS MEA 3000 SW BND / 3500 NE BND', 'MCA 6000 S BND / 2600 N BND']);
  });

  it('shows the GNSS MEA alone when it is the only published altitude', () => {
    expect(
      formatAirwayWaypointAltitudes(buildWaypoint({ gnssMinimumEnrouteAltitudeFt: 4000 })),
    ).toEqual(['GNSS MEA 4000']);
  });

  it('keeps an opposite-direction value whose primary is missing', () => {
    expect(
      formatAirwayWaypointAltitudes(
        buildWaypoint({
          minimumEnrouteAltitudeOppositeFt: 5000,
          minimumEnrouteAltitudeOppositeDirection: 'SW BND',
        }),
      ),
    ).toEqual(['MEA 5000 SW BND']);
  });

  it('returns no lines when nothing is published', () => {
    expect(formatAirwayWaypointAltitudes(buildWaypoint({}))).toEqual([]);
  });
});
