import type { ScopeSnapshot, ScopeTarget } from '../../../shared/protocol.js';
import { hexWithAlpha } from '../../scope/color.js';
import { formatDataBlock } from '../../scope/data-block.js';
import {
  drawCompassRose,
  drawRangeRings,
  drawReceiverMarker,
  drawTextLines,
  FULL_CIRCLE_DEG,
  FULL_CIRCLE_RAD,
} from '../../scope/furniture.js';
import type { FurnitureColors } from '../../scope/furniture.js';
import { offsetByBearing, polarToScreen } from '../../scope/projection.js';
import type { ScopeViewport } from '../../scope/projection.js';
import type { ScopeFrame, ScopeRenderer } from '../../scope/renderer.js';
import { canvasFont } from '../../styles/theme.js';

import { areTagsVisible, sweepPeriodMs } from './analog-settings.js';
import type { AnalogTheme } from './analog-theme.js';
import { blipAlpha, isBearingSwept, normalizeDeg, pruneBlips, sweepAdvanceDeg } from './sweep.js';
import type { Blip } from './sweep.js';

/** Angular width of a painted blip: roughly the beam width of a surveillance radar's antenna. */
export const BEAM_WIDTH_DEG = 1.6;

/** How far behind the beam its afterglow trails. */
export const AFTERGLOW_DEG = 45;

/** Brightness of the afterglow right behind the beam, from which it fades to nothing. */
export const AFTERGLOW_ALPHA = 0.3;

/** Brightness of a data tag relative to the blip it labels, so tags stay secondary to the returns. */
export const TAG_ALPHA = 0.6;

/** Stroke width of the beam itself. A hairline stays crisp at any scale. */
const BEAM_LINE_WIDTH_PX = 1.5;
const DEG_TO_RAD = FULL_CIRCLE_RAD / FULL_CIRCLE_DEG;
const NORTH_TO_CANVAS_ZERO_DEG = 90;

/** Sizes of the analog scope's returns and tags, in rem, converted with the viewport's `pxPerRem` at draw time. */
export const ANALOG_LAYOUT_REM = {
  /** Radial thickness of a blip. */
  blipThickness: 0.25,
  /** Shortest a blip's arc is ever drawn, so returns near the center stay visible. */
  blipMinLength: 0.5,
  /** Horizontal gap between a blip and its tag. */
  tagOffsetX: 0.5,
  /** Vertical gap between a blip and the bottom of its tag. */
  tagOffsetY: 0.375,
  /** Height of one tag line. */
  tagLineHeight: 0.875,
} as const;

/**
 * Converts a true bearing to the angle the canvas arc APIs use: radians
 * clockwise from the positive x axis.
 *
 * @param trueBearingDeg - Bearing in degrees true.
 * @returns The canvas angle in radians.
 */
export function bearingToCanvasRad(trueBearingDeg: number): number {
  return (trueBearingDeg - NORTH_TO_CANVAS_ZERO_DEG) * DEG_TO_RAD;
}

function paintCrossedTargets(
  blips: Blip[],
  snapshot: ScopeSnapshot,
  rangeNm: number,
  sweepDeg: number,
  advanceDeg: number,
  frameTimeMs: number,
): void {
  for (const target of snapshot.targets) {
    const position = target.position;
    if (position === undefined || position.rangeNm > rangeNm) {
      continue;
    }
    if (isBearingSwept(position.trueBearingDeg, sweepDeg, advanceDeg)) {
      blips.push({ icaoHex: target.icaoHex, position, paintedAtMs: frameTimeMs });
    }
  }
}

function drawAfterglow(
  context: CanvasRenderingContext2D,
  sweepColor: string,
  viewport: ScopeViewport,
  sweepDeg: number,
): void {
  if (typeof context.createConicGradient !== 'function') {
    return;
  }
  const { center, radiusPx } = viewport;
  const startRad = bearingToCanvasRad(sweepDeg - AFTERGLOW_DEG);
  const gradient = context.createConicGradient(startRad, center.xPx, center.yPx);
  gradient.addColorStop(0, hexWithAlpha(sweepColor, 0));
  gradient.addColorStop(AFTERGLOW_DEG / FULL_CIRCLE_DEG, hexWithAlpha(sweepColor, AFTERGLOW_ALPHA));
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(center.xPx, center.yPx);
  context.arc(center.xPx, center.yPx, radiusPx, startRad, bearingToCanvasRad(sweepDeg));
  context.closePath();
  context.fill();
}

function drawBeam(
  context: CanvasRenderingContext2D,
  sweepColor: string,
  viewport: ScopeViewport,
  sweepDeg: number,
): void {
  const tip = offsetByBearing(viewport.center, sweepDeg, viewport.radiusPx);
  context.strokeStyle = sweepColor;
  context.lineWidth = BEAM_LINE_WIDTH_PX;
  context.beginPath();
  context.moveTo(viewport.center.xPx, viewport.center.yPx);
  context.lineTo(tip.xPx, tip.yPx);
  context.stroke();
}

