import { bitAt } from './bits.js';

/** 13-bit field width shared by the identity (ID) and altitude (AC) fields. */
const FIELD_WIDTH = 13;

/**
 * Decodes a 13-bit Mode-S identity (ID) field to a 4-digit octal squawk
 * string, per ICAO Annex 10 Vol. IV / RTCA DO-260. The field packs each
 * octal digit across three interleaved pulse bits (e.g. digit A from bits
 * A4, A2, A1) rather than storing the four digits contiguously.
 *
 * @param idField - The raw 13-bit ID field, 0-8191.
 * @returns The 4-character octal squawk string, e.g. "1200".
 */
export function decodeIdentityCode(idField: number): string {
  const bitOf = (pos: number): number => bitAt(idField, pos, FIELD_WIDTH);

  const a = (bitOf(5) << 2) | (bitOf(3) << 1) | bitOf(1); // A4 A2 A1
  const b = (bitOf(11) << 2) | (bitOf(9) << 1) | bitOf(7); // B4 B2 B1
  const c = (bitOf(4) << 2) | (bitOf(2) << 1) | bitOf(0); // C4 C2 C1
  const d = (bitOf(12) << 2) | (bitOf(10) << 1) | bitOf(8); // D4 D2 D1

  return `${a}${b}${c}${d}`;
}
