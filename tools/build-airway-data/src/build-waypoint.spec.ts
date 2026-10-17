import { describe, it, expect, assert } from 'vitest';

import {
  UNUSABLE_REMARK,
  buildWaypoint,
  classifyWaypointType,
  publishedDistanceNm,
} from './build-waypoint.js';
import { pointRecord, segmentRecord } from './test-utils.js';

describe('classifyWaypointType', () => {
  it('classifies VOR/VORTAC/NDB/TACAN/DME facility types as NAVAID', () => {
    expect(classifyWaypointType('VOR/DME')).toBe('NAVAID');
    expect(classifyWaypointType('VORTAC')).toBe('NAVAID');
    expect(classifyWaypointType('NDB')).toBe('NAVAID');
    expect(classifyWaypointType('TACAN')).toBe('NAVAID');
    expect(classifyWaypointType('VOR/DME/TACAN')).toBe('NAVAID');
  });

  it('classifies WAY-PT as WAYPOINT', () => {
    expect(classifyWaypointType('WAY-PT')).toBe('WAYPOINT');
  });

  it('classifies REP-PT, AWY-INTXN, COORDN-FIX, MIL-REP-PT, FIX, TURN-PT as FIX', () => {
    expect(classifyWaypointType('REP-PT')).toBe('FIX');
    expect(classifyWaypointType('AWY-INTXN')).toBe('FIX');
    expect(classifyWaypointType('COORDN-FIX')).toBe('FIX');
    expect(classifyWaypointType('MIL-REP-PT')).toBe('FIX');
    expect(classifyWaypointType('FIX')).toBe('FIX');
    expect(classifyWaypointType('TURN-PT')).toBe('FIX');
  });

  it('classifies ARTCC-BDRY, unknown and blank facility types as OTHER', () => {
    expect(classifyWaypointType('ARTCC-BDRY')).toBe('OTHER');
    expect(classifyWaypointType('UNKNOWN')).toBe('OTHER');
    expect(classifyWaypointType('')).toBe('OTHER');
  });

  it('matches facility types case-insensitively', () => {
    expect(classifyWaypointType('vor/dme')).toBe('NAVAID');
    expect(classifyWaypointType('way-pt')).toBe('WAYPOINT');
  });
});

describe('publishedDistanceNm', () => {
  it('returns the segment distance when it is positive', () => {
    expect(publishedDistanceNm(45.05, 0)).toBe(45.05);
    expect(publishedDistanceNm(45.05, 71)).toBe(45.05);
  });

  it('falls back to the header distance when the segment distance is zero or undefined', () => {
    expect(publishedDistanceNm(0, 71)).toBe(71);
    expect(publishedDistanceNm(undefined, 71)).toBe(71);
  });

  it('returns undefined when neither field holds a positive distance', () => {
    expect(publishedDistanceNm(0, 0)).toBe(undefined);
    expect(publishedDistanceNm(0, undefined)).toBe(undefined);
    expect(publishedDistanceNm(undefined, undefined)).toBe(undefined);
  });
});

