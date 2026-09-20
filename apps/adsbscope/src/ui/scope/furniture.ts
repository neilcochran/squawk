import { offsetByBearing } from './projection.js';
import type { ScopeViewport } from './projection.js';
import { ringRadiiNm } from './range.js';

/** Angle between compass rose ticks. */
export const COMPASS_TICK_STEP_DEG = 10;

/** Angle between labeled compass rose ticks. */
export const COMPASS_LABEL_STEP_DEG = 30;

/** Degrees in a full circle. */
export const FULL_CIRCLE_DEG = 360;

/** Radians in a full circle. */
export const FULL_CIRCLE_RAD = Math.PI * 2;

/** Stroke width of the scope's fixed lines. A hairline stays one CSS pixel at any scale. */
export const FURNITURE_LINE_WIDTH_PX = 1;

/**
 * Sizes of the scope's fixed furniture - range rings, compass rose, receiver
 * marker - in rem, converted with the viewport's `pxPerRem` at draw time.
 * Shared by every view style, so the furniture lines up exactly when the
 * style is switched.
 */
export const FURNITURE_LAYOUT_REM = {
  /** Horizontal gap between the north radial and a range ring's label. */
  ringLabelOffsetX: 0.25,
  /** Vertical gap between a range ring and its label, which sits just inside the ring. */
  ringLabelOffsetY: 0.1875,
  /** Length of an unlabeled compass tick. */
  compassTickLength: 0.25,
  /** Length of a labeled compass tick. */
  compassLabeledTickLength: 0.5,
  /** Distance from the range circle to the center of a compass label. */
  compassLabelOffset: 1.125,
  /** Half the width of the cross marking the receiver. */
  receiverMarkerHalfSize: 0.3125,
} as const;

/** The two colors the furniture is drawn in. */
export interface FurnitureColors {
  /** Lines: range rings and compass ticks. */
  line: string;
  /** Labels, and the receiver marker. */
  label: string;
}

/**
 * Formats a compass rose label: a three-digit heading, with north as `360`.
 *
 * @param headingDeg - Heading in whole degrees, 0-359.
 * @returns The zero-padded label.
 */
export function formatCompassLabel(headingDeg: number): string {
  return String(headingDeg === 0 ? FULL_CIRCLE_DEG : headingDeg).padStart(3, '0');
}

/**
 * Draws the range rings for the selected range, each labeled with its radius
 * in nautical miles just inside the ring on the north radial.
 *
 * @param context - The canvas context, with its font already set.
 * @param colors - Line and label colors.
 * @param viewport - The current viewport.
 * @param rangeNm - Nautical miles from the center to the range circle.
 */
export function drawRangeRings(
  context: CanvasRenderingContext2D,
  colors: FurnitureColors,
  viewport: ScopeViewport,
  rangeNm: number,
): void {
  const { center, pxPerNm, pxPerRem } = viewport;
  context.strokeStyle = colors.line;
  context.fillStyle = colors.label;
  context.lineWidth = FURNITURE_LINE_WIDTH_PX;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  for (const radiusNm of ringRadiiNm(rangeNm)) {
    const radiusPx = radiusNm * pxPerNm;
    context.beginPath();
    context.arc(center.xPx, center.yPx, radiusPx, 0, FULL_CIRCLE_RAD);
    context.stroke();
    context.fillText(
      String(radiusNm),
      center.xPx + FURNITURE_LAYOUT_REM.ringLabelOffsetX * pxPerRem,
      center.yPx - radiusPx + FURNITURE_LAYOUT_REM.ringLabelOffsetY * pxPerRem,
    );
  }
}

/**
 * Draws the compass rose around the range circle: a tick every
 * {@link COMPASS_TICK_STEP_DEG}, and a longer tick with a heading label every
 * {@link COMPASS_LABEL_STEP_DEG}, in degrees true.
 *
 * @param context - The canvas context, with its font already set.
 * @param colors - Line and label colors.
 * @param viewport - The current viewport.
 */
export function drawCompassRose(
  context: CanvasRenderingContext2D,
  colors: FurnitureColors,
  viewport: ScopeViewport,
): void {
  const { center, radiusPx, pxPerRem } = viewport;
  context.strokeStyle = colors.line;
  context.fillStyle = colors.label;
  context.lineWidth = FURNITURE_LINE_WIDTH_PX;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (let headingDeg = 0; headingDeg < FULL_CIRCLE_DEG; headingDeg += COMPASS_TICK_STEP_DEG) {
    const labeled = headingDeg % COMPASS_LABEL_STEP_DEG === 0;
    const tickLengthRem = labeled
      ? FURNITURE_LAYOUT_REM.compassLabeledTickLength
      : FURNITURE_LAYOUT_REM.compassTickLength;
    const inner = offsetByBearing(center, headingDeg, radiusPx);
    const outer = offsetByBearing(center, headingDeg, radiusPx + tickLengthRem * pxPerRem);
    context.beginPath();
    context.moveTo(inner.xPx, inner.yPx);
    context.lineTo(outer.xPx, outer.yPx);
    context.stroke();
    if (labeled) {
      const label = offsetByBearing(
        center,
        headingDeg,
        radiusPx + FURNITURE_LAYOUT_REM.compassLabelOffset * pxPerRem,
      );
      context.fillText(formatCompassLabel(headingDeg), label.xPx, label.yPx);
    }
  }
}

/**
 * Draws the cross marking the receiver at the center of the scope.
 *
 * @param context - The canvas context.
 * @param colors - Line and label colors; the marker uses the label color.
 * @param viewport - The current viewport.
 */
export function drawReceiverMarker(
  context: CanvasRenderingContext2D,
  colors: FurnitureColors,
  viewport: ScopeViewport,
): void {
  const { xPx, yPx } = viewport.center;
  const halfSizePx = FURNITURE_LAYOUT_REM.receiverMarkerHalfSize * viewport.pxPerRem;
  context.strokeStyle = colors.label;
  context.lineWidth = FURNITURE_LINE_WIDTH_PX;
  context.beginPath();
  context.moveTo(xPx - halfSizePx, yPx);
  context.lineTo(xPx + halfSizePx, yPx);
  context.moveTo(xPx, yPx - halfSizePx);
  context.lineTo(xPx, yPx + halfSizePx);
  context.stroke();
}

/**
 * Draws lines of text stacked upward from a baseline, left-aligned - the
 * shape of a data block, whose last line sits at the anchor.
 *
 * @param context - The canvas context, with its font and fill style already set.
 * @param lines - The lines, top first.
 * @param xPx - Left edge of the text.
 * @param bottomYPx - Bottom of the last line.
 * @param lineHeightPx - Height of one line.
 */
export function drawTextLines(
  context: CanvasRenderingContext2D,
  lines: readonly string[],
  xPx: number,
  bottomYPx: number,
  lineHeightPx: number,
): void {
  context.textAlign = 'left';
  context.textBaseline = 'bottom';
  lines.forEach((line, index) => {
    const linesBelow = lines.length - 1 - index;
    context.fillText(line, xPx, bottomYPx - linesBelow * lineHeightPx);
  });
}
