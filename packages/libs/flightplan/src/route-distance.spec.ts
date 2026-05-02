import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert/strict';
import { greatCircle } from '@squawk/geo';
import type { Airport, AirwayWaypoint } from '@squawk/types';
import { computeRouteDistance } from './route-distance.js';
import type {
  ParsedRoute,
  RouteElement,
  AirportRouteElement,
  WaypointRouteElement,
  CoordinateRouteElement,
  DirectRouteElement,
  SpeedAltitudeRouteElement,
  AirwayRouteElement,
  SidRouteElement,
  StarRouteElement,
  UnresolvedRouteElement,
  FlightplanResolver,
} from './resolver.js';

/**
 * Returns true if two numbers are within the given delta of each other.
 */
function close(a: number, b: number, delta = 0.01): boolean {
  return Math.abs(a - b) <= delta;
}

// ---------------------------------------------------------------------------
// Synthetic element helpers
// ---------------------------------------------------------------------------

function makeAirport(raw: string, lat: number, lon: number): AirportRouteElement {
  return {
    type: 'airport',
    raw,
    airport: { lat, lon, faaId: raw, name: raw } as Airport,
  };
}

function makeWaypoint(raw: string, lat: number, lon: number): WaypointRouteElement {
  return { type: 'waypoint', raw, lat, lon };
}

function makeCoordinate(raw: string, lat: number, lon: number): CoordinateRouteElement {
  return { type: 'coordinate', raw, lat, lon };
}

function makeDirect(): DirectRouteElement {
  return { type: 'direct', raw: 'DCT' };
}

function makeSpeedAltitude(): SpeedAltitudeRouteElement {
  return { type: 'speedAltitude', raw: 'N0450F350', speedKt: 450, flightLevel: 350 };
}

function makeUnresolved(raw: string): UnresolvedRouteElement {
  return { type: 'unresolved', raw };
}

function makeAirway(
  raw: string,
  waypoints: {
    name?: string;
    identifier?: string;
    lat: number;
    lon: number;
    distanceToNextNm?: number;
  }[],
): AirwayRouteElement {
  return {
    type: 'airway',
    raw,
    airway: { designation: raw, type: 'JET', region: 'US', waypoints: [] } as never,
    entryFix: waypoints[0]?.identifier ?? waypoints[0]?.name ?? '',
    exitFix:
      waypoints[waypoints.length - 1]?.identifier ?? waypoints[waypoints.length - 1]?.name ?? '',
    waypoints: waypoints.map((wp) => {
      const base: AirwayWaypoint = {
        name: wp.name ?? wp.identifier ?? '',
        waypointType: 'FIX',
        lat: wp.lat,
        lon: wp.lon,
      };
      if (wp.identifier !== undefined) {
        base.identifier = wp.identifier;
      }
      if (wp.distanceToNextNm !== undefined) {
        base.distanceToNextNm = wp.distanceToNextNm;
      }
      return base;
    }),
  };
}

function makeSid(
  raw: string,
  fixes: { fixIdentifier: string; lat: number; lon: number }[],
): SidRouteElement {
  return {
    type: 'sid',
    raw,
    procedure: {
      name: raw,
      identifier: raw,
      type: 'SID',
      airports: [],
      commonRoutes: [],
      transitions: [],
    },
    legs: fixes.map((wp) => ({
      pathTerminator: 'TF' as const,
      fixIdentifier: wp.fixIdentifier,
      category: 'FIX' as const,
      lat: wp.lat,
      lon: wp.lon,
    })),
  };
}

function makeStar(
  raw: string,
  fixes: { fixIdentifier: string; lat: number; lon: number }[],
): StarRouteElement {
  return {
    type: 'star',
    raw,
    procedure: {
      name: raw,
      identifier: raw,
      type: 'STAR',
      airports: [],
      commonRoutes: [],
      transitions: [],
    },
    legs: fixes.map((wp) => ({
      pathTerminator: 'TF' as const,
      fixIdentifier: wp.fixIdentifier,
      category: 'FIX' as const,
      lat: wp.lat,
      lon: wp.lon,
    })),
  };
}

