import type { ScopeSnapshot, ScopeTarget } from '../../../shared/protocol.js';
import { leaderBearingsOf, placeDataBlocks } from '../../scope/data-block-placement.js';
import type {
  DataBlockGeometry,
  DataBlockPlacement,
  DataBlockRequest,
  PlacedDataBlock,
} from '../../scope/data-block-placement.js';
import {
  formatAlternateDataBlock,
  formatDataBlock,
  isTimeShareAlternate,
} from '../../scope/data-block.js';
import type { DataBlockLines } from '../../scope/data-block.js';
import {
  drawCompassRose,
  drawRangeRings,
  drawReceiverMarker,
  drawTextLines,
  FULL_CIRCLE_RAD,
  FURNITURE_LINE_WIDTH_PX,
} from '../../scope/furniture.js';
import type { FurnitureColors } from '../../scope/furniture.js';
import { isNearCanvas, offsetByBearing, polarToScreen } from '../../scope/projection.js';
import type { ScopeViewport, ScreenPoint } from '../../scope/projection.js';
import type { ScopeFrame, ScopeRenderer } from '../../scope/renderer.js';
import { drawVideoMap } from '../../scope/video-map-draw.js';
import type { VideoMapColors } from '../../scope/video-map-draw.js';
import { canvasFont } from '../../styles/theme.js';
import type { ScopeCanvasPalette, ScopeTheme } from '../../styles/theme.js';
import { mapDetail } from '../shared-settings.js';

/** How long a target may go unheard, as of its snapshot, before it is drawn dimmed as coasting. */
export const COASTING_AFTER_MS = 15_000;

/** How far ahead, in minutes of flight at the current ground speed, the velocity vector reaches. */
export const VECTOR_MINUTES = 1;

/**
 * Sizes of the digital scope's target symbology, in rem. They are converted
 * to pixels with the viewport's `pxPerRem` at draw time, so the scope scales
 * with the root font size rather than being pinned to one pixel density or
 * one user's font-size setting.
 */
export const DIGITAL_LAYOUT_REM = {
  /** How far off any canvas edge a target may sit and still be drawn, so its data block can trail in from just off-screen. */
  offscreenMargin: 2.5,
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
  /** Half the side of the square around every target's symbol that data blocks are kept off. */
  symbolClearance: 0.375,
} as const;

const MINUTES_PER_HOUR = 60;

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
  context.lineWidth = FURNITURE_LINE_WIDTH_PX;
  context.beginPath();
  context.moveTo(at.xPx, at.yPx);
  context.lineTo(tip.xPx, tip.yPx);
  context.stroke();
}

/** A target that is on, or just off, the canvas: a request for a place for its data block, carrying what is needed to draw it. */
interface PlottedTarget extends DataBlockRequest {
  /** The target. */
  target: ScopeTarget;
  /** Its data block's lines, top first. */
  lines: DataBlockLines;
  /** The lines shown in their place during the alternate part of the time-share, if the target has any. */
  alternateLines: DataBlockLines | undefined;
}

function drawSymbolAndDataBlock(
  context: CanvasRenderingContext2D,
  color: string,
  pxPerRem: number,
  plotted: PlottedTarget,
  placement: DataBlockPlacement,
  lines: DataBlockLines,
): void {
  const { target, at } = plotted;
  const halfSizePx = DIGITAL_LAYOUT_REM.symbolHalfSize * pxPerRem;
  const sizePx = halfSizePx * 2;
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = FURNITURE_LINE_WIDTH_PX;
  if (target.onGround === true) {
    context.strokeRect(at.xPx - halfSizePx, at.yPx - halfSizePx, sizePx, sizePx);
  } else {
    context.fillRect(at.xPx - halfSizePx, at.yPx - halfSizePx, sizePx, sizePx);
  }

  const leaderStart = offsetByBearing(
    at,
    placement.leaderBearingDeg,
    halfSizePx + DIGITAL_LAYOUT_REM.leaderGap * pxPerRem,
  );
  context.beginPath();
  context.moveTo(leaderStart.xPx, leaderStart.yPx);
  context.lineTo(placement.leaderEnd.xPx, placement.leaderEnd.yPx);
  context.stroke();

  drawTextLines(
    context,
    lines,
    placement.rect.leftPx,
    placement.rect.bottomPx,
    DIGITAL_LAYOUT_REM.dataBlockLineHeight * pxPerRem,
  );
}

function plotTargets(
  context: CanvasRenderingContext2D,
  viewport: ScopeViewport,
  snapshot: ScopeSnapshot,
): PlottedTarget[] {
  const marginPx = DIGITAL_LAYOUT_REM.offscreenMargin * viewport.pxPerRem;
  const lineHeightPx = DIGITAL_LAYOUT_REM.dataBlockLineHeight * viewport.pxPerRem;
  const plotted: PlottedTarget[] = [];
  for (const target of snapshot.targets) {
    if (target.position === undefined) {
      continue;
    }
    const at = polarToScreen(viewport, target.position);
    if (isNearCanvas(viewport, at, marginPx)) {
      const lines = formatDataBlock(target);
      const alternateLines = formatAlternateDataBlock(target);
      const everyLine = [...lines, ...(alternateLines ?? [])];
      plotted.push({
        id: target.icaoHex,
        at,
        widthPx: Math.max(...everyLine.map((line) => context.measureText(line).width)),
        heightPx: lines.length * lineHeightPx,
        target,
        lines,
        alternateLines,
      });
    }
  }
  return plotted;
}

