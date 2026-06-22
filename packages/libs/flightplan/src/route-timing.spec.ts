import assert from 'node:assert/strict';

import { describe, it, beforeAll } from 'vitest';

import { planning, wind } from '@squawk/flight-math';
import { greatCircle } from '@squawk/geo';

import type { FlightplanResolver } from './resolver.js';
import { computeRouteTiming } from './route-timing.js';
import { close, makeUnresolved, makeWaypoint, route } from './test-utils.js';

// ---------------------------------------------------------------------------
// Unit tests (synthetic data)
// ---------------------------------------------------------------------------

describe('computeRouteTiming', () => {
  describe('empty and minimal routes', () => {
    it('returns zero totals for an empty route', () => {
      const result = computeRouteTiming(route([]), { trueAirspeedKt: 450 });
      assert.equal(result.legs.length, 0);
      assert.equal(result.totalDistanceNm, 0);
      assert.equal(result.totalEteHrs, 0);
      assert.equal(result.totalFuelRequired, undefined);
      assert.equal(result.enduranceHrs, undefined);
      assert.equal(result.fuelSufficient, undefined);
      assert.equal(result.unresolvedElements.length, 0);
    });

    it('returns zero totals for a single geographic element', () => {
      const result = computeRouteTiming(route([makeWaypoint('MERIT', 40.0, -74.0)]), {
        trueAirspeedKt: 120,
      });
      assert.equal(result.legs.length, 0);
      assert.equal(result.totalDistanceNm, 0);
      assert.equal(result.totalEteHrs, 0);
    });
  });

  describe('calm timing', () => {
    it('uses true airspeed as ground speed when no wind provider is given', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);
      const d = greatCircle.distanceNm(40.0, -74.0, 41.0, -74.0);

      const result = computeRouteTiming(route([a, b]), { trueAirspeedKt: 120 });
      assert.equal(result.legs.length, 1);
      const leg = result.legs[0]!;
      assert.equal(leg.groundSpeedKt, 120);
      assert.equal(leg.windCorrectionAngleDeg, 0);
      assert.equal(leg.trueHeadingDeg, leg.trueCourseDeg);
      assert.equal(leg.wind, undefined);
      assert.ok(close(leg.eteHrs!, d / 120));
      assert.ok(close(result.totalEteHrs!, d / 120));
    });

    it('treats an undefined provider result as calm', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteTiming(route([a, b]), {
        trueAirspeedKt: 120,
        windProvider: () => undefined,
      });
      const leg = result.legs[0]!;
      assert.equal(leg.groundSpeedKt, 120);
      assert.equal(leg.windCorrectionAngleDeg, 0);
      assert.equal(leg.wind, undefined);
    });

    it('records the true course from the great-circle bearing', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);
      const expectedCourse = greatCircle.bearing(40.0, -74.0, 41.0, -74.0);

      const result = computeRouteTiming(route([a, b]), { trueAirspeedKt: 120 });
      assert.ok(close(result.legs[0]!.trueCourseDeg, expectedCourse));
    });
  });

  describe('wind-corrected timing', () => {
    it('slows ground speed with a headwind', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteTiming(route([a, b]), {
        trueAirspeedKt: 120,
        windProvider: () => ({ directionDeg: 0, speedKt: 30 }),
      });
      const leg = result.legs[0]!;
      // Due-north course into a wind from the north: pure headwind, GS = TAS - wind.
      assert.ok(close(leg.groundSpeedKt, 90));
      assert.ok(close(leg.eteHrs!, leg.distanceNm / leg.groundSpeedKt));
      assert.deepEqual(leg.wind, { directionDeg: 0, speedKt: 30 });
    });

    it('speeds ground speed with a tailwind', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteTiming(route([a, b]), {
        trueAirspeedKt: 120,
        windProvider: () => ({ directionDeg: 180, speedKt: 30 }),
      });
      const leg = result.legs[0]!;
      // Due-north course with a wind from the south: pure tailwind, GS = TAS + wind.
      assert.ok(close(leg.groundSpeedKt, 150));
      assert.ok(close(leg.eteHrs!, leg.distanceNm / leg.groundSpeedKt));
    });

    it('matches the wind triangle solution for a crosswind', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);
      const course = greatCircle.bearing(40.0, -74.0, 41.0, -74.0);
      const expected = wind.solveWindTriangle(120, course, 90, 30);

      const result = computeRouteTiming(route([a, b]), {
        trueAirspeedKt: 120,
        windProvider: () => ({ directionDeg: 90, speedKt: 30 }),
      });
      const leg = result.legs[0]!;
      assert.ok(close(leg.groundSpeedKt, expected.groundSpeedKt));
      assert.ok(close(leg.trueHeadingDeg, expected.trueHeadingDeg));
      assert.ok(close(leg.windCorrectionAngleDeg, expected.windCorrectionAngleDeg));
      assert.notEqual(leg.windCorrectionAngleDeg, 0);
    });
  });

  describe('legs that cannot be timed', () => {
    it('leaves ete undefined when a pure headwind equals true airspeed', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteTiming(route([a, b]), {
        trueAirspeedKt: 120,
        windProvider: () => ({ directionDeg: 0, speedKt: 120 }),
        fuelBurnPerHr: 12,
      });
      const leg = result.legs[0]!;
      assert.ok(close(leg.groundSpeedKt, 0));
      assert.equal(leg.eteHrs, undefined);
      assert.equal(leg.fuelRequired, undefined);
      assert.equal(result.totalEteHrs, undefined);
      assert.equal(result.totalFuelRequired, undefined);
    });

    it('propagates an untimed leg into the cumulative and route totals', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);
      const c = makeWaypoint('C', 41.0, -73.0);

      // Kill only the first (due-north) leg: a wind from the north equal to TAS
      // sampled near that leg's midpoint; the second leg samples calm.
      const result = computeRouteTiming(route([a, b, c]), {
        trueAirspeedKt: 120,
        windProvider: (lat) => (lat < 40.6 ? { directionDeg: 0, speedKt: 120 } : undefined),
        fuelBurnPerHr: 12,
      });
      assert.equal(result.legs.length, 2);
      assert.equal(result.legs[0]!.eteHrs, undefined);
      assert.ok(result.legs[1]!.eteHrs !== undefined);
      assert.equal(result.legs[0]!.cumulativeEteHrs, undefined);
      assert.equal(result.legs[1]!.cumulativeEteHrs, undefined);
      assert.equal(result.totalEteHrs, undefined);
      assert.ok(result.legs[1]!.fuelRequired !== undefined);
      assert.equal(result.totalFuelRequired, undefined);
    });
  });

  describe('fuel and endurance', () => {
    it('computes per-leg and total fuel from ground speed', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);
      const d = greatCircle.distanceNm(40.0, -74.0, 41.0, -74.0);
      const expectedFuel = planning.fuelRequired(d, 120, 12);

      const result = computeRouteTiming(route([a, b]), {
        trueAirspeedKt: 120,
        fuelBurnPerHr: 12,
      });
      assert.ok(close(result.legs[0]!.fuelRequired!, expectedFuel));
      assert.ok(close(result.totalFuelRequired!, expectedFuel));
    });

    it('leaves fuel undefined when no burn rate is given', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteTiming(route([a, b]), { trueAirspeedKt: 120 });
      assert.equal(result.legs[0]!.fuelRequired, undefined);
      assert.equal(result.totalFuelRequired, undefined);
    });

    it('reports endurance and sufficiency when fuel on board is given', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteTiming(route([a, b]), {
        trueAirspeedKt: 120,
        fuelBurnPerHr: 12,
        fuelAvailable: 24,
      });
      assert.ok(close(result.enduranceHrs!, 2));
      assert.equal(result.fuelSufficient, true);
    });

    it('reports insufficient fuel when endurance is below the route time', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteTiming(route([a, b]), {
        trueAirspeedKt: 120,
        fuelBurnPerHr: 12,
        fuelAvailable: 1,
      });
      assert.ok(close(result.enduranceHrs!, 1 / 12));
      assert.equal(result.fuelSufficient, false);
    });

    it('leaves endurance undefined without fuel on board', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteTiming(route([a, b]), {
        trueAirspeedKt: 120,
        fuelBurnPerHr: 12,
      });
      assert.equal(result.enduranceHrs, undefined);
      assert.equal(result.fuelSufficient, undefined);
    });
  });

  describe('cumulative timing', () => {
    it('accumulates ete across legs', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const b = makeWaypoint('B', 41.0, -74.0);
      const c = makeWaypoint('C', 42.0, -74.0);

      const result = computeRouteTiming(route([a, b, c]), { trueAirspeedKt: 120 });
      assert.equal(result.legs.length, 2);
      const ete0 = result.legs[0]!.eteHrs!;
      const ete1 = result.legs[1]!.eteHrs!;
      assert.ok(close(result.legs[0]!.cumulativeEteHrs!, ete0));
      assert.ok(close(result.legs[1]!.cumulativeEteHrs!, ete0 + ete1));
      assert.ok(close(result.totalEteHrs!, ete0 + ete1));
    });
  });

  describe('unresolved elements', () => {
    it('passes through unresolved elements from the distance computation', () => {
      const a = makeWaypoint('A', 40.0, -74.0);
      const unresolved = makeUnresolved('XYZZY');
      const b = makeWaypoint('B', 41.0, -74.0);

      const result = computeRouteTiming(route([a, unresolved, b]), { trueAirspeedKt: 120 });
      assert.equal(result.unresolvedElements.length, 1);
      assert.equal(result.unresolvedElements[0], unresolved);
      assert.equal(result.legs.length, 1);
    });
  });
});

