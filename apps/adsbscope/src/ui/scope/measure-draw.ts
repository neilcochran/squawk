import { FURNITURE_LINE_WIDTH_PX } from './furniture.js';
import { formatMeasureLabel } from './measure.js';
import type { MeasuredLine } from './measure.js';
import { polarToScreen } from './projection.js';
import type { ScopeViewport } from './projection.js';

/** Sizes of the range/bearing line's furniture, in rem, converted with the viewport's `pxPerRem` at draw time. */
export const MEASURE_LAYOUT_REM = {
  /** Distance from the middle of the line to the center of its label, measured square to the line. */
  labelOffset: 0.625,
} as const;

/**
 * Draws a range/bearing line between its two ends, with its bearing and
 * distance written beside the middle, on whichever side of the line is
 * nearer the top of the scope so the label never hangs below it. Shared by
 * every view style, so a line looks the same whichever style it was drawn
 * in.
 *
 * @param context - The canvas context, with its font already set.
 * @param color - The color of the line and its label.
 * @param viewport - The current viewport.
 * @param line - The line to draw.
 */
export function drawMeasureLine(
  context: CanvasRenderingContext2D,
  color: string,
  viewport: ScopeViewport,
  line: MeasuredLine,
): void {
  const from = polarToScreen(viewport, line.from);
  const to = polarToScreen(viewport, line.to);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = FURNITURE_LINE_WIDTH_PX;
  context.beginPath();
  context.moveTo(from.xPx, from.yPx);
  context.lineTo(to.xPx, to.yPx);
  context.stroke();

  const alongXPx = to.xPx - from.xPx;
  const alongYPx = to.yPx - from.yPx;
  const lengthPx = Math.hypot(alongXPx, alongYPx);
  let acrossX = 0;
  let acrossY = -1;
  if (lengthPx > 0) {
    acrossX = -alongYPx / lengthPx;
    acrossY = alongXPx / lengthPx;
    if (acrossY > 0) {
      acrossX = -acrossX;
      acrossY = -acrossY;
    }
  }
  const offsetPx = MEASURE_LAYOUT_REM.labelOffset * viewport.pxPerRem;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(
    formatMeasureLabel(line),
    (from.xPx + to.xPx) / 2 + acrossX * offsetPx,
    (from.yPx + to.yPx) / 2 + acrossY * offsetPx,
  );
}