function dataBlockGeometry(viewport: ScopeViewport): DataBlockGeometry {
  const { pxPerRem } = viewport;
  return {
    leaderLengthPx: DIGITAL_LAYOUT_REM.leaderLength * pxPerRem,
    blockGapPx: DIGITAL_LAYOUT_REM.dataBlockOffsetX * pxPerRem,
    symbolClearancePx: DIGITAL_LAYOUT_REM.symbolClearance * pxPerRem,
    bounds: { leftPx: 0, topPx: 0, rightPx: viewport.widthPx, bottomPx: viewport.heightPx },
  };
}

/** What a set of data block placements was worked out for. Placements are reused until one of these changes. */
interface PlacementInputs {
  /** The snapshot whose targets were placed. */
  snapshot: ScopeSnapshot;
  /** Canvas width. */
  widthPx: number;
  /** Canvas height. */
  heightPx: number;
  /** Traffic scale. */
  pxPerNm: number;
  /** Type scale. */
  pxPerRem: number;
}

function isSameInputs(a: PlacementInputs, b: PlacementInputs): boolean {
  return (
    a.snapshot === b.snapshot &&
    a.widthPx === b.widthPx &&
    a.heightPx === b.heightPx &&
    a.pxPerNm === b.pxPerNm &&
    a.pxPerRem === b.pxPerRem
  );
}

/**
 * Creates the `digital` view style's renderer: a modern ATC scope with no
 * sweep. Every frame is drawn from scratch - the video map, range rings, a
 * compass rose, and for each target a position symbol (hollow when on the ground), fading
 * history dots, a one-minute velocity vector, and a leader line to its data
 * block. A target not heard from for {@link COASTING_AFTER_MS} is drawn
 * dimmed.
 *
 * A target whose registered model is known time-shares the second line of
 * its block with it; a block is sized for the wider of the two, so it does
 * not move as they alternate.
 *
 * Data blocks are kept off one another: each leader line takes whichever of
 * eight directions leaves its block clear. The directions are worked out once
 * per snapshot, not once per frame, and are the only thing the renderer
 * remembers between frames - a block stays where it was last put until it has
 * to move.
 *
 * @param theme - Colors and type to draw with.
 * @returns The renderer.
 */
export function createDigitalRenderer(theme: ScopeTheme): ScopeRenderer {
  const palette = theme.canvas;
  const furnitureColors: FurnitureColors = { line: palette.map, label: palette.mapLabel };
  const videoMapColors: VideoMapColors = {
    airspace: {
      classB: palette.airspaceClassB,
      classC: palette.airspaceClassC,
      classD: palette.airspaceClassD,
      specialUse: palette.airspaceSpecialUse,
    },
    feature: palette.videoMapFeature,
    label: palette.videoMapLabel,
  };
  let placedFor: PlacementInputs | undefined;
  let placed: PlacedDataBlock<PlottedTarget>[] = [];

  function placedTargets(
    context: CanvasRenderingContext2D,
    viewport: ScopeViewport,
    snapshot: ScopeSnapshot,
  ): readonly PlacedDataBlock<PlottedTarget>[] {
    const inputs: PlacementInputs = {
      snapshot,
      widthPx: viewport.widthPx,
      heightPx: viewport.heightPx,
      pxPerNm: viewport.pxPerNm,
      pxPerRem: viewport.pxPerRem,
    };
    if (placedFor === undefined || !isSameInputs(placedFor, inputs)) {
      placed = placeDataBlocks(
        plotTargets(context, viewport, snapshot),
        dataBlockGeometry(viewport),
        leaderBearingsOf(placed),
      );
      placedFor = inputs;
    }
    return placed;
  }

  return {
    render(context: CanvasRenderingContext2D, frame: ScopeFrame): void {
      const { viewport, snapshot } = frame;
      context.globalAlpha = 1;
      context.fillStyle = palette.background;
      context.fillRect(0, 0, viewport.widthPx, viewport.heightPx);
      context.font = canvasFont(theme, viewport.pxPerRem);
      const detail = mapDetail(frame.settings);
      if (frame.videoMap !== undefined && detail !== 'off') {
        drawVideoMap(context, videoMapColors, viewport, frame.videoMap, {
          detail,
          extent: 'canvas',
        });
      }
      drawRangeRings(context, furnitureColors, viewport, frame.rangeNm);
      drawCompassRose(context, furnitureColors, viewport);
      drawReceiverMarker(context, furnitureColors, viewport);
      if (snapshot === undefined) {
        return;
      }
      const showAlternate = isTimeShareAlternate(frame.frameTimeMs);
      for (const { request, placement } of placedTargets(context, viewport, snapshot)) {
        const coasting = snapshot.at - request.target.lastSeenAt > COASTING_AFTER_MS;
        drawHistory(context, palette, viewport, request.target);
        drawVelocityVector(context, palette, viewport, request.target, request.at);
        drawSymbolAndDataBlock(
          context,
          coasting ? palette.coasting : palette.target,
          viewport.pxPerRem,
          request,
          placement,
          showAlternate ? (request.alternateLines ?? request.lines) : request.lines,
        );
      }
    },
    reset(): void {
      placedFor = undefined;
      placed = [];
    },
  };
}
