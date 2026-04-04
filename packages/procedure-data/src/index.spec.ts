import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { usBundledProcedures } from './index.js';

describe('usBundledProcedures', () => {
  it('loads with a reasonable number of records', () => {
    assert.ok(usBundledProcedures.records.length > 1000);
  });

  it('has metadata with generatedAt, nasrCycleDate, recordCount, sidCount, starCount, and waypointCount', () => {
    assert.ok(usBundledProcedures.properties.generatedAt.length > 0);
    assert.ok(usBundledProcedures.properties.nasrCycleDate.length > 0);
    assert.equal(usBundledProcedures.properties.recordCount, usBundledProcedures.records.length);
    assert.ok(usBundledProcedures.properties.sidCount > 0);
    assert.ok(usBundledProcedures.properties.starCount > 0);
    assert.equal(
      usBundledProcedures.properties.sidCount + usBundledProcedures.properties.starCount,
      usBundledProcedures.properties.recordCount,
    );
    assert.ok(usBundledProcedures.properties.waypointCount > 0);
  });

  it('contains records with the expected required fields', () => {
    const first = usBundledProcedures.records[0];
    assert.ok(first !== undefined);
    assert.equal(typeof first.name, 'string');
    assert.ok(first.name.length > 0);
    assert.equal(typeof first.computerCode, 'string');
    assert.ok(first.computerCode.length > 0);
    assert.equal(typeof first.type, 'string');
    assert.ok(first.type === 'SID' || first.type === 'STAR');
    assert.ok(Array.isArray(first.airports));
    assert.ok(Array.isArray(first.commonRoutes));
    assert.ok(Array.isArray(first.transitions));
  });

  it('contains waypoints with the expected required fields', () => {
    const proc = usBundledProcedures.records.find(
      (r) => r.commonRoutes.length > 0 && r.commonRoutes[0]!.waypoints.length > 0,
    );
    assert.ok(proc !== undefined, 'expected at least one procedure with common route waypoints');
    const wp = proc.commonRoutes[0]!.waypoints[0]!;
    assert.equal(typeof wp.fixIdentifier, 'string');
    assert.ok(wp.fixIdentifier.length > 0);
    assert.equal(typeof wp.category, 'string');
    assert.equal(typeof wp.typeCode, 'string');
    assert.equal(typeof wp.lat, 'number');
    assert.equal(typeof wp.lon, 'number');
  });

  it('contains both SIDs and STARs', () => {
    const types = new Set(usBundledProcedures.records.map((r) => r.type));
    assert.ok(types.has('SID'), 'expected SID procedures');
    assert.ok(types.has('STAR'), 'expected STAR procedures');
  });

  it('contains procedures with adapted airports', () => {
    const withAirports = usBundledProcedures.records.find((r) => r.airports.length > 0);
    assert.ok(withAirports !== undefined, 'expected at least one procedure with adapted airports');
  });

  it('contains procedures with transitions', () => {
    const withTransitions = usBundledProcedures.records.find((r) => r.transitions.length > 0);
    assert.ok(withTransitions !== undefined, 'expected at least one procedure with transitions');
    const t = withTransitions.transitions[0]!;
    assert.equal(typeof t.name, 'string');
    assert.ok(t.name.length > 0);
    assert.ok(t.waypoints.length > 0);
  });

  it('contains procedures with multiple common routes', () => {
    const withMultiple = usBundledProcedures.records.find((r) => r.commonRoutes.length > 1);
    assert.ok(
      withMultiple !== undefined,
      'expected at least one procedure with multiple common routes',
    );
  });

  it('can find a known STAR by scanning records', () => {
    const aalle = usBundledProcedures.records.find((r) => r.computerCode === 'AALLE4');
    assert.ok(aalle !== undefined, 'expected to find AALLE4 STAR');
    assert.equal(aalle.type, 'STAR');
    assert.equal(aalle.name, 'AALLE FOUR');
    assert.ok(aalle.airports.includes('DEN'));
    assert.ok(aalle.commonRoutes.length > 0);
    assert.ok(aalle.transitions.length > 0);
  });

  it('can find a known SID by scanning records', () => {
    const accra = usBundledProcedures.records.find((r) => r.computerCode === 'ACCRA5');
    assert.ok(accra !== undefined, 'expected to find ACCRA5 SID');
    assert.equal(accra.type, 'SID');
    assert.equal(accra.name, 'ACCRA FIVE');
    assert.ok(accra.airports.length > 0);
  });

  it('waypointCount matches actual waypoint total', () => {
    let actualCount = 0;
    for (const proc of usBundledProcedures.records) {
      for (const route of proc.commonRoutes) {
        actualCount += route.waypoints.length;
      }
      for (const transition of proc.transitions) {
        actualCount += transition.waypoints.length;
      }
    }
    assert.equal(usBundledProcedures.properties.waypointCount, actualCount);
  });

  it('common routes have associated airports', () => {
    const withRouteAirports = usBundledProcedures.records.find((r) =>
      r.commonRoutes.some((cr) => cr.airports.length > 0),
    );
    assert.ok(
      withRouteAirports !== undefined,
      'expected at least one procedure with airports on common routes',
    );
  });
});
