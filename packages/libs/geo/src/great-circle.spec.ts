import { describe, it, expect, assert } from 'vitest';

import {
  distanceNm,
  bearing,
  bearingAndDistance,
  midpoint,
  destination,
  densify,
} from './great-circle.js';
import { close } from './test-utils.js';

describe('distanceNm', () => {
  it('returns 0 for the same point', () => {
    expect(distanceNm(40.6413, -73.7781, 40.6413, -73.7781)).toBe(0);
  });

  it('computes JFK to LAX distance (~2144 NM)', () => {
    // JFK (40.6413, -73.7781) to LAX (33.9425, -118.4081).
    const dist = distanceNm(40.6413, -73.7781, 33.9425, -118.4081);
    assert(close(dist, 2144, 5), `expected ~2144, got ${dist}`);
  });

  it('computes JFK to LGA distance (~9.7 NM)', () => {
    // JFK (40.6413, -73.7781) to LGA (40.7769, -73.8740).
    const dist = distanceNm(40.6413, -73.7781, 40.7769, -73.874);
    assert(close(dist, 9.7, 0.5), `expected ~9.7, got ${dist}`);
  });

  it('is symmetric', () => {
    const d1 = distanceNm(40.6413, -73.7781, 33.9425, -118.4081);
    const d2 = distanceNm(33.9425, -118.4081, 40.6413, -73.7781);
    assert(close(d1, d2, 0.001));
  });

  it('approximates 1 degree of latitude as ~60 NM at the equator', () => {
    const dist = distanceNm(0, 0, 1, 0);
    assert(close(dist, 60, 0.5), `expected ~60, got ${dist}`);
  });
});

describe('bearing', () => {
  it('returns 0/360 for a due-north bearing', () => {
    const brg = bearing(0, 0, 90, 0);
    assert(close(brg, 0, 0.1) || close(brg, 360, 0.1), `expected ~0/360, got ${brg}`);
  });

  it('returns 180 for a due-south bearing', () => {
    const brg = bearing(45, 0, 0, 0);
    assert(close(brg, 180, 0.1), `expected ~180, got ${brg}`);
  });

  it('returns 90 for a due-east bearing from the equator', () => {
    const brg = bearing(0, 0, 0, 10);
    assert(close(brg, 90, 0.1), `expected ~90, got ${brg}`);
  });

  it('returns 270 for a due-west bearing from the equator', () => {
    const brg = bearing(0, 0, 0, -10);
    assert(close(brg, 270, 0.1), `expected ~270, got ${brg}`);
  });

  it('computes a realistic bearing for JFK to LAX', () => {
    // JFK to LAX expected initial bearing roughly 260-280 degrees.
    const brg = bearing(40.6413, -73.7781, 33.9425, -118.4081);
    assert(brg > 260 && brg < 280, `expected 260-280, got ${brg}`);
  });

  it('returns 0 for identical points (degenerate case)', () => {
    const brg = bearing(40.0, -74.0, 40.0, -74.0);
    assert(close(brg, 0, 0.001), `expected 0, got ${brg}`);
  });

  it('returns a finite value in [0, 360) for antipodal points', () => {
    const brg = bearing(90, 0, -90, 0);
    assert(brg >= 0 && brg < 360, `expected 0-360, got ${brg}`);
  });
});

describe('bearingAndDistance', () => {
  it('returns both bearing and distance', () => {
    const result = bearingAndDistance(0, 0, 0, 1);
    assert(close(result.bearingDeg, 90, 0.1), `expected bearing ~90, got ${result.bearingDeg}`);
    assert(close(result.distanceNm, 60, 0.5), `expected ~60 NM, got ${result.distanceNm}`);
  });

  it('matches individual bearing and distance functions', () => {
    const lat1 = 40.6413;
    const lon1 = -73.7781;
    const lat2 = 33.9425;
    const lon2 = -118.4081;
    const result = bearingAndDistance(lat1, lon1, lat2, lon2);
    const expectedBrg = bearing(lat1, lon1, lat2, lon2);
    const expectedDist = distanceNm(lat1, lon1, lat2, lon2);
    assert(close(result.bearingDeg, expectedBrg, 0.001));
    assert(close(result.distanceNm, expectedDist, 0.001));
  });
});

