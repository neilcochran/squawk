import { describe, expect, it } from 'vitest';

import { FULL_CIRCLE_RAD, FURNITURE_LINE_WIDTH_PX } from './furniture.js';
import { drawHalo } from './halo.js';
import { createViewport } from './projection.js';
import { createRecordingContext } from './test-utils.js';
import { DEFAULT_PX_PER_REM } from './units.js';

describe('drawHalo', () => {
  const center = { xPx: 300, yPx: 200 };

  it('strokes a full circle around the target, as a hairline in the given color', () => {
    const viewport = createViewport(800, 600, 60, DEFAULT_PX_PER_REM);
    const recording = createRecordingContext();

    drawHalo(recording.context, '#4dd2ff', viewport, center, 3);

    expect(recording.callsTo('arc')).toEqual([
      expect.objectContaining({
        args: [center.xPx, center.yPx, 3 * viewport.pxPerNm, 0, FULL_CIRCLE_RAD],
      }),
    ]);
    expect(recording.callsTo('stroke')).toEqual([
      expect.objectContaining({ strokeStyle: '#4dd2ff', lineWidth: FURNITURE_LINE_WIDTH_PX }),
    ]);
  });

  it('follows the range: the same radius in miles is twice as wide at half the range', () => {
    const wide = createRecordingContext();
    const close = createRecordingContext();

    drawHalo(wide.context, '#ffffff', createViewport(800, 600, 60, DEFAULT_PX_PER_REM), center, 5);
    drawHalo(close.context, '#ffffff', createViewport(800, 600, 30, DEFAULT_PX_PER_REM), center, 5);

    expect(Number(close.callsTo('arc')[0]?.args[2])).toBeCloseTo(
      Number(wide.callsTo('arc')[0]?.args[2]) * 2,
    );
  });
});
