/**
 * Test-only inverse of `bits.ts`'s `extractBits`: sets `bitLength` bits of
 * `value` into `bytes` starting at `bitOffset` (0-indexed from the MSB),
 * for building synthetic ME fields in specs.
 */
export function setBits(bytes: Uint8Array, bitOffset: number, bitLength: number, value: number): void {
  for (let i = 0; i < bitLength; i++) {
    const bitPos = bitOffset + i;
    const byteIndex = bitPos >> 3;
    const bitInByte = 7 - (bitPos & 7);
    const bit = (value >> (bitLength - 1 - i)) & 1;
    const current = bytes[byteIndex];
    if (bit === 1 && current !== undefined) {
      bytes[byteIndex] = current | (1 << bitInByte);
    }
  }
}