describe('midpoint', () => {
  it('returns the same point for identical inputs', () => {
    const mid = midpoint(40.0, -74.0, 40.0, -74.0);
    assert(close(mid.lat, 40.0, 0.001));
    assert(close(mid.lon, -74.0, 0.001));
  });

  it('returns a point equidistant from both endpoints', () => {
    const lat1 = 40.6413;
    const lon1 = -73.7781;
    const lat2 = 33.9425;
    const lon2 = -118.4081;
    const mid = midpoint(lat1, lon1, lat2, lon2);
    const d1 = distanceNm(lat1, lon1, mid.lat, mid.lon);
    const d2 = distanceNm(mid.lat, mid.lon, lat2, lon2);
    assert(close(d1, d2, 0.1), `expected d1 ~= d2, got ${d1} vs ${d2}`);
  });

  it('lies at roughly half the total distance', () => {
    const lat1 = 40.6413;
    const lon1 = -73.7781;
    const lat2 = 33.9425;
    const lon2 = -118.4081;
    const full = distanceNm(lat1, lon1, lat2, lon2);
    const mid = midpoint(lat1, lon1, lat2, lon2);
    const half = distanceNm(lat1, lon1, mid.lat, mid.lon);
    assert(close(half, full / 2, 0.5), `expected ~${full / 2}, got ${half}`);
  });

  it('is symmetric', () => {
    const m1 = midpoint(40.6413, -73.7781, 33.9425, -118.4081);
    const m2 = midpoint(33.9425, -118.4081, 40.6413, -73.7781);
    assert(close(m1.lat, m2.lat, 0.001));
    assert(close(m1.lon, m2.lon, 0.001));
  });

  it('returns a longitude in the range [-180, 180]', () => {
    // Two points straddling the antimeridian. The midpoint sits on the
    // antimeridian; either -180 or +180 is a valid representation.
    const mid = midpoint(0, 170, 0, -170);
    assert(mid.lon >= -180 && mid.lon <= 180, `expected [-180, 180], got ${mid.lon}`);
    assert(close(Math.abs(mid.lon), 180, 0.001), `expected antimeridian, got ${mid.lon}`);
  });

  it('returns a finite, valid coordinate for antipodal inputs', () => {
    // Antipodal points: midpoint is mathematically underdetermined, but the
    // function must still return a deterministic finite result.
    const mid = midpoint(0, 0, 0, 180);
    assert(Number.isFinite(mid.lat), `expected finite lat, got ${mid.lat}`);
    assert(Number.isFinite(mid.lon), `expected finite lon, got ${mid.lon}`);
    assert(mid.lat >= -90 && mid.lat <= 90, `expected [-90, 90], got ${mid.lat}`);
    assert(mid.lon >= -180 && mid.lon <= 180, `expected [-180, 180], got ${mid.lon}`);
  });
});

describe('destination', () => {
  it('returns the start point for a zero-distance trip', () => {
    const dest = destination(40.6413, -73.7781, 90, 0);
    assert(close(dest.lat, 40.6413, 0.001));
    assert(close(dest.lon, -73.7781, 0.001));
  });

  it('moves due north by ~60 NM ~= 1 degree of latitude', () => {
    const dest = destination(0, 0, 0, 60);
    assert(close(dest.lat, 1, 0.01), `expected ~1, got ${dest.lat}`);
    assert(close(dest.lon, 0, 0.01), `expected ~0, got ${dest.lon}`);
  });

  it('moves due east from the equator by ~60 NM ~= 1 degree of longitude', () => {
    const dest = destination(0, 0, 90, 60);
    assert(close(dest.lat, 0, 0.01), `expected ~0, got ${dest.lat}`);
    assert(close(dest.lon, 1, 0.01), `expected ~1, got ${dest.lon}`);
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
    assert(close(dest.lat, lat2, 0.01), `expected lat ~${lat2}, got ${dest.lat}`);
    assert(close(dest.lon, lon2, 0.01), `expected lon ~${lon2}, got ${dest.lon}`);
  });

  it('returns a longitude in the range [-180, 180]', () => {
    // Start near the antimeridian and travel east to wrap.
    const dest = destination(0, 179, 90, 200);
    assert(dest.lon >= -180 && dest.lon <= 180, `expected [-180, 180], got ${dest.lon}`);
  });

  it('moves due south from the equator by ~60 NM ~= -1 degree of latitude', () => {
    const dest = destination(0, 0, 180, 60);
    assert(close(dest.lat, -1, 0.01), `expected ~-1, got ${dest.lat}`);
    assert(close(dest.lon, 0, 0.01), `expected ~0, got ${dest.lon}`);
  });

  it('normalizes bearings greater than 360', () => {
    const d1 = destination(0, 0, 450, 60);
    const d2 = destination(0, 0, 90, 60);
    assert(close(d1.lat, d2.lat, 0.0001), `expected same lat as bearing=90, got ${d1.lat}`);
    assert(close(d1.lon, d2.lon, 0.0001), `expected same lon as bearing=90, got ${d1.lon}`);
  });

  it('normalizes negative bearings', () => {
    const d1 = destination(0, 0, -90, 60);
    const d2 = destination(0, 0, 270, 60);
    assert(close(d1.lat, d2.lat, 0.0001), `expected same lat as bearing=270, got ${d1.lat}`);
    assert(close(d1.lon, d2.lon, 0.0001), `expected same lon as bearing=270, got ${d1.lon}`);
  });

  it('handles travel that crosses the north pole', () => {
    // Start at 80N, travel due north 1200 NM (20 deg angular): crosses the
    // pole and continues south on the opposite meridian.
    const dest = destination(80, 0, 0, 1200);
    assert(Number.isFinite(dest.lat) && Number.isFinite(dest.lon), 'expected finite result');
    assert(dest.lat >= -90 && dest.lat <= 90, `expected [-90, 90], got ${dest.lat}`);
    // After crossing the pole, the longitude should be on the opposite side.
    assert(close(Math.abs(dest.lon), 180, 0.001), `expected ~180 or ~-180, got ${dest.lon}`);
  });

  it('treats negative distance as travel in the opposite direction', () => {
    // Traveling -60 NM at bearing 90 should equal +60 NM at bearing 270.
    const d1 = destination(0, 0, 90, -60);
    const d2 = destination(0, 0, 270, 60);
    assert(close(d1.lat, d2.lat, 0.0001), `expected same lat, got ${d1.lat} vs ${d2.lat}`);
    assert(close(d1.lon, d2.lon, 0.0001), `expected same lon, got ${d1.lon} vs ${d2.lon}`);
  });
});

