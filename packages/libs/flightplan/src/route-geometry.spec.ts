import assert from 'node:assert/strict';

import { describe, it } from 'vitest';

import { extractRoutePoints, routeToLineString } from './route-geometry.js';
import {
  makeAirport,
  makeAirway,
  makeCoordinate,
  makeDirect,
  makeSid,
  makeSpeedAltitude,
  makeStar,
  makeUnresolved,
  makeWaypoint,
  route,
} from './test-utils.js';

// ---------------------------------------------------------------------------
// extractRoutePoints
// ---------------------------------------------------------------------------

describe('extractRoutePoints', () => {
  it('returns an empty array for an empty route', () => {
    assert.deepEqual(extractRoutePoints(route([])), []);
  });

  it('returns label/lat/lon for airport, waypoint, and coordinate elements', () => {
    const points = extractRoutePoints(
      route([
        makeAirport('KJFK', 40.6413, -73.7781),
        makeWaypoint('MERIT', 41.0, -73.0),
        makeCoordinate('4200N07200W', 42.0, -72.0),
      ]),
    );

    assert.deepEqual(points, [
      { label: 'KJFK', lat: 40.6413, lon: -73.7781 },
      { label: 'MERIT', lat: 41.0, lon: -73.0 },
      { label: '4200N07200W', lat: 42.0, lon: -72.0 },
    ]);
  });

  it('does not expose the internal precomputed distance field', () => {
    const points = extractRoutePoints(
      route([
        makeAirway('J60', [
          { identifier: 'A', lat: 40.0, lon: -74.0, distanceToNextNm: 100 },
          { identifier: 'B', lat: 41.0, lon: -74.0 },
        ]),
      ]),
    );

    assert.equal(points.length, 2);
    for (const point of points) {
      assert.deepEqual(Object.keys(point).sort(), ['label', 'lat', 'lon']);
    }
  });

  it('expands airway waypoints into individual points', () => {
    const points = extractRoutePoints(
      route([
        makeAirway('J60', [
          { identifier: 'A', lat: 40.0, lon: -74.0 },
          { identifier: 'B', lat: 41.0, lon: -74.0 },
          { identifier: 'C', lat: 42.0, lon: -74.0 },
        ]),
      ]),
    );

    assert.deepEqual(
      points.map((p) => p.label),
      ['A', 'B', 'C'],
    );
  });

  it('uses airway waypoint name as label when identifier is absent', () => {
    const points = extractRoutePoints(
      route([
        makeAirway('J60', [
          { name: 'ALPHA POINT', lat: 40.0, lon: -74.0 },
          { name: 'BRAVO POINT', lat: 41.0, lon: -74.0 },
        ]),
      ]),
    );

    assert.deepEqual(
      points.map((p) => p.label),
      ['ALPHA POINT', 'BRAVO POINT'],
    );
  });

  it('flattens SID legs into points', () => {
    const points = extractRoutePoints(
      route([
        makeSid('DEEZZ5', [
          { fixIdentifier: 'RWY', lat: 40.0, lon: -74.0 },
          { fixIdentifier: 'TURNN', lat: 40.5, lon: -74.0 },
          { fixIdentifier: 'DEEZZ', lat: 41.0, lon: -74.0 },
        ]),
      ]),
    );

    assert.deepEqual(
      points.map((p) => p.label),
      ['RWY', 'TURNN', 'DEEZZ'],
    );
  });

  it('flattens STAR legs into points', () => {
    const points = extractRoutePoints(
      route([
        makeStar('ARRIV3', [
          { fixIdentifier: 'ENTER', lat: 41.0, lon: -74.0 },
          { fixIdentifier: 'DESCN', lat: 40.5, lon: -74.0 },
          { fixIdentifier: 'FINAL', lat: 40.0, lon: -74.0 },
        ]),
      ]),
    );

    assert.deepEqual(
      points.map((p) => p.label),
      ['ENTER', 'DESCN', 'FINAL'],
    );
  });

  it('skips procedure legs that lack a fix identifier or coordinates', () => {
    const points = extractRoutePoints(
      route([
        makeSid('CLIMB1', [
          { fixIdentifier: 'RWY', lat: 40.0, lon: -74.0 },
          {},
          { fixIdentifier: 'TOP', lat: 40.5, lon: -74.0 },
        ]),
      ]),
    );

    assert.deepEqual(
      points.map((p) => p.label),
      ['RWY', 'TOP'],
    );
  });

  it('suppresses consecutive duplicate points', () => {
    const points = extractRoutePoints(
      route([
        makeWaypoint('MERIT', 40.5, -74.0),
        makeAirway('J60', [
          { identifier: 'MERIT', lat: 40.5, lon: -74.0 },
          { identifier: 'MARTN', lat: 41.0, lon: -74.0 },
        ]),
      ]),
    );

    assert.deepEqual(
      points.map((p) => p.label),
      ['MERIT', 'MARTN'],
    );
  });

  it('contributes no points for DCT, speed/altitude, and unresolved elements', () => {
    const points = extractRoutePoints(
      route([makeDirect(), makeSpeedAltitude(), makeUnresolved('XYZZY')]),
    );

    assert.deepEqual(points, []);
  });
});

// ---------------------------------------------------------------------------
// routeToLineString
// ---------------------------------------------------------------------------

describe('routeToLineString', () => {
  it('builds a LineString with [lon, lat] coordinates', () => {
    const line = routeToLineString(
      route([makeWaypoint('A', 40.0, -74.0), makeWaypoint('B', 41.0, -73.0)]),
    );

    assert.deepEqual(line, {
      type: 'LineString',
      coordinates: [
        [-74.0, 40.0],
        [-73.0, 41.0],
      ],
    });
  });

  it('returns undefined for an empty route', () => {
    assert.equal(routeToLineString(route([])), undefined);
  });

  it('returns undefined when the route yields a single point', () => {
    assert.equal(routeToLineString(route([makeWaypoint('SOLO', 40.0, -74.0)])), undefined);
  });
});
