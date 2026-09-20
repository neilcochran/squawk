import { offsetByBearing } from './projection.js';
import type { ScreenPoint } from './projection.js';

/** An axis-aligned rectangle on the canvas, in CSS pixels. */
export interface ScreenRect {
  /** Left edge. */
  leftPx: number;
  /** Top edge. */
  topPx: number;
  /** Right edge. */
  rightPx: number;
  /** Bottom edge. */
  bottomPx: number;
}

/**
 * The directions a leader line may run from a target to its data block, in
 * order of preference. They are the eight compass points a controller can
 * pick from on a real scope; north-east first, the usual default, then the
 * other diagonals, which keep the block clear of the target's own history
 * trail and velocity vector more often than the cardinals do.
 */
export const LEADER_BEARINGS_DEG: readonly number[] = [45, 135, 315, 225, 90, 270, 0, 180];

/** The leader direction of a data block with nothing to avoid. */
export const DEFAULT_LEADER_BEARING_DEG = 45;

/** A data block that needs a place. */
export interface DataBlockRequest {
  /** Identifies the target between frames, so its block stays where it was put. */
  id: string;
  /** Center of the target's position symbol. */
  at: ScreenPoint;
  /** Width of the block's text. */
  widthPx: number;
  /** Height of the block's text. */
  heightPx: number;
}

/** The fixed geometry blocks are placed with, in CSS pixels. */
export interface DataBlockGeometry {
  /** Distance from the symbol's center to the end of the leader line. */
  leaderLengthPx: number;
  /** Gap between the end of the leader line and the block's text. */
  blockGapPx: number;
  /** Half the side of the square kept clear around every target's symbol. */
  symbolClearancePx: number;
  /** The canvas: a block is kept inside it where it can be. */
  bounds: ScreenRect;
}

/** Where a data block was put. */
export interface DataBlockPlacement {
  /** Direction of the leader line from the symbol, in degrees clockwise from up. */
  leaderBearingDeg: number;
  /** Where the leader line ends. */
  leaderEnd: ScreenPoint;
  /** The rectangle the block's text occupies. */
  rect: ScreenRect;
}

/** A data block together with the place found for it. */
export interface PlacedDataBlock<T extends DataBlockRequest> {
  /** The block that was placed, exactly as it was passed in. */
  request: T;
  /** Where it was put. */
  placement: DataBlockPlacement;
}

const DEG_TO_RAD = Math.PI / 180;

/** Below this, a bearing's sine or cosine counts as zero: the leader runs straight along an axis. */
const AXIS_TOLERANCE = 1e-6;

/**
 * Measures how much two rectangles overlap.
 *
 * @param a - One rectangle.
 * @param b - The other.
 * @returns The area of their intersection in square pixels; zero if they only touch or are apart.
 */
export function overlapAreaPx(a: ScreenRect, b: ScreenRect): number {
  const widthPx = Math.min(a.rightPx, b.rightPx) - Math.max(a.leftPx, b.leftPx);
  const heightPx = Math.min(a.bottomPx, b.bottomPx) - Math.max(a.topPx, b.topPx);
  return widthPx > 0 && heightPx > 0 ? widthPx * heightPx : 0;
}

function rectArea(rect: ScreenRect): number {
  return (rect.rightPx - rect.leftPx) * (rect.bottomPx - rect.topPx);
}

/**
 * Works out where a data block sits for one leader direction. The block
 * always lies beyond the end of its leader line: to the right of it for an
 * easterly leader and to the left for a westerly one, above it for a
 * northerly leader and below for a southerly one, and centered on it along
 * whichever axis the leader does not move.
 *
 * @param request - The block to place.
 * @param leaderBearingDeg - Direction of the leader line, in degrees clockwise from up.
 * @param geometry - The placement geometry.
 * @returns The placement for that direction.
 */
