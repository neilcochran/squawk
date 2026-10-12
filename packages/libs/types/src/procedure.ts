/**
 * Classification of a published instrument procedure.
 *
 * - `SID` - Standard Instrument Departure.
 * - `STAR` - Standard Terminal Arrival Route.
 * - `IAP` - Instrument Approach Procedure.
 *
 * Obstacle Departure Procedures (ODPs) are encoded by FAA CIFP as SIDs
 * (PD records) without any distinguishing field, so graphic ODPs appear
 * in this model labelled as `SID`. Textual ODPs are not carried by CIFP
 * at all. See the `@squawk/procedure-data` README for the full caveat.
 */
export type ProcedureType = 'SID' | 'STAR' | 'IAP';

/**
 * Approach classification for Instrument Approach Procedures, derived
 * from the CIFP approach identifier prefix and the ARINC 424 route
 * type code of the final-approach record.
 *
 * - `ILS` - Instrument Landing System.
 * - `LOC` - Localizer-only approach.
 * - `LOC_BC` - Localizer backcourse approach.
 * - `RNAV` - Area Navigation (GPS/GNSS-based).
 * - `RNAV_RNP` - Area Navigation with Required Navigation Performance.
 * - `VOR` - VHF Omnidirectional Range approach.
 * - `VOR_DME` - VOR approach paired with DME.
 * - `NDB` - Non-Directional Beacon approach.
 * - `NDB_DME` - NDB approach paired with DME.
 * - `TACAN` - Tactical Air Navigation approach.
 * - `GLS` - GNSS Landing System approach.
 * - `IGS` - Instrument Guidance System approach.
 * - `LDA` - Localizer-type Directional Aid approach.
 * - `SDF` - Simplified Directional Facility approach.
 * - `GPS` - Legacy GPS overlay approach.
 * - `FMS` - Flight Management System approach.
 * - `MLS` - Microwave Landing System approach.
 */
export type ApproachType =
  | 'ILS'
  | 'LOC'
  | 'LOC_BC'
  | 'RNAV'
  | 'RNAV_RNP'
  | 'VOR'
  | 'VOR_DME'
  | 'NDB'
  | 'NDB_DME'
  | 'TACAN'
  | 'GLS'
  | 'IGS'
  | 'LDA'
  | 'SDF'
  | 'GPS'
  | 'FMS'
  | 'MLS';

/**
 * ARINC 424 path terminator code describing how a procedure leg
 * transitions from the previous leg's termination to this leg's
 * termination.
 *
 * - `IF` - Initial Fix. Defines a starting fix without a preceding leg.
 * - `TF` - Track to a Fix. Great-circle track to the termination fix.
 * - `CF` - Course to a Fix. Specified magnetic course to the termination fix.
 * - `DF` - Direct to a Fix. Direct routing from present position to the termination fix.
 * - `FA` - Fix to an Altitude. From a fix on a heading until reaching an altitude.
 * - `FC` - Track from a Fix for a Distance.
 * - `FD` - Track from a Fix to a DME Distance.
 * - `FM` - From a Fix on a heading until manually terminated.
 * - `CA` - Course to an Altitude.
 * - `CD` - Course to a DME Distance.
 * - `CI` - Course to an Intercept of the next leg.
 * - `CR` - Course to a Radial termination (crossing a navaid radial).
 * - `RF` - Constant Radius Arc. Arc with a specified center and radius.
 * - `AF` - Arc to a Fix. DME arc around a navaid to a termination fix.
 * - `VA` - Heading to an Altitude termination.
 * - `VD` - Heading to a DME Distance termination.
 * - `VI` - Heading to an Intercept of the next leg.
 * - `VM` - Heading until manually terminated.
 * - `VR` - Heading to a Radial termination.
 * - `PI` - 045/180 Procedure Turn reversal.
 * - `HA` - Holding pattern terminating at an altitude.
 * - `HF` - Holding pattern, single circuit terminating at the fix.
 * - `HM` - Holding pattern terminating manually.
 */