function route(elements: RouteElement[]): ParsedRoute {
  return { raw: 'test', elements };
}

// ---------------------------------------------------------------------------
// Unit tests (synthetic data)
// ---------------------------------------------------------------------------

describe('computeRouteDistance', () => {
  describe('empty and minimal routes', () => {
    it('returns zero for an empty route', () => {
      const result = computeRouteDistance(route([]));
      assert.equal(result.totalDistanceNm, 0);
      assert.equal(result.legs.length, 0);
      assert.equal(result.unresolvedElements.length, 0);
      assert.equal(result.estimatedTimeEnrouteHrs, undefined);
    });

    it('returns zero for a single geographic element', () => {
      const result = computeRouteDistance(route([makeWaypoint('MERIT', 40.0, -74.0)]));
      assert.equal(result.totalDistanceNm, 0);
      assert.equal(result.legs.length, 0);
    });
  });

  describe('basic distance computation', () => {
    it('computes distance between two waypoints', () => {
      // JFK area to a point ~60 nm north
      const p1 = makeWaypoint('AAA', 40.0, -74.0);
      const p2 = makeWaypoint('BBB', 41.0, -74.0);
      const expected = greatCircle.distanceNm(40.0, -74.0, 41.0, -74.0);

      const result = computeRouteDistance(route([p1, p2]));
      assert.equal(result.legs.length, 1);
      assert.ok(close(result.totalDistanceNm, expected));
      assert.equal(result.legs[0]!.from, 'AAA');
      assert.equal(result.legs[0]!.to, 'BBB');
      assert.ok(close(result.legs[0]!.distanceNm, expected));
      assert.ok(close(result.legs[0]!.cumulativeDistanceNm, expected));
    });

    it('computes cumulative distance across multiple legs', () => {
      const p1 = makeWaypoint('A', 40.0, -74.0);
      const p2 = makeWaypoint('B', 41.0, -74.0);
      const p3 = makeWaypoint('C', 42.0, -74.0);
      const d1 = greatCircle.distanceNm(40.0, -74.0, 41.0, -74.0);
      const d2 = greatCircle.distanceNm(41.0, -74.0, 42.0, -74.0);

      const result = computeRouteDistance(route([p1, p2, p3]));
      assert.equal(result.legs.length, 2);
      assert.ok(close(result.legs[0]!.cumulativeDistanceNm, d1));
      assert.ok(close(result.legs[1]!.cumulativeDistanceNm, d1 + d2));
      assert.ok(close(result.totalDistanceNm, d1 + d2));
    });

    it('handles airport elements', () => {
      const p1 = makeAirport('KJFK', 40.6413, -73.7781);
      const p2 = makeAirport('KLGA', 40.7769, -73.874);
      const expected = greatCircle.distanceNm(40.6413, -73.7781, 40.7769, -73.874);

      const result = computeRouteDistance(route([p1, p2]));
      assert.ok(close(result.totalDistanceNm, expected));
    });

    it('handles coordinate elements', () => {
      const p1 = makeCoordinate('4000N07400W', 40.0, -74.0);
      const p2 = makeCoordinate('4100N07400W', 41.0, -74.0);
      const expected = greatCircle.distanceNm(40.0, -74.0, 41.0, -74.0);

      const result = computeRouteDistance(route([p1, p2]));
      assert.ok(close(result.totalDistanceNm, expected));
    });
  });

  describe('non-geographic elements', () => {
    it('skips DCT markers', () => {
      const p1 = makeWaypoint('A', 40.0, -74.0);
      const p2 = makeWaypoint('B', 41.0, -74.0);
      const expected = greatCircle.distanceNm(40.0, -74.0, 41.0, -74.0);

      const result = computeRouteDistance(route([p1, makeDirect(), p2]));
      assert.equal(result.legs.length, 1);
      assert.ok(close(result.totalDistanceNm, expected));
      assert.equal(result.unresolvedElements.length, 0);
    });

    it('skips speed/altitude groups', () => {
      const p1 = makeWaypoint('A', 40.0, -74.0);
      const p2 = makeWaypoint('B', 41.0, -74.0);
      const expected = greatCircle.distanceNm(40.0, -74.0, 41.0, -74.0);

      const result = computeRouteDistance(route([p1, makeSpeedAltitude(), p2]));
      assert.equal(result.legs.length, 1);
      assert.ok(close(result.totalDistanceNm, expected));
      assert.equal(result.unresolvedElements.length, 0);
    });
  });

  describe('unresolved elements', () => {
    it('collects unresolved element between waypoints', () => {
      const p1 = makeWaypoint('A', 40.0, -74.0);
      const unresolved = makeUnresolved('XYZZY');
      const p2 = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteDistance(route([p1, unresolved, p2]));
      assert.equal(result.unresolvedElements.length, 1);
      assert.equal(result.unresolvedElements[0], unresolved);
      assert.equal(result.legs.length, 1);
    });

    it('collects multiple adjacent unresolved elements', () => {
      const p1 = makeWaypoint('A', 40.0, -74.0);
      const u1 = makeUnresolved('XXX');
      const u2 = makeUnresolved('YYY');
      const p2 = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteDistance(route([p1, u1, u2, p2]));
      assert.equal(result.unresolvedElements.length, 2);
      assert.equal(result.unresolvedElements[0], u1);
      assert.equal(result.unresolvedElements[1], u2);
    });

    it('collects leading unresolved elements', () => {
      const u1 = makeUnresolved('XXX');
      const p1 = makeWaypoint('A', 40.0, -74.0);
      const p2 = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteDistance(route([u1, p1, p2]));
      assert.equal(result.unresolvedElements.length, 1);
    });

    it('collects trailing unresolved elements', () => {
      const p1 = makeWaypoint('A', 40.0, -74.0);
      const p2 = makeWaypoint('B', 41.0, -74.0);
      const u1 = makeUnresolved('XXX');

      const result = computeRouteDistance(route([p1, p2, u1]));
      assert.equal(result.unresolvedElements.length, 1);
    });

    it('does not include DCT in unresolvedElements', () => {
      const p1 = makeWaypoint('A', 40.0, -74.0);
      const p2 = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteDistance(route([p1, makeDirect(), p2]));
      assert.equal(result.unresolvedElements.length, 0);
    });

    it('does not include speedAltitude in unresolvedElements', () => {
      const p1 = makeWaypoint('A', 40.0, -74.0);
      const p2 = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteDistance(route([p1, makeSpeedAltitude(), p2]));
      assert.equal(result.unresolvedElements.length, 0);
    });
  });

  describe('airway elements', () => {
    it('produces legs for each internal waypoint pair', () => {
      const awp = makeAirway('J60', [
        { identifier: 'A', lat: 40.0, lon: -74.0 },
        { identifier: 'B', lat: 41.0, lon: -74.0 },
        { identifier: 'C', lat: 42.0, lon: -74.0 },
      ]);

      const result = computeRouteDistance(route([awp]));
      assert.equal(result.legs.length, 2);
      assert.equal(result.legs[0]!.from, 'A');
      assert.equal(result.legs[0]!.to, 'B');
      assert.equal(result.legs[1]!.from, 'B');
      assert.equal(result.legs[1]!.to, 'C');
    });

    it('uses precomputed distanceToNextNm when available', () => {
      const awp = makeAirway('J60', [
        { identifier: 'A', lat: 40.0, lon: -74.0, distanceToNextNm: 100 },
        { identifier: 'B', lat: 41.0, lon: -74.0, distanceToNextNm: 50 },
        { identifier: 'C', lat: 42.0, lon: -74.0 },
      ]);

      const result = computeRouteDistance(route([awp]));
      assert.equal(result.legs[0]!.distanceNm, 100);
      assert.equal(result.legs[1]!.distanceNm, 50);
      assert.equal(result.totalDistanceNm, 150);
    });

    it('falls back to great-circle when distanceToNextNm is absent', () => {
      const awp = makeAirway('J60', [
        { identifier: 'A', lat: 40.0, lon: -74.0 },
        { identifier: 'B', lat: 41.0, lon: -74.0 },
      ]);
      const expected = greatCircle.distanceNm(40.0, -74.0, 41.0, -74.0);

      const result = computeRouteDistance(route([awp]));
      assert.ok(close(result.totalDistanceNm, expected));
    });

    it('handles airway with empty waypoints', () => {
      const awp = makeAirway('J99', []);
      const result = computeRouteDistance(route([awp]));
      assert.equal(result.legs.length, 0);
      assert.equal(result.totalDistanceNm, 0);
    });

    it('uses waypoint name as label when identifier is absent', () => {
      const awp = makeAirway('J60', [
        { name: 'ALPHA POINT', lat: 40.0, lon: -74.0 },
        { name: 'BRAVO POINT', lat: 41.0, lon: -74.0 },
      ]);

      const result = computeRouteDistance(route([awp]));
      assert.equal(result.legs.length, 1);
      assert.equal(result.legs[0]!.from, 'ALPHA POINT');
      assert.equal(result.legs[0]!.to, 'BRAVO POINT');
    });
  });

  describe('procedure elements', () => {
    it('produces legs for SID internal waypoints', () => {
      const sid = makeSid('DEEZZ5', [
        { fixIdentifier: 'RWY', lat: 40.0, lon: -74.0 },
        { fixIdentifier: 'TURNN', lat: 40.5, lon: -74.0 },
        { fixIdentifier: 'DEEZZ', lat: 41.0, lon: -74.0 },
      ]);

      const result = computeRouteDistance(route([sid]));
      assert.equal(result.legs.length, 2);
      assert.equal(result.legs[0]!.from, 'RWY');
      assert.equal(result.legs[0]!.to, 'TURNN');
      assert.equal(result.legs[1]!.from, 'TURNN');
      assert.equal(result.legs[1]!.to, 'DEEZZ');
    });

    it('produces legs for STAR internal waypoints', () => {
      const star = makeStar('ARRIV3', [
        { fixIdentifier: 'ENTER', lat: 41.0, lon: -74.0 },
        { fixIdentifier: 'DESCN', lat: 40.5, lon: -74.0 },
        { fixIdentifier: 'FINAL', lat: 40.0, lon: -74.0 },
      ]);

      const result = computeRouteDistance(route([star]));
      assert.equal(result.legs.length, 2);
      assert.equal(result.legs[0]!.from, 'ENTER');
      assert.equal(result.legs[0]!.to, 'DESCN');
      assert.equal(result.legs[1]!.from, 'DESCN');
      assert.equal(result.legs[1]!.to, 'FINAL');
    });

    it('handles SID with empty waypoints', () => {
      const sid = makeSid('EMPTY1', []);
      const result = computeRouteDistance(route([sid]));
      assert.equal(result.legs.length, 0);
      assert.equal(result.totalDistanceNm, 0);
    });

    it('handles STAR with empty waypoints', () => {
      const star = makeStar('EMPTY2', []);
      const result = computeRouteDistance(route([star]));
      assert.equal(result.legs.length, 0);
      assert.equal(result.totalDistanceNm, 0);
    });
  });

  describe('deduplication', () => {
    it('does not create a zero-length leg when airway entry fix matches preceding waypoint', () => {
      const wp = makeWaypoint('MERIT', 40.5, -74.0);
      const awp = makeAirway('J60', [
        { identifier: 'MERIT', lat: 40.5, lon: -74.0 },
        { identifier: 'MARTN', lat: 41.0, lon: -74.0 },
      ]);
      const expected = greatCircle.distanceNm(40.5, -74.0, 41.0, -74.0);

      const result = computeRouteDistance(route([wp, awp]));
      assert.equal(result.legs.length, 1);
      assert.equal(result.legs[0]!.from, 'MERIT');
      assert.equal(result.legs[0]!.to, 'MARTN');
      assert.ok(close(result.totalDistanceNm, expected));
    });

    it('transfers precomputed distance when dedup skips an airway entry fix', () => {
      const wp = makeWaypoint('MERIT', 40.5, -74.0);
      const awp = makeAirway('J60', [
        { identifier: 'MERIT', lat: 40.5, lon: -74.0, distanceToNextNm: 99 },
        { identifier: 'MARTN', lat: 41.0, lon: -74.0 },
      ]);

      const result = computeRouteDistance(route([wp, awp]));
      assert.equal(result.legs.length, 1);
      // Should use the precomputed 99 NM, not great-circle
      assert.equal(result.legs[0]!.distanceNm, 99);
      assert.equal(result.totalDistanceNm, 99);
    });

    it('does not create a zero-length leg when SID last fix matches following waypoint', () => {
      const sid = makeSid('TEST5', [
        { fixIdentifier: 'RWY', lat: 40.0, lon: -74.0 },
        { fixIdentifier: 'MERGE', lat: 40.5, lon: -74.0 },
      ]);
      const wp = makeWaypoint('MERGE', 40.5, -74.0);
      const wp2 = makeWaypoint('NEXT', 41.0, -74.0);

      const result = computeRouteDistance(route([sid, wp, wp2]));
      // SID produces RWY->MERGE, then MERGE is deduplicated, then MERGE->NEXT
      assert.equal(result.legs.length, 2);
      assert.equal(result.legs[0]!.from, 'RWY');
      assert.equal(result.legs[0]!.to, 'MERGE');
      assert.equal(result.legs[1]!.from, 'MERGE');
      assert.equal(result.legs[1]!.to, 'NEXT');
    });

    it('deduplicates and transfers precomputed distance between consecutive airways', () => {
      const awp1 = makeAirway('J60', [
        { identifier: 'A', lat: 40.0, lon: -74.0, distanceToNextNm: 80 },
        { identifier: 'B', lat: 41.0, lon: -74.0 },
      ]);
      const awp2 = makeAirway('J15', [
        { identifier: 'B', lat: 41.0, lon: -74.0, distanceToNextNm: 70 },
        { identifier: 'C', lat: 42.0, lon: -74.0 },
      ]);

      const result = computeRouteDistance(route([awp1, awp2]));
      // B from awp2 is deduplicated; its precomputed 70 transfers to existing B
      assert.equal(result.legs.length, 2);
      assert.equal(result.legs[0]!.from, 'A');
      assert.equal(result.legs[0]!.to, 'B');
      assert.equal(result.legs[0]!.distanceNm, 80);
      assert.equal(result.legs[1]!.from, 'B');
      assert.equal(result.legs[1]!.to, 'C');
      assert.equal(result.legs[1]!.distanceNm, 70);
      assert.equal(result.totalDistanceNm, 150);
    });

    it('preserves existing precomputed distance when duplicate also has one', () => {
      // Contrived: airway1 last waypoint has precomputed (non-last in a 3-wp airway),
      // then airway2 entry fix at the same position also has precomputed.
      // The existing point's precomputed should be preserved.
      const awp1 = makeAirway('J60', [
        { identifier: 'A', lat: 40.0, lon: -74.0, distanceToNextNm: 80 },
        { identifier: 'B', lat: 41.0, lon: -74.0, distanceToNextNm: 55 },
        { identifier: 'C', lat: 42.0, lon: -74.0 },
      ]);
      // awp2 entry fix C overlaps awp1 exit fix C. awp1's C has no precomputed
      // (isLast), so awp2's precomputed 60 should be transferred.
      const awp2 = makeAirway('J15', [
        { identifier: 'C', lat: 42.0, lon: -74.0, distanceToNextNm: 60 },
        { identifier: 'D', lat: 43.0, lon: -74.0 },
      ]);

      const result = computeRouteDistance(route([awp1, awp2]));
      assert.equal(result.legs.length, 3);
      assert.equal(result.legs[0]!.distanceNm, 80);
      assert.equal(result.legs[1]!.distanceNm, 55);
      // C->D should use awp2's transferred precomputed distance
      assert.equal(result.legs[2]!.distanceNm, 60);
      assert.equal(result.totalDistanceNm, 195);
    });
  });

  describe('ETE computation', () => {
    it('computes ETE when ground speed is provided', () => {
      // Two points 60 nm apart at 120 kt = 0.5 hrs
      const p1 = makeWaypoint('A', 40.0, -74.0);
      const p2 = makeWaypoint('B', 41.0, -74.0);
      const d = greatCircle.distanceNm(40.0, -74.0, 41.0, -74.0);

      const result = computeRouteDistance(route([p1, p2]), 120);
      assert.ok(result.estimatedTimeEnrouteHrs !== undefined);
      assert.ok(close(result.estimatedTimeEnrouteHrs, d / 120));
    });

    it('returns undefined ETE when ground speed is omitted', () => {
      const p1 = makeWaypoint('A', 40.0, -74.0);
      const p2 = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteDistance(route([p1, p2]));
      assert.equal(result.estimatedTimeEnrouteHrs, undefined);
    });

    it('returns undefined ETE when ground speed is zero', () => {
      const p1 = makeWaypoint('A', 40.0, -74.0);
      const p2 = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteDistance(route([p1, p2]), 0);
      assert.equal(result.estimatedTimeEnrouteHrs, undefined);
    });

    it('returns undefined ETE when ground speed is negative', () => {
      const p1 = makeWaypoint('A', 40.0, -74.0);
      const p2 = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteDistance(route([p1, p2]), -100);
      assert.equal(result.estimatedTimeEnrouteHrs, undefined);
    });
  });

  describe('edge cases', () => {
    it('handles a route of only unresolved elements', () => {
      const u1 = makeUnresolved('AAA');
      const u2 = makeUnresolved('BBB');

      const result = computeRouteDistance(route([u1, u2]));
      assert.equal(result.totalDistanceNm, 0);
      assert.equal(result.legs.length, 0);
      assert.equal(result.unresolvedElements.length, 2);
    });

    it('computes distance for a mixed element type route', () => {
      // Realistic composition: airport -> SID -> DCT -> waypoint -> airway -> STAR -> airport
      const departure = makeAirport('KABC', 40.0, -74.0);
      const sid = makeSid('DEPART1', [
        { fixIdentifier: 'KABC', lat: 40.0, lon: -74.0 },
        { fixIdentifier: 'CLIMB', lat: 40.3, lon: -74.0 },
        { fixIdentifier: 'SIDEX', lat: 40.5, lon: -74.0 },
      ]);
      const dct = makeDirect();
      const enroute = makeWaypoint('ENRTE', 41.0, -74.0);
      const awp = makeAirway('J10', [
        { identifier: 'ENRTE', lat: 41.0, lon: -74.0, distanceToNextNm: 30 },
        { identifier: 'MIDPT', lat: 41.5, lon: -74.0, distanceToNextNm: 30 },
        { identifier: 'STREX', lat: 42.0, lon: -74.0 },
      ]);
      const star = makeStar('ARRIV2', [
        { fixIdentifier: 'STREX', lat: 42.0, lon: -74.0 },
        { fixIdentifier: 'DESND', lat: 42.3, lon: -74.0 },
        { fixIdentifier: 'KXYZ', lat: 42.5, lon: -74.0 },
      ]);
      const arrival = makeAirport('KXYZ', 42.5, -74.0);

      const result = computeRouteDistance(
        route([departure, sid, dct, enroute, awp, star, arrival]),
        400,
      );

      // Dedup should handle: departure->SID first fix, enroute->airway entry,
      // airway exit->STAR entry, STAR last->arrival
      assert.equal(result.unresolvedElements.length, 0);
      assert.ok(result.legs.length > 0, 'expected legs');
      assert.ok(result.totalDistanceNm > 0, 'expected positive distance');
      assert.ok(
        result.estimatedTimeEnrouteHrs !== undefined && result.estimatedTimeEnrouteHrs > 0,
        'expected positive ETE',
      );

      // Airway legs should use precomputed distances
      const airwayLeg1 = result.legs.find((l) => l.from === 'ENRTE' && l.to === 'MIDPT');
      assert.ok(airwayLeg1, 'expected ENRTE->MIDPT leg');
      assert.equal(airwayLeg1.distanceNm, 30);

      const airwayLeg2 = result.legs.find((l) => l.from === 'MIDPT' && l.to === 'STREX');
      assert.ok(airwayLeg2, 'expected MIDPT->STREX leg');
      assert.equal(airwayLeg2.distanceNm, 30);

      // Cumulative distance of last leg should equal total
      const lastLeg = result.legs[result.legs.length - 1]!;
      assert.ok(close(lastLeg.cumulativeDistanceNm, result.totalDistanceNm));
    });
  });
});

