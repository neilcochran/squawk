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
  | '@'
  | '+'
  | '-'
  | 'B'
  | 'C'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'V'
  | 'X'
  | 'Y';

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
 * Speed constraint descriptor.
 *
 * - `@` - Cross exactly at the speed.
 * - `+` - Cross at or above the speed.
 * - `-` - Cross at or below the speed (the most common published restriction).
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
 * Turn direction for a procedure leg. Populated only when the turn is
 * explicitly commanded by the procedure.
 */
export type TurnDirection = 'L' | 'R';

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
  /** Rho (distance from the recommended navaid to the fix) in nautical miles. */
  rhoNm?: number;
  /** Required Navigation Performance value in nautical miles. */
  rnpNm?: number;
  /** Commanded turn direction. */
  turnDirection?: TurnDirection;
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
  /** Runway identifier when CIFP tags the route to a specific runway. */
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
  /** Human-readable procedure name. For SIDs and STARs this equals the CIFP identifier (e.g. `AALLE4`) since CIFP does not carry the spelled-out name. For IAPs this is a composed label derived from the approach type and runway (e.g. `ILS RWY 04L`, `VOR-A`). */
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
  /** Approach classification. Populated only when `type` is `IAP`. */
  approachType?: ApproachType;
  /** Primary runway served by the approach, derived from the approach identifier when it encodes one. Populated only when `type` is `IAP`. */
  runway?: string;
  /** Missed approach sequence flown when a landing is not executed. Populated only when `type` is `IAP`. */
  missedApproach?: MissedApproachSequence;
}