export type ProcedureLegPathTerminator =
  | 'IF'
  | 'TF'
  | 'CF'
  | 'DF'
  | 'FA'
  | 'FC'
  | 'FD'
  | 'FM'
  | 'CA'
  | 'CD'
  | 'CI'
  | 'CR'
  | 'RF'
  | 'AF'
  | 'VA'
  | 'VD'
  | 'VI'
  | 'VM'
  | 'VR'
  | 'PI'
  | 'HA'
  | 'HF'
  | 'HM';

/**
 * CIFP altitude constraint descriptor (ARINC 424 field 5.29).
 *
 * - `@` - Cross exactly at the altitude.
 * - `+` - Cross at or above the altitude.
 * - `-` - Cross at or below the altitude.
 * - `B` - Cross between `primaryFt` and `secondaryFt` (`primaryFt` is the higher altitude).
 * - `C` - Conditional at-or-above (applies above the transition altitude).
 * - `G` - Glide-slope altitude at the fix.
 * - `H` - At `primaryFt`, with `secondaryFt` describing an associated glide-slope altitude.
 * - `I` - Glide-slope intercept altitude at the fix.
 * - `J` - Glide-slope intercept at `secondaryFt`, cross at or above `primaryFt`.
 * - `V` - Minimum altitude step-down published with a vertical angle.
 * - `X` - At altitude with step-down constraints applied.
 * - `Y` - At or above altitude with step-down constraints applied.
 */
export type AltitudeConstraintDescriptor =
  '@' | '+' | '-' | 'B' | 'C' | 'G' | 'H' | 'I' | 'J' | 'V' | 'X' | 'Y';

/**
 * Altitude constraint applied at the termination of a procedure leg.
 */
export interface AltitudeConstraint {
  /** Descriptor specifying how the constraint is evaluated. */
  descriptor: AltitudeConstraintDescriptor;
  /** Primary altitude in feet MSL. */
  primaryFt: number;
  /** Secondary altitude in feet MSL, when the descriptor uses two altitudes. */
  secondaryFt?: number;
}

/**
 * Speed constraint descriptor (ARINC 424 field 5.261).
 *
 * - `@` - Mandatory speed: cross the fix at the speed. ARINC 424 codes this as either `@` or a blank descriptor; the blank form is normalized to `@`. This is how most STAR speed restrictions are published.
 * - `+` - Minimum speed: cross at or above the speed.
 * - `-` - Maximum speed: cross at or below the speed.
 */
export type SpeedConstraintDescriptor = '@' | '+' | '-';

/**
 * Speed constraint applied at the termination of a procedure leg.
 */
export interface SpeedConstraint {
  /** Descriptor specifying how the constraint is evaluated. */
  descriptor: SpeedConstraintDescriptor;
  /** Indicated airspeed limit in knots. */
  speedKt: number;
}

/**
 * Turn direction for a procedure leg (ARINC 424 field 5.20). Populated
 * only when the turn is explicitly commanded by the procedure.
 *
 * - `L` - Left turn.
 * - `R` - Right turn.
 * - `E` - Either direction.
 */
export type TurnDirection = 'L' | 'R' | 'E';

/**
 * ARINC 424 GNSS/FMS indication (field 5.222): whether a procedure may be
 * flown with GNSS or FMS equipment and, for RNAV procedures, whether SBAS
 * (WAAS) based vertical guidance is authorized.
 *
 * - `0` - Procedure not authorized for a GNSS or FMS overlay.
 * - `1` - Procedure authorized for a GNSS overlay; the primary navaids are operating and monitored.
 * - `2` - Procedure authorized for a GNSS overlay; the primary navaids are installed but not monitored.
 * - `3` - Procedure authorized for a GNSS overlay; the procedure title includes GPS or GNSS.
 * - `4` - Procedure authorized for an FMS overlay.
 * - `5` - Procedure authorized for both an FMS and a GNSS overlay.
 * - `A` - RNAV (GPS), RNAV (RNP) or RNAV (GNSS) procedure; SBAS use and SBAS-based vertical navigation authorized.
 * - `B` - RNAV (GPS), RNAV (RNP) or RNAV (GNSS) procedure; SBAS-based vertical navigation not authorized.
 * - `C` - RNAV (GPS), RNAV (RNP) or RNAV (GNSS) procedure; SBAS-based vertical navigation use not published.
 * - `G` - PBN RNP approach provided as a GPS approach (ARINC 424-20 and later).
 * - `L` - Localizer-only portion of an ILS approach (ARINC 424-20 and later).
 * - `P` - Stand-alone GPS (GNSS) procedure.
 * - `U` - Overlay authorization not published.
 */
