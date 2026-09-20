import { describe, expect, it } from 'vitest';

import {
  dataBlockPlacementAt,
  DEFAULT_LEADER_BEARING_DEG,
  LEADER_BEARINGS_DEG,
  overlapAreaPx,
  placeDataBlocks,
} from './data-block-placement.js';
import type { DataBlockGeometry, DataBlockRequest, ScreenRect } from './data-block-placement.js';

const GEOMETRY: DataBlockGeometry = {
  leaderLengthPx: 26,
  blockGapPx: 3,
  symbolClearancePx: 6,
  bounds: { leftPx: 0, topPx: 0, rightPx: 800, bottomPx: 600 },
};
const NO_HISTORY = new Map<string, number>();

function request(id: string, xPx: number, yPx: number): DataBlockRequest {
  return { id, at: { xPx, yPx }, widthPx: 49, heightPx: 28 };
}

function bearingsById(
  requests: readonly DataBlockRequest[],
  geometry: DataBlockGeometry = GEOMETRY,
  previous: ReadonlyMap<string, number> = NO_HISTORY,
): Record<string, number> {
  return Object.fromEntries(
    placeDataBlocks(requests, geometry, previous).map(({ request: placed, placement }) => [
      placed.id,
      placement.leaderBearingDeg,
    ]),
  );
}

describe('overlapAreaPx', () => {
  const rect: ScreenRect = { leftPx: 0, topPx: 0, rightPx: 10, bottomPx: 10 };

  it('is the area two rectangles share', () => {
    expect(overlapAreaPx(rect, { leftPx: 5, topPx: 6, rightPx: 20, bottomPx: 20 })).toBe(20);
  });

  it('is zero for rectangles that only touch, or are apart on either axis', () => {
    expect(overlapAreaPx(rect, { leftPx: 10, topPx: 0, rightPx: 20, bottomPx: 10 })).toBe(0);
    expect(overlapAreaPx(rect, { leftPx: 30, topPx: 0, rightPx: 40, bottomPx: 10 })).toBe(0);
    expect(overlapAreaPx(rect, { leftPx: 0, topPx: 30, rightPx: 10, bottomPx: 40 })).toBe(0);
  });
});

describe('dataBlockPlacementAt', () => {
  const target = request('a', 400, 300);

  it('ends the leader line at the leader length along the bearing', () => {
    const { leaderEnd } = dataBlockPlacementAt(target, 90, GEOMETRY);

    expect(leaderEnd.xPx).toBeCloseTo(426);
    expect(leaderEnd.yPx).toBeCloseTo(300);
  });

  it('puts the block right of an easterly leader and left of a westerly one', () => {
    for (const bearing of [45, 90, 135]) {
      const { leaderEnd, rect } = dataBlockPlacementAt(target, bearing, GEOMETRY);
      expect(rect.leftPx).toBeCloseTo(leaderEnd.xPx + GEOMETRY.blockGapPx);
    }
    for (const bearing of [225, 270, 315]) {
      const { leaderEnd, rect } = dataBlockPlacementAt(target, bearing, GEOMETRY);
      expect(rect.rightPx).toBeCloseTo(leaderEnd.xPx - GEOMETRY.blockGapPx);
    }
  });

  it('puts the block above a northerly leader and below a southerly one', () => {
    for (const bearing of [45, 315]) {
      const { leaderEnd, rect } = dataBlockPlacementAt(target, bearing, GEOMETRY);
      expect(rect.bottomPx).toBeCloseTo(leaderEnd.yPx);
    }
    for (const bearing of [135, 225]) {
      const { leaderEnd, rect } = dataBlockPlacementAt(target, bearing, GEOMETRY);
      expect(rect.topPx).toBeCloseTo(leaderEnd.yPx);
    }
  });

  it('centers the block on the axis the leader does not move along', () => {
    const east = dataBlockPlacementAt(target, 90, GEOMETRY);
    const north = dataBlockPlacementAt(target, 0, GEOMETRY);
    const south = dataBlockPlacementAt(target, 180, GEOMETRY);

    expect((east.rect.topPx + east.rect.bottomPx) / 2).toBeCloseTo(east.leaderEnd.yPx);
    expect((north.rect.leftPx + north.rect.rightPx) / 2).toBeCloseTo(north.leaderEnd.xPx);
    expect(north.rect.bottomPx).toBeCloseTo(north.leaderEnd.yPx - GEOMETRY.blockGapPx);
    expect(south.rect.topPx).toBeCloseTo(south.leaderEnd.yPx + GEOMETRY.blockGapPx);
  });

  it('sizes the block to its text', () => {
    const { rect } = dataBlockPlacementAt(target, 45, GEOMETRY);

    expect(rect.rightPx - rect.leftPx).toBeCloseTo(target.widthPx);
    expect(rect.bottomPx - rect.topPx).toBeCloseTo(target.heightPx);
  });
});

