import { describe, it, expect, assert } from 'vitest';
import { discretizeArc } from './discretize-arc.js';

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
    const centerLon = -100;
    const centerLat = 40;
    const radiusNm = 10;
    const points = discretizeArc(centerLon, centerLat, radiusNm, 0, 90, 4);

    const first = points[0];
    const last = points[points.length - 1];
    assert(first && last);

    const radiusLatDeg = radiusNm / 60;
    const cosLat = Math.cos((centerLat * Math.PI) / 180);
    const radiusLonDeg = radiusLatDeg / cosLat;

    assert(Math.abs(first[0] - (centerLon + radiusLonDeg)) < 1e-9);
    assert(Math.abs(first[1] - centerLat) < 1e-9);

    assert(Math.abs(last[0] - centerLon) < 1e-9);
    assert(Math.abs(last[1] - (centerLat + radiusLatDeg)) < 1e-9);
  });

  it('produces a full closed ring when sweeping 0 to 360', () => {
    const points = discretizeArc(-100, 40, 5, 0, 360, 4);
    const first = points[0];
    const last = points[points.length - 1];
    assert(first && last);
    assert(Math.abs(first[0] - last[0]) < 1e-9);
    assert(Math.abs(first[1] - last[1]) < 1e-9);
  });

  it('wraps counterclockwise when end angle <= start angle', () => {
    const wrapped = discretizeArc(-100, 40, 5, 270, 90, 4);
    const explicit = discretizeArc(-100, 40, 5, 270, 450, 4);
    expect(wrapped.length).toBe(explicit.length);
    for (let i = 0; i < wrapped.length; i++) {
      const a = wrapped[i]!;
      const b = explicit[i]!;
      assert(Math.abs(a[0] - b[0]) < 1e-9);
      assert(Math.abs(a[1] - b[1]) < 1e-9);
    }
  });

  it('applies latitude-dependent longitude scaling', () => {
    const equatorial = discretizeArc(0, 0, 60, 0, 0, 2);
    const polar = discretizeArc(0, 60, 60, 0, 0, 2);

    assert(equatorial[0] && polar[0]);
    const dxEq = equatorial[0][0] - 0;
    const dxPolar = polar[0][0] - 0;
    // At latitude 60 degrees, longitude degrees per NM double vs. equator
    // because cos(60) = 0.5.
    assert(Math.abs(dxPolar - dxEq * 2) < 1e-6);
  });

  it('produces radii of ~1 NM = 1/60 degree latitude', () => {
    const points = discretizeArc(0, 0, 1, 90, 90, 2);
    const top = points[0]!;
    assert(Math.abs(top[1] - 1 / 60) < 1e-9);
  });

  it('defaults pointCount to 64', () => {
    const points = discretizeArc(-100, 40, 5, 0, 90);
    expect(points.length).toBe(65);
  });

  it('falls back to latitude scaling when cos(latitude) is zero (poles)', () => {
    // At the poles cos(lat) === 0 - the helper falls back to using the
    // latitude scaling for longitude rather than dividing by zero.
    const points = discretizeArc(0, 90, 1, 0, 90, 2);
    expect(points.length).toBe(3);
    for (const [lon, lat] of points) {
      assert(Number.isFinite(lon));
      assert(Number.isFinite(lat));
    }
  });
});
