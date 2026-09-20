import type { PolarPoint } from '../../shared/protocol.js';

/** A point on the canvas, in CSS pixels from its top-left corner. */
export interface ScreenPoint {
  /** Horizontal offset in CSS pixels, increasing to the right. */
  xPx: number;
  /** Vertical offset in CSS pixels, increasing downward. */
  yPx: number;
}

/** The mapping between the scope's polar coordinates and the canvas. North is up. */
export interface ScopeViewport {
  /** Canvas width in CSS pixels. */
  widthPx: number;
  /** Canvas height in CSS pixels. */
  heightPx: number;
  /** Where the receiver sits on the canvas. */
  center: ScreenPoint;
  /** Radius, in CSS pixels, of the circle at the scope's selected range. */
  radiusPx: number;
  /** Scale of the traffic: CSS pixels per nautical mile. */
  pxPerNm: number;
  /** Scale of the scope's own furniture and type: CSS pixels per rem. */
  pxPerRem: number;
}

/** Space kept clear between the range circle and the nearest canvas edge, for the compass labels. */
export const SCOPE_MARGIN_REM = 1.75;

/** The smallest range-circle radius ever produced, so a canvas too small to hold the margin still yields a valid scale. */
const MIN_RADIUS_PX = 1;

/**
 * Fits a scope of the given range into a canvas, centered, with the range
 * circle touching the shorter dimension (less {@link SCOPE_MARGIN_REM}), so
 * the whole scope stays visible at any size or orientation.
 *
 * @param widthPx - Canvas width in CSS pixels.
 * @param heightPx - Canvas height in CSS pixels.
 * @param rangeNm - Nautical miles from the center to the range circle.
 * @param pxPerRem - CSS pixels per rem.
 * @returns The viewport.
 */
export function createViewport(
  widthPx: number,
  heightPx: number,
  rangeNm: number,
  pxPerRem: number,
): ScopeViewport {
  const marginPx = SCOPE_MARGIN_REM * pxPerRem;
  const radiusPx = Math.max(MIN_RADIUS_PX, Math.min(widthPx, heightPx) / 2 - marginPx);
  return {
    widthPx,
    heightPx,
    center: { xPx: widthPx / 2, yPx: heightPx / 2 },
    radiusPx,
    pxPerNm: radiusPx / rangeNm,
    pxPerRem,
  };
}

/**
 * Moves a screen point along a true bearing.
 *
 * @param from - The starting point.
 * @param trueBearingDeg - Direction to move in, degrees true (0 is up the canvas, 90 is right).
 * @param distancePx - How far to move, in CSS pixels.
 * @returns The destination point.
 */
export function offsetByBearing(
  from: ScreenPoint,
  trueBearingDeg: number,
  distancePx: number,
): ScreenPoint {
  const radians = (trueBearingDeg * Math.PI) / 180;
  return {
    xPx: from.xPx + distancePx * Math.sin(radians),
    yPx: from.yPx - distancePx * Math.cos(radians),
  };
}

/**
 * Decides whether a point is worth drawing: on the canvas, give or take a
 * margin, so something whose label or tag trails in from just off-screen is
 * still drawn.
 *
 * @param viewport - The current viewport.
 * @param point - The canvas position to test.
 * @param marginPx - How far off any edge still counts, in CSS pixels.
 * @returns True if the point is on or near the canvas.
 */
export function isNearCanvas(
  viewport: ScopeViewport,
  point: ScreenPoint,
  marginPx: number,
): boolean {
  return (
    point.xPx >= -marginPx &&
    point.xPx <= viewport.widthPx + marginPx &&
    point.yPx >= -marginPx &&
    point.yPx <= viewport.heightPx + marginPx
  );
}

/**
 * Projects a receiver-relative polar point onto the canvas.
 *
 * @param viewport - The current viewport.
 * @param point - Bearing and range from the receiver.
 * @returns The point's canvas position.
 */
export function polarToScreen(viewport: ScopeViewport, point: PolarPoint): ScreenPoint {
  return offsetByBearing(viewport.center, point.trueBearingDeg, point.rangeNm * viewport.pxPerNm);
}
