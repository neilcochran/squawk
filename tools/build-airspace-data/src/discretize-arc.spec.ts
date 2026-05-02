import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { discretizeArc } from './discretize-arc.js';

describe('discretizeArc', () => {
  it('generates (pointCount + 1) coordinates by default', () => {
    const points = discretizeArc(-100, 40, 5, 0, 90);
    assert.equal(points.length, 65);
  });

  it('honors a custom pointCount', () => {
    const points = discretizeArc(-100, 40, 5, 0, 90, 8);
    assert.equal(points.length, 9);
  });

  it('starts at the start angle and ends at the end angle', () => {
    const centerLon = -100;
    const centerLat = 40;
    const radiusNm = 10;
    const points = discretizeArc(centerLon, centerLat, radiusNm, 0, 90, 4);

    const first = points[0];
    const last = points[points.length - 1];
    assert.ok(first && last);

    const radiusLatDeg = radiusNm / 60;
    const cosLat = Math.cos((centerLat * Math.PI) / 180);
    const radiusLonDeg = radiusLatDeg / cosLat;

    assert.ok(Math.abs(first[0] - (centerLon + radiusLonDeg)) < 1e-9);
    assert.ok(Math.abs(first[1] - centerLat) < 1e-9);

    assert.ok(Math.abs(last[0] - centerLon) < 1e-9);
    assert.ok(Math.abs(last[1] - (centerLat + radiusLatDeg)) < 1e-9);
  });

  it('produces a full closed ring when sweeping 0 to 360', () => {
    const points = discretizeArc(-100, 40, 5, 0, 360, 4);
    const first = points[0];
    const last = points[points.length - 1];
    assert.ok(first && last);
    assert.ok(Math.abs(first[0] - last[0]) < 1e-9);
    assert.ok(Math.abs(first[1] - last[1]) < 1e-9);
  });

  it('wraps counterclockwise when end angle <= start angle', () => {
    const wrapped = discretizeArc(-100, 40, 5, 270, 90, 4);
    const explicit = discretizeArc(-100, 40, 5, 270, 450, 4);
    assert.equal(wrapped.length, explicit.length);
    for (let i = 0; i < wrapped.length; i++) {
      const a = wrapped[i]!;
      const b = explicit[i]!;
      assert.ok(Math.abs(a[0] - b[0]) < 1e-9);
      assert.ok(Math.abs(a[1] - b[1]) < 1e-9);
    }
  });

  it('applies latitude-dependent longitude scaling', () => {
    const equatorial = discretizeArc(0, 0, 60, 0, 0, 2);
    const polar = discretizeArc(0, 60, 60, 0, 0, 2);

    assert.ok(equatorial[0] && polar[0]);
    const dxEq = equatorial[0][0] - 0;
    const dxPolar = polar[0][0] - 0;
    // At latitude 60 degrees, longitude degrees per NM double vs. equator
    // because cos(60) = 0.5.
    assert.ok(Math.abs(dxPolar - dxEq * 2) < 1e-6);
  });

  it('produces radii of ~1 NM = 1/60 degree latitude', () => {
    const points = discretizeArc(0, 0, 1, 90, 90, 2);
    const top = points[0]!;
    assert.ok(Math.abs(top[1] - 1 / 60) < 1e-9);
  });

  it('defaults pointCount to 64', () => {
    const points = discretizeArc(-100, 40, 5, 0, 90);
    assert.equal(points.length, 65);
  });
});
