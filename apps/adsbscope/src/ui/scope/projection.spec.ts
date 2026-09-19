import { describe, expect, it } from 'vitest';

import { createViewport, offsetByBearing, polarToScreen, SCOPE_MARGIN_REM } from './projection.js';
import { DEFAULT_PX_PER_REM } from './units.js';

const MARGIN_PX = SCOPE_MARGIN_REM * DEFAULT_PX_PER_REM;

describe('createViewport', () => {
  it('centers the scope and fits the range circle to the shorter dimension', () => {
    const viewport = createViewport(1000, 600, 60, DEFAULT_PX_PER_REM);

    expect(viewport.center).toEqual({ xPx: 500, yPx: 300 });
    expect(viewport.radiusPx).toBe(300 - MARGIN_PX);
    expect(viewport.pxPerNm).toBeCloseTo((300 - MARGIN_PX) / 60);
    expect(viewport.widthPx).toBe(1000);
    expect(viewport.heightPx).toBe(600);
    expect(viewport.pxPerRem).toBe(DEFAULT_PX_PER_REM);
  });

  it('fits to the width when the canvas is taller than it is wide, as on a phone in portrait', () => {
    expect(createViewport(400, 900, 40, DEFAULT_PX_PER_REM).radiusPx).toBe(200 - MARGIN_PX);
  });

  it('scales the margin with the root font size', () => {
    const viewport = createViewport(1000, 600, 60, 24);

    expect(viewport.radiusPx).toBe(300 - SCOPE_MARGIN_REM * 24);
    expect(viewport.pxPerRem).toBe(24);
  });

  it('never produces a negative radius for a tiny canvas', () => {
    expect(createViewport(10, 10, 60, DEFAULT_PX_PER_REM).radiusPx).toBe(1);
  });
});

describe('offsetByBearing', () => {
  const origin = { xPx: 100, yPx: 100 };

  it('moves up the canvas for north and down for south', () => {
    expect(offsetByBearing(origin, 0, 50).yPx).toBeCloseTo(50);
    expect(offsetByBearing(origin, 180, 50).yPx).toBeCloseTo(150);
    expect(offsetByBearing(origin, 0, 50).xPx).toBeCloseTo(100);
  });

  it('moves right for east and left for west', () => {
    expect(offsetByBearing(origin, 90, 50).xPx).toBeCloseTo(150);
    expect(offsetByBearing(origin, 270, 50).xPx).toBeCloseTo(50);
    expect(offsetByBearing(origin, 90, 50).yPx).toBeCloseTo(100);
  });
});

describe('polarToScreen', () => {
  const viewport = createViewport(600 + MARGIN_PX * 2, 600 + MARGIN_PX * 2, 60, DEFAULT_PX_PER_REM);

  it('places the receiver at the center', () => {
    expect(polarToScreen(viewport, { trueBearingDeg: 123, rangeNm: 0 })).toEqual(viewport.center);
  });

  it('scales range by the viewport and rotates by bearing', () => {
    const northEast = polarToScreen(viewport, { trueBearingDeg: 45, rangeNm: 60 });
    const edge = 300 * Math.SQRT1_2;

    expect(northEast.xPx).toBeCloseTo(viewport.center.xPx + edge);
    expect(northEast.yPx).toBeCloseTo(viewport.center.yPx - edge);
  });
});
