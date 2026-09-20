import { describe, expect, it } from 'vitest';

import {
  DATA_BLOCK_MODEL_MAX_CHARS,
  formatAlternateDataBlock,
  formatAltitudeHundreds,
  formatDataBlock,
  formatGroundSpeedTens,
  isTimeShareAlternate,
  TIME_SHARE_ALTERNATE_MS,
  TIME_SHARE_CYCLE_MS,
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

describe('emergency codes', () => {
  it('follows the identity with the emergency code, in both the usual and the alternate block', () => {
    const target = makeTarget({
      callsign: 'UAL123',
      emergency: 'general',
      aircraftModel: '737-8H4',
    });

    expect(formatDataBlock(target)[0]).toBe('UAL123 EM');
    expect(formatAlternateDataBlock(target)?.[0]).toBe('UAL123 EM');
    expect(formatDataBlock(makeTarget({ emergency: 'radioFailure' }))[0]).toBe('A1B2C3 RF');
  });

  it('adds nothing to the identity of an aircraft that is not in an emergency', () => {
    expect(formatDataBlock(makeTarget({ callsign: 'UAL123' }))[0]).toBe('UAL123');
  });
});

describe('formatAlternateDataBlock', () => {
  it('shows the registered model under the same first line', () => {
    const target = makeTarget({ callsign: 'N409CC ', aircraftModel: 'PA-28-181' });

    expect(formatAlternateDataBlock(target)).toEqual(['N409CC', 'PA-28-181']);
    expect(formatAlternateDataBlock(target)?.[0]).toBe(formatDataBlock(target)[0]);
  });

  it('identifies the aircraft by its ICAO hex until it has sent a callsign', () => {
    expect(formatAlternateDataBlock(makeTarget({ aircraftModel: 'SR22' }))).toEqual([
      'A1B2C3',
      'SR22',
    ]);
  });

  it('shows a model up to the limit whole, and cuts a longer one, without a trailing space', () => {
    const modelOf = (aircraftModel: string): string | undefined =>
      formatAlternateDataBlock(makeTarget({ aircraftModel }))?.[1];

    expect(modelOf('BD-100-1A10')).toBe('BD-100-1A10');
    expect(modelOf('CL-600-2C10X')).toBe('CL-600-2C10X');
    expect(modelOf('GULFSTREAM G280')).toBe('GULFSTREAM G');
    expect(modelOf('GULFSTREAM G280')?.length).toBe(DATA_BLOCK_MODEL_MAX_CHARS);
    expect(modelOf('ERJ 170-200 LR')).toBe('ERJ 170-200');
    expect(modelOf('FALCON 2000 EX')).toBe('FALCON 2000');
  });

  it('has nothing to show for an aircraft whose model is not known', () => {
    expect(formatAlternateDataBlock(makeTarget())).toBeUndefined();
  });
});

describe('isTimeShareAlternate', () => {
  it('shows the usual line for the first part of each cycle and the alternate for the rest', () => {
    const switchAtMs = TIME_SHARE_CYCLE_MS - TIME_SHARE_ALTERNATE_MS;

    expect(isTimeShareAlternate(0)).toBe(false);
    expect(isTimeShareAlternate(switchAtMs - 1)).toBe(false);
    expect(isTimeShareAlternate(switchAtMs)).toBe(true);
    expect(isTimeShareAlternate(TIME_SHARE_CYCLE_MS - 1)).toBe(true);
  });

  it('repeats every cycle, and shows the usual line for longer than the alternate', () => {
    expect(isTimeShareAlternate(TIME_SHARE_CYCLE_MS)).toBe(false);
    expect(isTimeShareAlternate(TIME_SHARE_CYCLE_MS * 7 - 1)).toBe(true);
    expect(TIME_SHARE_ALTERNATE_MS).toBeLessThan(TIME_SHARE_CYCLE_MS / 2);
  });
});
