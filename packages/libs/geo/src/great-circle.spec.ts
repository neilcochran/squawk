import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { close } from './test-utils.js';
import { distanceNm, bearing, bearingAndDistance, midpoint, destination } from './great-circle.js';

describe('distanceNm', () => {
  it('returns 0 for the same point', () => {
    assert.equal(distanceNm(40.6413, -73.7781, 40.6413, -73.7781), 0);
  });

  it('computes JFK to LAX distance (~2144 NM)', () => {
    // JFK (40.6413, -73.7781) to LAX (33.9425, -118.4081).
    const dist = distanceNm(40.6413, -73.7781, 33.9425, -118.4081);
    assert.ok(close(dist, 2144, 5), `expected ~2144, got ${dist}`);
  });

  it('computes JFK to LGA distance (~9.7 NM)', () => {
    // JFK (40.6413, -73.7781) to LGA (40.7769, -73.8740).
    const dist = distanceNm(40.6413, -73.7781, 40.7769, -73.874);
    assert.ok(close(dist, 9.7, 0.5), `expected ~9.7, got ${dist}`);
  });

  it('is symmetric', () => {
    const d1 = distanceNm(40.6413, -73.7781, 33.9425, -118.4081);
    const d2 = distanceNm(33.9425, -118.4081, 40.6413, -73.7781);
    assert.ok(close(d1, d2, 0.001));
  });

  it('approximates 1 degree of latitude as ~60 NM at the equator', () => {
    const dist = distanceNm(0, 0, 1, 0);
    assert.ok(close(dist, 60, 0.5), `expected ~60, got ${dist}`);
  });
});

describe('bearing', () => {
  it('returns 0/360 for a due-north bearing', () => {
    const brg = bearing(0, 0, 90, 0);
    assert.ok(close(brg, 0, 0.1) || close(brg, 360, 0.1), `expected ~0/360, got ${brg}`);
  });

  it('returns 180 for a due-south bearing', () => {
    const brg = bearing(45, 0, 0, 0);
    assert.ok(close(brg, 180, 0.1), `expected ~180, got ${brg}`);
  });

  it('returns 90 for a due-east bearing from the equator', () => {
    const brg = bearing(0, 0, 0, 10);
    assert.ok(close(brg, 90, 0.1), `expected ~90, got ${brg}`);
  });

  it('returns 270 for a due-west bearing from the equator', () => {
    const brg = bearing(0, 0, 0, -10);
    assert.ok(close(brg, 270, 0.1), `expected ~270, got ${brg}`);
  });

  it('computes a realistic bearing for JFK to LAX', () => {
    // JFK to LAX expected initial bearing roughly 260-280 degrees.
    const brg = bearing(40.6413, -73.7781, 33.9425, -118.4081);
    assert.ok(brg > 260 && brg < 280, `expected 260-280, got ${brg}`);
  });

  it('returns 0 for identical points (degenerate case)', () => {
    const brg = bearing(40.0, -74.0, 40.0, -74.0);
    assert.ok(close(brg, 0, 0.001), `expected 0, got ${brg}`);
  });

  it('returns a finite value in [0, 360) for antipodal points', () => {
    const brg = bearing(90, 0, -90, 0);
    assert.ok(brg >= 0 && brg < 360, `expected 0-360, got ${brg}`);
  });
});

describe('bearingAndDistance', () => {
  it('returns both bearing and distance', () => {
    const result = bearingAndDistance(0, 0, 0, 1);
    assert.ok(close(result.bearingDeg, 90, 0.1), `expected bearing ~90, got ${result.bearingDeg}`);
    assert.ok(close(result.distanceNm, 60, 0.5), `expected ~60 NM, got ${result.distanceNm}`);
  });

  it('matches individual bearing and distance functions', () => {
    const lat1 = 40.6413;
    const lon1 = -73.7781;
    const lat2 = 33.9425;
    const lon2 = -118.4081;
    const result = bearingAndDistance(lat1, lon1, lat2, lon2);
    const expectedBrg = bearing(lat1, lon1, lat2, lon2);
    const expectedDist = distanceNm(lat1, lon1, lat2, lon2);
    assert.ok(close(result.bearingDeg, expectedBrg, 0.001));
    assert.ok(close(result.distanceNm, expectedDist, 0.001));
  });
});

