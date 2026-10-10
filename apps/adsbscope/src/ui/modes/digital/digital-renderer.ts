import type { ScopeSnapshot, ScopeTarget } from '../../../shared/protocol.js';
import { positionSymbol } from '../../scope/category.js';
import type { PositionSymbol } from '../../scope/category.js';
import {
  leaderBearingsOf,
  pickPlacedDataBlock,
  placeDataBlocks,
} from '../../scope/data-block-placement.js';
import type {
  DataBlockGeometry,
  DataBlockPlacement,
  DataBlockRequest,
  PlacedDataBlock,
} from '../../scope/data-block-placement.js';
import {
  dataBlockLinesFor,
  everyDataBlockLine,
  formatDataBlockPhases,
  timeSharePhase,
} from '../../scope/data-block.js';
import type { DataBlockLines, DataBlockPhases } from '../../scope/data-block.js';
import { isEmergencyFlashOn } from '../../scope/emergency.js';
import type { ScopeExtent } from '../../scope/extent.js';
import {
  drawCompassRose,
  drawRangeRings,
  drawReceiverMarker,
  drawTextLines,
  FULL_CIRCLE_RAD,
  FURNITURE_LINE_WIDTH_PX,
} from '../../scope/furniture.js';
import type { FurnitureColors } from '../../scope/furniture.js';
import { drawHalo } from '../../scope/halo.js';
import { isNearCanvas, offsetByBearing, polarToScreen } from '../../scope/projection.js';
import type { ScopeViewport, ScreenPoint } from '../../scope/projection.js';
import type { ScopeFrame, ScopeRenderer } from '../../scope/renderer.js';
import { drawVideoMap } from '../../scope/video-map-draw.js';
import type { VideoMapColors } from '../../scope/video-map-draw.js';
import { canvasFont } from '../../styles/theme.js';
import type { ScopeCanvasPalette, ScopeTheme } from '../../styles/theme.js';
import { haloRadiusNm, leaderLength, mapDetail } from '../shared-settings.js';
import type { LeaderLength } from '../shared-settings.js';

import { vectorMinutes } from './digital-settings.js';

/** How far the digital scope reaches: the whole canvas, as a modern scope's rectangular display does. */
export const DIGITAL_EXTENT: ScopeExtent = 'canvas';

/** How long a target may go unheard, as of its snapshot, before it is drawn dimmed as coasting. */
export const COASTING_AFTER_MS = 15_000;

/**
 * How many times its usual size a target's position symbol is drawn while
 * the pilot is squawking ident. Held steady, in the usual color: a red or a
 * flashing symbol would read as an emergency.
 */
export const IDENT_SYMBOL_SCALE = 2;

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
  /** Distance from the symbol's center to the end of the leader line, for each choice of the leader setting. */
  leaderLength: {
    /** The short leader, which is the default. */
    short: 1.625,
    /** The long leader: twice the short one. */
    long: 3.25,
  },
  /** Gap between the end of the leader line and the data block's text. */
  dataBlockOffsetX: 0.1875,
  /** Height of one data block line. */
  dataBlockLineHeight: 0.875,
  /** Half the side of the square around every target's symbol that data blocks are kept off. */
  symbolClearance: 0.375,
  /** Radius of the ring around the selected target. */
  selectionRadius: 0.5625,
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
  minutes: number,
): void {
  if (
    target.trueTrackDeg === undefined ||
    target.groundSpeedKt === undefined ||
    target.onGround === true
  ) {
    return;
  }
  const vectorNm = (target.groundSpeedKt / MINUTES_PER_HOUR) * minutes;
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
  /** Everything its data block can show, by part of the time-share. */
  phases: DataBlockPhases;
}

function tracePolygon(context: CanvasRenderingContext2D, points: readonly ScreenPoint[]): void {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.xPx, point.yPx);
    } else {
      context.lineTo(point.xPx, point.yPx);
    }
  });
  context.closePath();
}

/**
 * Draws a target's position symbol, filled when airborne and hollow on the
 * ground. A cross has no inside to fill, so it is always stroked; a surface
 * vehicle is never airborne anyway.
 */
function drawPositionSymbol(
  context: CanvasRenderingContext2D,
  symbol: PositionSymbol,
  at: ScreenPoint,
  halfSizePx: number,
  hollow: boolean,
): void {
  const { xPx, yPx } = at;
  switch (symbol) {
    case 'square':
      if (hollow) {
        context.strokeRect(xPx - halfSizePx, yPx - halfSizePx, halfSizePx * 2, halfSizePx * 2);
      } else {
        context.fillRect(xPx - halfSizePx, yPx - halfSizePx, halfSizePx * 2, halfSizePx * 2);
      }
      return;
    case 'circle':
      context.beginPath();
      context.arc(xPx, yPx, halfSizePx, 0, FULL_CIRCLE_RAD);
      break;
    case 'triangle':
      tracePolygon(context, [
        { xPx, yPx: yPx - halfSizePx },
        { xPx: xPx + halfSizePx, yPx: yPx + halfSizePx },
        { xPx: xPx - halfSizePx, yPx: yPx + halfSizePx },
      ]);
      break;
    case 'diamond':
      tracePolygon(context, [
        { xPx, yPx: yPx - halfSizePx },
        { xPx: xPx + halfSizePx, yPx },
        { xPx, yPx: yPx + halfSizePx },
        { xPx: xPx - halfSizePx, yPx },
      ]);
      break;
    case 'cross':
      context.beginPath();
      context.moveTo(xPx - halfSizePx, yPx - halfSizePx);
      context.lineTo(xPx + halfSizePx, yPx + halfSizePx);
      context.moveTo(xPx + halfSizePx, yPx - halfSizePx);
      context.lineTo(xPx - halfSizePx, yPx + halfSizePx);
      context.stroke();
      return;
  }
  if (hollow) {
    context.stroke();
  } else {
    context.fill();
  }
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
  const symbolScale = target.identActive === true ? IDENT_SYMBOL_SCALE : 1;
  const halfSizePx = DIGITAL_LAYOUT_REM.symbolHalfSize * pxPerRem * symbolScale;
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = FURNITURE_LINE_WIDTH_PX;
  drawPositionSymbol(
    context,
    positionSymbol(target.category),
    at,
    halfSizePx,
    target.onGround === true,
  );

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

function targetColor(
  palette: ScopeCanvasPalette,
  target: ScopeTarget,
  snapshot: ScopeSnapshot,
  isFlashOn: boolean,
): string {
  if (target.emergency !== undefined) {
    return isFlashOn ? palette.emergency : palette.target;
  }
  return snapshot.at - target.lastSeenAt > COASTING_AFTER_MS ? palette.coasting : palette.target;
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
      const phases = formatDataBlockPhases(target);
      plotted.push({
        id: target.icaoHex,
        at,
        widthPx: Math.max(
          ...everyDataBlockLine(phases).map((line) => context.measureText(line).width),
        ),
        heightPx: phases.usual.length * lineHeightPx,
        target,
        phases,
      });
    }
  }
  return plotted;
}

