/**
 * Classification of a published instrument procedure.
 *
 * - `SID` - Standard Instrument Departure (DP)
 * - `STAR` - Standard Terminal Arrival Route
 */
export type ProcedureType = 'SID' | 'STAR';

/**
 * Maps the first character of a STARDP.txt record to its ProcedureType.
 */
export const PROCEDURE_TYPE_MAP: Record<string, ProcedureType> = {
  D: 'SID',
  S: 'STAR',
};

/**
 * High-level classification of a waypoint on a procedure route.
 *
 * - `FIX` - A named intersection, reporting point, or computer navigation fix
 * - `NAVAID` - A radio navigation facility (VOR, VORTAC, NDB, DME, TACAN, etc.)
 * - `AIRPORT` - An adapted airport associated with the procedure
 */
export type ProcedureWaypointCategory = 'FIX' | 'NAVAID' | 'AIRPORT';

/**
 * Raw waypoint type code from the FAA STARDP.txt file.
 *
 * - `P` - Published computer navigation fix
 * - `R` - Flyby computer navigation fix (recommended)
 * - `AA` - Adapted airport
 * - `NW` - Navaid (VOR/VORTAC)
 * - `ND` - Navaid (DME)
 * - `NA` - Navaid (NDB)
 * - `CN` - Computer navigation fix
 * - `NV` - Navaid (VOR)
 * - `NT` - Navaid (TACAN)
 * - `NX` - Navaid (other)
 * - `NO` - Navaid (other)
 */
export type ProcedureWaypointTypeCode =
  | 'P'
  | 'R'
  | 'AA'
  | 'NW'
  | 'ND'
  | 'NA'
  | 'CN'
  | 'NV'
  | 'NT'
  | 'NX'
  | 'NO';

/**
 * Maps a raw STARDP.txt waypoint type code to its high-level category.
 */
export const PROCEDURE_WAYPOINT_CATEGORY_MAP: Record<
  ProcedureWaypointTypeCode,
  ProcedureWaypointCategory
> = {
  P: 'FIX',
  R: 'FIX',
  CN: 'FIX',
  AA: 'AIRPORT',
  NW: 'NAVAID',
  ND: 'NAVAID',
  NA: 'NAVAID',
  NV: 'NAVAID',
  NT: 'NAVAID',
  NX: 'NAVAID',
  NO: 'NAVAID',
};

/**
 * A single waypoint along a procedure route. Waypoints are ordered
 * in the sequence they are flown.
 */
export interface ProcedureWaypoint {
  /** Fix or navaid identifier (e.g. "AALLE", "DEN", "BOS"). */
  fixIdentifier: string;
  /** High-level category of this waypoint (FIX, NAVAID, or AIRPORT). */
  category: ProcedureWaypointCategory;
  /** Raw FAA waypoint type code from STARDP.txt (e.g. "P", "R", "NW", "AA"). */
  typeCode: ProcedureWaypointTypeCode;
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
  /** ICAO region code (e.g. "K2", "K5", "PA"). */
  icaoRegionCode?: string;
}

/**
 * A named transition on a procedure. For STARs, transitions are enroute
 * entry paths that lead to the common route. For SIDs, transitions are
 * enroute exit paths that depart from the common route.
 */
export interface ProcedureTransition {
  /** Transition name, typically the name of the entry/exit fix (e.g. "BBOTL", "HOPPP"). */
  name: string;
  /** Ordered sequence of waypoints defining the transition path. */
  waypoints: ProcedureWaypoint[];
}

/**
 * A common route on a procedure. Common routes are the unnamed trunk
 * paths that connect transitions to adapted airports. A procedure may
 * have multiple common routes for different runway configurations.
 */
export interface ProcedureCommonRoute {
  /** Ordered sequence of waypoints defining the common route. */
  waypoints: ProcedureWaypoint[];
  /** FAA identifiers of adapted airports served by this specific route. */
  airports: string[];
}

/**
 * A published instrument procedure in the US National Airspace System.
 * Procedures are named, published paths - SIDs (Standard Instrument
 * Departures) and STARs (Standard Terminal Arrival Routes) - consisting
 * of a sequence of fixes with optional transitions for entry/exit.
 */
export interface Procedure {
  /** Human-readable procedure name (e.g. "AALLE FOUR", "ACCRA FIVE"). */
  name: string;
  /** FAA computer code for the procedure (e.g. "AALLE4", "ACCRA5"). */
  computerCode: string;
  /** Whether this is a SID or STAR. */
  type: ProcedureType;
  /** All adapted airports served by this procedure. */
  airports: string[];
  /** Common routes (trunk paths). A procedure may have multiple common routes for different runway or airport configurations. */
  commonRoutes: ProcedureCommonRoute[];
  /** Named transitions. For STARs these are enroute entry transitions; for SIDs these are enroute exit transitions. */
  transitions: ProcedureTransition[];
}