describe('placeDataBlocks', () => {
  it('offers the eight compass points, the default first', () => {
    expect(LEADER_BEARINGS_DEG).toHaveLength(8);
    expect(LEADER_BEARINGS_DEG[0]).toBe(DEFAULT_LEADER_BEARING_DEG);
  });

  it('places nothing for no requests', () => {
    expect(placeDataBlocks([], GEOMETRY, NO_HISTORY)).toEqual([]);
  });

  it('gives a block with nothing to avoid the default direction', () => {
    expect(bearingsById([request('a', 400, 300)])).toEqual({ a: DEFAULT_LEADER_BEARING_DEG });
  });

  it('moves the second of two crowded blocks aside, so that they do not overlap', () => {
    const placed = placeDataBlocks(
      [request('a', 400, 300), request('b', 405, 300)],
      GEOMETRY,
      NO_HISTORY,
    );

    expect(placed.map(({ placement }) => placement.leaderBearingDeg)).toEqual([45, 135]);
    expect(overlapAreaPx(placed[0]!.placement.rect, placed[1]!.placement.rect)).toBe(0);
  });

  it('does not depend on the order the requests arrive in', () => {
    const a = request('a', 400, 300);
    const b = request('b', 405, 300);

    expect(bearingsById([b, a])).toEqual(bearingsById([a, b]));
  });

  it('hands each request back untouched, in order of id', () => {
    const a = { ...request('a', 100, 100), callsign: 'AAL1' };
    const b = { ...request('b', 500, 400), callsign: 'BAW2' };

    const placed = placeDataBlocks([b, a], GEOMETRY, NO_HISTORY);

    expect(placed.map((entry) => entry.request)).toEqual([a, b]);
    expect(placed[0]?.request).toBe(a);
  });

  it("keeps a block off another target's symbol", () => {
    const covered = request('c', 440, 270);

    expect(bearingsById([request('a', 400, 300), covered])).toEqual({ a: 135, c: 45 });
  });

  it('keeps a block on the canvas', () => {
    expect(bearingsById([request('a', 790, 10)])).toEqual({ a: 225 });
  });

  it('leaves a block where it was last time while that is still clear', () => {
    const previous = new Map([['a', 270]]);

    expect(bearingsById([request('a', 400, 300)], GEOMETRY, previous)).toEqual({ a: 270 });
  });

  it('moves a block from where it was last time once that is no longer clear', () => {
    const previous = new Map([['b', 45]]);

    expect(
      bearingsById([request('a', 400, 300), request('b', 405, 300)], GEOMETRY, previous),
    ).toEqual({ a: 45, b: 135 });
  });

  it('takes the direction that covers the least when none is clear', () => {
    const strip: DataBlockGeometry = {
      ...GEOMETRY,
      bounds: { leftPx: 0, topPx: 0, rightPx: 800, bottomPx: 20 },
    };

    expect(bearingsById([request('a', 400, 10)], strip)).toEqual({ a: 90 });
  });
});