// ---------------------------------------------------------------------------
// Integration test with real data
// ---------------------------------------------------------------------------

describe('computeRouteTiming integration', () => {
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

  it('computes wind-corrected timing for a real airway route', () => {
    const parsed = resolver.parse('KABQ CNX J15 CME BGS SAT');
    const result = computeRouteTiming(parsed, {
      trueAirspeedKt: 450,
      windProvider: () => ({ directionDeg: 270, speedKt: 50 }),
      fuelBurnPerHr: 600,
      fuelAvailable: 1200,
    });

    assert.ok(result.legs.length > 2, 'expected multiple legs from airway expansion');
    assert.ok(result.totalDistanceNm > 400, `expected > 400 nm, got ${result.totalDistanceNm}`);
    assert.ok(
      result.totalEteHrs !== undefined && result.totalEteHrs > 0,
      'expected positive total ETE',
    );
    assert.ok(
      result.totalFuelRequired !== undefined && result.totalFuelRequired > 0,
      'expected positive total fuel',
    );
    assert.ok(result.enduranceHrs !== undefined && result.enduranceHrs > 0, 'expected endurance');

    for (const leg of result.legs) {
      assert.ok(leg.trueCourseDeg >= 0 && leg.trueCourseDeg < 360, 'course in range');
      assert.deepEqual(leg.wind, { directionDeg: 270, speedKt: 50 });
    }

    const lastLeg = result.legs[result.legs.length - 1]!;
    assert.equal(lastLeg.cumulativeEteHrs, result.totalEteHrs);
  });
});
