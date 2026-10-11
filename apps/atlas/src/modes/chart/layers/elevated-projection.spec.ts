import { describe, expect, it } from 'vitest';

import { projectMercatorPoint } from './elevated-projection.ts';
import type { ProjectionFrame } from './elevated-projection.ts';

/** Column-major identity, so clip space equals mercator space. */
const IDENTITY: readonly number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/**
 * Identity with the y flip MapLibre's projection applies, so mercator y
 * (which grows southward) becomes clip y (which grows upward).
 */
const FLIP_Y: readonly number[] = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/**
 * A 2x2 pixel canvas under {@link FLIP_Y}, so a mercator point `(x, y)`
 * lands at pixel `(x + 1, 1 + y)`.
 */
const UNIT_FRAME: ProjectionFrame = { mainMatrix: FLIP_Y, width: 2, height: 2 };

describe('projectMercatorPoint', () => {
  it('maps the center of the mercator world to the center of the canvas', () => {
    const point = projectMercatorPoint(UNIT_FRAME, { x: 0.5, y: 0.5, z: 0 });
    expect(point?.x).toBeCloseTo(1.5, 10);
    expect(point?.y).toBeCloseTo(1.5, 10);
  });

  it('moves right with mercator x and up the screen as mercator y shrinks', () => {
    const origin = projectMercatorPoint(UNIT_FRAME, { x: 0.5, y: 0.5, z: 0 });
    const east = projectMercatorPoint(UNIT_FRAME, { x: 0.75, y: 0.5, z: 0 });
    const north = projectMercatorPoint(UNIT_FRAME, { x: 0.5, y: 0.36, z: 0 });
    expect(east?.x).toBeGreaterThan(origin?.x ?? Number.POSITIVE_INFINITY);
    expect(east?.y).toBeCloseTo(origin?.y ?? Number.NaN, 10);
    expect(north?.y).toBeLessThan(origin?.y ?? Number.NEGATIVE_INFINITY);
    expect(north?.x).toBeCloseTo(origin?.x ?? Number.NaN, 10);
  });

  it('feeds altitude through the matrix z column', () => {
    // A matrix that adds z into clip y: a lifted point moves up the
    // screen, which is what a tilted camera does to a box top.
    const lift: number[] = [...FLIP_Y];
    lift[9] = 1;
    const frame: ProjectionFrame = { ...UNIT_FRAME, mainMatrix: lift };
    const ground = projectMercatorPoint(frame, { x: 0.5, y: 0.5, z: 0 });
    const lifted = projectMercatorPoint(frame, { x: 0.5, y: 0.5, z: 0.25 });
    expect(ground?.y).toBeCloseTo(1.5, 10);
    expect(lifted?.y).toBeCloseTo(1.25, 10);
    expect(lifted?.x).toBeCloseTo(ground?.x ?? Number.NaN, 10);
  });

  it('scales normalized device coordinates by the canvas width and height', () => {
    const frame: ProjectionFrame = { mainMatrix: IDENTITY, width: 100, height: 50 };
    const point = projectMercatorPoint(frame, { x: 2, y: 2, z: 0 });
    // Clip x 2 -> (2 + 1) / 2 * 100; clip y 2 -> (1 - 2) / 2 * 50.
    expect(point?.x).toBeCloseTo(150, 10);
    expect(point?.y).toBeCloseTo(-25, 10);
  });

  it('returns undefined for a point behind the camera', () => {
    const behind: number[] = [...FLIP_Y];
    behind[15] = -1;
    const frame: ProjectionFrame = { ...UNIT_FRAME, mainMatrix: behind };
    expect(projectMercatorPoint(frame, { x: 0.5, y: 0.5, z: 0 })).toBeUndefined();
  });

  it('returns undefined when the matrix is missing elements', () => {
    const frame: ProjectionFrame = { ...UNIT_FRAME, mainMatrix: [1, 0, 0] };
    expect(projectMercatorPoint(frame, { x: 0.5, y: 0.5, z: 0 })).toBeUndefined();
  });
});
