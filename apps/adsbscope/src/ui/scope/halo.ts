import { FULL_CIRCLE_RAD, FURNITURE_LINE_WIDTH_PX } from './furniture.js';
import type { ScopeViewport, ScreenPoint } from './projection.js';

/**
 * Draws a halo: a ring of a fixed radius in nautical miles around a target -
 * the J-ring of a real scope - for judging separation by eye. The radius goes
 * through the viewport's traffic scale, so the ring grows and shrinks with
 * the range, and the one drawing serves every view style so that it means
 * the same distance in each.
 *
 * @param context - The canvas context.
 * @param color - The ring's color.
 * @param viewport - The current viewport.
 * @param center - The target's position on the canvas.
 * @param radiusNm - The ring's radius in nautical miles.
 */
export function drawHalo(
  context: CanvasRenderingContext2D,
  color: string,
  viewport: ScopeViewport,
  center: ScreenPoint,
  radiusNm: number,
): void {
  context.strokeStyle = color;
  context.lineWidth = FURNITURE_LINE_WIDTH_PX;
  context.beginPath();
  context.arc(center.xPx, center.yPx, radiusNm * viewport.pxPerNm, 0, FULL_CIRCLE_RAD);
  context.stroke();
}
