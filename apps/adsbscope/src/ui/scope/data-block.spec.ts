import { describe, expect, it } from 'vitest';

import {
  formatAltitudeHundreds,
  formatDataBlock,
  formatGroundSpeedTens,
  verticalTrendMarker,
} from './data-block.js';
import { makeTarget } from './test-utils.js';

describe('formatAltitudeHundreds', () => {
  it('shows hundreds of feet, zero-padded to three digits', () => {
    expect(formatAltitudeHundreds(4500)).toBe('045');
    expect(formatAltitudeHundreds(35_000)).toBe('350');
    expect(formatAltitudeHundreds(949)).toBe('009');
    expect(formatAltitudeHundreds(950)).toBe('010');
  });

  it('clamps a negative altitude to zero and lets a very high one grow', () => {
    expect(formatAltitudeHundreds(-200)).toBe('000');
    expect(formatAltitudeHundreds(125_000)).toBe('1250');
  });
});

describe('formatGroundSpeedTens', () => {
  it('shows tens of knots, zero-padded to two digits', () => {
    expect(formatGroundSpeedTens(250)).toBe('25');
    expect(formatGroundSpeedTens(84)).toBe('08');
    expect(formatGroundSpeedTens(0)).toBe('00');
    expect(formatGroundSpeedTens(1200)).toBe('120');
  });
});

describe('verticalTrendMarker', () => {
  it('marks a climb and a descent beyond the threshold', () => {
    expect(verticalTrendMarker(1500)).toBe('^');
    expect(verticalTrendMarker(-1500)).toBe('v');
  });

  it('shows a space when level, within the threshold, or unknown', () => {
    expect(verticalTrendMarker(0)).toBe(' ');
    expect(verticalTrendMarker(300)).toBe(' ');
    expect(verticalTrendMarker(-300)).toBe(' ');
    expect(verticalTrendMarker(undefined)).toBe(' ');
  });
});

describe('formatDataBlock', () => {
  it('shows callsign over altitude, trend, and ground speed', () => {
    const target = makeTarget({
      callsign: 'UAL123 ',
      altitudeFt: 23_600,
      groundSpeedKt: 420,
      verticalRateFtPerMin: -1200,
    });

    expect(formatDataBlock(target)).toEqual(['UAL123', '236v42']);
  });

  it('falls back to the ICAO hex when there is no callsign or it is blank', () => {
    expect(formatDataBlock(makeTarget())[0]).toBe('A1B2C3');
    expect(formatDataBlock(makeTarget({ callsign: '   ' }))[0]).toBe('A1B2C3');
  });

  it('shows dashes for unknown altitude and ground speed', () => {
    expect(formatDataBlock(makeTarget())[1]).toBe('--- --');
  });

  it('shows GND for an aircraft on the ground, whatever altitude it reports', () => {
    const target = makeTarget({ onGround: true, altitudeFt: 75, groundSpeedKt: 14 });

    expect(formatDataBlock(target)[1]).toBe('GND 01');
  });
});
