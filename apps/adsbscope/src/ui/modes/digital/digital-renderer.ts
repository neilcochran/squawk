import type { ScopeSnapshot, ScopeTarget } from '../../../shared/protocol.js';
import { formatDataBlock } from '../../scope/data-block.js';
import { offsetByBearing, polarToScreen } from '../../scope/projection.js';
import type { ScopeViewport, ScreenPoint } from '../../scope/projection.js';
import { ringRadiiNm } from '../../scope/range.js';
import type { ScopeFrame, ScopeRenderer } from '../../scope/renderer.js';
import { canvasFont } from '../../styles/theme.js';
import type { ScopeCanvasPalette, ScopeTheme } from '../../styles/theme.js';

/** How long a target may go unheard, as of its snapshot, before it is drawn dimmed as coasting. */
export const COASTING_AFTER_MS = 15_000;

/** How far ahead, in minutes of flight at the current ground speed, the velocity vector reaches. */
export const VECTOR_MINUTES = 1;

/** Angle between compass rose ticks. */
export const COMPASS_TICK_STEP_DEG = 10;

/** Angle between labeled compass rose ticks. */
export const COMPASS_LABEL_STEP_DEG = 30;

/** Direction the leader line runs from a target's symbol to its data block. */
export const LEADER_BEARING_DEG = 45;

/**
 * Sizes of the digital scope's furniture and target symbology, in rem. They
 * are converted to pixels with the viewport's `pxPerRem` at draw time, so the
 * whole scope scales with the root font size rather than being pinned to one
 * pixel density or one user's font-size setting.
 */
export const DIGITAL_LAYOUT_REM = {
  /** How far off any canvas edge a target may sit and still be drawn, so its data block can trail in from just off-screen. */
  offscreenMargin: 2.5,
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
  /** Half the side of a target's square position symbol. */
  symbolHalfSize: 0.1875,
  /** Radius of a history trail dot. */
  historyDotRadius: 0.125,
  /** Gap between the symbol's edge and the start of the leader line. */
  leaderGap: 0.1875,
  /** Distance from the symbol's center to the end of the leader line. */
  leaderLength: 1.625,
  /** Gap between the end of the leader line and the data block's text. */
  dataBlockOffsetX: 0.1875,
  /** Height of one data block line. */
  dataBlockLineHeight: 0.875,
} as const;

/** Stroke width of every line on the scope. A hairline stays one CSS pixel at any scale. */
const LINE_WIDTH_PX = 1;
const FULL_CIRCLE_RAD = Math.PI * 2;
const FULL_CIRCLE_DEG = 360;
const MINUTES_PER_HOUR = 60;

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
 * Decides whether a point is worth drawing: inside the canvas, give or take
 * the layout's off-screen margin.
 *
 * @param viewport - The current viewport.
 * @param point - The canvas position to test.
 * @returns True if the point is on or near the canvas.
 */
export function isNearCanvas(viewport: ScopeViewport, point: ScreenPoint): boolean {
  const marginPx = DIGITAL_LAYOUT_REM.offscreenMargin * viewport.pxPerRem;
  return (
    point.xPx >= -marginPx &&
    point.xPx <= viewport.widthPx + marginPx &&
    point.yPx >= -marginPx &&
    point.yPx <= viewport.heightPx + marginPx
  );
}

function drawRangeRings(
  context: CanvasRenderingContext2D,
  palette: ScopeCanvasPalette,
  viewport: ScopeViewport,
  rangeNm: number,
): void {
  const { center, pxPerNm, pxPerRem } = viewport;
  context.strokeStyle = palette.map;
  context.fillStyle = palette.mapLabel;
  context.lineWidth = LINE_WIDTH_PX;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  for (const radiusNm of ringRadiiNm(rangeNm)) {
    const radiusPx = radiusNm * pxPerNm;
    context.beginPath();
    context.arc(center.xPx, center.yPx, radiusPx, 0, FULL_CIRCLE_RAD);
    context.stroke();
    context.fillText(
      String(radiusNm),
      center.xPx + DIGITAL_LAYOUT_REM.ringLabelOffsetX * pxPerRem,
      center.yPx - radiusPx + DIGITAL_LAYOUT_REM.ringLabelOffsetY * pxPerRem,
    );
  }
}

function drawCompassRose(
  context: CanvasRenderingContext2D,
  palette: ScopeCanvasPalette,
  viewport: ScopeViewport,
): void {
  const { center, radiusPx, pxPerRem } = viewport;
  context.strokeStyle = palette.map;
  context.fillStyle = palette.mapLabel;
  context.lineWidth = LINE_WIDTH_PX;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (let headingDeg = 0; headingDeg < FULL_CIRCLE_DEG; headingDeg += COMPASS_TICK_STEP_DEG) {
    const labeled = headingDeg % COMPASS_LABEL_STEP_DEG === 0;
    const tickLengthRem = labeled
      ? DIGITAL_LAYOUT_REM.compassLabeledTickLength
      : DIGITAL_LAYOUT_REM.compassTickLength;
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
        radiusPx + DIGITAL_LAYOUT_REM.compassLabelOffset * pxPerRem,
      );
      context.fillText(formatCompassLabel(headingDeg), label.xPx, label.yPx);
    }
  }
}

function drawReceiver(
  context: CanvasRenderingContext2D,
  palette: ScopeCanvasPalette,
  viewport: ScopeViewport,
): void {
  const { xPx, yPx } = viewport.center;
  const halfSizePx = DIGITAL_LAYOUT_REM.receiverMarkerHalfSize * viewport.pxPerRem;
  context.strokeStyle = palette.mapLabel;
  context.lineWidth = LINE_WIDTH_PX;
  context.beginPath();
  context.moveTo(xPx - halfSizePx, yPx);
  context.lineTo(xPx + halfSizePx, yPx);
  context.moveTo(xPx, yPx - halfSizePx);
  context.lineTo(xPx, yPx + halfSizePx);
  context.stroke();
}

