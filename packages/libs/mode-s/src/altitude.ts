import { bitAt } from './bits.js';

/** 13-bit field width shared by the altitude (AC) and identity (ID) fields. */
const FIELD_WIDTH = 13;

/**
 * Converts an unsigned Gillham code (a reflected Gray-code variant) to a
 * plain binary integer via the standard Gray-to-binary fold.
 */
function grayToBinary(value: number, bitWidth: number): number {
  let result = value;
  for (let shift = 1; shift < bitWidth; shift *= 2) {
    result ^= result >> shift;
  }
  return result;
}

/**
 * Decodes a 13-bit Mode-S altitude code (the AC field of DF0/4/16/20
 * surveillance replies) to feet, per ICAO Annex 10 Vol. IV / RTCA DO-260.
 *
 * The field supports two encodings, selected by the Q bit: a 25-foot
 * linear encoding (Q=1), or a 100-foot Gillham (Gray code) encoding
 * (Q=0) - the legacy scheme shared with Mode-C. Bit layout, MSB first:
 * `C1 A1 C2 A2 C4 A4 M B1 Q B2 D2 B4 D4`.
 *
 * @param altitudeCode - The raw 13-bit AC field, 0-8191.
 * @returns Altitude in feet, or undefined if the field is all-zero (altitude unknown), reports the rare M (metric) encoding, or contains an invalid Gillham value.
 */
export function decodeAltitudeCode(altitudeCode: number): number | undefined {
  if (altitudeCode === 0) {
    return undefined;
  }

  const bitOf = (pos: number): number => bitAt(altitudeCode, pos, FIELD_WIDTH);

  const mBit = bitOf(6);
  const qBit = bitOf(8);

  if (mBit === 0 && qBit === 1) {
    // 25-foot linear encoding: drop the M and Q bits, the remaining 11 bits
    // form the value - the top 6 bits (C1A1C2A2C4A4), then B1, then the
    // bottom 4 bits (B2D2B4D4).
    const topSixBits = (altitudeCode >> 7) & 0x3f;
    const bottomFourBits = altitudeCode & 0xf;
    const n = (topSixBits << 5) | (bitOf(7) << 4) | bottomFourBits;
    return n * 25 - 1000;
  }

  if (mBit === 0 && qBit === 0) {
    const c1 = bitOf(0);
    const a1 = bitOf(1);
    const c2 = bitOf(2);
    const a2 = bitOf(3);
    const c4 = bitOf(4);
    const a4 = bitOf(5);
    const b1 = bitOf(7);
    const b2 = bitOf(9);
    const d2 = bitOf(10);
    const b4 = bitOf(11);
    const d4 = bitOf(12);

    // Re-order into an 8-bit 500 ft Gillham counter and a 3-bit 100 ft
    // Gillham counter, per ICAO Annex 10 Vol. IV / DO-260.
    const gray500 =
      (d2 << 7) | (d4 << 6) | (a1 << 5) | (a2 << 4) | (a4 << 3) | (b1 << 2) | (b2 << 1) | b4;
    const gray100 = (c1 << 2) | (c2 << 1) | c4;

    const n500 = grayToBinary(gray500, 8);
    let n100 = grayToBinary(gray100, 4);

    if (n100 === 0 || n100 === 5 || n100 === 6) {
      return undefined;
    }
    if (n100 === 7) {
      n100 = 5;
    }
    if (n500 % 2 === 1) {
      n100 = 6 - n100;
    }

    return n500 * 500 + n100 * 100 - 1300;
  }

  // M = 1: rare, non-standard meter-based encoding. Not decoded.
  return undefined;
}

/**
 * Decodes the 12-bit altitude field of an ADS-B airborne position message
 * (type codes 9-18, barometric altitude). The field omits the M bit that
 * {@link decodeAltitudeCode}'s 13-bit AC field carries, so it is
 * re-inserted (always 0 - the M encoding never appears in ADS-B position
 * messages) before delegating to the shared Gillham/linear decoder.
 *
 * @param positionAltitudeField - The raw 12-bit altitude field from bits 8-19 of an airborne position ME field.
 * @returns Altitude in feet, or undefined if unavailable.
 */
export function decodeAdsbPositionAltitude(positionAltitudeField: number): number | undefined {
  const altitudeCode = ((positionAltitudeField >> 6) << 7) | (positionAltitudeField & 0x3f);
  return decodeAltitudeCode(altitudeCode);
}

/**
 * Decodes the GNSS altitude field of an ADS-B airborne position message
 * (type codes 20-22). Unlike barometric altitude, this field is a plain
 * 12-bit integer in meters - no Gillham or linear-code decoding involved.
 *
 * @param gnssAltitudeField - The raw 12-bit altitude field from bits 8-19 of a GNSS-altitude position ME field.
 * @returns Altitude in feet.
 */
export function decodeAdsbGnssAltitude(gnssAltitudeField: number): number {
  return Math.round(gnssAltitudeField * 3.28084);
}
