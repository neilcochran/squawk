import { describe, it, expect } from 'vitest';

import { parseSbsLine } from './sbs-mapping.js';

/** Builds a 22-field SBS line from 0-indexed field overrides, blank elsewhere. */
function buildLine(overrides: Record<number, string>): string {
  const fields = new Array(22).fill('');
  for (const [index, value] of Object.entries(overrides)) {
    fields[Number(index)] = value;
  }
  return fields.join(',');
}

describe('parseSbsLine', () => {
  it('returns undefined for a non-MSG record type', () => {
    expect(parseSbsLine(buildLine({ 0: 'STA', 4: 'A0B1C2' }))).toBeUndefined();
  });

  it('returns undefined when the hex ident field is blank', () => {
    expect(parseSbsLine(buildLine({ 0: 'MSG', 1: '1' }))).toBeUndefined();
  });

  it('parses a transmission type 1 (ident/category) record - callsign only', () => {
    const update = parseSbsLine(buildLine({ 0: 'MSG', 1: '1', 4: 'a0b1c2', 10: 'UAL123  ' }));
    expect(update).toEqual({ icaoHex: 'A0B1C2', callsign: 'UAL123' });
  });

  it('parses a transmission type 3 (airborne position) record - altitude and lat/lon', () => {
    const update = parseSbsLine(
      buildLine({ 0: 'MSG', 1: '3', 4: 'a0b1c2', 11: '5500', 14: '40.6413', 15: '-73.7781' }),
    );
    expect(update).toEqual({
      icaoHex: 'A0B1C2',
      baroAltitudeFt: 5500,
      lat: 40.6413,
      lon: -73.7781,
    });
  });

  it('parses a transmission type 4 (airborne velocity) record - speed, track, vertical rate', () => {
    const update = parseSbsLine(
      buildLine({ 0: 'MSG', 1: '4', 4: 'a0b1c2', 12: '210', 13: '271.4', 16: '-640' }),
    );
    expect(update).toEqual({
      icaoHex: 'A0B1C2',
      groundSpeedKt: 210,
      trueTrackDeg: 271.4,
      verticalRateFtPerMin: -640,
    });
  });

  it('parses a transmission type 5 (surveillance altitude) record - altitude only, no position', () => {
    const update = parseSbsLine(buildLine({ 0: 'MSG', 1: '5', 4: 'a0b1c2', 11: '5500' }));
    expect(update).toEqual({ icaoHex: 'A0B1C2', baroAltitudeFt: 5500 });
  });

  it('parses a transmission type 6 (surveillance ID) record - squawk', () => {
    const update = parseSbsLine(buildLine({ 0: 'MSG', 1: '6', 4: 'a0b1c2', 17: '1200' }));
    expect(update).toEqual({ icaoHex: 'A0B1C2', squawk: '1200' });
  });

  it('only sets lat/lon when both are present and numeric', () => {
    expect(parseSbsLine(buildLine({ 0: 'MSG', 1: '3', 4: 'a0b1c2', 14: '40.6413' }))).toEqual({
      icaoHex: 'A0B1C2',
    });
  });

  it('maps the on-ground flag when it is exactly "0" or "1"', () => {
    expect(parseSbsLine(buildLine({ 0: 'MSG', 1: '2', 4: 'a0b1c2', 21: '1' }))?.onGround).toBe(
      true,
    );
    expect(parseSbsLine(buildLine({ 0: 'MSG', 1: '3', 4: 'a0b1c2', 21: '0' }))?.onGround).toBe(
      false,
    );
  });

  it('leaves onGround unset when the flag is blank or an unrecognized value', () => {
    expect(parseSbsLine(buildLine({ 0: 'MSG', 1: '3', 4: 'a0b1c2' }))?.onGround).toBeUndefined();
    expect(
      parseSbsLine(buildLine({ 0: 'MSG', 1: '3', 4: 'a0b1c2', 21: '-1' }))?.onGround,
    ).toBeUndefined();
  });

  it('trims a space-padded callsign and omits it when blank', () => {
    expect(
      parseSbsLine(buildLine({ 0: 'MSG', 1: '1', 4: 'a0b1c2', 10: '  ' }))?.callsign,
    ).toBeUndefined();
  });

  it('uppercases the hex ident', () => {
    expect(parseSbsLine(buildLine({ 0: 'MSG', 1: '1', 4: 'a0b1c2' }))?.icaoHex).toBe('A0B1C2');
  });
});

// Lines below are verbatim from a live dump1090-fa SBS/BaseStation capture,
// not hand-built, so field presence and formatting reflect what the wire
// format actually produces rather than what a synthetic test assumes.
describe('parseSbsLine - real dump1090-fa capture', () => {
  it('parses a real transmission type 1 (ident) line', () => {
    const update = parseSbsLine(
      'MSG,1,1,1,A03F84,1,2026/08/30,19:14:44.547,2026/08/30,19:14:44.621,RPA4500 ,,,,,,,,,,,0',
    );
    expect(update).toEqual({ icaoHex: 'A03F84', callsign: 'RPA4500', onGround: false });
  });

  it('parses a real transmission type 3 (airborne position) line', () => {
    const update = parseSbsLine(
      'MSG,3,1,1,89639D,1,2026/08/30,19:14:44.248,2026/08/30,19:14:44.300,,40000,,,43.12637,-70.59115,,,0,,0,0',
    );
    expect(update).toEqual({
      icaoHex: '89639D',
      baroAltitudeFt: 40000,
      lat: 43.12637,
      lon: -70.59115,
      onGround: false,
    });
  });

  it('parses a real transmission type 4 (airborne velocity) line', () => {
    const update = parseSbsLine(
      'MSG,4,1,1,4075C1,1,2026/08/30,19:14:44.382,2026/08/30,19:14:44.452,,,441,205,,,64,,,,,0',
    );
    expect(update).toEqual({
      icaoHex: '4075C1',
      groundSpeedKt: 441,
      trueTrackDeg: 205,
      verticalRateFtPerMin: 64,
      onGround: false,
    });
  });

  it('parses a real transmission type 6 (surveillance ID / squawk) line', () => {
    const update = parseSbsLine(
      'MSG,6,1,1,A262D4,1,2026/08/30,19:14:49.850,2026/08/30,19:14:49.912,,,,,,,,3543,0,0,0,',
    );
    expect(update).toEqual({ icaoHex: 'A262D4', squawk: '3543' });
  });
});