function drawBlip(
  context: CanvasRenderingContext2D,
  color: string,
  viewport: ScopeViewport,
  blip: Blip,
  alpha: number,
): void {
  const { center, pxPerNm, pxPerRem } = viewport;
  const thicknessPx = ANALOG_LAYOUT_REM.blipThickness * pxPerRem;
  const minLengthPx = ANALOG_LAYOUT_REM.blipMinLength * pxPerRem;
  const radiusPx = blip.position.rangeNm * pxPerNm;
  context.globalAlpha = alpha;
  context.beginPath();
  if (radiusPx < minLengthPx / 2) {
    context.fillStyle = color;
    context.arc(center.xPx, center.yPx, thicknessPx / 2, 0, FULL_CIRCLE_RAD);
    context.fill();
    return;
  }
  const halfWidthRad = Math.max((BEAM_WIDTH_DEG / 2) * DEG_TO_RAD, minLengthPx / 2 / radiusPx);
  const centerRad = bearingToCanvasRad(blip.position.trueBearingDeg);
  context.strokeStyle = color;
  context.lineWidth = thicknessPx;
  context.lineCap = 'round';
  context.arc(center.xPx, center.yPx, radiusPx, centerRad - halfWidthRad, centerRad + halfWidthRad);
  context.stroke();
}

function drawTags(
  context: CanvasRenderingContext2D,
  color: string,
  viewport: ScopeViewport,
  blips: readonly Blip[],
  targets: readonly ScopeTarget[],
  nowMs: number,
  periodMs: number,
): void {
  const newestByHex = new Map<string, Blip>();
  for (const blip of blips) {
    newestByHex.set(blip.icaoHex, blip);
  }
  context.fillStyle = color;
  for (const target of targets) {
    const blip = newestByHex.get(target.icaoHex);
    if (blip === undefined) {
      continue;
    }
    const at = polarToScreen(viewport, blip.position);
    context.globalAlpha = TAG_ALPHA * blipAlpha(nowMs - blip.paintedAtMs, periodMs);
    drawTextLines(
      context,
      formatDataBlock(target),
      at.xPx + ANALOG_LAYOUT_REM.tagOffsetX * viewport.pxPerRem,
      at.yPx - ANALOG_LAYOUT_REM.tagOffsetY * viewport.pxPerRem,
      ANALOG_LAYOUT_REM.tagLineHeight * viewport.pxPerRem,
    );
  }
}

/**
 * Creates the `analog` view style's renderer: a sweep-era PPI scope. A beam
 * rotates clockwise from north, trailing an afterglow, and a target is only
 * painted - as a short arc, like a real return - at the moment the beam
 * crosses its bearing. The blip then fades, so a moving aircraft leaves a
 * trail of its previous returns until the beam comes round again.
 *
 * Blips are kept as state (where and when each was painted) and redrawn every
 * frame at a brightness computed from their age, rather than by fading the
 * canvas, which keeps the decay exact and lets a blip re-project if the range
 * changes while it fades. `reset()` forgets every blip and returns the beam
 * to north, so switching to this style starts from a dark scope that fills in
 * over one rotation.
 *
 * @param theme - Colors and type to draw with. Canvas colors must be six-digit hex.
 * @returns The renderer.
 */
export function createAnalogRenderer(theme: AnalogTheme): ScopeRenderer {
  const palette = theme.canvas;
  const furnitureColors: FurnitureColors = { line: palette.map, label: palette.mapLabel };
  let sweepDeg = 0;
  let lastFrameTimeMs: number | undefined;
  let blips: Blip[] = [];

  return {
    render(context: CanvasRenderingContext2D, frame: ScopeFrame): void {
      const { viewport, snapshot, frameTimeMs } = frame;
      const periodMs = sweepPeriodMs(frame.settings);
      const elapsedMs = lastFrameTimeMs === undefined ? 0 : frameTimeMs - lastFrameTimeMs;
      const advanceDeg = sweepAdvanceDeg(elapsedMs, periodMs);
      if (snapshot !== undefined) {
        paintCrossedTargets(blips, snapshot, frame.rangeNm, sweepDeg, advanceDeg, frameTimeMs);
      }
      sweepDeg = normalizeDeg(sweepDeg + advanceDeg);
      lastFrameTimeMs = frameTimeMs;
      blips = pruneBlips(blips, frameTimeMs, periodMs);

      context.globalAlpha = 1;
      context.fillStyle = palette.background;
      context.fillRect(0, 0, viewport.widthPx, viewport.heightPx);
      context.font = canvasFont(theme, viewport.pxPerRem);
      drawRangeRings(context, furnitureColors, viewport, frame.rangeNm);
      drawCompassRose(context, furnitureColors, viewport);
      drawReceiverMarker(context, furnitureColors, viewport);
      drawAfterglow(context, palette.sweep, viewport, sweepDeg);
      drawBeam(context, palette.sweep, viewport, sweepDeg);
      for (const blip of blips) {
        const alpha = blipAlpha(frameTimeMs - blip.paintedAtMs, periodMs);
        drawBlip(context, palette.target, viewport, blip, alpha);
      }
      if (snapshot !== undefined && areTagsVisible(frame.settings)) {
        drawTags(context, palette.target, viewport, blips, snapshot.targets, frameTimeMs, periodMs);
      }
      context.globalAlpha = 1;
    },
    reset(): void {
      sweepDeg = 0;
      lastFrameTimeMs = undefined;
      blips = [];
    },
  };
}
