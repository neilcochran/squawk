/**
 * The named Resolution Advisory type for a single-threat encounter, derived
 * from the corrective/sense/rate/crossing/reversal flags per RTCA DO-185B
 * Table 2-16 (reproduced as Table 3 in the FAA's "Introduction to TCAS II
 * v7.1"). "Maintain Climb"/"Maintain Descend" and "Crossing Maintain
 * Climb"/"Crossing Maintain Descend" are not distinct wire values - they
 * are the same broadcast RA as `climb`/`descend` (or their crossing
 * variants), annunciated differently by the receiving aircraft's own TCAS
 * unit depending on whether it was already climbing/descending faster than
 * the initially-commanded rate.
 */
export type ResolutionAdvisoryType =
  | 'climb'
  | 'descend'
  | 'crossingClimb'
  | 'crossingDescend'
  | 'increaseClimb'
  | 'increaseDescent'
  | 'reduceClimb'
  | 'reduceDescent'
  | 'doNotClimb'
  | 'doNotDescend'
  | 'reversalToClimb'
  | 'reversalToDescend';

/** No threat-identity data (Threat Type Indicator 0). */
export interface AcasThreatNone {
  /** Discriminant tag - no threat-identity data follows. */
  threatType: 'none';
}

/** The threat identified by its 24-bit ICAO address (Threat Type Indicator 1). */
export interface AcasThreatIcaoAddress {
  /** Discriminant tag - the threat is identified by ICAO address. */
  threatType: 'icaoAddress';
  /** The threat aircraft's 24-bit ICAO hex address. */
  threatIcaoHex: string;
}

/** The threat identified by relative altitude, range, and bearing (Threat Type Indicator 2). */
export interface AcasThreatAltitudeRangeBearing {
  /** Discriminant tag - the threat is identified by altitude/range/bearing. */
  threatType: 'altitudeRangeBearing';
  /** The threat's altitude in feet, or undefined if the field is unavailable. */
  threatAltitudeFt: number | undefined;
  /** The threat's range in nautical miles, or undefined if the field is unavailable. */
  threatRangeNm: number | undefined;
  /** The threat's bearing in degrees relative to own aircraft, or undefined if the field is unavailable. */
  threatBearingDeg: number | undefined;
}

/**
 * The identity of the threat an ACAS Resolution Advisory report responds
 * to, discriminated by `threatType` (the 2-bit Threat Type Indicator, TTI).
 */
export type AcasThreat = AcasThreatNone | AcasThreatIcaoAddress | AcasThreatAltitudeRangeBearing;

/** Which kind of threat-identity data an ACAS Resolution Advisory report carries - the `threatType` discriminant of {@link AcasThreat}. */
export type AcasThreatType = AcasThreat['threatType'];

/**
 * A decoded ACAS/TCAS Resolution Advisory report - BDS 3,0 content, carried
 * either in a DF16 long air-air surveillance reply's MV field, or in a
 * DF17/18 type-code-28 subtype-2 ME field (the ADS-B RA broadcast, which
 * carries the identical content so aircraft without interrogation
 * capability can still see an active RA).
 */
export interface AcasResolutionAdvisoryReport {
  /** Whether a Resolution Advisory is currently active. False (with every other field still populated) means no advisory is presently in effect. */
  active: boolean;
  /** The named RA type for a single-threat encounter, derived from `corrective`/`downwardSense`/`increasedRate`/`senseReversal`/`altitudeCrossing`. Undefined when `active` is false, or when the flag combination has no defined single-threat RA type (e.g. some multi-threat composites - see `doNotPassBelow`/`doNotPassAbove`/`doNotTurnLeft`/`doNotTurnRight`). */
  advisoryType: ResolutionAdvisoryType | undefined;
  /** True if own aircraft must change its current vertical speed to comply; false if the RA is preventive (own aircraft is already in conformance and must only avoid certain rates). */
  corrective: boolean;
  /** True when the RA's sense is downward (descend-family); false when upward (climb-family). */
  downwardSense: boolean;
  /** True once own aircraft has been told to accelerate its climb/descent beyond the initial RA's target rate. */
  increasedRate: boolean;
  /** True when this RA reverses the sense of a previously issued RA for the same encounter. */
  senseReversal: boolean;
  /** True when this RA requires own aircraft to cross through the threat's altitude. */
  altitudeCrossing: boolean;
  /** True for a positive RA (a specific target climb/descend rate); false for a negative/Vertical-Speed-Limit RA (a rate to avoid). */
  positive: boolean;
  /** Resolution Advisory Complement: restricts own aircraft from descending below its current altitude. Primarily meaningful in multi-threat encounters. */
  doNotPassBelow: boolean;
  /** Resolution Advisory Complement: restricts own aircraft from climbing above its current altitude. Primarily meaningful in multi-threat encounters. */
  doNotPassAbove: boolean;
  /** Resolution Advisory Complement: reserved for a horizontal-maneuver capability TCAS II does not implement (TCAS II issues vertical RAs only) - expected to always be false in practice, decoded for completeness. */
  doNotTurnLeft: boolean;
  /** Resolution Advisory Complement: reserved for a horizontal-maneuver capability TCAS II does not implement (TCAS II issues vertical RAs only) - expected to always be false in practice, decoded for completeness. */
  doNotTurnRight: boolean;
  /** True for up to 18 seconds after an RA ends, indicating it is no longer displayed to the pilot. */
  terminated: boolean;
  /** True when this report resolves more than one simultaneous threat. */
  multipleThreat: boolean;
  /** The threat this report responds to - narrow on `threat.threatType` to access the identity fields for that kind. */
  threat: AcasThreat;
}
