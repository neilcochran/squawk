import { describe, expect, it } from 'vitest';

import {
  drawCompassRose,
  drawRangeRings,
  drawReceiverMarker,
  drawTextLines,
  formatCompassLabel,
  FULL_CIRCLE_RAD,
  FURNITURE_LAYOUT_REM,
} from './furniture.js';
import type { FurnitureColors } from './furniture.js';
import { createViewport } from './projection.js';
import { createRecordingContext } from './test-utils.js';
import { DEFAULT_PX_PER_REM } from './units.js';

const COLORS: FurnitureColors = { line: '#111111', label: '#222222' };
const VIEWPORT = createViewport(800, 600, 60, DEFAULT_PX_PER_REM);

describe('formatCompassLabel', () => {
  it('pads headings to three digits and shows north as 360', () => {
    expect(formatCompassLabel(0)).toBe('360');
    expect(formatCompassLabel(30)).toBe('030');
    expect(formatCompassLabel(270)).toBe('270');
  });
});

describe('drawRangeRings', () => {
  it('draws one labeled full circle per ring, out to the range circle', () => {
    const recording = createRecordingContext();

    drawRangeRings(recording.context, COLORS, VIEWPORT, 60);

    const arcs = recording.callsTo('arc');
    expect(arcs).toHaveLength(6);
    expect(arcs.every((call) => call.args[4] === FULL_CIRCLE_RAD)).toBe(true);
    expect(Number(arcs.at(-1)?.args[2])).toBeCloseTo(VIEWPORT.radiusPx);
    expect(arcs[0]?.strokeStyle).toBe(COLORS.line);
    expect(recording.texts()).toEqual(['10', '20', '30', '40', '50', '60']);
    expect(recording.callsTo('fillText')[0]?.fillStyle).toBe(COLORS.label);
  });

  it('places each label just inside its ring, beside the north radial', () => {
    const recording = createRecordingContext();

    drawRangeRings(recording.context, COLORS, VIEWPORT, 60);

    const firstLabel = recording.callsTo('fillText')[0];
    const firstRingRadiusPx = 10 * VIEWPORT.pxPerNm;
    expect(Number(firstLabel?.args[1])).toBeCloseTo(
      VIEWPORT.center.xPx + FURNITURE_LAYOUT_REM.ringLabelOffsetX * DEFAULT_PX_PER_REM,
    );
    expect(Number(firstLabel?.args[2])).toBeCloseTo(
      VIEWPORT.center.yPx -
        firstRingRadiusPx +
        FURNITURE_LAYOUT_REM.ringLabelOffsetY * DEFAULT_PX_PER_REM,
    );
  });
});

describe('drawCompassRose', () => {
  it('draws a tick every 10 degrees and a label every 30', () => {
    const recording = createRecordingContext();

    drawCompassRose(recording.context, COLORS, VIEWPORT);

    expect(recording.callsTo('stroke')).toHaveLength(36);
    expect(recording.texts()).toHaveLength(12);
    expect(recording.texts()).toEqual(expect.arrayContaining(['360', '030', '090', '180', '330']));
    expect(recording.texts()).not.toContain('010');
  });

  it('draws labeled ticks longer than unlabeled ones', () => {
    const recording = createRecordingContext();

    drawCompassRose(recording.context, COLORS, VIEWPORT);

    const tickEnds = recording.callsTo('lineTo');
    const northTipY = Number(tickEnds[0]?.args[1]);
    const tenDegreeTip = tickEnds[1];
    const northLengthPx = VIEWPORT.center.yPx - VIEWPORT.radiusPx - northTipY;
    const tenDegreeLengthPx =
      Math.hypot(
        Number(tenDegreeTip?.args[0]) - VIEWPORT.center.xPx,
        Number(tenDegreeTip?.args[1]) - VIEWPORT.center.yPx,
      ) - VIEWPORT.radiusPx;
    expect(northLengthPx).toBeCloseTo(
      FURNITURE_LAYOUT_REM.compassLabeledTickLength * DEFAULT_PX_PER_REM,
    );
    expect(tenDegreeLengthPx).toBeCloseTo(
      FURNITURE_LAYOUT_REM.compassTickLength * DEFAULT_PX_PER_REM,
    );
  });
});

describe('drawReceiverMarker', () => {
  it('draws a cross centered on the receiver in the label color', () => {
    const recording = createRecordingContext();

    drawReceiverMarker(recording.context, COLORS, VIEWPORT);

    const halfPx = FURNITURE_LAYOUT_REM.receiverMarkerHalfSize * DEFAULT_PX_PER_REM;
    expect(recording.callsTo('moveTo').map((call) => call.args)).toEqual([
      [VIEWPORT.center.xPx - halfPx, VIEWPORT.center.yPx],
      [VIEWPORT.center.xPx, VIEWPORT.center.yPx - halfPx],
    ]);
    expect(recording.callsTo('stroke')[0]?.strokeStyle).toBe(COLORS.label);
  });
});

describe('drawTextLines', () => {
  it('stacks lines upward so the last sits on the baseline', () => {
    const recording = createRecordingContext();

    drawTextLines(recording.context, ['UAL123', '120 30', 'B738'], 100, 200, 14);

    expect(recording.callsTo('fillText').map((call) => call.args)).toEqual([
      ['UAL123', 100, 172],
      ['120 30', 100, 186],
      ['B738', 100, 200],
    ]);
    expect(recording.context.textAlign).toBe('left');
    expect(recording.context.textBaseline).toBe('bottom');
  });

  it('draws nothing for no lines', () => {
    const recording = createRecordingContext();

    drawTextLines(recording.context, [], 100, 200, 14);

    expect(recording.callsTo('fillText')).toHaveLength(0);
  });
});