describe('midpoint', () => {
  it('returns the same point for identical inputs', () => {
    const mid = midpoint(40.0, -74.0, 40.0, -74.0);
    assert.ok(close(mid.lat, 40.0, 0.001));
    assert.ok(close(mid.lon, -74.0, 0.001));
  });

  it('returns a point equidistant from both endpoints', () => {
    const lat1 = 40.6413;
    const lon1 = -73.7781;
    const lat2 = 33.9425;
    const lon2 = -118.4081;
    const mid = midpoint(lat1, lon1, lat2, lon2);
    const d1 = distanceNm(lat1, lon1, mid.lat, mid.lon);
    const d2 = distanceNm(mid.lat, mid.lon, lat2, lon2);
    assert.ok(close(d1, d2, 0.1), `expected d1 ~= d2, got ${d1} vs ${d2}`);
  });

  it('lies at roughly half the total distance', () => {
    const lat1 = 40.6413;
    const lon1 = -73.7781;
    const lat2 = 33.9425;
    const lon2 = -118.4081;
    const full = distanceNm(lat1, lon1, lat2, lon2);
    const mid = midpoint(lat1, lon1, lat2, lon2);
    const half = distanceNm(lat1, lon1, mid.lat, mid.lon);
    assert.ok(close(half, full / 2, 0.5), `expected ~${full / 2}, got ${half}`);
  });

  it('is symmetric', () => {
    const m1 = midpoint(40.6413, -73.7781, 33.9425, -118.4081);
    const m2 = midpoint(33.9425, -118.4081, 40.6413, -73.7781);
    assert.ok(close(m1.lat, m2.lat, 0.001));
    assert.ok(close(m1.lon, m2.lon, 0.001));
  });

  it('returns a longitude in the range [-180, 180]', () => {
    // Two points straddling the antimeridian. The midpoint sits on the
    // antimeridian; either -180 or +180 is a valid representation.
    const mid = midpoint(0, 170, 0, -170);
    assert.ok(mid.lon >= -180 && mid.lon <= 180, `expected [-180, 180], got ${mid.lon}`);
    assert.ok(close(Math.abs(mid.lon), 180, 0.001), `expected antimeridian, got ${mid.lon}`);
  });

  it('returns a finite, valid coordinate for antipodal inputs', () => {
    // Antipodal points: midpoint is mathematically underdetermined, but the
    // function must still return a deterministic finite result.
    const mid = midpoint(0, 0, 0, 180);
    assert.ok(Number.isFinite(mid.lat), `expected finite lat, got ${mid.lat}`);
    assert.ok(Number.isFinite(mid.lon), `expected finite lon, got ${mid.lon}`);
    assert.ok(mid.lat >= -90 && mid.lat <= 90, `expected [-90, 90], got ${mid.lat}`);
    assert.ok(mid.lon >= -180 && mid.lon <= 180, `expected [-180, 180], got ${mid.lon}`);
  });
});

