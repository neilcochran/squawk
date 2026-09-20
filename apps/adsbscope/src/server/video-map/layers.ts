import type { Airport, Fix, Navaid } from '@squawk/types';

import type { VideoMapAirspaceClass } from '../../shared/protocol.js';

/**
 * How far beyond the scope range the map reaches, as a multiple of the range.
 * The range circle fits the shorter side of the canvas, so on a wide screen
 * the corners are about twice as far from the receiver as the circle is.
 */
export const VIDEO_MAP_VIEW_FACTOR = 2.1;

/**
 * The largest scope range, in nautical miles, at which each layer of the map
 * is included. Zooming out drops detail layer by layer, so the map thins as
 * it shrinks instead of turning into a smear of overlapping labels. These are
 * the knobs to turn if the map is too busy or too sparse at some range.
 */
export const VIDEO_MAP_LAYER_MAX_RANGE_NM = {
  /** Public-use airports with no ICAO code: small fields, only useful close in. */
  publicAirports: 20,
  /** Airports with an ICAO code: the regionally significant ones. Towered airports are shown at every range. */
  icaoAirports: 80,
  /** Runways drawn to scale. Beyond this they are too short to see, and the airport gets a symbol instead. */
  runways: 60,
  /** VORs, VORTACs, VOR/DMEs, and TACANs. */
  vorNavaids: 150,
  /** NDBs. */
  ndbNavaids: 40,
  /** Fixes charted on enroute charts, SIDs, and STARs. */
  fixes: 40,
  /** Labels on those fixes. Beyond this a fix is a bare symbol: on a real scope fixes are mostly unlabeled, and their labels are what crowd the traffic. */
  fixLabels: 20,
  /** Class D airspace. Class B and C are shown at every range. */
  classD: 100,
  /** Restricted and prohibited areas. */
  specialUse: 150,
} as const;

/** How finely a line is drawn relative to the scope range: vertices closer together than `rangeNm / this` are merged, as they would land within a pixel or two of each other. */
export const VIDEO_MAP_LINE_DETAIL = 300;

const NON_TOWERED = 'NON-ATCT';
const VOR_NAVAID_TYPES: readonly string[] = ['VOR', 'VORTAC', 'VOR/DME', 'TACAN'];
const NDB_NAVAID_TYPES: readonly string[] = ['NDB', 'NDB/DME'];
const ROUTE_CHART_TYPES: readonly string[] = ['ENROUTE LOW', 'ENROUTE HIGH', 'SID', 'STAR'];
const AIRSPACE_CLASS_BY_TYPE: Readonly<Record<string, VideoMapAirspaceClass>> = {
  CLASS_B: 'classB',
  CLASS_C: 'classC',
  CLASS_D: 'classD',
  RESTRICTED: 'specialUse',
  PROHIBITED: 'specialUse',
};

/**
 * Decides whether an airport belongs on the map at a range. Only open,
 * fixed-wing airports are considered (no heliports or seaplane bases);
 * towered airports are always shown, then ICAO-coded and public-use airports
 * as the range closes in.
 *
 * @param airport - The airport.
 * @param rangeNm - The scope range in nautical miles.
 * @returns True if the airport should be on the map.
 */
export function isAirportShown(airport: Airport, rangeNm: number): boolean {
  if (airport.facilityType !== 'AIRPORT' || airport.status !== 'OPEN') {
    return false;
  }
  if (airport.towerType !== undefined && airport.towerType !== NON_TOWERED) {
    return true;
  }
  if (airport.icao !== undefined) {
    return rangeNm <= VIDEO_MAP_LAYER_MAX_RANGE_NM.icaoAirports;
  }
  return airport.useType === 'PUBLIC' && rangeNm <= VIDEO_MAP_LAYER_MAX_RANGE_NM.publicAirports;
}

/**
 * Decides whether runways are drawn to scale at a range.
 *
 * @param rangeNm - The scope range in nautical miles.
 * @returns True if runways are long enough on screen to be worth drawing.
 */
export function areRunwaysShown(rangeNm: number): boolean {
  return rangeNm <= VIDEO_MAP_LAYER_MAX_RANGE_NM.runways;
}

/**
 * Decides whether a navaid belongs on the map at a range. DME-only
 * facilities, VOR test facilities, and marker beacons are never shown.
 *
 * @param navaid - The navaid.
 * @param rangeNm - The scope range in nautical miles.
 * @returns True if the navaid should be on the map.
 */
export function isNavaidShown(navaid: Navaid, rangeNm: number): boolean {
  if (VOR_NAVAID_TYPES.includes(navaid.type)) {
    return rangeNm <= VIDEO_MAP_LAYER_MAX_RANGE_NM.vorNavaids;
  }
  if (NDB_NAVAID_TYPES.includes(navaid.type)) {
    return rangeNm <= VIDEO_MAP_LAYER_MAX_RANGE_NM.ndbNavaids;
  }
  return false;
}

/**
 * Decides whether a fix belongs on the map at a range. Only fixes that define
 * routes - charted on an enroute chart, a SID, or a STAR - are shown;
 * approach-only fixes outnumber them several times over and would bury the
 * map.
 *
 * @param fix - The fix.
 * @param rangeNm - The scope range in nautical miles.
 * @returns True if the fix should be on the map.
 */
export function isFixShown(fix: Fix, rangeNm: number): boolean {
  return (
    rangeNm <= VIDEO_MAP_LAYER_MAX_RANGE_NM.fixes &&
    fix.chartTypes.some((chartType) => ROUTE_CHART_TYPES.includes(chartType))
  );
}

/**
 * Decides whether a fix that is shown also gets its label at a range.
 *
 * @param rangeNm - The scope range in nautical miles.
 * @returns True if fix labels are drawn.
 */
export function areFixLabelsShown(rangeNm: number): boolean {
  return rangeNm <= VIDEO_MAP_LAYER_MAX_RANGE_NM.fixLabels;
}

/**
 * Decides whether an airspace boundary belongs on the map at a range, and as
 * what class. Class B and C are shown at every range, Class D and restricted
 * and prohibited areas as the range closes in. Class E, MOAs, warning and
 * alert areas, and ARTCC boundaries are never shown: they are large or
 * numerous enough to obscure the traffic.
 *
 * @param airspaceType - The airspace's type, as in the `AirspaceType` of `@squawk/types`.
 * @param rangeNm - The scope range in nautical miles.
 * @returns The class to draw the boundary as, or undefined if it should not be on the map.
 */
export function shownAirspaceClass(
  airspaceType: string,
  rangeNm: number,
): VideoMapAirspaceClass | undefined {
  const airspaceClass = AIRSPACE_CLASS_BY_TYPE[airspaceType];
  if (airspaceClass === 'classD' && rangeNm > VIDEO_MAP_LAYER_MAX_RANGE_NM.classD) {
    return undefined;
  }
  if (airspaceClass === 'specialUse' && rangeNm > VIDEO_MAP_LAYER_MAX_RANGE_NM.specialUse) {
    return undefined;
  }
  return airspaceClass;
}