export type GnssFmsIndication =
  '0' | '1' | '2' | '3' | '4' | '5' | 'A' | 'B' | 'C' | 'G' | 'L' | 'P' | 'U';

/**
 * ARINC 424 route type qualifier 1 for approach procedures (field 5.7,
 * column 119): the navigation sensor the route requires. FAA CIFP codes
 * it to the ARINC 424-19 table.
 *
 * - `A` - Advanced RNP (RNAV (RNP) procedure not requiring authorization).
 * - `B` - RNAV visual procedure.
 * - `D` - DME required for the procedure.
 * - `F` - RNP AR (authorization required); the FAA's RNAV (RNP) approaches.
 * - `J` - GNSS required; DME/DME to the RNP value not authorized.
 * - `L` - GBAS procedure.
 * - `N` - DME not required for the procedure.
 * - `P` - GNSS required.
 * - `R` - GNSS or DME/DME to the RNP value required.
 * - `T` - DME/DME required for the procedure.
 * - `U` - RNAV, sensor not specified.
 * - `V` - VOR/DME RNAV.
 * - `W` - RNAV procedure that requires a FAS data block.
 */
export type ApproachRouteQualifier1 =
  'A' | 'B' | 'D' | 'F' | 'J' | 'L' | 'N' | 'P' | 'R' | 'T' | 'U' | 'V' | 'W';

/**
 * ARINC 424 route type qualifier 2 for approach procedures (field 5.7,
 * column 120): the minimums the route provides, or the missed approach
 * it belongs to.
 *
 * - `S` - Procedure with straight-in minimums.
 * - `C` - Procedure with circle-to-land minimums.
 * - `H` - Helicopter procedure with straight-in minimums.
 * - `I` - Helicopter procedure with circle-to-land minimums.
 * - `L` - Helicopter procedure with helicopter landing minimums.
 * - `V` - Procedure with VMC minimums.
 * - `A` - Primary missed approach.
 * - `B` - Secondary missed approach.
 * - `E` - Engine-out missed approach.
 */
export type ApproachRouteQualifier2 = 'A' | 'B' | 'C' | 'E' | 'H' | 'I' | 'L' | 'S' | 'V';

/**
 * Category of the fix (or terminator) associated with a procedure leg.
 *
 * - `FIX` - A named intersection, reporting point, or terminal waypoint.
 * - `NAVAID` - A radio navigation facility (VOR, VORTAC, NDB, DME, TACAN, etc.).
 * - `AIRPORT` - An adapted airport.
 * - `RUNWAY` - A runway threshold or runway fix (identifiers prefixed with `RW`).
 */
export type ProcedureLegFixCategory = 'FIX' | 'NAVAID' | 'AIRPORT' | 'RUNWAY';

/**
 * A single leg of an instrument procedure, modelled on the ARINC 424
 * primary-record leg fields. A leg describes how an aircraft transitions
 * from the previous leg's termination to this leg's termination.
 *
 * Some path terminators (for example `VA`, `CA`, `VM`, `FM`) terminate
 * at an altitude, intercept, or manual event rather than at a fix. On
 * those legs the fix-related fields (`fixIdentifier`, `category`, `lat`,
 * `lon`, `icaoRegionCode`) are absent.
 */
