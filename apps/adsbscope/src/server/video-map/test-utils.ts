import type { Airport, Fix, Navaid } from '@squawk/types';

/**
 * Builds an airport for specs: an open, public-use, non-towered airport with
 * no ICAO code and no runways, unless overridden.
 *
 * @param overrides - Fields to set on top of that baseline.
 * @returns The airport.
 */
export function makeAirport(overrides: Partial<Airport> = {}): Airport {
  return {
    faaId: '1B0',
    name: 'TEST FIELD',
    facilityType: 'AIRPORT',
    ownershipType: 'PUBLIC',
    useType: 'PUBLIC',
    status: 'OPEN',
    city: 'TESTVILLE',
    country: 'US',
    lat: 40.1,
    lon: -74,
    timezone: 'America/New_York',
    towerType: 'NON-ATCT',
    runways: [],
    frequencies: [],
    ...overrides,
  };
}

/**
 * Builds a navaid for specs: an operational VOR, unless overridden.
 *
 * @param overrides - Fields to set on top of that baseline.
 * @returns The navaid.
 */
export function makeNavaid(overrides: Partial<Navaid> = {}): Navaid {
  return {
    identifier: 'TST',
    name: 'TEST',
    type: 'VOR',
    status: 'OPERATIONAL_IFR',
    lat: 40.2,
    lon: -74,
    country: 'US',
    ...overrides,
  };
}

/**
 * Builds a fix for specs: a waypoint charted on the low enroute chart, unless
 * overridden.
 *
 * @param overrides - Fields to set on top of that baseline.
 * @returns The fix.
 */
export function makeFix(overrides: Partial<Fix> = {}): Fix {
  return {
    identifier: 'TESTS',
    icaoRegionCode: 'K6',
    country: 'US',
    lat: 40.3,
    lon: -74,
    useCode: 'WP',
    pitch: false,
    catch: false,
    suaAtcaa: false,
    chartTypes: ['ENROUTE LOW'],
    navaidAssociations: [],
    ...overrides,
  };
}
