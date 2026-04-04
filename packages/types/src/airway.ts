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
  | 'PUERTO_RICO';

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
 */
export const ATS_TYPE_MAP: Record<string, AirwayType> = {
  AT: 'ATLANTIC',
  BF: 'BAHAMA',
  PA: 'PACIFIC',
  PR: 'PUERTO_RICO',
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
 * Type of navigational reference at an airway waypoint.
 *
 * - `NAVAID` - A radio navigation facility (VOR, VORTAC, NDB, etc.)
 * - `FIX` - A named intersection or reporting point
 * - `WAYPOINT` - A named waypoint (typically RNAV)
 * - `BORDER` - A US border crossing point
 * - `OTHER` - Other point type (unnamed, turning point, etc.)
 */
export type AirwayWaypointType = 'NAVAID' | 'FIX' | 'WAYPOINT' | 'BORDER' | 'OTHER';

/**
 * A single waypoint along an airway route. Waypoints are ordered
 * west-to-east / south-to-north per FAA convention.
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
  /** Two-letter state code (e.g. "NY", "CA"). */
  state?: string;
  /** ICAO region code for fixes (e.g. "K6", "K7"). */
  icaoRegionCode?: string;
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
  /** ARTCC identifier for this waypoint (e.g. "ZNY", "ZBW"). */
  artccId?: string;
  /** Minimum reception altitude in feet at this point, if published. */
  minimumReceptionAltitude?: number;
  /** Segment MEA (Minimum Enroute Altitude) in feet for the segment starting at this waypoint. */
  mea?: number;
  /** Direction qualifier for the MEA (e.g. "E BND", "W BND"). */
  meaDirection?: string;
  /** MEA in the opposite direction in feet, if different from the primary MEA. */
  meaOpposite?: number;
  /** Direction qualifier for the opposite MEA. */
  meaOppositeDirection?: string;
  /** Maximum authorized altitude (MAA) in feet for this segment. */
  maa?: number;
  /** Minimum obstruction clearance altitude (MOCA) in feet for this segment. */
  moca?: number;
  /** GNSS MEA in feet for this segment, if published. */
  gnssMea?: number;
  /** Direction qualifier for the GNSS MEA. */
  gnssMeaDirection?: string;
  /** GNSS MEA in the opposite direction in feet. */
  gnssMeaOpposite?: number;
  /** Direction qualifier for the opposite GNSS MEA. */
  gnssMeaOppositeDirection?: string;
  /** Minimum crossing altitude (MCA) in feet at this point. */
  mca?: number;
  /** Direction of the minimum crossing altitude. */
  mcaDirection?: string;
  /** Minimum crossing altitude in the opposite direction. */
  mcaOpposite?: number;
  /** Direction for the opposite minimum crossing altitude. */
  mcaOppositeDirection?: string;
  /** Distance in nautical miles from this waypoint to the next waypoint along the airway. */
  distanceToNextNm?: number;
  /** Magnetic course in degrees from this waypoint to the next. */
  magneticCourse?: number;
  /** Magnetic course in degrees in the opposite direction. */
  magneticCourseOpposite?: number;
  /** Distance in nautical miles from this waypoint to the changeover point. */
  changeoverDistance?: number;
  /** Whether there is a gap in navigation signal coverage on this segment. */
  signalGap?: boolean;
  /** Whether altitude data applies only to US airspace on this segment. */
  usAirspaceOnly?: boolean;
  /** Whether this is a dogleg point (a turn point not at a navaid). */
  dogleg?: boolean;
  /** Whether the airway is discontinued at this point (gap flag). */
  discontinued?: boolean;
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
}
