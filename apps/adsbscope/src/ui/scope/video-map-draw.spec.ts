import { describe, expect, it } from 'vitest';

import type { ScopeVideoMap } from '../../shared/protocol.js';

import { FULL_CIRCLE_RAD } from './furniture.js';
import { createViewport, polarToScreen } from './projection.js';
import { createRecordingContext } from './test-utils.js';
import type { RecordingContext } from './test-utils.js';
import { DEFAULT_PX_PER_REM } from './units.js';
import {
  AIRSPACE_LINE_WIDTH_PX,
  drawVideoMap,
  RUNWAY_LINE_WIDTH_PX,
  VIDEO_MAP_LAYOUT_REM,
  VIDEO_MAP_POINT_KINDS_BY_DETAIL,
} from './video-map-draw.js';
import type { VideoMapColors, VideoMapDetail } from './video-map-draw.js';

const COLORS: VideoMapColors = {
  airspace: {
    classB: '#11111b',
    classC: '#11111c',
    classD: '#11111d',
    specialUse: '#11111e',
  },
  feature: '#222222',
  label: '#333333',
};
const VIEWPORT = createViewport(800, 600, 60, DEFAULT_PX_PER_REM);
const EMPTY: ScopeVideoMap = { rangeNm: 60, points: [], lines: [] };

function draw(map: ScopeVideoMap, detail: VideoMapDetail = 'full'): RecordingContext {
  const recording = createRecordingContext();
  drawVideoMap(recording.context, COLORS, VIEWPORT, map, detail);
  return recording;
}

