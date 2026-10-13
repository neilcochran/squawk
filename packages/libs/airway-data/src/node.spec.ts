import { describe, it, expect, assert } from 'vitest';

import type { Airway, AirwayWaypoint } from '@squawk/types';
import { AIRWAY_DIRECTIONS } from '@squawk/types';

import { usBundledAirways } from './node.js';

/** Mean Earth radius in nautical miles. */
const EARTH_RADIUS_NM = 3440.065;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine great-circle distance in nautical miles between two positions. */
function greatCircleNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(a));
}

/** Initial great-circle bearing in degrees true from the first position to the second. */
function initialBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(toRadians(lon2 - lon1)) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(toRadians(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Each altitude field paired with the direction field that qualifies it. */
const DIRECTION_FIELDS: [keyof AirwayWaypoint, keyof AirwayWaypoint][] = [
  ['minimumEnrouteAltitudeFt', 'minimumEnrouteAltitudeDirection'],
  ['minimumEnrouteAltitudeOppositeFt', 'minimumEnrouteAltitudeOppositeDirection'],
  ['gnssMinimumEnrouteAltitudeFt', 'gnssMinimumEnrouteAltitudeDirection'],
  ['gnssMinimumEnrouteAltitudeOppositeFt', 'gnssMinimumEnrouteAltitudeOppositeDirection'],
  ['dmeDmeIruMinimumEnrouteAltitudeFt', 'dmeDmeIruMinimumEnrouteAltitudeDirection'],
  ['dmeDmeIruMinimumEnrouteAltitudeOppositeFt', 'dmeDmeIruMinimumEnrouteAltitudeOppositeDirection'],
  ['minimumCrossingAltitudeFt', 'minimumCrossingAltitudeDirection'],
  ['minimumCrossingAltitudeOppositeFt', 'minimumCrossingAltitudeOppositeDirection'],
];

const DIRECTION_SET: ReadonlySet<string> = new Set(AIRWAY_DIRECTIONS);

function allWaypoints(): AirwayWaypoint[] {
  return usBundledAirways.records.flatMap((airway) => airway.waypoints);
}

function airway(designation: string): Airway {
  const found = usBundledAirways.records.find((r) => r.designation === designation);
  assert(found !== undefined, `expected to find ${designation}`);
  return found;
}

function waypoint(designation: string, identifierOrName: string): AirwayWaypoint {
  const found = airway(designation).waypoints.find(
    (wp) => wp.identifier === identifierOrName || wp.name === identifierOrName,
  );
  assert(found !== undefined, `expected ${identifierOrName} on ${designation}`);
  return found;
}

describe('usBundledAirways', () => {
  it('loads with a reasonable number of records', () => {
    assert(usBundledAirways.records.length > 1000);
  });

  it('has metadata with generatedAt, nasrCycleDate, recordCount, and waypointCount', () => {
    assert(usBundledAirways.properties.generatedAt.length > 0);
    assert(usBundledAirways.properties.nasrCycleDate.length > 0);
    expect(usBundledAirways.properties.recordCount).toBe(usBundledAirways.records.length);
    assert(usBundledAirways.properties.waypointCount > 0);
  });

  it('contains records with the expected required fields', () => {
    const first = usBundledAirways.records[0];
    assert(first !== undefined);
    expect(typeof first.designation).toBe('string');
    assert(first.designation.length > 0);
    expect(typeof first.type).toBe('string');
    expect(typeof first.region).toBe('string');
    assert(Array.isArray(first.waypoints));
    assert(first.waypoints.length > 0);
  });

  it('contains waypoints with the expected required fields', () => {
    for (const wp of allWaypoints()) {
      expect(typeof wp.name).toBe('string');
      assert(wp.name.length > 0, 'expected every waypoint to be named');
      expect(typeof wp.waypointType).toBe('string');
      assert(Math.abs(wp.lat) <= 90 && Math.abs(wp.lon) <= 180, `${wp.name} is off the globe`);
    }
  });

  it('contains airways of every published type', () => {
    const types = new Set<string>(usBundledAirways.records.map((r) => r.type));
    for (const type of ['VICTOR', 'JET', 'RNAV_Q', 'RNAV_T', 'ATLANTIC', 'PACIFIC', 'SPECIAL']) {
      assert(types.has(type), `expected ${type} airways`);
    }
  });

  it('includes the special routes the FAA publishes without an MEA', () => {
    const special = usBundledAirways.records.filter((r) => r.type === 'SPECIAL');
    assert(special.length >= 30, `expected the ZK special routes, found ${special.length}`);
    for (const route of special) {
      assert(
        route.designation.startsWith('SPZK'),
        `unexpected special designation ${route.designation}`,
      );
      for (const wp of route.waypoints) {
        expect(wp.minimumEnrouteAltitudeFt).toBe(undefined);
        assert(
          wp.maximumAuthorizedAltitudeFt !== undefined,
          `${route.designation} ${wp.name} has no MAA`,
        );
      }
    }
    assert(airway('SPZK214').waypoints.length >= 8);
  });

  it('uses only the published waypoint types', () => {
    const waypointTypes = new Set<string>(allWaypoints().map((wp) => wp.waypointType));
    assert(waypointTypes.has('NAVAID'), 'expected NAVAID waypoints');
    assert(waypointTypes.has('FIX'), 'expected FIX waypoints');
    assert(waypointTypes.has('WAYPOINT'), 'expected WAYPOINT waypoints');
    for (const type of waypointTypes) {
      assert(
        ['NAVAID', 'FIX', 'WAYPOINT', 'OTHER'].includes(type),
        `unexpected waypoint type ${type}`,
      );
    }
  });

  it('contains airways with MEA data on waypoints', () => {
    const withMea = usBundledAirways.records.find((a) =>
      a.waypoints.some((wp) => wp.minimumEnrouteAltitudeFt !== undefined),
    );
    assert(withMea !== undefined, 'expected at least one airway with MEA data');
  });

  it('emits an altitude direction only with its altitude and only in the FAA compass form', () => {
    let directions = 0;
    for (const wp of allWaypoints()) {
      for (const [altitudeField, directionField] of DIRECTION_FIELDS) {
        const direction = wp[directionField];
        if (direction === undefined) {
          continue;
        }
        directions += 1;
        assert(
          wp[altitudeField] !== undefined,
          `${wp.name}: ${directionField} without ${altitudeField}`,
        );
        assert(
          typeof direction === 'string' && DIRECTION_SET.has(direction),
          `${wp.name}: direction ${String(direction)}`,
        );
      }
    }
    assert(directions > 1500, `expected the published directional altitudes, found ${directions}`);
  });

  it('attaches each minimum crossing altitude to the point the FAA names for it', () => {
    const withMca = allWaypoints().filter((wp) => wp.minimumCrossingAltitudeFt !== undefined);
    assert(withMca.length >= 950, `expected the published MCAs, found ${withMca.length}`);
    for (const wp of withMca) {
      assert(
        wp.minimumCrossingAltitudeDirection !== undefined,
        `${wp.name}: MCA without a direction`,
      );
    }
    expect(waypoint('J70', 'NICKL').minimumCrossingAltitudeFt).toBe(undefined);
    const auger = waypoint('J70', 'AUGER');
    expect(auger.minimumCrossingAltitudeFt).toBe(25000);
    expect(auger.minimumCrossingAltitudeDirection).toBe('W BND');
    const selinsgrove = waypoint('T291', 'SEG');
    expect(selinsgrove.minimumCrossingAltitudeFt).toBe(3800);
    expect(selinsgrove.minimumCrossingAltitudeDirection).toBe('NE BND');
    expect(waypoint('T291', 'MORTO').minimumCrossingAltitudeFt).toBe(undefined);
  });

  it('flags unusable segments, which never carry an MEA', () => {
    const unusable = allWaypoints().filter((wp) => wp.unusable === true);
    assert(unusable.length >= 60, `expected the unusable segments, found ${unusable.length}`);
    for (const wp of unusable) {
      expect(wp.minimumEnrouteAltitudeFt).toBe(undefined);
      expect(wp.gnssMinimumEnrouteAltitudeFt).toBe(undefined);
      expect(wp.discontinued).toBe(undefined);
    }
    const dryer = waypoint('J34', 'DJB');
    expect(dryer.unusable).toBe(true);
    expect(dryer.remarks).toEqual(['UNUSABLE']);
    expect(waypoint('V70', 'LUMPP').unusable).toBe(true);
  });

  it('keeps every GNSS MEA at or below the higher directional MEA', () => {
    for (const wp of allWaypoints()) {
      const mea = wp.minimumEnrouteAltitudeFt;
      const gnss = wp.gnssMinimumEnrouteAltitudeFt;
      if (mea === undefined || gnss === undefined) {
        continue;
      }
      const ceiling = Math.max(mea, wp.minimumEnrouteAltitudeOppositeFt ?? mea);
      assert(gnss <= ceiling, `${wp.name}: GNSS MEA ${gnss} above MEA ${ceiling}`);
    }
  });

  it('publishes a GNSS MEA on nearly every RNAV segment', () => {
    let segments = 0;
    let withGnss = 0;
    for (const route of usBundledAirways.records) {
      if (route.type !== 'RNAV_Q' && route.type !== 'RNAV_T') {
        continue;
      }
      for (let i = 0; i < route.waypoints.length - 1; i++) {
        segments += 1;
        if (route.waypoints[i]?.gnssMinimumEnrouteAltitudeFt !== undefined) {
          withGnss += 1;
        }
      }
    }
    assert(
      withGnss / segments > 0.99,
      `expected GNSS MEAs on RNAV routes, got ${withGnss} of ${segments}`,
    );
  });

  it('keeps every magnetic course within 30 degrees of the true bearing to the next waypoint', () => {
    for (const route of usBundledAirways.records) {
      for (let i = 0; i < route.waypoints.length - 1; i++) {
        const wp = route.waypoints[i];
        const next = route.waypoints[i + 1];
        if (
          wp === undefined ||
          next === undefined ||
          wp.magneticCourseDeg === undefined ||
          wp.discontinued
        ) {
          continue;
        }
        let delta = Math.abs(
          initialBearingDeg(wp.lat, wp.lon, next.lat, next.lon) - wp.magneticCourseDeg,
        );
        if (delta > 180) {
          delta = 360 - delta;
        }
        assert(
          delta <= 30,
          `${route.designation} ${wp.name}: course ${wp.magneticCourseDeg} vs bearing`,
        );
      }
    }
  });

  it('populates the DME/DME/IRU MEA, magnetic variation, RNP and remark fields', () => {
    const waypoints = allWaypoints();
    const dmeDmeIru = waypoints.filter((wp) => wp.dmeDmeIruMinimumEnrouteAltitudeFt !== undefined);
    assert(dmeDmeIru.length >= 1500, `expected DME/DME/IRU MEAs, found ${dmeDmeIru.length}`);
    const variation = waypoints.filter((wp) => wp.magneticVariationDeg !== undefined);
    assert(variation.length >= 4000, `expected navaid variations, found ${variation.length}`);
    for (const wp of variation) {
      assert(wp.magneticVariationDirection === 'E' || wp.magneticVariationDirection === 'W');
      assert(wp.waypointType === 'NAVAID', `${wp.name}: variation on a ${wp.waypointType}`);
    }
    const rnp = waypoints.filter((wp) => wp.rnpNm !== undefined);
    assert(rnp.length >= 40, `expected the RNP 1 oceanic segments, found ${rnp.length}`);
    for (const wp of rnp) {
      expect(wp.rnpNm).toBe(1);
    }
    const remarked = waypoints.filter((wp) => wp.remarks !== undefined);
    assert(remarked.length >= 1400, `expected point remarks, found ${remarked.length}`);
    expect(waypoint('J15', 'WINK').remarks).toEqual(['WINK R-311 UNUSABLE, USE CHISUM R-129']);
    const withRouteRemarks = usBundledAirways.records.filter((r) => r.remarks !== undefined);
    assert(
      withRouteRemarks.length >= 10,
      `expected route remarks, found ${withRouteRemarks.length}`,
    );
    expect(airway('T227').remarks).toEqual(['HF COMM REQUIRED']);
  });

  it('carries the NASR state pseudo-codes and single-letter region codes', () => {
    const states = new Set(allWaypoints().map((wp) => wp.state));
    for (const code of ['OA', 'OP', 'OG', '59']) {
      assert(states.has(code), `expected pseudo state code ${code}`);
    }
    const regions = new Set(allWaypoints().map((wp) => wp.icaoRegionCode));
    assert(regions.has('K') && regions.has('P'), 'expected the offshore region codes K and P');
  });

  it('keeps both regional variants of a shared designation', () => {
    const counts = new Map<string, number>();
    for (const route of usBundledAirways.records) {
      counts.set(route.designation, (counts.get(route.designation) ?? 0) + 1);
    }
    const shared = [...counts.values()].filter((n) => n > 1).length;
    assert(shared >= 40, `expected the CONUS and Hawaii duplicates, found ${shared}`);
    expect(
      usBundledAirways.records
        .filter((r) => r.designation === 'V1')
        .map((r) => r.region)
        .sort(),
    ).toEqual(['HAWAII', 'US']);
  });

  it('publishes a positive distance to next on most waypoints', () => {
    let total = 0;
    let positive = 0;
    for (const wp of allWaypoints()) {
      total++;
      if (wp.distanceToNextNm !== undefined && wp.distanceToNextNm > 0) {
        positive++;
      }
    }
    assert(
      positive / total > 0.8,
      `expected most waypoints to carry a distance to next, got ${positive} of ${total}`,
    );
  });

  it('leaves distance to next unset rather than zero where none is published', () => {
    const zeros = allWaypoints().filter((wp) => wp.distanceToNextNm === 0).length;
    expect(zeros).toBe(0);
  });

  it('leaves only the border-trimmed and blank FAA legs without a distance', () => {
    let missing = 0;
    for (const route of usBundledAirways.records) {
      for (let i = 0; i < route.waypoints.length - 1; i++) {
        const wp = route.waypoints[i];
        if (wp !== undefined && wp.distanceToNextNm === undefined && !wp.discontinued) {
          missing += 1;
        }
      }
    }
    assert(missing <= 12, `expected only the documented legs without a distance, found ${missing}`);
  });

  it('publishes the distance to next as the leg to the following waypoint', () => {
    const j60 = airway('J60');
    const [first, second] = j60.waypoints;
    assert(first !== undefined && second !== undefined, 'expected at least two J60 waypoints');
    assert(first.distanceToNextNm !== undefined, 'expected a distance on the first J60 waypoint');
    const directNm = greatCircleNm(first.lat, first.lon, second.lat, second.lon);
    expect(Math.abs(first.distanceToNextNm - directNm)).toBeLessThan(1);
  });

  it('can find known airways by scanning records', () => {
    const v16 = airway('V16');
    expect(v16.type).toBe('VICTOR');
    assert(v16.waypoints.length > 2);
    expect(airway('J60').type).toBe('JET');
  });

  it('waypointCount matches actual waypoint total', () => {
    const actualCount = usBundledAirways.records.reduce((sum, a) => sum + a.waypoints.length, 0);
    expect(usBundledAirways.properties.waypointCount).toBe(actualCount);
  });
});
