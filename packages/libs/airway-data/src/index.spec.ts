import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { usBundledAirways } from './index.js';

describe('usBundledAirways', () => {
  it('loads with a reasonable number of records', () => {
    assert.ok(usBundledAirways.records.length > 1000);
  });

  it('has metadata with generatedAt, nasrCycleDate, recordCount, and waypointCount', () => {
    assert.ok(usBundledAirways.properties.generatedAt.length > 0);
    assert.ok(usBundledAirways.properties.nasrCycleDate.length > 0);
    assert.equal(usBundledAirways.properties.recordCount, usBundledAirways.records.length);
    assert.ok(usBundledAirways.properties.waypointCount > 0);
  });

  it('contains records with the expected required fields', () => {
    const first = usBundledAirways.records[0];
    assert.ok(first !== undefined);
    assert.equal(typeof first.designation, 'string');
    assert.ok(first.designation.length > 0);
    assert.equal(typeof first.type, 'string');
    assert.equal(typeof first.region, 'string');
    assert.ok(Array.isArray(first.waypoints));
    assert.ok(first.waypoints.length > 0);
  });

  it('contains waypoints with the expected required fields', () => {
    const airway = usBundledAirways.records[0]!;
    const wp = airway.waypoints[0]!;
    assert.equal(typeof wp.name, 'string');
    assert.ok(wp.name.length > 0);
    assert.equal(typeof wp.waypointType, 'string');
    assert.equal(typeof wp.lat, 'number');
    assert.equal(typeof wp.lon, 'number');
  });

  it('contains airways of various types', () => {
    const types = new Set(usBundledAirways.records.map((r) => r.type));
    assert.ok(types.has('VICTOR'), 'expected VICTOR airways');
    assert.ok(types.has('JET'), 'expected JET airways');
    assert.ok(types.has('RNAV_Q'), 'expected RNAV_Q airways');
    assert.ok(types.has('RNAV_T'), 'expected RNAV_T airways');
  });

  it('contains airways with MEA data on waypoints', () => {
    const withMea = usBundledAirways.records.find((a) =>
      a.waypoints.some((wp) => wp.minimumEnrouteAltitudeFt !== undefined),
    );
    assert.ok(withMea !== undefined, 'expected at least one airway with MEA data');
  });

  it('contains waypoints with various types', () => {
    const waypointTypes = new Set<string>();
    for (const airway of usBundledAirways.records) {
      for (const wp of airway.waypoints) {
        waypointTypes.add(wp.waypointType);
      }
    }
    assert.ok(waypointTypes.has('NAVAID'), 'expected NAVAID waypoints');
    assert.ok(waypointTypes.has('FIX'), 'expected FIX waypoints');
  });

  it('contains waypoints with distance to next', () => {
    const withDistance = usBundledAirways.records.find((a) =>
      a.waypoints.some((wp) => wp.distanceToNextNm !== undefined),
    );
    assert.ok(withDistance !== undefined, 'expected at least one waypoint with distanceToNextNm');
  });

  it('can find a known airway by scanning records', () => {
    const v16 = usBundledAirways.records.find((r) => r.designation === 'V16');
    assert.ok(v16 !== undefined, 'expected to find V16 airway');
    assert.equal(v16.type, 'VICTOR');
    assert.ok(v16.waypoints.length > 2);
  });

  it('can find a known jet route by scanning records', () => {
    const j60 = usBundledAirways.records.find((r) => r.designation === 'J60');
    assert.ok(j60 !== undefined, 'expected to find J60 jet route');
    assert.equal(j60.type, 'JET');
  });

  it('waypointCount matches actual waypoint total', () => {
    const actualCount = usBundledAirways.records.reduce((sum, a) => sum + a.waypoints.length, 0);
    assert.equal(usBundledAirways.properties.waypointCount, actualCount);
  });
});