function drawHistory(
  context: CanvasRenderingContext2D,
  palette: ScopeCanvasPalette,
  viewport: ScopeViewport,
  target: ScopeTarget,
): void {
  const radiusPx = DIGITAL_LAYOUT_REM.historyDotRadius * viewport.pxPerRem;
  context.fillStyle = palette.history;
  target.history.forEach((point, index) => {
    const dot = polarToScreen(viewport, point);
    context.globalAlpha = (index + 1) / (target.history.length + 1);
    context.beginPath();
    context.arc(dot.xPx, dot.yPx, radiusPx, 0, FULL_CIRCLE_RAD);
    context.fill();
  });
  context.globalAlpha = 1;
}

function drawVelocityVector(
  context: CanvasRenderingContext2D,
  palette: ScopeCanvasPalette,
  viewport: ScopeViewport,
  target: ScopeTarget,
  at: ScreenPoint,
): void {
  if (
    target.trueTrackDeg === undefined ||
    target.groundSpeedKt === undefined ||
    target.onGround === true
  ) {
    return;
  }
  const vectorNm = (target.groundSpeedKt / MINUTES_PER_HOUR) * VECTOR_MINUTES;
  const tip = offsetByBearing(at, target.trueTrackDeg, vectorNm * viewport.pxPerNm);
  context.strokeStyle = palette.vector;
  context.lineWidth = LINE_WIDTH_PX;
  context.beginPath();
  context.moveTo(at.xPx, at.yPx);
  context.lineTo(tip.xPx, tip.yPx);
  context.stroke();
}

function drawSymbolAndDataBlock(
  context: CanvasRenderingContext2D,
  color: string,
  pxPerRem: number,
  target: ScopeTarget,
  at: ScreenPoint,
): void {
  const halfSizePx = DIGITAL_LAYOUT_REM.symbolHalfSize * pxPerRem;
  const sizePx = halfSizePx * 2;
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = LINE_WIDTH_PX;
  if (target.onGround === true) {
    context.strokeRect(at.xPx - halfSizePx, at.yPx - halfSizePx, sizePx, sizePx);
  } else {
    context.fillRect(at.xPx - halfSizePx, at.yPx - halfSizePx, sizePx, sizePx);
  }

  const leaderStart = offsetByBearing(
    at,
    LEADER_BEARING_DEG,
    halfSizePx + DIGITAL_LAYOUT_REM.leaderGap * pxPerRem,
  );
  const leaderEnd = offsetByBearing(
    at,
    LEADER_BEARING_DEG,
    DIGITAL_LAYOUT_REM.leaderLength * pxPerRem,
  );
  context.beginPath();
  context.moveTo(leaderStart.xPx, leaderStart.yPx);
  context.lineTo(leaderEnd.xPx, leaderEnd.yPx);
  context.stroke();

  context.textAlign = 'left';
  context.textBaseline = 'bottom';
  const lineHeightPx = DIGITAL_LAYOUT_REM.dataBlockLineHeight * pxPerRem;
  const lines = formatDataBlock(target);
  lines.forEach((line, index) => {
    const linesBelow = lines.length - 1 - index;
    context.fillText(
      line,
      leaderEnd.xPx + DIGITAL_LAYOUT_REM.dataBlockOffsetX * pxPerRem,
      leaderEnd.yPx - linesBelow * lineHeightPx,
    );
  });
}

function drawTarget(
  context: CanvasRenderingContext2D,
  palette: ScopeCanvasPalette,
  viewport: ScopeViewport,
  target: ScopeTarget,
  snapshot: ScopeSnapshot,
): void {
  if (target.position === undefined) {
    return;
  }
  const at = polarToScreen(viewport, target.position);
  if (!isNearCanvas(viewport, at)) {
    return;
  }
  const coasting = snapshot.at - target.lastSeenAt > COASTING_AFTER_MS;
  const color = coasting ? palette.coasting : palette.target;
  drawHistory(context, palette, viewport, target);
  drawVelocityVector(context, palette, viewport, target, at);
  drawSymbolAndDataBlock(context, color, viewport.pxPerRem, target, at);
}

/**
 * Creates the `digital` view style's renderer: a modern ATC scope with no
 * sweep. Every frame is drawn from scratch - range rings, a compass rose, and
 * for each target a position symbol (hollow when on the ground), fading
 * history dots, a one-minute velocity vector, and a leader line to its data
 * block. A target not heard from for {@link COASTING_AFTER_MS} is drawn
 * dimmed.
 *
 * @param theme - Colors and type to draw with.
 * @returns The renderer. It carries no state between frames.
 */
export function createDigitalRenderer(theme: ScopeTheme): ScopeRenderer {
  const palette = theme.canvas;
  return {
    render(context: CanvasRenderingContext2D, frame: ScopeFrame): void {
      const { viewport, snapshot } = frame;
      context.globalAlpha = 1;
      context.fillStyle = palette.background;
      context.fillRect(0, 0, viewport.widthPx, viewport.heightPx);
      context.font = canvasFont(theme, viewport.pxPerRem);
      drawRangeRings(context, palette, viewport, frame.rangeNm);
      drawCompassRose(context, palette, viewport);
      drawReceiver(context, palette, viewport);
      if (snapshot === undefined) {
        return;
      }
      for (const target of snapshot.targets) {
        drawTarget(context, palette, viewport, target, snapshot);
      }
    },
    reset(): void {},
  };
}
