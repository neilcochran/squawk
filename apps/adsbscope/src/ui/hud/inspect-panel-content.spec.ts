import { describe, expect, it } from 'vitest';

import { makeTarget } from '../scope/test-utils.js';

import {
  buildInspectContent,
  LEVEL_FLIGHT_FT_PER_MIN,
  UNKNOWN_VALUE,
} from './inspect-panel-content.js';
import type { InspectContent } from './inspect-panel-content.js';

const NOW = 1_000_000;

function valueOf(content: InspectContent, label: string): string | undefined {
  return content.rows.find((row) => row.label === label)?.value;
}

describe('buildInspectContent', () => {
  it('writes out everything a fully reporting aircraft has sent', () => {
    const content = buildInspectContent(
      makeTarget({
        icaoHex: 'a4ce45',
        callsign: 'N409CC ',
        squawk: '1200',
        aircraftModel: 'PA-28-181 ARCHER III',
        altitudeFt: 4500,
        groundSpeedKt: 1105,
        trueTrackDeg: 134.6,
        verticalRateFtPerMin: 1500,
        position: { trueBearingDeg: 44.6, rangeNm: 12.34 },
        lastSeenAt: NOW - 3200,
      }),
      NOW,
      undefined,
    );

    expect(content.title).toBe('N409CC');
    expect(content.rows).toEqual([
      { label: 'ICAO hex', value: 'A4CE45' },
      { label: 'Model', value: 'PA-28-181 ARCHER III' },
      { label: 'Squawk', value: '1200' },
      { label: 'Altitude', value: '4,500 ft' },
      { label: 'Vertical', value: '+1,500 ft/min' },
      { label: 'Speed', value: '1,105 kt' },
      { label: 'Track', value: '135 true' },
      { label: 'Position', value: '045 true, 12.3 nm' },
      { label: 'Heard', value: '3 s ago' },
    ]);
  });

  it('keeps its shape for an aircraft that has sent almost nothing', () => {
    const content = buildInspectContent(
      makeTarget({ icaoHex: 'c0ffee', lastSeenAt: NOW }),
      NOW,
      undefined,
    );

    expect(content.title).toBe('C0FFEE');
    expect(content.rows).toEqual([
      { label: 'ICAO hex', value: 'C0FFEE' },
      { label: 'Altitude', value: UNKNOWN_VALUE },
      { label: 'Position', value: 'not yet known' },
      { label: 'Heard', value: '0 s ago' },
    ]);
  });

  it('carries the emergency code in the title', () => {
    expect(
      buildInspectContent(makeTarget({ callsign: 'UAL123', emergency: 'general' }), NOW, undefined)
        .title,
    ).toBe('UAL123 EM');
  });

  it('describes an aircraft on the ground as such, with no vertical rate', () => {
    const content = buildInspectContent(
      makeTarget({ onGround: true, altitudeFt: 0, verticalRateFtPerMin: 0 }),
      NOW,
      undefined,
    );

    expect(valueOf(content, 'Altitude')).toBe('on the ground');
    expect(valueOf(content, 'Vertical')).toBeUndefined();
  });

  it('describes a descent with a minus sign, and a small rate either way as level', () => {
    const rate = (verticalRateFtPerMin: number): string | undefined =>
      valueOf(
        buildInspectContent(makeTarget({ verticalRateFtPerMin }), NOW, undefined),
        'Vertical',
      );

    expect(rate(-700)).toBe('-700 ft/min');
    expect(rate(LEVEL_FLIGHT_FT_PER_MIN)).toBe(`+${LEVEL_FLIGHT_FT_PER_MIN} ft/min`);
    expect(rate(LEVEL_FLIGHT_FT_PER_MIN - 1)).toBe('level');
    expect(rate(-(LEVEL_FLIGHT_FT_PER_MIN - 1))).toBe('level');
  });

  it('writes north as 360, and wraps a bearing that rounds up to it', () => {
    const track = (trueTrackDeg: number): string | undefined =>
      valueOf(buildInspectContent(makeTarget({ trueTrackDeg }), NOW, undefined), 'Track');

    expect(track(0)).toBe('360 true');
    expect(track(359.7)).toBe('360 true');
    expect(track(7.2)).toBe('007 true');
  });

  it('adds what the registry records about the aircraft, once it has loaded', () => {
    const content = buildInspectContent(makeTarget({ icaoHex: 'a4ce45' }), NOW, {
      icaoHex: 'A4CE45',
      registration: 'N409CC',
      make: 'PIPER AIRCRAFT INC',
      model: 'PA-28-181',
      operator: 'PAPPY AIR LLC',
      yearManufactured: 2023,
    });

    expect(content.rows.slice(0, 6)).toEqual([
      { label: 'ICAO hex', value: 'A4CE45' },
      { label: 'Registration', value: 'N409CC' },
      { label: 'Make', value: 'PIPER AIRCRAFT INC' },
      { label: 'Model', value: 'PA-28-181' },
      { label: 'Operator', value: 'PAPPY AIR LLC' },
      { label: 'Built', value: '2023' },
    ]);
  });

  it('shows only the registry fields that hold something, and prefers the model the snapshot carries', () => {
    const content = buildInspectContent(makeTarget({ aircraftModel: 'PA-28-181 ARCHER' }), NOW, {
      icaoHex: 'A1B2C3',
      registration: 'N1',
      model: 'PA-28-181',
    });

    expect(valueOf(content, 'Registration')).toBe('N1');
    expect(valueOf(content, 'Model')).toBe('PA-28-181 ARCHER');
    expect(valueOf(content, 'Make')).toBeUndefined();
    expect(valueOf(content, 'Operator')).toBeUndefined();
    expect(valueOf(content, 'Built')).toBeUndefined();
  });

  it('never reports a negative age when the clocks disagree', () => {
    const content = buildInspectContent(makeTarget({ lastSeenAt: NOW + 5000 }), NOW, undefined);

    expect(valueOf(content, 'Heard')).toBe('0 s ago');
  });
});