export interface ProcedureLeg {
  /** ARINC 424 path terminator code. */
  pathTerminator: ProcedureLegPathTerminator;
  /** Fix identifier at the leg termination, when the leg terminates at a fix. */
  fixIdentifier?: string;
  /** Category of the termination fix. */
  category?: ProcedureLegFixCategory;
  /** Latitude of the termination fix in decimal degrees, positive north. */
  lat?: number;
  /** Longitude of the termination fix in decimal degrees, positive east. */
  lon?: number;
  /** ICAO region code of the termination fix. */
  icaoRegionCode?: string;
  /** Altitude constraint at leg termination. */
  altitudeConstraint?: AltitudeConstraint;
  /** Speed constraint at leg termination. */
  speedConstraint?: SpeedConstraint;
  /** Outbound or intercept course in degrees. */
  courseDeg?: number;
  /** `true` when the published course is a true bearing rather than magnetic. */
  courseIsTrue?: boolean;
  /** Leg distance in nautical miles, when the terminator specifies a distance. */
  distanceNm?: number;
  /** Holding pattern leg time in minutes, when the terminator specifies a hold time. */
  holdTimeMin?: number;
  /** Identifier of the recommended navaid providing the course, radial, or arc for this leg. */
  recommendedNavaid?: string;
  /** ICAO region code of the recommended navaid. */
  recommendedNavaidIcaoRegionCode?: string;
  /** Theta (bearing from the recommended navaid to the fix) in degrees. */
  thetaDeg?: number;
  /** Rho (distance from the recommended navaid to the fix) in nautical miles. Absent when the source field is saturated at its 999.9 maximum, which marks a distance the field cannot hold rather than a real value. */
  rhoNm?: number;
  /** Required Navigation Performance value in nautical miles. */
  rnpNm?: number;
  /** Commanded turn direction. */
  turnDirection?: TurnDirection;
  /** `true` when the procedure flags the commanded turn direction as mandatory (ARINC 424 field 5.22, Turn Direction Valid): the aircraft must turn in `turnDirection` before joining the leg's path rather than taking the shorter way round. */
  turnDirectionValid?: boolean;
  /** Vertical navigation path angle in degrees for the leg (ARINC 424 field 5.70), negative for a descent: `-3` is a 3.00 deg final approach path. The FAA publishes `0` where no vertical path is prescribed (circling and dive-and-drive approaches, or straight-in approaches with obstacles in the visual area). Present on final approach legs. */
  verticalAngleDeg?: number;
  /** Arc radius in nautical miles for `RF` (constant radius arc) legs. */
  arcRadiusNm?: number;
  /** Identifier of the center fix for `RF` legs. */
  centerFix?: string;
  /** ICAO region code of the center fix for `RF` legs. */
  centerFixIcaoRegionCode?: string;
  /** `true` when this leg's fix is an Initial Approach Fix (IAF). */
  isInitialApproachFix?: boolean;
  /** `true` when this leg's fix is the Intermediate Fix (IF). */
  isIntermediateFix?: boolean;
  /** `true` when this leg's fix is the Final Approach Fix (FAF). */
  isFinalApproachFix?: boolean;
  /** `true` when this leg's fix is the Final Approach Course Fix (FACF). */
  isFinalApproachCourseFix?: boolean;
  /** `true` when this leg's fix is the Missed Approach Point (MAP). */
  isMissedApproachPoint?: boolean;
  /** `true` when the fix must be overflown before any turn begins. */
  isFlyover?: boolean;
  /** GNSS/FMS indication published on approach legs: `0` on conventional approaches not authorized for an overlay, `3` on GPS overlays, `A` and `B` on RNAV approaches with and without SBAS vertical guidance, `P` on stand-alone GPS approaches. */
  gnssFmsIndication?: GnssFmsIndication;
  /** Route type qualifier 1 (the required navigation sensor) published on approach legs: `J` and `P` on RNAV (GPS) approaches, `F` on RNAV (RNP) approaches, `D` and `N` on conventional approaches with and without a DME requirement. */
  routeTypeQualifier1?: ApproachRouteQualifier1;
  /** Route type qualifier 2 (the minimums) published on approach legs: `S` straight-in, `C` circling, `H` helicopter. */
  routeTypeQualifier2?: ApproachRouteQualifier2;
}