export function dataBlockPlacementAt(
  request: DataBlockRequest,
  leaderBearingDeg: number,
  geometry: DataBlockGeometry,
): DataBlockPlacement {
  const leaderEnd = offsetByBearing(request.at, leaderBearingDeg, geometry.leaderLengthPx);
  const eastward = Math.sin(leaderBearingDeg * DEG_TO_RAD);
  const northward = Math.cos(leaderBearingDeg * DEG_TO_RAD);
  const isVertical = Math.abs(eastward) < AXIS_TOLERANCE;

  let leftPx = leaderEnd.xPx - request.widthPx / 2;
  if (!isVertical) {
    leftPx =
      eastward > 0
        ? leaderEnd.xPx + geometry.blockGapPx
        : leaderEnd.xPx - geometry.blockGapPx - request.widthPx;
  }

  let topPx = leaderEnd.yPx - request.heightPx / 2;
  if (northward > AXIS_TOLERANCE) {
    topPx = leaderEnd.yPx - request.heightPx - (isVertical ? geometry.blockGapPx : 0);
  } else if (northward < -AXIS_TOLERANCE) {
    topPx = leaderEnd.yPx + (isVertical ? geometry.blockGapPx : 0);
  }

  return {
    leaderBearingDeg,
    leaderEnd,
    rect: {
      leftPx,
      topPx,
      rightPx: leftPx + request.widthPx,
      bottomPx: topPx + request.heightPx,
    },
  };
}

function symbolRect(at: ScreenPoint, clearancePx: number): ScreenRect {
  return {
    leftPx: at.xPx - clearancePx,
    topPx: at.yPx - clearancePx,
    rightPx: at.xPx + clearancePx,
    bottomPx: at.yPx + clearancePx,
  };
}

/**
 * Places every data block so that, where it can be managed, no block covers
 * another block or another target's symbol, and none hangs off the canvas.
 *
 * Blocks are placed one at a time, in order of id so that the result does not
 * depend on the order targets arrive in. Each takes the first direction that
 * is completely clear, trying the direction it had last time first: a block
 * only moves when it has to, so blocks do not flicker between directions as
 * traffic shifts, and - as on a real scope - one that was moved aside stays
 * there. When no direction is clear, the block takes the one that covers the
 * least.
 *
 * @param requests - The blocks to place. A request may carry more than placement needs; it is handed back untouched.
 * @param geometry - The placement geometry.
 * @param previousBearings - The leader direction each block had last time, by id.
 * @returns Every block with its placement, in order of id.
 */
export function placeDataBlocks<T extends DataBlockRequest>(
  requests: readonly T[],
  geometry: DataBlockGeometry,
  previousBearings: ReadonlyMap<string, number>,
): PlacedDataBlock<T>[] {
  const ordered = [...requests].sort((a, b) => a.id.localeCompare(b.id));
  const symbols = ordered.map((request) => ({
    id: request.id,
    rect: symbolRect(request.at, geometry.symbolClearancePx),
  }));
  const placed: PlacedDataBlock<T>[] = [];

  for (const request of ordered) {
    const previous = previousBearings.get(request.id);
    const bearings =
      previous === undefined
        ? LEADER_BEARINGS_DEG
        : [previous, ...LEADER_BEARINGS_DEG.filter((bearing) => bearing !== previous)];

    let best = dataBlockPlacementAt(request, DEFAULT_LEADER_BEARING_DEG, geometry);
    let bestCost = Infinity;
    for (const bearing of bearings) {
      const candidate = dataBlockPlacementAt(request, bearing, geometry);
      let cost = rectArea(candidate.rect) - overlapAreaPx(candidate.rect, geometry.bounds);
      for (const other of placed) {
        cost += overlapAreaPx(candidate.rect, other.placement.rect);
      }
      for (const symbol of symbols) {
        if (symbol.id !== request.id) {
          cost += overlapAreaPx(candidate.rect, symbol.rect);
        }
      }
      if (cost < bestCost) {
        best = candidate;
        bestCost = cost;
      }
      if (cost === 0) {
        break;
      }
    }
    placed.push({ request, placement: best });
  }
  return placed;
}
