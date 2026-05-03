import { describe, it, expect, assert } from 'vitest';

import { usBundledAirways } from './index.js';

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

  it('contains waypoints with distance to next', () => {
    const withDistance = usBundledAirways.records.find((a) =>
      a.waypoints.some((wp) => wp.distanceToNextNm !== undefined),
    );
    assert(withDistance !== undefined, 'expected at least one waypoint with distanceToNextNm');
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