describe('densify', () => {
  it('returns just the endpoints for an arc shorter than the limit', () => {
    // JFK to LGA is ~9.7 NM.
    expect(densify(40.6413, -73.7781, 40.7769, -73.874, 25)).toEqual([
      { lat: 40.6413, lon: -73.7781 },
      { lat: 40.7769, lon: -73.874 },
    ]);
  });

  it('returns the endpoints exactly as given', () => {
    const points = densify(40.6413, -73.7781, 33.9425, -118.4081, 25);
    expect(points[0]).toEqual({ lat: 40.6413, lon: -73.7781 });
    expect(points.at(-1)).toEqual({ lat: 33.9425, lon: -118.4081 });
  });

  it('uses the fewest equal segments that keep each within the limit', () => {
    // 1 degree of longitude along the equator is ~60 NM: three segments at a
    // 25 NM limit, so four points.
    const points = densify(0, 0, 0, 1, 25);
    expect(points).toHaveLength(4);
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1];
      const current = points[i];
      assert(previous !== undefined && current !== undefined);
      const step = distanceNm(previous.lat, previous.lon, current.lat, current.lon);
      assert(close(step, 20, 0.05), `expected ~20 NM steps, got ${step}`);
    }
  });

  it('lays every point on the great circle between the endpoints', () => {
    // JFK to LAX: each point's distance from both ends sums to the total.
    const total = distanceNm(40.6413, -73.7781, 33.9425, -118.4081);
    for (const point of densify(40.6413, -73.7781, 33.9425, -118.4081, 50)) {
      const fromStart = distanceNm(40.6413, -73.7781, point.lat, point.lon);
      const toEnd = distanceNm(point.lat, point.lon, 33.9425, -118.4081);
      assert(close(fromStart + toEnd, total, 0.01), `expected point on the arc, got ${point.lat}`);
    }
  });

  it('bows poleward of the straight line on a long east-west leg', () => {
    // The great circle between two points at 40N peaks north of 40N.
    const points = densify(40, -120, 40, -75, 100);
    const peak = Math.max(...points.map((point) => point.lat));
    assert(peak > 42, `expected the arc to rise above 42N, got ${peak}`);
  });

  it('normalizes longitudes across the antimeridian', () => {
    const points = densify(52, 175, 52, -175, 25);
    for (const point of points) {
      assert(point.lon >= -180 && point.lon <= 180, `expected [-180, 180], got ${point.lon}`);
    }
    expect(points.some((point) => point.lon > 175)).toBe(true);
    expect(points.some((point) => point.lon < -175)).toBe(true);
  });

  it('returns both endpoints for coincident points', () => {
    expect(densify(40, -75, 40, -75, 25)).toEqual([
      { lat: 40, lon: -75 },
      { lat: 40, lon: -75 },
    ]);
  });

  it('returns finite points for antipodal inputs', () => {
    const points = densify(0, 0, 0, 180, 1000);
    for (const point of points) {
      assert(Number.isFinite(point.lat) && Number.isFinite(point.lon), 'expected finite result');
    }
  });

  it('rejects a limit that is not a positive finite number', () => {
    expect(() => densify(0, 0, 0, 1, 0)).toThrow(RangeError);
    expect(() => densify(0, 0, 0, 1, -5)).toThrow(RangeError);
    expect(() => densify(0, 0, 0, 1, Number.NaN)).toThrow(RangeError);
    expect(() => densify(0, 0, 0, 1, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
