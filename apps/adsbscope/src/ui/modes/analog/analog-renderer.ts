import type { ScopeSnapshot, ScopeTarget } from '../../../shared/protocol.js';
import { hexWithAlpha } from '../../scope/color.js';
import { leaderBearingsOf, placeDataBlocks } from '../../scope/data-block-placement.js';
import type {
  DataBlockGeometry,
  DataBlockRequest,
  PlacedDataBlock,
} from '../../scope/data-block-placement.js';
import { formatDataBlock } from '../../scope/data-block.js';
import type { DataBlockLines } from '../../scope/data-block.js';
import {
  drawCompassRose,
  drawRangeRings,
  drawReceiverMarker,
  drawTextLines,
  FULL_CIRCLE_DEG,
  FULL_CIRCLE_RAD,
  FURNITURE_LINE_WIDTH_PX,
} from '../../scope/furniture.js';
import type { FurnitureColors } from '../../scope/furniture.js';
import { offsetByBearing, polarToScreen } from '../../scope/projection.js';
import type { ScopeViewport } from '../../scope/projection.js';
import type { ScopeFrame, ScopeRenderer } from '../../scope/renderer.js';
import { drawVideoMap } from '../../scope/video-map-draw.js';
import type { VideoMapColors } from '../../scope/video-map-draw.js';
import { canvasFont } from '../../styles/theme.js';
import { mapDetail } from '../shared-settings.js';

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
  /** Gap between the center of a blip and the start of its tag's leader line. */
  tagLeaderGap: 0.375,
  /** Distance from the center of a blip to the end of its tag's leader line. */
  tagLeaderLength: 1,
  /** Gap between the end of the leader line and the tag's text. */
  tagGap: 0.1875,
  /** Half the side of the square around every tagged blip that tags are kept off. */
  tagClearance: 0.375,
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

/** The newest blip of a target that is still in the snapshot: a request for a place for its tag, carrying what is needed to draw it. */
interface TaggedBlip extends DataBlockRequest {
  /** The blip the tag belongs to. The tag fades with it. */
  blip: Blip;
  /** The tag's lines, top first. */
  lines: DataBlockLines;
}

/** What a set of tag placements was worked out for. Placements are reused until one of these changes. */
interface TagPlacementInputs {
  /** The snapshot the tags describe. */
  snapshot: ScopeSnapshot;
  /** The blips the tags hang off: each tagged target's newest blip, and when it was painted. */
  newestBlips: string;
  /** Canvas width. */
  widthPx: number;
  /** Canvas height. */
  heightPx: number;
  /** Traffic scale. */
  pxPerNm: number;
  /** Type scale. */
  pxPerRem: number;
}

function isSameTagInputs(a: TagPlacementInputs, b: TagPlacementInputs): boolean {
  return (
    a.snapshot === b.snapshot &&
    a.newestBlips === b.newestBlips &&
    a.widthPx === b.widthPx &&
    a.heightPx === b.heightPx &&
    a.pxPerNm === b.pxPerNm &&
    a.pxPerRem === b.pxPerRem
  );
}

function newestBlipsByHex(blips: readonly Blip[]): Map<string, Blip> {
  const newestByHex = new Map<string, Blip>();
  for (const blip of blips) {
    newestByHex.set(blip.icaoHex, blip);
  }
  return newestByHex;
}

function tagBlips(
  context: CanvasRenderingContext2D,
  viewport: ScopeViewport,
  targets: readonly ScopeTarget[],
  newestByHex: ReadonlyMap<string, Blip>,
): TaggedBlip[] {
  const lineHeightPx = ANALOG_LAYOUT_REM.tagLineHeight * viewport.pxPerRem;
  const tagged: TaggedBlip[] = [];
  for (const target of targets) {
    const blip = newestByHex.get(target.icaoHex);
    if (blip !== undefined) {
      const lines = formatDataBlock(target);
      tagged.push({
        id: target.icaoHex,
        at: polarToScreen(viewport, blip.position),
        widthPx: Math.max(...lines.map((line) => context.measureText(line).width)),
        heightPx: lines.length * lineHeightPx,
        blip,
        lines,
      });
    }
  }
  return tagged;
}

