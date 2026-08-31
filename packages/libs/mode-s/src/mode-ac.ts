import { extractBits } from './bits.js';
import type { ModeAcReply } from './types/index.js';

/**
 * Converts a raw Mode A code to a Mode C altitude in 100s of feet, via the
 * reflected-binary unscrambling defined for the Mode C altitude pulse
 * train. Ported from dump1090-fa's `mode_ac.c` (`internalModeAToModeC`) and
 * verified by exhaustive comparison against it across all 65536 possible
 * inputs (0 mismatches) - this package's own capture data has no Mode A/C
 * traffic to validate against directly (the format's use is opt-in and was
 * off on the reference station), so this port leans on that exhaustive
 * algorithmic cross-check rather than real-world samples.
 *
 * @param modeA - The raw 16-bit Mode A value.
 * @returns Altitude in 100s of feet, or undefined if the code is not a valid Mode C altitude report.
 */
function modeAToModeC(modeA: number): number | undefined {
  if ((modeA & 0xffff8889) !== 0 || (modeA & 0x000000f0) === 0) {
    return undefined;
  }

  let oneHundreds = 0;
  if (modeA & 0x0010) {
    oneHundreds ^= 0x007; // C1
  }
  if (modeA & 0x0020) {
    oneHundreds ^= 0x003; // C2
  }
  if (modeA & 0x0040) {
    oneHundreds ^= 0x001; // C4
  }
  if ((oneHundreds & 5) === 5) {
    oneHundreds ^= 2; // remap 7 <-> 5
  }
  if (oneHundreds > 5) {
    return undefined;
  }

  let fiveHundreds = 0;
  if (modeA & 0x0002) {
    fiveHundreds ^= 0x0ff; // D2
  }
  if (modeA & 0x0004) {
    fiveHundreds ^= 0x07f; // D4
  }
  if (modeA & 0x1000) {
    fiveHundreds ^= 0x03f; // A1
  }
  if (modeA & 0x2000) {
    fiveHundreds ^= 0x01f; // A2
  }
  if (modeA & 0x4000) {
    fiveHundreds ^= 0x00f; // A4
  }
  if (modeA & 0x0100) {
    fiveHundreds ^= 0x007; // B1
  }
  if (modeA & 0x0200) {
    fiveHundreds ^= 0x003; // B2
  }
  if (modeA & 0x0400) {
    fiveHundreds ^= 0x001; // B4
  }

  if (fiveHundreds & 1) {
    oneHundreds = 6 - oneHundreds;
  }

  return fiveHundreds * 5 + oneHundreds - 13;
}

/**
 * Decodes a Mode A/C reply, as carried by a Beast type-1 frame. Beast
 * represents the reply as the raw big-endian 16-bit value dump1090-fa
 * calls "ModeA" internally: each of the four squawk digits occupies one
 * nibble (masking with `0x7777` isolates them), with the Ident pulse and a
 * couple of spare bits interspersed.
 *
 * Mode A/C carries no ICAO address, so a decoded reply cannot be
 * associated with a specific aircraft the way a Mode-S message can - it is
 * decode-only in this package, not wired into any aircraft-tracking state.
 *
 * @param bytes - The 2-byte Mode A/C payload from a Beast type-1 frame.
 * @returns The decoded squawk code, Ident flag, and altitude (if the reply looks like a valid Mode C report).
 */
export function decodeModeAc(bytes: Uint8Array): ModeAcReply {
  const modeA = extractBits(bytes, 0, 16);
  const squawk = (modeA & 0x7777).toString(16).padStart(4, '0');
  const identActive = (modeA & 0x0080) !== 0;
  const modeC = identActive ? undefined : modeAToModeC(modeA);
  const altitudeFt = modeC === undefined ? undefined : modeC * 100;
  return { kind: 'modeAc', squawk, identActive, altitudeFt };
}
