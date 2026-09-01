import type { ModeSMessageEnvelope } from './types/index.js';

/**
 * The 24-bit Mode-S CRC generator polynomial (ICAO Annex 10 Vol. IV / RTCA
 * DO-260), represented as its low 24 bits - the implicit leading term
 * cancels against the overflow bit it is XORed in response to.
 */
const CRC24_GENERATOR = 0xfff409;

/**
 * Extracts the downlink format from a Mode-S message's first 5 bits.
 *
 * @param bytes - Raw message bytes (7 or 14 bytes).
 * @returns The raw downlink format value, 0-31.
 */
export function extractDownlinkFormat(bytes: Uint8Array): number {
  const first = bytes[0] ?? 0;
  return first >> 3;
}

/**
 * Computes the 24-bit Mode-S CRC remainder over an entire message (all
 * bytes, including the trailing 24-bit parity field), via the standard
 * bit-serial polynomial division used to check or recover Mode-S CRCs.
 *
 * See {@link ModeSMessageEnvelope.crcRemainder} for how to interpret the
 * result - it is a pass/fail check for squitter formats (DF11/17/18) but a
 * recovered ICAO address for surveillance-reply formats.
 *
 * @param bytes - Raw message bytes (7 or 14 bytes), parity field included.
 * @returns The 24-bit CRC remainder.
 */
export function computeCrc24(bytes: Uint8Array): number {
  let register = 0;
  for (const byte of bytes) {
    for (let bitIndex = 7; bitIndex >= 0; bitIndex--) {
      const bit = (byte >> bitIndex) & 1;
      const topBit = (register >> 23) & 1;
      register = ((register << 1) | bit) & 0xffffff;
      if (topBit === 1) {
        register ^= CRC24_GENERATOR;
      }
    }
  }
  return register;
}

/**
 * Parses the shared envelope (downlink format, CRC remainder) out of a raw
 * Mode-S message. {@link decodeModeSMessage} uses this to decide how to
 * route a message before calling the per-type decoders - those decoders
 * take a raw ME field or an already-extracted field value, not the
 * envelope itself.
 *
 * ```typescript
 * import { parseModeSFrame } from '@squawk/mode-s';
 *
 * const envelope = parseModeSFrame(rawMessageBytes);
 * if (envelope.downlinkFormat === 17 && envelope.crcRemainder === 0) {
 *   // unmodified DF17 extended squitter, safe to decode further
 * }
 * ```
 *
 * @param bytes - Raw message bytes (7 or 14 bytes).
 * @returns The parsed envelope.
 */
export function parseModeSFrame(bytes: Uint8Array): ModeSMessageEnvelope {
  return {
    bytes,
    downlinkFormat: extractDownlinkFormat(bytes),
    crcRemainder: computeCrc24(bytes),
  };
}