describe('drawVideoMap', () => {
  it('draws no lines, symbols, or labels for an empty map', () => {
    const recording = draw(EMPTY);

    expect(recording.callsTo('lineTo')).toHaveLength(0);
    expect(recording.callsTo('arc')).toHaveLength(0);
    expect(recording.callsTo('fillText')).toHaveLength(0);
  });

  it('strokes all boundaries of a class as one path, ahead of the runways', () => {
    const map: ScopeVideoMap = {
      ...EMPTY,
      lines: [
        {
          kind: 'runway',
          points: [
            [10, 5],
            [12, 5],
          ],
        },
        {
          kind: 'airspace',
          airspaceClass: 'classC',
          points: [
            [0, 10],
            [90, 10],
            [0, 10],
          ],
        },
        {
          kind: 'airspace',
          airspaceClass: 'classC',
          points: [
            [180, 20],
            [270, 20],
          ],
        },
      ],
    };

    const recording = draw(map);

    const strokes = recording.callsTo('stroke');
    expect(strokes.map((stroke) => stroke.strokeStyle)).toEqual([
      COLORS.airspace.classC,
      COLORS.feature,
      COLORS.feature,
    ]);
    const firstStroke = recording.calls.findIndex((call) => call.method === 'stroke');
    const boundaryPath = recording.calls.slice(0, firstStroke);
    expect(boundaryPath.filter((call) => call.method === 'beginPath')).toHaveLength(1);
    expect(boundaryPath.filter((call) => call.method === 'moveTo')).toHaveLength(2);
    expect(boundaryPath.filter((call) => call.method === 'lineTo')).toHaveLength(3);
  });

  it('colors each class of airspace separately, the most significant drawn last', () => {
    const points: [number, number][] = [
      [0, 10],
      [90, 10],
    ];
    const recording = draw({
      ...EMPTY,
      lines: [
        { kind: 'airspace', airspaceClass: 'classB', points },
        { kind: 'airspace', airspaceClass: 'classD', points },
        { kind: 'airspace', airspaceClass: 'specialUse', points },
        { kind: 'airspace', airspaceClass: 'classC', points },
      ],
    });

    const boundaryStrokes = recording.callsTo('stroke').slice(0, 4);
    expect(boundaryStrokes.map((stroke) => stroke.strokeStyle)).toEqual([
      COLORS.airspace.specialUse,
      COLORS.airspace.classD,
      COLORS.airspace.classC,
      COLORS.airspace.classB,
    ]);
  });

  it('dashes airspace boundaries, so they never read as range rings, and nothing else', () => {
    const recording = draw({
      ...EMPTY,
      lines: [
        {
          kind: 'airspace',
          airspaceClass: 'classD',
          points: [
            [0, 10],
            [90, 10],
          ],
        },
        {
          kind: 'runway',
          points: [
            [10, 5],
            [12, 5],
          ],
        },
      ],
    });

    const dashes = recording.callsTo('setLineDash');
    expect(dashes.map((call) => call.args[0])).toEqual([
      [
        VIDEO_MAP_LAYOUT_REM.airspaceDash * DEFAULT_PX_PER_REM,
        VIDEO_MAP_LAYOUT_REM.airspaceDashGap * DEFAULT_PX_PER_REM,
      ],
      [],
    ]);
    const indexOf = (method: string, nth: number): number =>
      recording.calls
        .map((call, index) => (call.method === method ? index : -1))
        .filter((index) => index >= 0)[nth] ?? -1;
    expect(indexOf('setLineDash', 0)).toBeLessThan(indexOf('stroke', 0));
    expect(indexOf('stroke', 0)).toBeLessThan(indexOf('setLineDash', 1));
    expect(indexOf('setLineDash', 1)).toBeLessThan(indexOf('stroke', 1));
  });

  it('projects line vertices from their bearing and range', () => {
    const recording = draw({
      ...EMPTY,
      lines: [
        {
          kind: 'airspace',
          airspaceClass: 'classB',
          points: [
            [90, 30],
            [180, 30],
          ],
        },
      ],
    });

    const east = polarToScreen(VIEWPORT, { trueBearingDeg: 90, rangeNm: 30 });
    const south = polarToScreen(VIEWPORT, { trueBearingDeg: 180, rangeNm: 30 });
    expect(recording.callsTo('moveTo')[0]?.args).toEqual([east.xPx, east.yPx]);
    expect(recording.callsTo('lineTo')[0]?.args).toEqual([south.xPx, south.yPx]);
  });

  it('draws runways heavier than boundaries', () => {
    expect(RUNWAY_LINE_WIDTH_PX).toBeGreaterThan(AIRSPACE_LINE_WIDTH_PX);
  });

  it('marks an airport with a ring, a navaid with a diamond, and a fix with a triangle', () => {
    const position = { trueBearingDeg: 90, rangeNm: 20 };
    const at = polarToScreen(VIEWPORT, position);

    const airport = draw({ ...EMPTY, points: [{ kind: 'airport', label: 'KTST', position }] });
    const navaid = draw({ ...EMPTY, points: [{ kind: 'navaid', label: 'TST', position }] });
    const fix = draw({ ...EMPTY, points: [{ kind: 'fix', label: 'TESTS', position }] });

    const ring = airport.callsTo('arc')[0];
    expect(ring?.args.slice(0, 3)).toEqual([
      at.xPx,
      at.yPx,
      VIDEO_MAP_LAYOUT_REM.airportRadius * DEFAULT_PX_PER_REM,
    ]);
    expect(ring?.args[4]).toBe(FULL_CIRCLE_RAD);
    expect(navaid.callsTo('lineTo')).toHaveLength(3);
    expect(navaid.callsTo('closePath')).toHaveLength(1);
    expect(fix.callsTo('lineTo')).toHaveLength(2);
    expect(fix.callsTo('closePath')).toHaveLength(1);
    expect(navaid.callsTo('stroke').at(-1)?.strokeStyle).toBe(COLORS.feature);
  });

  it('draws only airports on the basic map, and navaids and fixes too on the full one', () => {
    const map: ScopeVideoMap = {
      ...EMPTY,
      points: [
        { kind: 'airport', label: 'KTST', position: { trueBearingDeg: 0, rangeNm: 10 } },
        { kind: 'navaid', label: 'TST', position: { trueBearingDeg: 90, rangeNm: 10 } },
        { kind: 'fix', label: 'TESTS', position: { trueBearingDeg: 180, rangeNm: 10 } },
      ],
    };

    const basic = draw(map, 'basic');
    const full = draw(map, 'full');

    expect(VIDEO_MAP_POINT_KINDS_BY_DETAIL.basic).toEqual(['airport']);
    expect(basic.texts()).toEqual(['KTST']);
    expect(basic.callsTo('closePath')).toHaveLength(0);
    expect(full.texts()).toEqual(['KTST', 'TST', 'TESTS']);
    expect(full.callsTo('closePath')).toHaveLength(2);
  });

  it('labels a feature below and to the right of it, in the label color', () => {
    const position = { trueBearingDeg: 90, rangeNm: 20 };
    const at = polarToScreen(VIEWPORT, position);

    const recording = draw({ ...EMPTY, points: [{ kind: 'navaid', label: 'ENE', position }] });

    const label = recording.callsTo('fillText')[0];
    expect(label?.args).toEqual([
      'ENE',
      at.xPx + VIDEO_MAP_LAYOUT_REM.labelOffsetX * DEFAULT_PX_PER_REM,
      at.yPx + VIDEO_MAP_LAYOUT_REM.labelOffsetY * DEFAULT_PX_PER_REM,
    ]);
    expect(label?.fillStyle).toBe(COLORS.label);
    expect(recording.context.textBaseline).toBe('top');
  });

  it('draws a feature sent without a label as a bare symbol', () => {
    const recording = draw({
      ...EMPTY,
      points: [{ kind: 'fix', position: { trueBearingDeg: 90, rangeNm: 20 } }],
    });

    expect(recording.callsTo('closePath')).toHaveLength(1);
    expect(recording.callsTo('fillText')).toHaveLength(0);
  });

  it('labels an outlined airport but draws no stand-in symbol for it', () => {
    const recording = draw({
      ...EMPTY,
      points: [
        {
          kind: 'airport',
          label: 'KPWM',
          position: { trueBearingDeg: 90, rangeNm: 5 },
          outlined: true,
        },
      ],
    });

    expect(recording.callsTo('arc')).toHaveLength(0);
    expect(recording.texts()).toEqual(['KPWM']);
  });

  it('skips point features that are off the canvas', () => {
    const recording = draw({
      ...EMPTY,
      points: [
        { kind: 'fix', label: 'NEARR', position: { trueBearingDeg: 0, rangeNm: 10 } },
        { kind: 'fix', label: 'FARRR', position: { trueBearingDeg: 0, rangeNm: 500 } },
      ],
    });

    expect(recording.texts()).toEqual(['NEARR']);
  });

  it('scales its symbols and dashes with the root font size', () => {
    const position = { trueBearingDeg: 90, rangeNm: 20 };
    const recording = createRecordingContext();

    drawVideoMap(
      recording.context,
      COLORS,
      createViewport(800, 600, 60, 32),
      { ...EMPTY, points: [{ kind: 'airport', label: 'KTST', position }] },
      'basic',
    );

    expect(recording.callsTo('arc')[0]?.args[2]).toBe(VIDEO_MAP_LAYOUT_REM.airportRadius * 32);
    expect(recording.callsTo('setLineDash')[0]?.args[0]).toEqual([
      VIDEO_MAP_LAYOUT_REM.airspaceDash * 32,
      VIDEO_MAP_LAYOUT_REM.airspaceDashGap * 32,
    ]);
  });
});
