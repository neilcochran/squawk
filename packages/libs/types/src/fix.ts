/**
 * Usage category of a fix as classified by the FAA.
 *
 * - `WP` - Waypoint
 * - `RP` - Reporting Point
 * - `MW` - Military Waypoint
 * - `MR` - Military Reporting Point
 * - `CN` - Computer Navigation Fix (internal FAA automation point)
 * - `VFR` - VFR Waypoint
 * - `NRS` - NRS Waypoint
 * - `RADAR` - Radar fix
 */
export type FixUseCode = 'WP' | 'RP' | 'MW' | 'MR' | 'CN' | 'VFR' | 'NRS' | 'RADAR';

/**
 * The full set of {@link FixUseCode} values, in declaration order.
 *
 * Use as the single source of truth for value-side iteration (e.g. building a
 * lookup table keyed by use code) or with {@link isFixUseCode} to narrow an
 * external string into the union. The `as const satisfies` brand keeps this
 * array in sync with the type at compile time.
 */
export const FIX_USE_CODES = [
  'WP',
  'RP',
  'MW',
  'MR',
  'CN',
  'VFR',
  'NRS',
  'RADAR',
] as const satisfies readonly FixUseCode[];

const FIX_USE_CODE_SET: ReadonlySet<string> = new Set(FIX_USE_CODES);

/**
 * Type guard that narrows a string to {@link FixUseCode} when it matches a
 * member of {@link FIX_USE_CODES}.
 *
 * Useful when consuming external strings (URL params, config files, MCP tool
 * inputs) that should be validated before being used as a fix use code.
 *
 * @param value - The string to test.
 * @returns `true` if `value` is a valid `FixUseCode`.
 */
export function isFixUseCode(value: string): value is FixUseCode {
  return FIX_USE_CODE_SET.has(value);
}

/**
 * Maps FAA FIX_USE_CODE values from NASR data to FixUseCode.
 * FAA values may have trailing whitespace so trimmed values are mapped here.
 */
export const FIX_USE_CODE_MAP: Record<string, FixUseCode> = {
  WP: 'WP',
  RP: 'RP',
  MW: 'MW',
  MR: 'MR',
  CN: 'CN',
  VFR: 'VFR',
  NRS: 'NRS',
  RADAR: 'RADAR',
};

/**
 * Compulsory reporting designation for a fix.
 *
 * - `HIGH` - Compulsory at high altitude
 * - `LOW` - Compulsory at low altitude
 * - `LOW/HIGH` - Compulsory at both low and high altitude
 */
export type FixCompulsory = 'HIGH' | 'LOW' | 'LOW/HIGH';

/**
 * Maps FAA COMPULSORY values from NASR data to FixCompulsory.
 */
export const FIX_COMPULSORY_MAP: Record<string, FixCompulsory> = {
  HIGH: 'HIGH',
  LOW: 'LOW',
  'LOW/HIGH': 'LOW/HIGH',
};

/**
 * A navigational aid association for a fix: a facility that defines the fix,
 * with the bearing and distance from the facility to the fix where they are
 * published. Many fixes are defined by a bearing alone (a localizer course or
 * a VOR radial without DME) or a distance alone (a DME arc), and a fix at a
 * marker beacon or on a localizer may carry neither.
 */
export interface FixNavaidAssociation {
  /**
   * Identifier of the facility (e.g. "PDK", "BOS"). For a localizer this is
   * the ILS identifier without its "I-" prefix.
   */
  navaidId: string;
  /**
   * Facility type (e.g. "VOR", "VORTAC", "VOR/DME", "TACAN", "DME", "NDB",
   * "NDB/DME", "LOC", "OM", "MM").
   */
  navaidType: string;
  /**
   * Magnetic bearing in degrees from the facility to the fix: the radial of
   * a VOR or TACAN, the bearing from an NDB, or the course from a localizer
   * antenna. North is published as both 0 and 360. Absent when the fix is
   * defined by distance alone or the bearing is not published.
   */
  magneticBearingDeg?: number;
  /**
   * Distance in nautical miles from the facility to the fix. For a localizer
   * it is measured from the localizer antenna or, where the ILS has a DME
   * sited elsewhere, from that DME. Absent when the fix is defined by bearing
   * alone or the distance is not published.
   */
  distanceNm?: number;
}

/**
 * A named fix or waypoint published by the FAA. Includes US fixes and
 * selected foreign fixes (Canadian, Mexican, Caribbean, Pacific) that
 * participate in US operations.
 * Fixes are specific geographic positions used in flight planning, instrument
 * procedures, and ATC operations. They are defined by geographic coordinates
 * and may be associated with one or more navaids via radial/distance intersections.
 */
export interface Fix {
  /** Fix identifier (e.g. "MERIT", "BOSCO", "AAALL"). */
  identifier: string;
  /** ICAO region code (e.g. "K6", "K7", "K1"). */
  icaoRegionCode: string;
  /** Two-letter state code (e.g. "MA", "NY", "CA"). Absent for non-US fixes. */
  state?: string;
  /** Two-letter country code (e.g. "US"). */
  country: string;
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
  /** Usage category of the fix. */
  useCode: FixUseCode;
  /** High-altitude ARTCC identifier (e.g. "ZNY", "ZBW"). */
  highArtccId?: string;
  /** Low-altitude ARTCC identifier (e.g. "ZNY", "ZBW"). */
  lowArtccId?: string;
  /** Whether this fix has a pitch designation. */
  pitch: boolean;
  /** Whether this fix has a catch designation. */
  catch: boolean;
  /** Whether this fix is associated with Special Use Airspace or an ATCAA. */
  suaAtcaa: boolean;
  /** Minimum reception altitude in feet, if published. */
  minimumReceptionAltitudeFt?: number;
  /** Compulsory reporting designation, if applicable. */
  compulsory?: FixCompulsory;
  /** Previous fix identifier, if the fix was renamed. */
  previousIdentifier?: string;
  /** Charting remark text, if any. */
  chartingRemark?: string;
  /** Chart types on which this fix appears (e.g. "IAP", "STAR", "ENROUTE LOW"). */
  chartTypes: string[];
  /** Navaid associations defining the fix by radial/distance from nearby navaids. */
  navaidAssociations: FixNavaidAssociation[];
}
