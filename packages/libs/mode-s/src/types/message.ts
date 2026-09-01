import type { AcasResolutionAdvisoryReport } from './acas.js';
import type { EmergencyState } from './emergency-status.js';
import type { AircraftIdentification } from './identification.js';
import type { AirborneVelocity } from './velocity.js';

/**
 * Where a DF17/18 extended squitter's address and data actually came from.
 * DF17 is always `icaoDirect` - it carries no control field, and a DF17
 * transponder is, by protocol definition, always ICAO-addressed and
 * broadcasting its own state directly. For DF18, this is derived from the
 * control field (CF):
 * - `icaoDirect` (CF=0): ICAO-addressed, direct from the aircraft - same as DF17.
 * - `anonymousDirect` (CF=1): a self-assigned or anonymous address (e.g. a
 *   ground vehicle's ADS-B-out unit with no Mode-S allocation), direct from
 *   the transmitting participant - `icaoHex` is not a registered ICAO address.
 * - `icaoTisb` (CF=2): ICAO-addressed, but ground-station-derived (TIS-B,
 *   fine format) rather than heard directly from the aircraft's own transponder.
 * - `anonymousTisb` (CF=5): a ground-assigned track-file address (TIS-B, fine
 *   format, non-ICAO) - `icaoHex` is not a registered ICAO address.
 * - `adsr` (CF=6): ICAO-addressed, relayed from another data link (e.g. UAT)
 *   by a ground station (ADS-B Rebroadcast).
 */
export type MessageSource =
  'icaoDirect' | 'anonymousDirect' | 'icaoTisb' | 'anonymousTisb' | 'adsr';

/** Fields common to every decoded DF17/18 extended squitter message. */
export interface ExtendedSquitterCommon {
  /**
   * 24-bit hex address from the message's AA field. A real, registered ICAO
   * Mode-S address when `messageSource` is `icaoDirect`/`icaoTisb`/`adsr` -
   * an anonymous or ground-assigned identifier, not a registered ICAO
   * address, when `messageSource` is `anonymousDirect`/`anonymousTisb`.
   */
  icaoHex: string;
  /** Where this message's address and data actually came from - see {@link MessageSource}. */
  messageSource: MessageSource;
}

/** A DF17/18 extended squitter airborne or surface position message. */
export interface ExtendedSquitterPosition extends ExtendedSquitterCommon {
  /** Discriminant tag identifying this as a decoded airborne or surface position message. */
  kind: 'extendedSquitterPosition';
  /** Whether this is a surface (on-ground) or airborne position message. */
  surface: boolean;
  /** Whether the CPR fields use the even or odd format. */
  cprFormat: 'even' | 'odd';
  /** Raw 17-bit CPR-encoded latitude field, or undefined for a type-code-0 airborne position message (no position information available - altitude may still be valid). */
  latCpr: number | undefined;
  /** Raw 17-bit CPR-encoded longitude field, or undefined for a type-code-0 airborne position message (no position information available - altitude may still be valid). */
  lonCpr: number | undefined;
  /** Decoded altitude in feet. Always undefined for a surface position - surface messages carry ground movement/track in place of altitude. */
  altitudeFt: number | undefined;
  /** Ground speed in knots, decoded from the movement field. Always undefined for an airborne position - airborne messages carry altitude in the same bits instead. */
  groundSpeedKt: number | undefined;
  /** Track over ground in degrees true. Always undefined for an airborne position, and for a surface position whose track status bit is unset (no valid track available). */
  trueTrackDeg: number | undefined;
}

/** A DF17/18 extended squitter airborne velocity message. */
export interface ExtendedSquitterVelocity extends ExtendedSquitterCommon {
  /** Discriminant tag identifying this as a decoded airborne velocity message. */
  kind: 'extendedSquitterVelocity';
  /** The decoded velocity. */
  velocity: AirborneVelocity;
}

/** A DF17/18 extended squitter aircraft identification message. */
export interface ExtendedSquitterIdentification extends ExtendedSquitterCommon {
  /** Discriminant tag identifying this as a decoded aircraft identification message. */
  kind: 'extendedSquitterIdentification';
  /** The decoded callsign and category. */
  identification: AircraftIdentification;
}

/** A DF11 all-call reply - confirms an aircraft's ICAO address, carries no other data. */
export interface AllCallReply {
  /** Discriminant tag identifying this as a decoded DF11 all-call reply. */
  kind: 'allCallReply';
  /** 24-bit ICAO hex address of the transmitting aircraft. */
  icaoHex: string;
}

/**
 * A DF0 short air-air surveillance reply (ACAS/TCAS interrogation reply
 * from an aircraft with no resolution advisory currently active - an
 * aircraft replying while an RA is active sends the longer DF16 instead).
 * Like {@link SurveillanceAltitudeReply}, this is a targeted response whose
 * CRC is XORed with the responding aircraft's ICAO address rather than
 * being a plain checksum - `candidateIcaoHex` needs cross-checking against
 * known traffic before it can be trusted.
 */