describe('destination', () => {
  it('returns the start point for a zero-distance trip', () => {
    const dest = destination(40.6413, -73.7781, 90, 0);
    assert.ok(close(dest.lat, 40.6413, 0.001));
    assert.ok(close(dest.lon, -73.7781, 0.001));
  });

  it('moves due north by ~60 NM ~= 1 degree of latitude', () => {
    const dest = destination(0, 0, 0, 60);
    assert.ok(close(dest.lat, 1, 0.01), `expected ~1, got ${dest.lat}`);
    assert.ok(close(dest.lon, 0, 0.01), `expected ~0, got ${dest.lon}`);
  });

  it('moves due east from the equator by ~60 NM ~= 1 degree of longitude', () => {
    const dest = destination(0, 0, 90, 60);
    assert.ok(close(dest.lat, 0, 0.01), `expected ~0, got ${dest.lat}`);
    assert.ok(close(dest.lon, 1, 0.01), `expected ~1, got ${dest.lon}`);
  });

  it('inverts with distanceNm and bearing', () => {
    // Traveling along the initial bearing for the full distance should
    // arrive at the destination point.
    const lat1 = 40.6413;
    const lon1 = -73.7781;
    const lat2 = 33.9425;
    const lon2 = -118.4081;
    const brg = bearing(lat1, lon1, lat2, lon2);
    const dist = distanceNm(lat1, lon1, lat2, lon2);
    const dest = destination(lat1, lon1, brg, dist);
    assert.ok(close(dest.lat, lat2, 0.01), `expected lat ~${lat2}, got ${dest.lat}`);
    assert.ok(close(dest.lon, lon2, 0.01), `expected lon ~${lon2}, got ${dest.lon}`);
  });

  it('returns a longitude in the range [-180, 180]', () => {
    // Start near the antimeridian and travel east to wrap.
    const dest = destination(0, 179, 90, 200);
    assert.ok(dest.lon >= -180 && dest.lon <= 180, `expected [-180, 180], got ${dest.lon}`);
  });

  it('moves due south from the equator by ~60 NM ~= -1 degree of latitude', () => {
    const dest = destination(0, 0, 180, 60);
    assert.ok(close(dest.lat, -1, 0.01), `expected ~-1, got ${dest.lat}`);
    assert.ok(close(dest.lon, 0, 0.01), `expected ~0, got ${dest.lon}`);
  });

  it('normalizes bearings greater than 360', () => {
    const d1 = destination(0, 0, 450, 60);
    const d2 = destination(0, 0, 90, 60);
    assert.ok(close(d1.lat, d2.lat, 0.0001), `expected same lat as bearing=90, got ${d1.lat}`);
    assert.ok(close(d1.lon, d2.lon, 0.0001), `expected same lon as bearing=90, got ${d1.lon}`);
  });

  it('normalizes negative bearings', () => {
    const d1 = destination(0, 0, -90, 60);
    const d2 = destination(0, 0, 270, 60);
    assert.ok(close(d1.lat, d2.lat, 0.0001), `expected same lat as bearing=270, got ${d1.lat}`);
    assert.ok(close(d1.lon, d2.lon, 0.0001), `expected same lon as bearing=270, got ${d1.lon}`);
  });

  it('handles travel that crosses the north pole', () => {
    // Start at 80N, travel due north 1200 NM (20 deg angular): crosses the
    // pole and continues south on the opposite meridian.
    const dest = destination(80, 0, 0, 1200);
    assert.ok(Number.isFinite(dest.lat) && Number.isFinite(dest.lon), 'expected finite result');
    assert.ok(dest.lat >= -90 && dest.lat <= 90, `expected [-90, 90], got ${dest.lat}`);
    // After crossing the pole, the longitude should be on the opposite side.
    assert.ok(close(Math.abs(dest.lon), 180, 0.001), `expected ~180 or ~-180, got ${dest.lon}`);
  });

  it('treats negative distance as travel in the opposite direction', () => {
    // Traveling -60 NM at bearing 90 should equal +60 NM at bearing 270.
    const d1 = destination(0, 0, 90, -60);
    const d2 = destination(0, 0, 270, 60);
    assert.ok(close(d1.lat, d2.lat, 0.0001), `expected same lat, got ${d1.lat} vs ${d2.lat}`);
    assert.ok(close(d1.lon, d2.lon, 0.0001), `expected same lon, got ${d1.lon} vs ${d2.lon}`);
  });
});