/**
 * A named transition on a procedure.
 *
 * - For STARs, a transition is an enroute entry path that leads into the common route.
 * - For SIDs, a transition is a runway or enroute exit path joined to the common route.
 * - For IAPs, a transition is an approach transition from an IAF or holding fix to the final approach segment.
 */
export interface ProcedureTransition {
  /** Transition identifier, typically the entry/exit fix name. */
  name: string;
  /** Ordered legs along the transition path. */
  legs: ProcedureLeg[];
}

/**
 * Common (trunk) route of a procedure.
 *
 * - For SIDs/STARs, the common route is the unnamed trunk connecting transitions to the adapted airport(s). A procedure may have multiple common routes for different runway configurations.
 * - For IAPs, the common route describes the final approach segment from the Intermediate Fix through the Missed Approach Point.
 */
export interface ProcedureCommonRoute {
  /** Ordered legs along the common route. */
  legs: ProcedureLeg[];
  /** FAA identifiers of adapted airports served by this route. */
  airports: string[];
  /** Runway designator (e.g. `04L`) when CIFP publishes the route for one runway; a trailing `B` (e.g. `28B`) means both parallel runways. Absent when the route applies to every runway. */
  runway?: string;
}

/**
 * Missed approach segment for an Instrument Approach Procedure, flown
 * when the pilot cannot land at or before the Missed Approach Point.
 */
export interface MissedApproachSequence {
  /** Ordered legs of the missed approach climb-out. */
  legs: ProcedureLeg[];
}

/**
 * A published instrument procedure sourced from FAA CIFP (Coded
 * Instrument Flight Procedures). Covers SIDs, STARs, and Instrument
 * Approach Procedures in a single shape. Fields specific to approaches
 * (`approachType`, `runway`, `missedApproach`) are populated only when
 * `type` is `IAP`.
 */
export interface Procedure {
  /** Human-readable procedure name. For SIDs and STARs this equals the CIFP identifier (e.g. `AALLE4`) since CIFP does not carry the spelled-out name. For IAPs this is a composed label derived from the approach type, the multiple-approach indicator when the airport publishes several approaches of the same type to the runway, and the runway, course, or circling letter (e.g. `ILS RWY 04L`, `RNAV Y RWY 21`, `RNAV 027`, `VOR-A`); helicopter approaches are prefixed `COPTER` (e.g. `COPTER RNAV 250`). */
  name: string;
  /** CIFP procedure identifier (e.g. "AALLE4" for a STAR, "I04L" for an IAP). */
  identifier: string;
  /** Procedure type. */
  type: ProcedureType;
  /** FAA identifiers of airports served by this procedure. */
  airports: string[];
  /** Common routes (trunk paths). SIDs/STARs may have multiple entries for different routing configurations; IAPs have exactly one describing the final approach segment. */
  commonRoutes: ProcedureCommonRoute[];
  /** Named transitions feeding into (STAR/IAP) or out of (SID) the common route. */
  transitions: ProcedureTransition[];
  /** Transition altitude in feet MSL published for the procedure (ARINC 424 field 5.53): the altitude at which the altimeter setting changes between local pressure and standard pressure. 18,000 ft on US procedures. */
  transitionAltitudeFt?: number;
  /** Approach classification. Populated only when `type` is `IAP`. */
  approachType?: ApproachType;
  /** Primary runway served by the approach, derived from the approach identifier when it encodes one. Absent for circling approaches and for approaches named by final approach course. Populated only when `type` is `IAP`. */
  runway?: string;
  /** Missed approach sequence flown when a landing is not executed. Populated only when `type` is `IAP`. */
  missedApproach?: MissedApproachSequence;
}