// ---------------------------------------------------------------------------
// Integration test with real data
// ---------------------------------------------------------------------------

describe('computeRouteDistance integration', () => {
  let resolver: FlightplanResolver;

  beforeAll(async () => {
    const [
      { usBundledAirports },
      { createAirportResolver },
      { usBundledNavaids },
      { createNavaidResolver },
      { usBundledFixes },
      { createFixResolver },
      { usBundledAirways },
      { createAirwayResolver },
    ] = await Promise.all([
      import('@squawk/airport-data'),
      import('@squawk/airports'),
      import('@squawk/navaid-data'),
      import('@squawk/navaids'),
      import('@squawk/fix-data'),
      import('@squawk/fixes'),
      import('@squawk/airway-data'),
      import('@squawk/airways'),
    ]);

    const { createFlightplanResolver } = await import('./resolver.js');

    resolver = createFlightplanResolver({
      airports: createAirportResolver({ data: usBundledAirports.records }),
      navaids: createNavaidResolver({ data: usBundledNavaids.records }),
      fixes: createFixResolver({ data: usBundledFixes.records }),
      airways: createAirwayResolver({ data: usBundledAirways.records }),
    });
  });

  it('computes a reasonable distance for a route with airways', () => {
    // KABQ to KATL via CNX, J15 airway, and waypoints (known to resolve from resolver tests)
    const parsed = resolver.parse('KABQ CNX J15 CME BGS SAT');
    const result = computeRouteDistance(parsed, 450);

    // ABQ to SAT is roughly 500-600 nm direct; routed via airways will be similar or longer
    assert.ok(result.totalDistanceNm > 400, `expected > 400 nm, got ${result.totalDistanceNm}`);
    assert.ok(result.legs.length > 2, 'expected multiple legs from airway expansion');
    assert.equal(result.unresolvedElements.length, 0);
    assert.ok(
      result.estimatedTimeEnrouteHrs !== undefined && result.estimatedTimeEnrouteHrs > 0,
      'expected positive ETE',
    );

    // Cumulative distance of last leg should equal totalDistanceNm
    const lastLeg = result.legs[result.legs.length - 1]!;
    assert.ok(close(lastLeg.cumulativeDistanceNm, result.totalDistanceNm));
  });
});