describe('buildWaypoint', () => {
  it('returns undefined when coordinates cannot be parsed', () => {
    expect(buildWaypoint(segmentRecord(), pointRecord({ latStr: '' }))).toBe(undefined);
    expect(buildWaypoint(segmentRecord(), pointRecord({ lonStr: 'nope' }))).toBe(undefined);
  });

  it('builds a NAVAID waypoint with navaid identifier and facility type', () => {
    const wp = buildWaypoint(segmentRecord(), pointRecord());
    assert(wp);
    expect(wp.name).toBe('KENNEDY');
    expect(wp.waypointType).toBe('NAVAID');
    expect(wp.identifier).toBe('JFK');
    expect(wp.navaidFacilityType).toBe('VOR/DME');
    assert(Math.abs(wp.lat - 40.639722) < 1e-4);
    assert(wp.lon < 0 && Math.abs(Math.abs(wp.lon) - 73.778611) < 1e-4);
    expect(wp.state).toBe('NY');
    expect(wp.icaoRegionCode).toBe('K6');
  });

  it('uses the name as identifier for FIX waypoints lacking a navaid identifier', () => {
    const wp = buildWaypoint(
      segmentRecord(),
      pointRecord({ facilityType: 'REP-PT', navaidIdentifier: '', name: 'OBAAK' }),
    );
    assert(wp);
    expect(wp.waypointType).toBe('FIX');
    expect(wp.identifier).toBe('OBAAK');
    expect(wp.navaidFacilityType).toBe(undefined);
  });

  it('prefers the segment distance and falls back to the header distance', () => {
    expect(
      buildWaypoint(segmentRecord({ segmentDistanceNm: 42.5 }), pointRecord())?.distanceToNextNm,
    ).toBe(42.5);
    expect(
      buildWaypoint(segmentRecord({ distanceToNextNm: 10, segmentDistanceNm: 99 }), pointRecord())
        ?.distanceToNextNm,
    ).toBe(99);
    expect(
      buildWaypoint(segmentRecord({ distanceToNextNm: 10, segmentDistanceNm: 0 }), pointRecord())
        ?.distanceToNextNm,
    ).toBe(10);
  });

  it('leaves distanceToNextNm unset when both distance fields are zero', () => {
    const wp = buildWaypoint(
      segmentRecord({ distanceToNextNm: 0, segmentDistanceNm: 0 }),
      pointRecord(),
    );
    assert(wp);
    expect(wp.distanceToNextNm).toBe(undefined);
  });

  it('leaves distanceToNextNm unset when the airway is discontinued after this point', () => {
    const wp = buildWaypoint(
      segmentRecord({ segmentDistanceNm: 50, discontinued: true }),
      pointRecord(),
    );
    assert(wp);
    expect(wp.discontinued).toBe(true);
    expect(wp.distanceToNextNm).toBe(undefined);
  });

  it('propagates boolean flags only when set', () => {
    const flagged = buildWaypoint(
      segmentRecord({ signalGap: true, usAirspaceOnly: true, dogleg: true, discontinued: true }),
      pointRecord(),
    );
    expect(flagged?.signalGap).toBe(true);
    expect(flagged?.usAirspaceOnly).toBe(true);
    expect(flagged?.dogleg).toBe(true);
    expect(flagged?.discontinued).toBe(true);
    const plain = buildWaypoint(segmentRecord(), pointRecord());
    assert(plain);
    expect('signalGap' in plain).toBe(false);
    expect('discontinued' in plain).toBe(false);
    expect('unusable' in plain).toBe(false);
  });

  it('propagates every altitude with its direction', () => {
    const wp = buildWaypoint(
      segmentRecord({
        minimumEnrouteAltitudeFt: 4000,
        minimumEnrouteAltitudeDirection: 'SE BND',
        minimumEnrouteAltitudeOppositeFt: 5000,
        minimumEnrouteAltitudeOppositeDirection: 'NW BND',
        maximumAuthorizedAltitudeFt: 18000,
        minimumObstructionClearanceAltitudeFt: 3200,
        gnssMinimumEnrouteAltitudeFt: 3500,
        gnssMinimumEnrouteAltitudeDirection: 'SE BND',
        gnssMinimumEnrouteAltitudeOppositeFt: 4500,
        gnssMinimumEnrouteAltitudeOppositeDirection: 'NW BND',
        dmeDmeIruMinimumEnrouteAltitudeFt: 18000,
        dmeDmeIruMinimumEnrouteAltitudeDirection: 'E BND',
      }),
      pointRecord({ minimumReceptionAltitudeFt: 2500 }),
    );
    assert(wp);
    expect(wp.minimumEnrouteAltitudeFt).toBe(4000);
    expect(wp.minimumEnrouteAltitudeDirection).toBe('SE BND');
    expect(wp.minimumEnrouteAltitudeOppositeFt).toBe(5000);
    expect(wp.minimumEnrouteAltitudeOppositeDirection).toBe('NW BND');
    expect(wp.maximumAuthorizedAltitudeFt).toBe(18000);
    expect(wp.minimumObstructionClearanceAltitudeFt).toBe(3200);
    expect(wp.gnssMinimumEnrouteAltitudeFt).toBe(3500);
    expect(wp.gnssMinimumEnrouteAltitudeDirection).toBe('SE BND');
    expect(wp.gnssMinimumEnrouteAltitudeOppositeFt).toBe(4500);
    expect(wp.gnssMinimumEnrouteAltitudeOppositeDirection).toBe('NW BND');
    expect(wp.dmeDmeIruMinimumEnrouteAltitudeFt).toBe(18000);
    expect(wp.dmeDmeIruMinimumEnrouteAltitudeDirection).toBe('E BND');
    expect(wp.minimumReceptionAltitudeFt).toBe(2500);
  });

  it('emits a direction only together with its altitude', () => {
    const wp = buildWaypoint(
      segmentRecord({
        minimumEnrouteAltitudeOppositeDirection: 'W BND',
        gnssMinimumEnrouteAltitudeOppositeDirection: 'W BND',
        dmeDmeIruMinimumEnrouteAltitudeDirection: 'E BND',
        minimumEnrouteAltitudeFt: 4000,
      }),
      pointRecord(),
    );
    assert(wp);
    expect(wp.minimumEnrouteAltitudeFt).toBe(4000);
    expect(wp.minimumEnrouteAltitudeDirection).toBe(undefined);
    expect('minimumEnrouteAltitudeOppositeDirection' in wp).toBe(false);
    expect('gnssMinimumEnrouteAltitudeOppositeDirection' in wp).toBe(false);
    expect('dmeDmeIruMinimumEnrouteAltitudeDirection' in wp).toBe(false);
  });

  it('copies the courses, changeover distance, RNP and ARTCC', () => {
    const wp = buildWaypoint(
      segmentRecord({
        magneticCourseDeg: 60,
        magneticCourseOppositeDeg: 240,
        changeoverDistanceNm: 12,
        rnpNm: 1,
        artccId: 'ZNY',
      }),
      pointRecord(),
    );
    assert(wp);
    expect(wp.magneticCourseDeg).toBe(60);
    expect(wp.magneticCourseOppositeDeg).toBe(240);
    expect(wp.changeoverDistanceNm).toBe(12);
    expect(wp.rnpNm).toBe(1);
    expect(wp.artccId).toBe('ZNY');
  });

  it('copies the magnetic variation of a navaid point', () => {
    const wp = buildWaypoint(
      segmentRecord({ magneticVariation: { degrees: 13, direction: 'W' } }),
      pointRecord(),
    );
    assert(wp);
    expect(wp.magneticVariationDeg).toBe(13);
    expect(wp.magneticVariationDirection).toBe('W');
    const without = buildWaypoint(segmentRecord(), pointRecord());
    assert(without);
    expect('magneticVariationDeg' in without).toBe(false);
  });

  it('leaves the minimum crossing altitude for the crossing-altitude pass', () => {
    const wp = buildWaypoint(
      segmentRecord({
        minimumCrossingAltitudeFt: 5000,
        minimumCrossingAltitudeDirection: 'NE BND',
        minimumCrossingAltitudePoint: 'OBAAK',
      }),
      pointRecord(),
    );
    assert(wp);
    expect('minimumCrossingAltitudeFt' in wp).toBe(false);
    expect('minimumCrossingAltitudeDirection' in wp).toBe(false);
  });

  it('flags the segment unusable from the MEA GAP column', () => {
    const wp = buildWaypoint(
      segmentRecord({ unusable: true, segmentDistanceNm: 12.3 }),
      pointRecord(),
    );
    assert(wp);
    expect(wp.unusable).toBe(true);
    expect(wp.distanceToNextNm).toBe(12.3);
  });

  it('flags the segment unusable from an UNUSABLE point remark and carries the remarks', () => {
    const wp = buildWaypoint(segmentRecord(), pointRecord(), [UNUSABLE_REMARK]);
    assert(wp);
    expect(wp.unusable).toBe(true);
    expect(wp.remarks).toEqual(['UNUSABLE']);
  });

  it('does not treat a remark about an unusable radial as an unusable segment', () => {
    const remarks = ['WINK R-311 UNUSABLE, USE CHISUM R-129'];
    const wp = buildWaypoint(segmentRecord(), pointRecord(), remarks);
    assert(wp);
    expect('unusable' in wp).toBe(false);
    expect(wp.remarks).toEqual(remarks);
    expect(wp.remarks).not.toBe(remarks);
  });

  it('omits remarks when the point has none', () => {
    const wp = buildWaypoint(segmentRecord(), pointRecord(), []);
    assert(wp);
    expect('remarks' in wp).toBe(false);
  });
});
