import { describe, expect, it } from 'vitest';

import {
  ROUTE_FRAME_BASE_PADDING_PX,
  routeBounds,
  routeFramePadding,
} from './plan-route-framing.ts';

describe('routeBounds', () => {
  it('returns undefined for a route with no points', () => {
    expect(routeBounds([])).toBeUndefined();
  });

  it('collapses to the point for a single-point route', () => {
    expect(routeBounds([{ label: 'KBOS', lat: 42.36, lon: -71.01 }])).toEqual([
      [-71.01, 42.36],
      [-71.01, 42.36],
    ]);
  });

  it('spans every point of the route', () => {
    expect(
      routeBounds([
        { label: 'KBOS', lat: 42.36, lon: -71.01 },
        { label: 'MERIT', lat: 41.38, lon: -73.14 },
        { label: 'KJFK', lat: 40.64, lon: -73.78 },
      ]),
    ).toEqual([
      [-73.78, 40.64],
      [-71.01, 42.36],
    ]);
  });

  it('keeps a route across the antimeridian a narrow box rather than the whole globe', () => {
    const bounds = routeBounds([
      { label: 'PADK', lat: 51.88, lon: -176.65 },
      { label: 'PASY', lat: 52.71, lon: 174.11 },
    ]);
    assertBounds(bounds);
    const [[west], [east]] = bounds;
    expect(east - west).toBeCloseTo(9.24, 2);
    expect(east).toBeCloseTo(-176.65, 2);
    expect(west).toBeCloseTo(-185.89, 2);
  });
});

describe('routeFramePadding', () => {
  const base = ROUTE_FRAME_BASE_PADDING_PX;

  it('clears the side panel on the right and the input bar on top at the desktop layout', () => {
    expect(
      routeFramePadding({
        desktop: true,
        sidePanelWidthPx: 400,
        sheetHeightPx: 280,
        topInsetPx: 56,
      }),
    ).toEqual({ top: 56 + base, right: 400 + base, bottom: base, left: base });
  });

  it('clears the bottom sheet instead of the side panel on a phone', () => {
    expect(
      routeFramePadding({
        desktop: false,
        sidePanelWidthPx: 400,
        sheetHeightPx: 280,
        topInsetPx: 64,
      }),
    ).toEqual({ top: 64 + base, right: base, bottom: 280 + base, left: base });
  });
});

function assertBounds(
  bounds: ReturnType<typeof routeBounds>,
): asserts bounds is NonNullable<ReturnType<typeof routeBounds>> {
  if (bounds === undefined) {
    throw new Error('expected bounds');
  }
}