function dataBlockGeometry(viewport: ScopeViewport, leader: LeaderLength): DataBlockGeometry {
  const { pxPerRem } = viewport;
  return {
    leaderLengthPx: DIGITAL_LAYOUT_REM.leaderLength[leader] * pxPerRem,
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
  /** How long the leader lines were. */
  leader: LeaderLength;
}

function isSameInputs(a: PlacementInputs, b: PlacementInputs): boolean {
  return (
    a.snapshot === b.snapshot &&
    a.widthPx === b.widthPx &&
    a.heightPx === b.heightPx &&
    a.pxPerNm === b.pxPerNm &&
    a.pxPerRem === b.pxPerRem &&
    a.leader === b.leader
  );
}

/**
 * Creates the `digital` view style's renderer: a modern ATC scope with no
 * sweep. Every frame is drawn from scratch - the video map, range rings, a
 * compass rose, and for each target a position symbol, fading history dots,
 * a velocity vector as many minutes long as the vector setting asks, and a
 * leader line, short or long as the leader setting asks, to its data block.
 * The selected target is ringed, and gets a halo of the radius the ring
 * setting asks for, if any. The
 * symbol's shape follows the aircraft's category - a square for a fixed-wing
 * aircraft, a circle for a rotorcraft, a triangle for a glider or balloon, a
 * diamond for a drone, a cross for a surface vehicle - and is hollow on the
 * ground and {@link IDENT_SYMBOL_SCALE} times its size while the pilot
 * squawks ident. A target not heard from for {@link COASTING_AFTER_MS} is
 * drawn dimmed. A target in an emergency flashes in the emergency color
 * instead, and is never dimmed: it is the one target that must not fade
 * from view.
 *
 * The second line of every block time-shares, in unison, between altitude
 * and ground speed, the aircraft's type, and the altitude it is climbing or
 * descending to, skipping any part a block has nothing for; a block is sized
 * for the widest of them, so it does not move as they alternate.
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
    leader: LeaderLength,
  ): readonly PlacedDataBlock<PlottedTarget>[] {
    const inputs: PlacementInputs = {
      snapshot,
      widthPx: viewport.widthPx,
      heightPx: viewport.heightPx,
      pxPerNm: viewport.pxPerNm,
      pxPerRem: viewport.pxPerRem,
      leader,
    };
    if (placedFor === undefined || !isSameInputs(placedFor, inputs)) {
      placed = placeDataBlocks(
        plotTargets(context, viewport, snapshot),
        dataBlockGeometry(viewport, leader),
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
          extent: DIGITAL_EXTENT,
        });
      }
      drawRangeRings(context, furnitureColors, viewport, frame.rangeNm);
      drawCompassRose(context, furnitureColors, viewport);
      drawReceiverMarker(context, furnitureColors, viewport);
      if (snapshot === undefined) {
        return;
      }
      const phase = timeSharePhase(frame.frameTimeMs);
      const isFlashOn = isEmergencyFlashOn(frame.frameTimeMs);
      const minutes = vectorMinutes(frame.settings);
      const haloNm = haloRadiusNm(frame.settings);
      const placedNow = placedTargets(context, viewport, snapshot, leaderLength(frame.settings));
      for (const { request, placement } of placedNow) {
        if (request.id === frame.selectedIcaoHex) {
          context.strokeStyle = palette.selected;
          context.lineWidth = FURNITURE_LINE_WIDTH_PX;
          context.beginPath();
          context.arc(
            request.at.xPx,
            request.at.yPx,
            DIGITAL_LAYOUT_REM.selectionRadius * viewport.pxPerRem,
            0,
            FULL_CIRCLE_RAD,
          );
          context.stroke();
          if (haloNm !== undefined) {
            drawHalo(context, palette.selected, viewport, request.at, haloNm);
          }
        }
        drawHistory(context, palette, viewport, request.target);
        drawVelocityVector(context, palette, viewport, request.target, request.at, minutes);
        drawSymbolAndDataBlock(
          context,
          targetColor(palette, request.target, snapshot, isFlashOn),
          viewport.pxPerRem,
          request,
          placement,
          dataBlockLinesFor(request.phases, phase),
        );
      }
    },
    reset(): void {
      placedFor = undefined;
      placed = [];
    },
    pickDataBlock(point: ScreenPoint): string | undefined {
      return pickPlacedDataBlock(placed, point);
    },
  };
}
