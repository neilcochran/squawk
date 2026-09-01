/**
 * A Mode-S message with its downlink format and CRC remainder extracted,
 * prior to any per-type decoding. The envelope every other decoder in this
 * package builds on.
 */
export interface ModeSMessageEnvelope {
  /** Raw message bytes - 7 for a short (56-bit) message, 14 for a long (112-bit) message. */
  bytes: Uint8Array;
  /**
   * The raw 5-bit downlink format value (0-31) from the top of byte 0.
   * Values 24-31 all denote Comm-D (DF24) - the lower 2 bits of this field
   * are the KE/ND subfields for that format, not distinct downlink formats.
   * This package does not decode Comm-D; callers should treat any value
   * >= 24 as "DF24, unsupported" rather than as a distinguishable DF25-31.
   */
  downlinkFormat: number;
  /**
   * 24-bit CRC remainder computed over the entire message. Interpretation
   * depends on `downlinkFormat`:
   * - DF11/17/18 (squitters): zero indicates an unmodified message. A
   *   non-zero value on DF11 (up to 127 - a 1-bit IC selector plus either a
   *   4-bit legacy II code or a 6-bit SI code) identifies the interrogator
   *   the ground station used, not a validation failure.
   * - DF0/4/5/16/20/21 (surveillance replies): this value IS the
   *   transmitting aircraft's 24-bit ICAO address, XORed into the parity
   *   field by design. There is no pass/fail check for these formats in
   *   isolation - callers confirm validity by matching this value against
   *   an ICAO address already known from squitter traffic.
   */
  crcRemainder: number;
}
