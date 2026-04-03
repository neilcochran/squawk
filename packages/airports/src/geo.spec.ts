import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistanceNm } from './geo.js';

describe('haversineDistanceNm', () => {
  it('returns 0 for the same point', () => {
    const dist = haversineDistanceNm(40.6413, -73.7781, 40.6413, -73.7781);
    assert.equal(dist, 0);
  });

  it('computes a known distance between JFK and LAX', () => {
    // JFK: 40.6413 N, 73.7781 W
    // LAX: 33.9425 N, 118.4081 W
    // Known great-circle distance is approximately 2145 nm
    const dist = haversineDistanceNm(40.6413, -73.7781, 33.9425, -118.4081);
    assert.ok(dist > 2100 && dist < 2200, `expected ~2145 nm, got ${dist}`);
  });

  it('computes a short distance between nearby airports', () => {
    // JFK: 40.6413 N, 73.7781 W
    // LGA: 40.7769 N, 73.8740 W
    // Known distance is approximately 10 nm
    const dist = haversineDistanceNm(40.6413, -73.7781, 40.7769, -73.874);
    assert.ok(dist > 5 && dist < 15, `expected ~10 nm, got ${dist}`);
  });

  it('is symmetric', () => {
    const d1 = haversineDistanceNm(40.6413, -73.7781, 33.9425, -118.4081);
    const d2 = haversineDistanceNm(33.9425, -118.4081, 40.6413, -73.7781);
    assert.ok(Math.abs(d1 - d2) < 0.001, 'distance should be symmetric');
  });
});
