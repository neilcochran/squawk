import type {
  ScopeVideoMap,
  VideoMapAirspaceClass,
  VideoMapLine,
  VideoMapPoint,
  VideoMapPointKind,
} from '../../shared/protocol.js';

import { isWithinExtent } from './extent.js';
import type { ScopeExtent } from './extent.js';
import { FULL_CIRCLE_RAD } from './furniture.js';
import { isNearCanvas, offsetByBearing, polarToScreen } from './projection.js';
import type { ScopeViewport, ScreenPoint } from './projection.js';

/** The colors the video map is drawn in. */
export interface VideoMapColors {
  /** The boundary color of each class of airspace. */
  airspace: Readonly<Record<VideoMapAirspaceClass, string>>;
  /** Runways, and the symbols of airports, navaids, and fixes. */
  feature: string;
  /** Labels. */
  label: string;
}

/** How much of the map to draw: `basic` is airspace and airports, `full` adds navaids and fixes. */
export type VideoMapDetail = 'basic' | 'full';

/** How a view style wants the video map drawn. */
export interface VideoMapDrawOptions {
  /** How much of the map to draw. */
  detail: VideoMapDetail;
  /** How far the map reaches. */
  extent: ScopeExtent;
}

/** The point features drawn at each detail level. Navaids and fixes are numerous enough to compete with the traffic, so they are opt-in. */
export const VIDEO_MAP_POINT_KINDS_BY_DETAIL: Readonly<
  Record<VideoMapDetail, readonly VideoMapPointKind[]>
> = {
  basic: ['airport'],
  full: ['airport', 'navaid', 'fix'],
};

/** Sizes of the video map's symbols, labels, and dashes, in rem, converted with the viewport's `pxPerRem` at draw time. */
export const VIDEO_MAP_LAYOUT_REM = {
  /** Radius of the ring marking an airport whose runways are not drawn. */
  airportRadius: 0.1875,
  /** Half the width of the diamond marking a navaid. */
  navaidHalfSize: 0.25,
  /** Half the width of the triangle marking a fix. */
  fixHalfSize: 0.1875,
  /** Horizontal gap between a feature and its label. */
  labelOffsetX: 0.375,
  /** Vertical gap between a feature and the top of its label, which sits below and to the right. */
  labelOffsetY: 0.25,
  /** How far off any canvas edge a feature may sit and still be drawn, so its label can trail in from just off-screen. */
  offscreenMargin: 3,
  /** Length of each dash of an airspace boundary. */
  airspaceDash: 0.375,
  /** Length of the gap between those dashes. */
  airspaceDashGap: 0.3125,
} as const;

/** Stroke width of an airspace boundary. */
export const AIRSPACE_LINE_WIDTH_PX = 1;

/** Stroke width of a runway: heavier than a boundary, so it reads as an object rather than an outline. */
export const RUNWAY_LINE_WIDTH_PX = 1.5;

const AIRSPACE_CLASSES: readonly VideoMapAirspaceClass[] = [
  'specialUse',
  'classD',
  'classC',
  'classB',
];

function strokeLines(
  context: CanvasRenderingContext2D,
  viewport: ScopeViewport,
  lines: readonly VideoMapLine[],
): void {
  context.beginPath();
  for (const line of lines) {
    line.points.forEach(([trueBearingDeg, rangeNm], index) => {
      const at = offsetByBearing(viewport.center, trueBearingDeg, rangeNm * viewport.pxPerNm);
      if (index === 0) {
        context.moveTo(at.xPx, at.yPx);
      } else {
        context.lineTo(at.xPx, at.yPx);
      }
    });
  }
  context.stroke();
}

function traceSymbol(
  context: CanvasRenderingContext2D,
  kind: VideoMapPointKind,
  at: ScreenPoint,
  pxPerRem: number,
): void {
  switch (kind) {
    case 'airport': {
      const radiusPx = VIDEO_MAP_LAYOUT_REM.airportRadius * pxPerRem;
      context.moveTo(at.xPx + radiusPx, at.yPx);
      context.arc(at.xPx, at.yPx, radiusPx, 0, FULL_CIRCLE_RAD);
      break;
    }
    case 'navaid': {
      const halfPx = VIDEO_MAP_LAYOUT_REM.navaidHalfSize * pxPerRem;
      context.moveTo(at.xPx, at.yPx - halfPx);
      context.lineTo(at.xPx + halfPx, at.yPx);
      context.lineTo(at.xPx, at.yPx + halfPx);
      context.lineTo(at.xPx - halfPx, at.yPx);
      context.closePath();
      break;
    }
    case 'fix': {
      const halfPx = VIDEO_MAP_LAYOUT_REM.fixHalfSize * pxPerRem;
      context.moveTo(at.xPx, at.yPx - halfPx);
      context.lineTo(at.xPx + halfPx, at.yPx + halfPx);
      context.lineTo(at.xPx - halfPx, at.yPx + halfPx);
      context.closePath();
      break;
    }
  }
}

