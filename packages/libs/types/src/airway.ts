/**
 * Classification of an airway by its route structure and intended use.
 *
 * - `VICTOR` - VOR-based low-altitude airway (V1, V16, etc.)
 * - `JET` - Jet route for high-altitude IFR (J1, J60, etc.)
 * - `RNAV_Q` - RNAV Q-route (GPS-based, typically high altitude)
 * - `RNAV_T` - RNAV T-route (GPS-based, typically low altitude)
 * - `GREEN` - Green colored airway (Alaska)
 * - `RED` - Red colored airway (Alaska)
 * - `AMBER` - Amber colored airway
 * - `BLUE` - Blue colored airway
 * - `ATLANTIC` - Atlantic oceanic route
 * - `BAHAMA` - Bahama route
 * - `PACIFIC` - Pacific oceanic route
 * - `PUERTO_RICO` - Puerto Rico route
 * - `SPECIAL` - Special route: one of the FAA's non-regulatory `ZK` routes,
 *   low-level RNAV routes used mainly by helicopter air ambulance operators.
 *   They are not on public charts and may be filed only with FAA Flight
 *   Standards approval.
 */
export type AirwayType =
  | 'VICTOR'
  | 'JET'
  | 'RNAV_Q'
  | 'RNAV_T'
  | 'GREEN'
  | 'RED'
  | 'AMBER'
  | 'BLUE'
  | 'ATLANTIC'
  | 'BAHAMA'
  | 'PACIFIC'
  | 'PUERTO_RICO'
  | 'SPECIAL';

/**
 * The full set of {@link AirwayType} values, in declaration order.
 *
 * Use as the single source of truth for value-side iteration (e.g. building a
 * lookup table keyed by airway type) or with {@link isAirwayType} to narrow
 * an external string into the union. The `as const satisfies` brand keeps
 * this array in sync with the type at compile time.
 */
export const AIRWAY_TYPES = [
  'VICTOR',
  'JET',
  'RNAV_Q',
  'RNAV_T',
  'GREEN',
  'RED',
  'AMBER',
  'BLUE',
  'ATLANTIC',
  'BAHAMA',
  'PACIFIC',
  'PUERTO_RICO',
  'SPECIAL',
] as const satisfies readonly AirwayType[];

const AIRWAY_TYPE_SET: ReadonlySet<string> = new Set(AIRWAY_TYPES);

/**
 * Type guard that narrows a string to {@link AirwayType} when it matches a
 * member of {@link AIRWAY_TYPES}.
 *
 * Useful when consuming external strings (URL params, config files, MCP tool
 * inputs) that should be validated before being used as an airway type.
 *
 * @param value - The string to test.
 * @returns `true` if `value` is a valid `AirwayType`.
 */
export function isAirwayType(value: string): value is AirwayType {
  return AIRWAY_TYPE_SET.has(value);
}

/**
 * Maps the first character of an AWY.txt airway designation to its AirwayType.
 */
export const AWY_TYPE_MAP: Record<string, AirwayType> = {
  V: 'VICTOR',
  J: 'JET',
  Q: 'RNAV_Q',
  T: 'RNAV_T',
  G: 'GREEN',
  R: 'RED',
  A: 'AMBER',
  B: 'BLUE',
};

/**
 * Maps the 2-character ATS.txt airway designation prefix to its AirwayType.
 * The prefix is the file's route category; a bundled ATS designation is the
 * prefix followed by the route identifier (`ATA315` for Atlantic route A315,
 * `SPZK214` for special route ZK214).
 */
export const ATS_TYPE_MAP: Record<string, AirwayType> = {
  AT: 'ATLANTIC',
  BF: 'BAHAMA',
  PA: 'PACIFIC',
  PR: 'PUERTO_RICO',
  SP: 'SPECIAL',
};

/**
 * Regional classification of an airway.
 *
 * - `US` - US Federal airway (contiguous states)
 * - `ALASKA` - Alaska-specific airway
 * - `HAWAII` - Hawaii-specific airway
 */
export type AirwayRegion = 'US' | 'ALASKA' | 'HAWAII';

/**
 * Maps the FAA airway type field character to its AirwayRegion.
 */
export const AIRWAY_REGION_MAP: Record<string, AirwayRegion> = {
  A: 'ALASKA',
  H: 'HAWAII',
};

/**
 * Direction of travel an airway altitude applies to, in the FAA's `BND`
 * (bound) notation: `E BND` is an altitude for eastbound traffic. An altitude
 * without a direction applies in both directions.
 */
export type AirwayDirection =
  'N BND' | 'NE BND' | 'E BND' | 'SE BND' | 'S BND' | 'SW BND' | 'W BND' | 'NW BND';