export interface ShortAirAirSurveillanceReply {
  /** Discriminant tag identifying this as a decoded DF0 short air-air surveillance reply. */
  kind: 'shortAirAirSurveillanceReply';
  /** Candidate 24-bit ICAO hex address, recovered from the CRC field - verify against known traffic before trusting it. */
  candidateIcaoHex: string;
  /** Whether the replying aircraft is on the ground, from the vertical status bit. */
  surface: boolean;
  /** Decoded altitude in feet, or undefined if the AC field is empty or invalid. */
  altitudeFt: number | undefined;
}

/**
 * A DF16 long air-air surveillance reply - an ACAS/TCAS interrogation reply
 * from an aircraft with a Resolution Advisory currently active. Like
 * {@link SurveillanceAltitudeReply}, this is a targeted response whose CRC
 * is XORed with the responding aircraft's ICAO address rather than being a
 * plain checksum - `candidateIcaoHex` needs cross-checking against known
 * traffic before it can be trusted.
 */
export interface LongAirAirSurveillanceReply {
  /** Discriminant tag identifying this as a decoded DF16 long air-air surveillance reply. */
  kind: 'longAirAirSurveillanceReply';
  /** Candidate 24-bit ICAO hex address, recovered from the CRC field - verify against known traffic before trusting it. */
  candidateIcaoHex: string;
  /** Whether the replying aircraft is on the ground, from the vertical status bit. */
  surface: boolean;
  /** Decoded altitude in feet, or undefined if the AC field is empty or invalid. */
  altitudeFt: number | undefined;
  /** The active Resolution Advisory report, or undefined if its Threat Type Indicator was the reserved value. Altitude and address above remain independently valid even when this is undefined. */
  resolutionAdvisory: AcasResolutionAdvisoryReport | undefined;
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
  /** Discriminant tag identifying this as a decoded DF4/20 surveillance altitude reply. */
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
  /** Discriminant tag identifying this as a decoded DF5/21 surveillance identity reply. */
  kind: 'surveillanceIdentityReply';
  /** Candidate 24-bit ICAO hex address, recovered from the CRC field - verify against known traffic before trusting it. */
  candidateIcaoHex: string;
  /** The decoded 4-digit octal squawk code. */
  squawk: string;
}

/**
 * A DF17/18 extended squitter aircraft status message (type code 28,
 * subtype 1 - emergency/priority status). Subtype 2 (TCAS/ACAS resolution
 * advisory broadcast) decodes to {@link ExtendedSquitterAcasRaBroadcast}
 * instead.
 */
export interface ExtendedSquitterEmergencyStatus extends ExtendedSquitterCommon {
  /** Discriminant tag identifying this as a decoded type-code-28 subtype-1 emergency/priority status message. */
  kind: 'extendedSquitterEmergencyStatus';
  /** The declared emergency/priority state. */
  emergencyState: EmergencyState;
  /** The squawk code broadcast alongside the emergency state - the same code the aircraft would transmit via a DF5/21 Mode-S reply, sent here natively over ADS-B. */
  squawk: string;
}

/**
 * A DF17/18 extended squitter aircraft status message (type code 28,
 * subtype 2 - ACAS/TCAS Resolution Advisory broadcast). Lets aircraft
 * without interrogation capability see that a nearby aircraft has an active
 * RA. Carries the same BDS 3,0 content as a DF16 reply's `resolutionAdvisory`.
 */
export interface ExtendedSquitterAcasRaBroadcast extends ExtendedSquitterCommon {
  /** Discriminant tag identifying this as a decoded type-code-28 subtype-2 ACAS Resolution Advisory broadcast. */
  kind: 'extendedSquitterAcasRaBroadcast';
  /** The active Resolution Advisory report. */
  resolutionAdvisory: AcasResolutionAdvisoryReport;
}

/**
 * A decoded Mode-S message. Discriminated by `kind`. DF24 (Comm-D) is
 * recognized at the envelope level but not decoded by this package -
 * {@link decodeModeSMessage} returns undefined for it, the same as a
 * genuinely unsupported or invalid message. DF19 (military extended
 * squitter) and DF22 (military use) are reserved formats with no publicly
 * documented payload and are not decoded, for the same reason.
 */
export type DecodedModeSMessage =
  | ExtendedSquitterPosition
  | ExtendedSquitterVelocity
  | ExtendedSquitterIdentification
  | ExtendedSquitterEmergencyStatus
  | ExtendedSquitterAcasRaBroadcast
  | AllCallReply
  | ShortAirAirSurveillanceReply
  | LongAirAirSurveillanceReply
  | SurveillanceAltitudeReply
  | SurveillanceIdentityReply;
