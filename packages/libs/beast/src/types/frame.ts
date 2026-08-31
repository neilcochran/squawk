import type { DecodedModeSMessage, ModeAcReply } from '@squawk/mode-s';

/** Which of the three Beast message types a frame carries. */
export type BeastFrameType = 'modeAC' | 'shortModeS' | 'longModeS';

/**
 * One deframed Beast message. `decoded` is populated when the raw message
 * decoded successfully - a `ModeAcReply` for `modeAC` frames, or a
 * `DecodedModeSMessage` (from `@squawk/mode-s`) for `shortModeS`/`longModeS`
 * frames whose downlink format and CRC this package's decoder supports. It is
 * undefined for a Mode-S frame that failed its CRC check or whose
 * downlink format isn't decoded - `rawMessage` is always populated
 * regardless, so a consumer that wants the bytes anyway (for logging, or
 * its own decode attempt) still has them.
 */
export interface BeastFrame {
  /** Which Beast message type this frame carries. */
  type: BeastFrameType;
  /** Receiver timestamp: a 48-bit value from dump1090-fa's internal clock, not wall-clock time. See the package README for how to interpret it. */
  timestamp: bigint;
  /** Signal level byte, 0-255 (higher is stronger). */
  signalLevel: number;
  /** Raw message bytes as received - 2 bytes for `modeAC`, 7 for `shortModeS`, 14 for `longModeS` - regardless of whether `decoded` is populated. */
  rawMessage: Uint8Array;
  /** The decoded message, or undefined if it could not be decoded. */
  decoded: DecodedModeSMessage | ModeAcReply | undefined;
}

/**
 * One frame that failed to parse: either its escape/length framing was
 * malformed, or (for a Mode-S frame) it parsed as a well-formed frame but
 * the message inside failed to decode.
 */
export interface BeastFrameError {
  /** Why the frame could not be produced. */
  reason: 'malformedFraming' | 'undecodedMessage';
  /** The raw bytes involved, where available - the malformed span for a framing error, or the full frame's message bytes for an undecoded message. */
  bytes: Uint8Array;
}