/**
 * Draws the video map: airspace boundaries, then runways, then the symbols
 * and labels of point features. Shared by every view style, so the map lines
 * up exactly when the style is switched; only the colors differ.
 *
 * Airspace boundaries are dashed, and colored by class. Most of them are
 * circles, and so are the range rings; near an airport the two nearly
 * coincide, so a boundary must never look like a ring. The dashes do that
 * even in a monochrome view style, where color cannot.
 *
 * Each class of boundary is stroked as a single path, as are the runways and
 * all the symbols, so a map with thousands of vertices costs a handful of
 * draw calls per frame. Point features off the canvas are skipped; lines are
 * left to the canvas to clip, since a boundary can cross the screen with no
 * vertex on it.
 *
 * With the `rangeCircle` extent, lines are clipped at the range circle, and
 * point features beyond it are left out whole rather than clipped, so a label
 * is never cut off mid-word.
 *
 * The map's positions are relative to the receiver, so a map built for one
 * range is still drawn correctly at another - it just carries that other
 * range's level of detail until the right one arrives.
 *
 * @param context - The canvas context, with its font already set.
 * @param colors - The colors to draw in.
 * @param viewport - The current viewport.
 * @param map - The map to draw.
 * @param options - How much of the map to draw, and how far it reaches.
 */
export function drawVideoMap(
  context: CanvasRenderingContext2D,
  colors: VideoMapColors,
  viewport: ScopeViewport,
  map: ScopeVideoMap,
  options: VideoMapDrawOptions,
): void {
  const { pxPerRem } = viewport;
  const isWithinRangeCircle = options.extent === 'rangeCircle';

  if (isWithinRangeCircle) {
    context.save();
    context.beginPath();
    context.arc(viewport.center.xPx, viewport.center.yPx, viewport.radiusPx, 0, FULL_CIRCLE_RAD);
    context.clip();
  }

  context.lineWidth = AIRSPACE_LINE_WIDTH_PX;
  context.setLineDash([
    VIDEO_MAP_LAYOUT_REM.airspaceDash * pxPerRem,
    VIDEO_MAP_LAYOUT_REM.airspaceDashGap * pxPerRem,
  ]);
  for (const airspaceClass of AIRSPACE_CLASSES) {
    const boundaries = map.lines.filter(
      (line) => line.kind === 'airspace' && line.airspaceClass === airspaceClass,
    );
    if (boundaries.length > 0) {
      context.strokeStyle = colors.airspace[airspaceClass];
      strokeLines(context, viewport, boundaries);
    }
  }
  context.setLineDash([]);

  context.strokeStyle = colors.feature;
  context.lineWidth = RUNWAY_LINE_WIDTH_PX;
  strokeLines(
    context,
    viewport,
    map.lines.filter((line) => line.kind === 'runway'),
  );

  if (isWithinRangeCircle) {
    context.restore();
  }

  const shownKinds = VIDEO_MAP_POINT_KINDS_BY_DETAIL[options.detail];
  const marginPx = VIDEO_MAP_LAYOUT_REM.offscreenMargin * pxPerRem;
  const visible: { point: VideoMapPoint; at: ScreenPoint }[] = [];
  for (const point of map.points) {
    if (!shownKinds.includes(point.kind)) {
      continue;
    }
    if (!isWithinExtent(viewport, point.position, options.extent)) {
      continue;
    }
    const at = polarToScreen(viewport, point.position);
    if (isNearCanvas(viewport, at, marginPx)) {
      visible.push({ point, at });
    }
  }

  context.strokeStyle = colors.feature;
  context.lineWidth = AIRSPACE_LINE_WIDTH_PX;
  context.beginPath();
  for (const { point, at } of visible) {
    if (point.outlined !== true) {
      traceSymbol(context, point.kind, at, pxPerRem);
    }
  }
  context.stroke();

  context.fillStyle = colors.label;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  for (const { point, at } of visible) {
    if (point.label !== undefined) {
      context.fillText(
        point.label,
        at.xPx + VIDEO_MAP_LAYOUT_REM.labelOffsetX * pxPerRem,
        at.yPx + VIDEO_MAP_LAYOUT_REM.labelOffsetY * pxPerRem,
      );
    }
  }
}
