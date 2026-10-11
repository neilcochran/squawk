import { describe, it, expect, assert } from 'vitest';

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
    const airway = usBundledAirways.records[0]!;
    const wp = airway.waypoints[0]!;
    expect(typeof wp.name).toBe('string');
    assert(wp.name.length > 0);
    expect(typeof wp.waypointType).toBe('string');
    expect(typeof wp.lat).toBe('number');
    expect(typeof wp.lon).toBe('number');
  });

  it('contains airways of various types', () => {
    const types = new Set(usBundledAirways.records.map((r) => r.type));
    assert(types.has('VICTOR'), 'expected VICTOR airways');
    assert(types.has('JET'), 'expected JET airways');
    assert(types.has('RNAV_Q'), 'expected RNAV_Q airways');
    assert(types.has('RNAV_T'), 'expected RNAV_T airways');
  });

  it('contains airways with MEA data on waypoints', () => {
    const withMea = usBundledAirways.records.find((a) =>
      a.waypoints.some((wp) => wp.minimumEnrouteAltitudeFt !== undefined),
    );
    assert(withMea !== undefined, 'expected at least one airway with MEA data');
  });

  it('contains waypoints with various types', () => {
    const waypointTypes = new Set<string>();
    for (const airway of usBundledAirways.records) {
      for (const wp of airway.waypoints) {
        waypointTypes.add(wp.waypointType);
      }
    }
    assert(waypointTypes.has('NAVAID'), 'expected NAVAID waypoints');
    assert(waypointTypes.has('FIX'), 'expected FIX waypoints');
  });

  it('publishes a positive distance to next on most waypoints', () => {
    let total = 0;
    let positive = 0;
    for (const airway of usBundledAirways.records) {
      for (const wp of airway.waypoints) {
        total++;
        if (wp.distanceToNextNm !== undefined && wp.distanceToNextNm > 0) {
          positive++;
        }
      }
    }
    assert(
      positive / total > 0.8,
      `expected most waypoints to carry a distance to next, got ${positive} of ${total}`,
    );
  });

  it('leaves distance to next unset rather than zero where none is published', () => {
    const zeros = usBundledAirways.records.reduce(
      (sum, a) => sum + a.waypoints.filter((wp) => wp.distanceToNextNm === 0).length,
      0,
    );
    expect(zeros).toBe(0);
  });

  it('publishes the distance to next as the leg to the following waypoint', () => {
    const j60 = usBundledAirways.records.find((r) => r.designation === 'J60');
    assert(j60 !== undefined, 'expected to find J60 jet route');
    const [first, second] = j60.waypoints;
    assert(first !== undefined && second !== undefined, 'expected at least two J60 waypoints');
    assert(first.distanceToNextNm !== undefined, 'expected a distance on the first J60 waypoint');
    const directNm = greatCircleNm(first.lat, first.lon, second.lat, second.lon);
    expect(Math.abs(first.distanceToNextNm - directNm)).toBeLessThan(1);
  });

  it('can find a known airway by scanning records', () => {
    const v16 = usBundledAirways.records.find((r) => r.designation === 'V16');
    assert(v16 !== undefined, 'expected to find V16 airway');
    expect(v16.type).toBe('VICTOR');
    assert(v16.waypoints.length > 2);
  });

  it('can find a known jet route by scanning records', () => {
    const j60 = usBundledAirways.records.find((r) => r.designation === 'J60');
    assert(j60 !== undefined, 'expected to find J60 jet route');
    expect(j60.type).toBe('JET');
  });

  it('waypointCount matches actual waypoint total', () => {
    const actualCount = usBundledAirways.records.reduce((sum, a) => sum + a.waypoints.length, 0);
    expect(usBundledAirways.properties.waypointCount).toBe(actualCount);
  });
});
