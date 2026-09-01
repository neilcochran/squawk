/**
 * Extracts an unsigned integer from `bitLength` bits starting at `bitOffset`
 * (0-indexed from the MSB of `bytes`), crossing byte boundaries as needed.
 *
 * JavaScript's bitwise operators work on 32-bit signed integers, so a raw
 * Mode-S ME field (56 bits) can't be treated as one shifted integer the way
 * a language with arbitrary-precision integers can. This reads bit by bit
 * instead, safe for any field up to 31 bits - comfortably more than any
 * single field this package decodes.
 *
 * @param bytes - The byte array to read from.
 * @param bitOffset - Index of the first bit to read, 0-indexed from the MSB of `bytes[0]`.
 * @param bitLength - Number of bits to read.
 * @returns The extracted value as an unsigned integer.
 */
export function extractBits(bytes: Uint8Array, bitOffset: number, bitLength: number): number {
  let value = 0;
  for (let i = 0; i < bitLength; i++) {
    const bitPos = bitOffset + i;
    const byteIndex = bitPos >> 3;
    const bitInByte = 7 - (bitPos & 7);
    const byte = bytes[byteIndex] ?? 0;
    const bit = (byte >> bitInByte) & 1;
    value = (value << 1) | bit;
  }
  return value;
}

/**
 * Extracts a single bit directly from an already-extracted integer field,
 * at `bitPosition` (0-indexed from the MSB of a `fieldWidth`-bit field).
 * For fields already narrow enough to fit safely in a plain 32-bit
 * bitwise op (comfortably true for anything this package decodes, e.g. a
 * 13-bit identity or altitude code) - {@link extractBits}'s byte-array
 * form exists to cross byte boundaries within a much wider ME field, which
 * a single already-extracted small field never needs to do.
 *
 * @param value - The field's value, e.g. a 13-bit integer in [0, 8191].
 * @param bitPosition - Index of the bit to read, 0-indexed from the MSB.
 * @param fieldWidth - Total width of the field in bits.
 * @returns The bit at that position, 0 or 1.
 */
export function bitAt(value: number, bitPosition: number, fieldWidth: number): number {
  return (value >> (fieldWidth - 1 - bitPosition)) & 1;
}

/**
 * Formats a 24-bit value (an ICAO address, a recovered CRC-XOR address, or
 * any other 24-bit identifier this package handles) as 6 uppercase hex
 * digits, zero-padded.
 *
 * @param value - The 24-bit value, 0-16777215.
 * @returns The value as 6 uppercase hex digits.
 */
export function formatHexAddress(value: number): string {
  return value.toString(16).padStart(6, '0').toUpperCase();
}