function tagGeometry(viewport: ScopeViewport): DataBlockGeometry {
  const { pxPerRem } = viewport;
  return {
    leaderLengthPx: ANALOG_LAYOUT_REM.tagLeaderLength * pxPerRem,
    blockGapPx: ANALOG_LAYOUT_REM.tagGap * pxPerRem,
    symbolClearancePx: ANALOG_LAYOUT_REM.tagClearance * pxPerRem,
    bounds: { leftPx: 0, topPx: 0, rightPx: viewport.widthPx, bottomPx: viewport.heightPx },
  };
}

function drawTags(
  context: CanvasRenderingContext2D,
  color: string,
  pxPerRem: number,
  tags: readonly PlacedDataBlock<TaggedBlip>[],
  nowMs: number,
  periodMs: number,
): void {
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = FURNITURE_LINE_WIDTH_PX;
  for (const { request, placement } of tags) {
    context.globalAlpha = TAG_ALPHA * blipAlpha(nowMs - request.blip.paintedAtMs, periodMs);
    const leaderStart = offsetByBearing(
      request.at,
      placement.leaderBearingDeg,
      ANALOG_LAYOUT_REM.tagLeaderGap * pxPerRem,
    );
    context.beginPath();
    context.moveTo(leaderStart.xPx, leaderStart.yPx);
    context.lineTo(placement.leaderEnd.xPx, placement.leaderEnd.yPx);
    context.stroke();
    drawTextLines(
      context,
      request.lines,
      placement.rect.leftPx,
      placement.rect.bottomPx,
      ANALOG_LAYOUT_REM.tagLineHeight * pxPerRem,
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
 * Tags hang off each target's newest blip on a short leader line, and are
 * kept off one another the way the digital style's data blocks are: a leader
 * takes whichever of eight directions leaves its tag clear, and keeps it
 * until it has to move. The directions are worked out again only when a blip
 * is painted or the snapshot changes, not every frame.
 *
 * @param theme - Colors and type to draw with. Canvas colors must be six-digit hex.
 * @returns The renderer.
 */
export function createAnalogRenderer(theme: AnalogTheme): ScopeRenderer {
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
  let sweepDeg = 0;
  let lastFrameTimeMs: number | undefined;
  let blips: Blip[] = [];
  let tagsPlacedFor: TagPlacementInputs | undefined;
  let tags: PlacedDataBlock<TaggedBlip>[] = [];

  function placedTags(
    context: CanvasRenderingContext2D,
    viewport: ScopeViewport,
    snapshot: ScopeSnapshot,
  ): readonly PlacedDataBlock<TaggedBlip>[] {
    const newestByHex = newestBlipsByHex(blips);
    const inputs: TagPlacementInputs = {
      snapshot,
      newestBlips: [...newestByHex].map(([hex, blip]) => `${hex}@${blip.paintedAtMs}`).join(),
      widthPx: viewport.widthPx,
      heightPx: viewport.heightPx,
      pxPerNm: viewport.pxPerNm,
      pxPerRem: viewport.pxPerRem,
    };
    if (tagsPlacedFor === undefined || !isSameTagInputs(tagsPlacedFor, inputs)) {
      tags = placeDataBlocks(
        tagBlips(context, viewport, snapshot.targets, newestByHex),
        tagGeometry(viewport),
        leaderBearingsOf(tags),
      );
      tagsPlacedFor = inputs;
    }
    return tags;
  }

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
      const detail = mapDetail(frame.settings);
      if (frame.videoMap !== undefined && detail !== 'off') {
        drawVideoMap(context, videoMapColors, viewport, frame.videoMap, {
          detail,
          extent: 'rangeCircle',
        });
      }
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
        drawTags(
          context,
          palette.target,
          viewport.pxPerRem,
          placedTags(context, viewport, snapshot),
          frameTimeMs,
          periodMs,
        );
      }
      context.globalAlpha = 1;
    },
    reset(): void {
      sweepDeg = 0;
      lastFrameTimeMs = undefined;
      blips = [];
      tagsPlacedFor = undefined;
      tags = [];
    },
  };
}
