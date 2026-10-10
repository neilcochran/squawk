import { describe, expect, it } from 'vitest';

import { FURNITURE_LINE_WIDTH_PX } from './furniture.js';
import { drawMeasureLine, MEASURE_LAYOUT_REM } from './measure-draw.js';
import type { MeasuredLine } from './measure.js';
import { createViewport, polarToScreen } from './projection.js';
import { createRecordingContext } from './test-utils.js';
import { DEFAULT_PX_PER_REM } from './units.js';

const VIEWPORT = createViewport(800, 600, 60, DEFAULT_PX_PER_REM);

function lineOf(from: MeasuredLine['from'], to: MeasuredLine['to']): MeasuredLine {
  return { from, to, trueBearingDeg: 47.4, distanceNm: 12.34 };
}

describe('drawMeasureLine', () => {
  it('strokes a hairline between the two ends, in the given color', () => {
    const line = lineOf({ trueBearingDeg: 0, rangeNm: 10 }, { trueBearingDeg: 90, rangeNm: 10 });
    const recording = createRecordingContext();

    drawMeasureLine(recording.context, '#e6d98a', VIEWPORT, line);

    const from = polarToScreen(VIEWPORT, line.from);
    const to = polarToScreen(VIEWPORT, line.to);
    expect(recording.callsTo('moveTo')[0]?.args).toEqual([from.xPx, from.yPx]);
    expect(recording.callsTo('lineTo')[0]?.args).toEqual([to.xPx, to.yPx]);
    expect(recording.callsTo('stroke')[0]).toMatchObject({
      strokeStyle: '#e6d98a',
      lineWidth: FURNITURE_LINE_WIDTH_PX,
    });
  });

  it('labels the middle of the line with its bearing and distance, on the upper side', () => {
    const line = lineOf({ trueBearingDeg: 270, rangeNm: 10 }, { trueBearingDeg: 90, rangeNm: 10 });
    const recording = createRecordingContext();

    drawMeasureLine(recording.context, '#e6d98a', VIEWPORT, line);

    const label = recording.callsTo('fillText')[0];
    expect(label?.args[0]).toBe('047/12.3');
    expect(label?.fillStyle).toBe('#e6d98a');
    expect(Number(label?.args[1])).toBeCloseTo(VIEWPORT.center.xPx);
    expect(Number(label?.args[2])).toBeCloseTo(
      VIEWPORT.center.yPx - MEASURE_LAYOUT_REM.labelOffset * DEFAULT_PX_PER_REM,
    );
  });

  it('keeps the label above the line whichever way the line was drawn', () => {
    const westToEast = createRecordingContext();
    const eastToWest = createRecordingContext();

    drawMeasureLine(
      westToEast.context,
      '#ffffff',
      VIEWPORT,
      lineOf({ trueBearingDeg: 270, rangeNm: 10 }, { trueBearingDeg: 90, rangeNm: 10 }),
    );
    drawMeasureLine(
      eastToWest.context,
      '#ffffff',
      VIEWPORT,
      lineOf({ trueBearingDeg: 90, rangeNm: 10 }, { trueBearingDeg: 270, rangeNm: 10 }),
    );

    expect(westToEast.callsTo('fillText')[0]?.args[2]).toBe(
      eastToWest.callsTo('fillText')[0]?.args[2],
    );
  });

  it('labels a line of no length straight above its point', () => {
    const point = { trueBearingDeg: 45, rangeNm: 20 };
    const recording = createRecordingContext();

    drawMeasureLine(recording.context, '#ffffff', VIEWPORT, lineOf(point, point));

    const at = polarToScreen(VIEWPORT, point);
    const label = recording.callsTo('fillText')[0];
    expect(Number(label?.args[1])).toBeCloseTo(at.xPx);
    expect(Number(label?.args[2])).toBeCloseTo(
      at.yPx - MEASURE_LAYOUT_REM.labelOffset * DEFAULT_PX_PER_REM,
    );
  });
});