/**
 * The full set of {@link AirwayDirection} values, clockwise from north.
 */
export const AIRWAY_DIRECTIONS = [
  'N BND',
  'NE BND',
  'E BND',
  'SE BND',
  'S BND',
  'SW BND',
  'W BND',
  'NW BND',
] as const satisfies readonly AirwayDirection[];

const AIRWAY_DIRECTION_SET: ReadonlySet<string> = new Set(AIRWAY_DIRECTIONS);

/**
 * Type guard that narrows a string to {@link AirwayDirection} when it matches
 * a member of {@link AIRWAY_DIRECTIONS}.
 *
 * @param value - The string to test.
 * @returns `true` if `value` is a valid `AirwayDirection`.
 */
export function isAirwayDirection(value: string): value is AirwayDirection {
  return AIRWAY_DIRECTION_SET.has(value);
}

/**
 * Type of navigational reference at an airway waypoint.
 *
 * - `NAVAID` - A radio navigation facility (VOR, VORTAC, NDB, etc.)
 * - `FIX` - A named intersection or reporting point
 * - `WAYPOINT` - A named waypoint (typically RNAV)
 * - `OTHER` - Other point type (unnamed, turning point, etc.)
 *
 * NASR publishes US border crossings as airway points without coordinates;
 * the bundled data omits them.
 */
export type AirwayWaypointType = 'NAVAID' | 'FIX' | 'WAYPOINT' | 'OTHER';

/**
 * A single waypoint along an airway route. Waypoints are ordered
 * west-to-east / south-to-north per FAA convention.
 *
 * Segment fields (MEA, MOCA, MAA, distance, course, gap and unusable flags)
 * describe the segment from this waypoint to the next one in the airway's
 * published order. A slice of the airway taken in the opposite direction
 * still carries them that way, so there each waypoint's segment fields
 * describe the segment between it and the waypoint before it in the slice.
 * Directional values (`NE`, `SW` and so on) are compass directions and
 * read the same either way. Point fields (MRA, MCA, magnetic variation)
 * describe the waypoint itself.
 */
