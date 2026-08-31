import { describe, it, expect } from 'vitest';

import { extractDownlinkFormat, computeCrc24, parseModeSFrame } from './frame.js';

describe('extractDownlinkFormat', () => {
  it('reads the top 5 bits of byte 0', () => {
    expect(extractDownlinkFormat(Uint8Array.of(0x00))).toBe(0);
    expect(extractDownlinkFormat(Uint8Array.of(0x20))).toBe(4); // 0b00100_000
    expect(extractDownlinkFormat(Uint8Array.of(0x28))).toBe(5); // 0b00101_000
    expect(extractDownlinkFormat(Uint8Array.of(0x58))).toBe(11); // 0b01011_000
    expect(extractDownlinkFormat(Uint8Array.of(0x88))).toBe(17); // 0b10001_000
    expect(extractDownlinkFormat(Uint8Array.of(0x90))).toBe(18); // 0b10010_000
    expect(extractDownlinkFormat(Uint8Array.of(0xa0))).toBe(20); // 0b10100_000
    expect(extractDownlinkFormat(Uint8Array.of(0xa8))).toBe(21); // 0b10101_000
    expect(extractDownlinkFormat(Uint8Array.of(0xff))).toBe(31); // 0b11111_111
  });

  it('returns 0 for an empty byte array rather than throwing', () => {
    expect(extractDownlinkFormat(new Uint8Array(0))).toBe(0);
  });
});

describe('computeCrc24', () => {
  it('returns zero for an all-zero message of any supported length', () => {
    expect(computeCrc24(new Uint8Array(7))).toBe(0);
    expect(computeCrc24(new Uint8Array(14))).toBe(0);
  });

  it('changes when any bit in the message changes', () => {
    const base = new Uint8Array(14);
    const flipped = new Uint8Array(14);
    flipped[0] = 0x01;
    expect(computeCrc24(flipped)).not.toBe(computeCrc24(base));
  });

  it('is deterministic for the same input', () => {
    const bytes = Uint8Array.of(0x8d, 0xab, 0x09, 0x69, 0x58, 0xc7, 0xf4, 0x8a, 0x99, 0x77, 0x3d, 0xf5, 0x01, 0x91);
    expect(computeCrc24(bytes)).toBe(computeCrc24(bytes));
  });
});

describe('parseModeSFrame', () => {
  it('combines downlink format and CRC extraction into one envelope', () => {
    const bytes = Uint8Array.of(0x8d, 0xab, 0x09, 0x69, 0x58, 0xc7, 0xf4, 0x8a, 0x99, 0x77, 0x3d, 0xf5, 0x01, 0x91);
    const envelope = parseModeSFrame(bytes);
    expect(envelope.bytes).toBe(bytes);
    expect(envelope.downlinkFormat).toBe(extractDownlinkFormat(bytes));
    expect(envelope.crcRemainder).toBe(computeCrc24(bytes));
  });
});

// Messages below are verbatim from a live Beast-binary capture off a real
// dump1090-fa station, not hand-built, decoded from the raw frames by hand
// (downlink format and ICAO address confirmed manually before writing these
// assertions). An unmodified DF17 squitter's CRC remainder must be exactly
// zero - that is the defining validity property of the format, not a
// station-specific value, so asserting the exact literal here is safe.
describe('parseModeSFrame - real dump1090-fa Beast capture', () => {
  it('parses a real DF17 airborne position message with a valid CRC', () => {
    const bytes = Uint8Array.of(
      0x8d, 0xab, 0x09, 0x69, 0x58, 0xc7, 0xf4, 0x8a, 0x99, 0x77, 0x3d, 0xf5, 0x01, 0x91,
    );
    const envelope = parseModeSFrame(bytes);
    expect(envelope.downlinkFormat).toBe(17);
    expect(envelope.crcRemainder).toBe(0);
  });

  it('parses a real DF17 airborne velocity message with a valid CRC', () => {
    const bytes = Uint8Array.of(
      0x8d, 0xab, 0x09, 0x69, 0x99, 0x0a, 0x55, 0x02, 0x80, 0x08, 0x35, 0xa7, 0x73, 0x9c,
    );
    const envelope = parseModeSFrame(bytes);
    expect(envelope.downlinkFormat).toBe(17);
    expect(envelope.crcRemainder).toBe(0);
  });

  it('parses a real DF11 all-call reply with a small interrogator-code remainder', () => {
    const bytes = Uint8Array.of(0x5d, 0xab, 0x09, 0x69, 0x30, 0xe6, 0x68);
    const envelope = parseModeSFrame(bytes);
    expect(envelope.downlinkFormat).toBe(11);
    expect(envelope.crcRemainder).toBeGreaterThanOrEqual(0);
    expect(envelope.crcRemainder).toBeLessThanOrEqual(15);
  });
});
