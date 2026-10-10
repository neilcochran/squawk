import { describe, expect, it } from 'vitest';

import type { ScopeAirspace } from '../../shared/protocol.js';
import { makeTarget } from '../scope/test-utils.js';

import {
  buildInspectContent,
  LEVEL_FLIGHT_FT_PER_MIN,
  OUTSIDE_AIRSPACE,
  SQUAWK_ALERT_NOTE,
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
        category: 'light',
        altitudeFt: 4500,
        selectedAltitudeFt: 6000,
        groundSpeedKt: 1105,
        indicatedAirspeedKt: 105,
        trueAirspeedKt: 112,
        trueTrackDeg: 134.6,
        magneticHeadingDeg: 149.5,
        selectedHeadingDeg: 150,
        autopilot: { engaged: true, modes: ['altitudeHold', 'lnav'] },
        verticalRateFtPerMin: 1500,
        position: { trueBearingDeg: 44.6, rangeNm: 12.34 },
        airspace: [
          { kind: 'restricted', name: 'R-4001A BRUNSWICK' },
          { kind: 'classD', name: 'NHZ' },
        ],
        lastSeenAt: NOW - 3200,
      }),
      NOW,
      undefined,
    );

    expect(content.title).toBe('N409CC');
    expect(content.rows).toEqual([
      { label: 'ICAO hex', value: 'A4CE45' },
      { label: 'Model', value: 'PA-28-181 ARCHER III' },
      { label: 'Category', value: 'Light (under 15,500 lb)' },
      { label: 'Squawk', value: '1200' },
      { label: 'Altitude', value: '4,500 ft' },
      { label: 'Selected altitude', value: '6,000 ft' },
      { label: 'Vertical', value: '+1,500 ft/min' },
      { label: 'Ground speed', value: '1,105 kt' },
      { label: 'Airspeed', value: '105 kt indicated, 112 kt true' },
      { label: 'Track', value: '135 true' },
      { label: 'Heading', value: '150 magnetic' },
      { label: 'Selected heading', value: '150' },
      { label: 'Autopilot', value: 'on, altitude hold, LNAV' },
      { label: 'Position', value: '045 true, 12.3 nm' },
      { label: 'Airspace', value: 'R-4001A BRUNSWICK, Class D (NHZ)' },
      { label: 'Heard', value: '3 s ago' },
    ]);
  });

  it('writes each class by its airport, and reads outside for an aircraft in none', () => {
    const airspaceOf = (airspace: ScopeAirspace[]): string | undefined =>
      valueOf(buildInspectContent(makeTarget({ airspace }), NOW, undefined), 'Airspace');

    expect(airspaceOf([{ kind: 'classB', name: 'BOS' }])).toBe('Class B (BOS)');
    expect(
      airspaceOf([
        { kind: 'warning', name: 'W-102L LOW' },
        { kind: 'moa', name: 'YANKEE 1 MOA' },
        { kind: 'classC', name: 'PWM' },
      ]),
    ).toBe('W-102L LOW, YANKEE 1 MOA, Class C (PWM)');
    expect(airspaceOf([])).toBe(OUTSIDE_AIRSPACE);
  });

  it('writes Class A alone, since it has no airport to name', () => {
    const airspaceOf = (airspace: ScopeAirspace[]): string | undefined =>
      valueOf(buildInspectContent(makeTarget({ airspace }), NOW, undefined), 'Airspace');

    expect(airspaceOf([{ kind: 'classA', name: 'CLASS A' }])).toBe('Class A');
    expect(
      airspaceOf([
        { kind: 'warning', name: 'W-102H HIGH' },
        { kind: 'classA', name: 'CLASS A' },
      ]),
    ).toBe('W-102H HIGH, Class A');
  });

  it('has no airspace row for an aircraft that could not be placed', () => {
    expect(valueOf(buildInspectContent(makeTarget(), NOW, undefined), 'Airspace')).toBeUndefined();
  });

  it('notes a squawk that has just changed', () => {
    const changed = buildInspectContent(
      makeTarget({ squawk: '3543', squawkAlert: true }),
      NOW,
      undefined,
    );
    const settled = buildInspectContent(makeTarget({ squawk: '3543' }), NOW, undefined);

    expect(valueOf(changed, 'Squawk')).toBe(`3543, ${SQUAWK_ALERT_NOTE}`);
    expect(valueOf(settled, 'Squawk')).toBe('3543');
  });

  it('carries the ident code in the title', () => {
    expect(
      buildInspectContent(makeTarget({ callsign: 'UAL123', identActive: true }), NOW, undefined)
        .title,
    ).toBe('UAL123 ID');
  });

  it('has no category row for an aircraft that broadcasts none, or an unknown one', () => {
    expect(valueOf(buildInspectContent(makeTarget(), NOW, undefined), 'Category')).toBeUndefined();
    expect(
      valueOf(buildInspectContent(makeTarget({ category: 'unknown' }), NOW, undefined), 'Category'),
    ).toBeUndefined();
    expect(
      valueOf(buildInspectContent(makeTarget({ category: 'heavy' }), NOW, undefined), 'Category'),
    ).toBe('Heavy (over 300,000 lb)');
  });

  it('writes whichever airspeed the aircraft reports, and no row when it reports neither', () => {
    const airspeedOf = (overrides: Parameters<typeof makeTarget>[0]): string | undefined =>
      valueOf(buildInspectContent(makeTarget(overrides), NOW, undefined), 'Airspeed');

    expect(airspeedOf({ indicatedAirspeedKt: 259 })).toBe('259 kt indicated');
    expect(airspeedOf({ trueAirspeedKt: 472 })).toBe('472 kt true');
    expect(airspeedOf({})).toBeUndefined();
  });

  it('describes an autopilot that is off, and one on with no mode reported', () => {
    const autopilotOf = (engaged: boolean, modes: ('vnav' | 'approach')[]): string | undefined =>
      valueOf(
        buildInspectContent(makeTarget({ autopilot: { engaged, modes } }), NOW, undefined),
        'Autopilot',
      );

    expect(autopilotOf(false, [])).toBe('off');
    expect(autopilotOf(true, [])).toBe('on');
    expect(autopilotOf(true, ['vnav', 'approach'])).toBe('on, VNAV, approach');
    expect(valueOf(buildInspectContent(makeTarget(), NOW, undefined), 'Autopilot')).toBeUndefined();
  });

  it('writes the selected heading as a heading with no datum, and north as 360', () => {
    const heading = (selectedHeadingDeg: number): string | undefined =>
      valueOf(
        buildInspectContent(makeTarget({ selectedHeadingDeg }), NOW, undefined),
        'Selected heading',
      );

    expect(heading(227.8)).toBe('228');
    expect(heading(0)).toBe('360');
    expect(heading(7.2)).toBe('007');
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
