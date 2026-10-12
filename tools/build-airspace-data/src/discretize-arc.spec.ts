import { describe, it, expect, assert } from 'vitest';

import { greatCircle } from '@squawk/geo';

import { discretizeArc } from './discretize-arc.js';

/**
 * Compass bearing from the center to a generated [lon, lat] point.
 */
function bearingFromCenter(centerLon: number, centerLat: number, point: [number, number]): number {
  return greatCircle.bearing(centerLat, centerLon, point[1], point[0]);
}

describe('discretizeArc', () => {
  it('generates (pointCount + 1) coordinates by default', () => {
    const points = discretizeArc(-100, 40, 5, 0, 90);
    expect(points.length).toBe(65);
  });

  it('honors a custom pointCount', () => {
    const points = discretizeArc(-100, 40, 5, 0, 90, 8);
    expect(points.length).toBe(9);
  });

  it('starts at the start angle and ends at the end angle', () => {
    const points = discretizeArc(-100, 40, 10, 0, 90, 4);
    const first = points[0];
    const last = points[points.length - 1];
    assert(first && last);
    // GML angle 0 is due east (bearing 090); GML angle 90 is due north (bearing 000).
    expect(bearingFromCenter(-100, 40, first)).toBeCloseTo(90, 3);
    expect(bearingFromCenter(-100, 40, last)).toBeCloseTo(0, 3);
  });

  it('places every point at the radius on the sphere', () => {
    // A 240 nm arc at 61 N is where a flat-earth arc missed its adjoining
    // segment by more than 2 nm.
    const points = discretizeArc(-150, 61, 240, 30, 150, 16);
    for (const [lon, lat] of points) {
      expect(greatCircle.distanceNm(61, -150, lat, lon)).toBeCloseTo(240, 6);
    }
  });

  it('sweeps counterclockwise when the start angle is smaller than the end angle', () => {
    const points = discretizeArc(-100, 40, 5, 0, 90, 2);
    const middle = points[1];
    assert(middle);
    // Counterclockwise from east towards north passes through the northeast.
    expect(bearingFromCenter(-100, 40, middle)).toBeCloseTo(45, 3);
  });

  it('sweeps clockwise when the start angle is larger than the end angle', () => {
    // MANCHESTER MOA: 295.28 -> 248.62 is a 46.66 degree clockwise arc, not a
    // 313 degree counterclockwise one.
    const points = discretizeArc(-80, 34, 20, 295.28, 248.62, 2);
    const first = points[0];
    const middle = points[1];
    const last = points[2];
    assert(first && middle && last);
    expect(bearingFromCenter(-80, 34, first)).toBeCloseTo(154.72, 2);
    expect(bearingFromCenter(-80, 34, middle)).toBeCloseTo(178.05, 2);
    expect(bearingFromCenter(-80, 34, last)).toBeCloseTo(201.38, 2);
  });

  it('accepts angles outside [0, 360) without normalizing the sweep', () => {
    // A negative end angle still means "travel clockwise by the difference".
    const points = discretizeArc(-100, 40, 5, 10, -131.9, 141);
    const last = points[points.length - 1];
    assert(last);
    // GML angle -131.9 is a bearing of 221.9.
    expect(bearingFromCenter(-100, 40, last)).toBeCloseTo(221.9, 2);
    expect(points.length).toBe(142);
  });

  it('produces a full closed ring when the angles are equal or 360 apart', () => {
    for (const [start, end] of [
      [0, 360],
      [90, 90],
    ]) {
      const points = discretizeArc(-100, 40, 5, start!, end!, 8);
      const first = points[0];
      const last = points[points.length - 1];
      assert(first && last);
      expect(first[0]).toBeCloseTo(last[0], 9);
      expect(first[1]).toBeCloseTo(last[1], 9);
    }
  });

  it('spreads longitude with latitude', () => {
    const equatorial = discretizeArc(0, 0, 60, 0, 0, 2);
    const northern = discretizeArc(0, 60, 60, 0, 0, 2);
    assert(equatorial[0] && northern[0]);
    // At 60 N a nautical mile of easting spans about twice the longitude it
    // does at the equator, because cos(60) = 0.5.
    expect(northern[0][0] / equatorial[0][0]).toBeCloseTo(2, 1);
  });

  it('places a point one nautical mile north about one minute of latitude away', () => {
    const points = discretizeArc(0, 0, 1, 90, 90, 2);
    const top = points[0];
    assert(top);
    expect(top[1]).toBeCloseTo(1 / 60, 4);
  });

  it('stays finite at the poles', () => {
    const points = discretizeArc(0, 90, 1, 0, 90, 2);
    expect(points.length).toBe(3);
    for (const [lon, lat] of points) {
      assert(Number.isFinite(lon));
      assert(Number.isFinite(lat));
    }
  });
});
