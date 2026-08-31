import type { EmergencyState } from './emergency-status.js';
import type { AircraftIdentification } from './identification.js';
import type { AirborneVelocity } from './velocity.js';

/** A DF17/18 extended squitter airborne or surface position message. */
export interface ExtendedSquitterPosition {
  kind: 'extendedSquitterPosition';
  /** 24-bit ICAO hex address of the transmitting aircraft. */
  icaoHex: string;
  /** Whether this is a surface (on-ground) or airborne position message. */
  surface: boolean;
  /** Whether the CPR fields use the even or odd format. */
  cprFormat: 'even' | 'odd';
  /** Raw 17-bit CPR-encoded latitude field. */
  latCpr: number;
  /** Raw 17-bit CPR-encoded longitude field. */
  lonCpr: number;
  /** Decoded altitude in feet. Always undefined for a surface position - surface messages carry ground movement/track in place of altitude. */
  altitudeFt: number | undefined;
  /** Ground speed in knots, decoded from the movement field. Always undefined for an airborne position - airborne messages carry altitude in the same bits instead. */
  groundSpeedKt: number | undefined;
  /** Track over ground in degrees true. Always undefined for an airborne position, and for a surface position whose track status bit is unset (no valid track available). */
  trueTrackDeg: number | undefined;
}

/** A DF17/18 extended squitter airborne velocity message. */
export interface ExtendedSquitterVelocity {
  kind: 'extendedSquitterVelocity';
  /** 24-bit ICAO hex address of the transmitting aircraft. */
  icaoHex: string;
  /** The decoded velocity. */
  velocity: AirborneVelocity;
}

/** A DF17/18 extended squitter aircraft identification message. */
export interface ExtendedSquitterIdentification {
  kind: 'extendedSquitterIdentification';
  /** 24-bit ICAO hex address of the transmitting aircraft. */
  icaoHex: string;
  /** The decoded callsign and category. */
  identification: AircraftIdentification;
}

/** A DF11 all-call reply - confirms an aircraft's ICAO address, carries no other data. */
export interface AllCallReply {
  kind: 'allCallReply';
  /** 24-bit ICAO hex address of the transmitting aircraft. */
  icaoHex: string;
}

/**
 * A DF4/20 Mode-S surveillance altitude reply. Unlike a squitter, this is
 * a targeted response to an interrogation - its CRC is XORed with the
 * responding aircraft's ICAO address rather than being a plain checksum,
 * so `candidateIcaoHex` is only trustworthy once cross-checked against an
 * address already known from squitter traffic (this package does not
 * perform that cross-check itself; see {@link ModeSMessageEnvelope.crcRemainder}).
 */
export interface SurveillanceAltitudeReply {
  kind: 'surveillanceAltitudeReply';
  /** Candidate 24-bit ICAO hex address, recovered from the CRC field - verify against known traffic before trusting it. */
  candidateIcaoHex: string;
  /** Decoded altitude in feet, or undefined if the AC field is empty or invalid. */
  altitudeFt: number | undefined;
}

/**
 * A DF5/21 Mode-S surveillance identity (squawk) reply. Like
 * {@link SurveillanceAltitudeReply}, this is a targeted response whose CRC
 * is XORed with the responding aircraft's ICAO address rather than being a
 * plain checksum - `candidateIcaoHex` needs cross-checking against known
 * traffic before it can be trusted.
 */
export interface SurveillanceIdentityReply {
  kind: 'surveillanceIdentityReply';
  /** Candidate 24-bit ICAO hex address, recovered from the CRC field - verify against known traffic before trusting it. */
  candidateIcaoHex: string;
  /** The decoded 4-digit octal squawk code. */
  squawk: string;
}

/**
 * A DF17/18 extended squitter aircraft status message (type code 28,
 * subtype 1 - emergency/priority status). Subtype 2 (TCAS/ACAS resolution
 * advisory broadcast) is a different domain - collision-avoidance
 * coordination between aircraft, not aircraft state - and is not decoded
 * by this package, the same as DF0/DF16.
 */
export interface ExtendedSquitterEmergencyStatus {
  kind: 'extendedSquitterEmergencyStatus';
  /** 24-bit ICAO hex address of the transmitting aircraft. */
  icaoHex: string;
  /** The declared emergency/priority state. */
  emergencyState: EmergencyState;
  /** The squawk code broadcast alongside the emergency state - the same code the aircraft would transmit via a DF5/21 Mode-S reply, sent here natively over ADS-B. */
  squawk: string;
}

/**
 * A decoded Mode-S message. Discriminated by `kind`. DF24 (Comm-D) is
 * recognized at the envelope level but not decoded by this package -
 * {@link decodeModeSMessage} returns undefined for it, the same as a
 * genuinely unsupported or invalid message.
 */
export type DecodedModeSMessage =
  | ExtendedSquitterPosition
  | ExtendedSquitterVelocity
  | ExtendedSquitterIdentification
  | ExtendedSquitterEmergencyStatus
  | AllCallReply
  | SurveillanceAltitudeReply
  | SurveillanceIdentityReply;
