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
    const content = buildInspectContent(makeTarget({ icaoHex: 'c0ffee', lastSeenAt: NOW }), NOW);

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
      buildInspectContent(makeTarget({ callsign: 'UAL123', emergency: 'general' }), NOW).title,
    ).toBe('UAL123 EM');
  });

  it('describes an aircraft on the ground as such, with no vertical rate', () => {
    const content = buildInspectContent(
      makeTarget({ onGround: true, altitudeFt: 0, verticalRateFtPerMin: 0 }),
      NOW,
    );

    expect(valueOf(content, 'Altitude')).toBe('on the ground');
    expect(valueOf(content, 'Vertical')).toBeUndefined();
  });

  it('describes a descent with a minus sign, and a small rate either way as level', () => {
    const rate = (verticalRateFtPerMin: number): string | undefined =>
      valueOf(buildInspectContent(makeTarget({ verticalRateFtPerMin }), NOW), 'Vertical');

    expect(rate(-700)).toBe('-700 ft/min');
    expect(rate(LEVEL_FLIGHT_FT_PER_MIN)).toBe(`+${LEVEL_FLIGHT_FT_PER_MIN} ft/min`);
    expect(rate(LEVEL_FLIGHT_FT_PER_MIN - 1)).toBe('level');
    expect(rate(-(LEVEL_FLIGHT_FT_PER_MIN - 1))).toBe('level');
  });

  it('writes north as 360, and wraps a bearing that rounds up to it', () => {
    const track = (trueTrackDeg: number): string | undefined =>
      valueOf(buildInspectContent(makeTarget({ trueTrackDeg }), NOW), 'Track');

    expect(track(0)).toBe('360 true');
    expect(track(359.7)).toBe('360 true');
    expect(track(7.2)).toBe('007 true');
  });

  it('never reports a negative age when the clocks disagree', () => {
    const content = buildInspectContent(makeTarget({ lastSeenAt: NOW + 5000 }), NOW);

    expect(valueOf(content, 'Heard')).toBe('0 s ago');
  });
});