export interface AirwayWaypoint {
  /** Waypoint name (navaid name, fix identifier, or descriptive name). */
  name: string;
  /** Waypoint identifier (short code, e.g. "BOS", "MERIT"). May be absent for unnamed points. */
  identifier?: string;
  /** Type of navigational reference at this point. */
  waypointType: AirwayWaypointType;
  /** Navaid facility type when waypointType is NAVAID (e.g. "VORTAC", "VOR/DME"). */
  navaidFacilityType?: string;
  /**
   * Two-letter state or country code of the point (e.g. "NY", "CA", "MX"), or
   * one of NASR's pseudo-codes: `OA`, `OP` and `OG` for oceanic points in the
   * Atlantic, the Pacific and the Gulf of Mexico, and `59` for Canada.
   */
  state?: string;
  /**
   * ICAO region code for fixes (e.g. "K6", "K7"). The single letters `K` and
   * `P` are the FAA's convention for offshore fixes.
   */
  icaoRegionCode?: string;
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
  /** ARTCC identifier for this waypoint (e.g. "ZNY", "ZBW"). */
  artccId?: string;
  /** Minimum reception altitude in feet at this point, if published. */
  minimumReceptionAltitudeFt?: number;
  /** Magnetic variation at a navaid waypoint in whole degrees, with `magneticVariationDirection`. */
  magneticVariationDeg?: number;
  /** Direction of the magnetic variation, `E` or `W`. */
  magneticVariationDirection?: 'E' | 'W';
  /** Segment MEA (Minimum Enroute Altitude) in feet for the segment starting at this waypoint. */
  minimumEnrouteAltitudeFt?: number;
  /** Direction the MEA applies to; absent when it applies in both directions. */
  minimumEnrouteAltitudeDirection?: AirwayDirection;
  /** MEA in the opposite direction in feet, if different from the primary MEA. */
  minimumEnrouteAltitudeOppositeFt?: number;
  /** Direction the opposite MEA applies to. */
  minimumEnrouteAltitudeOppositeDirection?: AirwayDirection;
  /** Maximum authorized altitude (MAA) in feet for this segment. */
  maximumAuthorizedAltitudeFt?: number;
  /** Minimum obstruction clearance altitude (MOCA) in feet for this segment. */
  minimumObstructionClearanceAltitudeFt?: number;
  /** GNSS MEA in feet for this segment, if published. */
  gnssMinimumEnrouteAltitudeFt?: number;
  /** Direction the GNSS MEA applies to; absent when it applies in both directions. */
  gnssMinimumEnrouteAltitudeDirection?: AirwayDirection;
  /** GNSS MEA in the opposite direction in feet. */
  gnssMinimumEnrouteAltitudeOppositeFt?: number;
  /** Direction the opposite GNSS MEA applies to. */
  gnssMinimumEnrouteAltitudeOppositeDirection?: AirwayDirection;
  /** DME/DME/IRU MEA in feet for this segment, if published (mostly on Q routes). */
  dmeDmeIruMinimumEnrouteAltitudeFt?: number;
  /** Direction the DME/DME/IRU MEA applies to; absent when it applies in both directions. */
  dmeDmeIruMinimumEnrouteAltitudeDirection?: AirwayDirection;
  /** DME/DME/IRU MEA in the opposite direction in feet. */
  dmeDmeIruMinimumEnrouteAltitudeOppositeFt?: number;
  /** Direction the opposite DME/DME/IRU MEA applies to. */
  dmeDmeIruMinimumEnrouteAltitudeOppositeDirection?: AirwayDirection;
  /**
   * Minimum crossing altitude (MCA) in feet at this waypoint for traffic in
   * `minimumCrossingAltitudeDirection`. NASR publishes an MCA on the first
   * segment record of the Part 95 segment it belongs to and names the point
   * it applies at; the bundled data attaches it to that named waypoint.
   */
  minimumCrossingAltitudeFt?: number;
  /** Direction of travel the MCA applies to. */
  minimumCrossingAltitudeDirection?: AirwayDirection;
  /** Minimum crossing altitude in feet at this waypoint for traffic in the opposite direction. */
  minimumCrossingAltitudeOppositeFt?: number;
  /** Direction of travel the opposite MCA applies to. */
  minimumCrossingAltitudeOppositeDirection?: AirwayDirection;
  /** Distance in nautical miles from this waypoint to the next waypoint along the airway. */
  distanceToNextNm?: number;
  /** Magnetic course in degrees from this waypoint to the next. */
  magneticCourseDeg?: number;
  /** Magnetic course in degrees in the opposite direction. */
  magneticCourseOppositeDeg?: number;
  /** Distance in nautical miles from this waypoint to the changeover point. */
  changeoverDistanceNm?: number;
  /** Required navigation performance in nautical miles for this segment, where the FAA publishes one. */
  rnpNm?: number;
  /** Whether there is a gap in navigation signal coverage on this segment. */
  signalGap?: boolean;
  /** Whether altitude data applies only to US airspace on this segment. */
  usAirspaceOnly?: boolean;
  /** Whether this is a dogleg point (a turn point not at a navaid). */
  dogleg?: boolean;
  /** Whether the airway is discontinued at this point (gap flag). */
  discontinued?: boolean;
  /**
   * Whether the segment from this waypoint to the next is unusable: the FAA
   * marks it in the MEA GAP column or with an `UNUSABLE` point remark. The
   * segment is still published with its distance, and without an MEA, but it
   * may not be flown.
   */
  unusable?: boolean;
  /** FAA remarks about this point, one per published line (e.g. `WINK R-311 UNUSABLE, USE CHISUM R-129`). */
  remarks?: string[];
}

/**
 * A named airway in the US National Airspace System. An airway is a published
 * route defined as an ordered sequence of waypoints (navaids, fixes, and other
 * reference points) with associated altitude restrictions and navigation data.
 *
 * Waypoints are ordered west-to-east / south-to-north per FAA convention.
 */
export interface Airway {
  /** Airway designation (e.g. "V16", "J60", "Q1", "T238", "ATA315"). */
  designation: string;
  /** Classification of the airway by route structure. */
  type: AirwayType;
  /** Regional classification of the airway. */
  region: AirwayRegion;
  /** Ordered sequence of waypoints defining the airway route. */
  waypoints: AirwayWaypoint[];
  /** FAA remarks about the whole route, one per published line (e.g. `HF COMM REQUIRED`). */
  remarks?: string[];
}

/**
 * A reference to the segment between two consecutive waypoints of an airway
 * expansion: the position of the first waypoint and the identifiers of both.
 */
export interface AirwaySegmentReference {
  /** Index into the expansion's waypoints of the waypoint that starts the segment; the segment runs from it to the next waypoint. */
  index: number;
  /** Identifier, or name when the waypoint has no identifier, of the waypoint that starts the segment. */
  from: string;
  /** Identifier, or name when the waypoint has no identifier, of the waypoint that ends the segment. */
  to: string;
}

/**
 * A published discontinuity between two consecutive waypoints of an airway
 * expansion. The FAA flags the waypoint after which an airway is discontinued
 * (`AirwayWaypoint.discontinued`), so the airway does not exist between that
 * waypoint and the next one: a route that files the airway across the gap is
 * not valid as filed, and a line between the two waypoints is not an airway
 * segment.
 */
export type AirwayGap = AirwaySegmentReference;
