/**
 * @packageDocumentation
 * Decode raw Mode-S/ADS-B messages: downlink format and CRC extraction,
 * CPR position, airborne velocity, identification, and altitude decoding.
 * Transport-agnostic - operates on already-framed message bytes regardless
 * of where they came from (Beast, a logged capture, or any other source).
 */
export { decodeModeSMessage } from './message.js';
export { decodeAcasResolutionAdvisory } from './acas.js';
export {
  decodeAdsbGnssAltitude,
  decodeAdsbPositionAltitude,
  decodeAltitudeCode,
} from './altitude.js';
export {
  decodeHeadingAndSpeedReport,
  decodeSelectedVerticalIntention,
  decodeTrackAndTurnReport,
  inferCommBRegisters,
} from './comm-b.js';
export {
  cprNumLongitudeZones,
  decodeAirborneCprPair,
  decodeAirborneCprWithReference,
  decodeSurfaceCprPair,
  decodeSurfaceCprWithReference,
} from './cpr.js';
export { decodeEmergencyState } from './emergency-status.js';
export { extractDownlinkFormat, computeCrc24, parseModeSFrame } from './frame.js';
export { decodeIdentification } from './identification.js';
export { decodeIdentityCode } from './identity.js';
export { decodeModeAc } from './mode-ac.js';
export { decodeAircraftOperationalStatus } from './operational-status.js';
export { decodeSurfaceMovement } from './surface-movement.js';
export { decodeTargetStateAndStatus } from './target-state-status.js';
export { decodeAirborneVelocity } from './velocity.js';
export type {
  AllCallReply,
  CommBAltitudeReply,
  CommBIdentityReply,
  DecodedModeSMessage,
  ExtendedSquitterAcasRaBroadcast,
  ExtendedSquitterCommon,
  ExtendedSquitterEmergencyStatus,
  ExtendedSquitterIdentification,
  ExtendedSquitterOperationalStatus,
  ExtendedSquitterPosition,
  ExtendedSquitterTargetStateAndStatus,
  ExtendedSquitterVelocity,
  LongAirAirSurveillanceReply,
  MessageSource,
  ShortAirAirSurveillanceReply,
  SurveillanceAltitudeReply,
  SurveillanceIdentityReply,
} from './types/index.js';
export type { AircraftOperationalStatus } from './types/index.js';
export type { TargetStateAndStatus } from './types/index.js';
export type {
  CommBRegister,
  HeadingAndSpeedReport,
  SelectedVerticalIntention,
  TrackAndTurnReport,
} from './types/index.js';
export type {
  AcasResolutionAdvisoryReport,
  AcasThreat,
  AcasThreatAltitudeRangeBearing,
  AcasThreatIcaoAddress,
  AcasThreatNone,
  AcasThreatType,
  ResolutionAdvisoryType,
} from './types/index.js';
export type { EmergencyState } from './types/index.js';
export type { AircraftIdentification } from './types/index.js';
export type {
  AirborneVelocity,
  AirborneVelocityCommon,
  AirSpeedVelocity,
  GroundSpeedVelocity,
} from './types/index.js';
export type { CprPosition, CprReference, ModeSMessageEnvelope } from './types/index.js';
export type { ModeAcReply } from './types/index.js';
