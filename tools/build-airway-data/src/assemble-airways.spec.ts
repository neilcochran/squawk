import { describe, it, expect, assert } from 'vitest';

import type { AirwayWaypoint } from '@squawk/types';

import type { AirwaySourceRecords } from './assemble-airways.js';
import { assembleAirway, assembleWaypoints, regionOf } from './assemble-airways.js';
import { fixRecord, pointRecord, segmentRecord } from './test-utils.js';

describe('regionOf', () => {
  it('maps the airway type character to a region', () => {
    expect(regionOf('A')).toBe('ALASKA');
    expect(regionOf('H')).toBe('HAWAII');
    expect(regionOf('')).toBe('US');
    expect(regionOf('X')).toBe('US');
  });
});

describe('assembleWaypoints', () => {
  function point(identifier: string, distanceToNextNm?: number): AirwayWaypoint {
    const wp: AirwayWaypoint = {
      name: identifier,
      identifier,
      waypointType: 'FIX',
      lat: 40,
      lon: -74,
    };
    if (distanceToNextNm !== undefined) {
      wp.distanceToNextNm = distanceToNextNm;
    }
    return wp;
  }

  it('keeps the built waypoints in sequence order and drops the rest', () => {
    const result = assembleWaypoints([point('A', 10), undefined, point('C', 20), point('D')]);
    expect(result.map((wp) => wp.identifier)).toEqual(['A', 'C', 'D']);
  });

  it('clears the distance on a waypoint whose successor was not built', () => {
    const result = assembleWaypoints([point('A', 10), undefined, point('C', 20), point('D')]);
    expect(result[0]?.distanceToNextNm).toBe(undefined);
    expect(result[1]?.distanceToNextNm).toBe(20);
  });

  it('clears the distance on the last waypoint', () => {
    const result = assembleWaypoints([point('A', 10), point('B', 20)]);
    expect(result[0]?.distanceToNextNm).toBe(10);
    expect(result[1]?.distanceToNextNm).toBe(undefined);
  });

  it('returns an empty array when nothing could be built', () => {
    expect(assembleWaypoints([undefined, undefined])).toEqual([]);
  });
});

describe('assembleAirway', () => {
  function source(overrides: Partial<AirwaySourceRecords> = {}): AirwaySourceRecords {
    return {
      designation: 'J70',
      airwayTypeChar: '',
      segments: new Map([
        [30, segmentRecord({ sequenceNumber: 30, segmentDistanceNm: 30 })],
        [
          10,
          segmentRecord({
            sequenceNumber: 10,
            segmentDistanceNm: 10,
            minimumCrossingAltitudeFt: 25000,
            minimumCrossingAltitudeDirection: 'W BND',
            minimumCrossingAltitudePoint: 'AUGER',
          }),
        ],
        [20, segmentRecord({ sequenceNumber: 20, segmentDistanceNm: 20 })],
      ]),
      points: new Map([
        [10, fixRecord('NICKL', 10)],
        [20, fixRecord('WILDD', 20)],
        [30, fixRecord('AUGER', 30)],
      ]),
      pointRemarks: new Map(),
      remarks: [],
      ...overrides,
    };
  }

  it('builds the waypoints in sequence order with the MCA on its named point', () => {
    const result = assembleAirway('JET', source());
    assert(result.airway);
    expect(result.airway.designation).toBe('J70');
    expect(result.airway.type).toBe('JET');
    expect(result.airway.region).toBe('US');
    expect(result.airway.waypoints.map((wp) => wp.name)).toEqual(['NICKL', 'WILDD', 'AUGER']);
    expect(result.airway.waypoints.map((wp) => wp.distanceToNextNm)).toEqual([10, 20, undefined]);
    expect(result.airway.waypoints[0]?.minimumCrossingAltitudeFt).toBe(undefined);
    expect(result.airway.waypoints[2]?.minimumCrossingAltitudeFt).toBe(25000);
    expect(result.crossingAltitudes).toEqual({ attached: 1, unplaced: [] });
    expect(result.unusableSegments).toBe(0);
    expect('remarks' in result.airway).toBe(false);
  });

  it('drops points without coordinates and clears the distance running to them', () => {
    const src = source();
    src.points.set(20, fixRecord('BORDER', 20));
    src.points.get(20)!.latStr = '';
    const result = assembleAirway('JET', src);
    assert(result.airway);
    expect(result.airway.waypoints.map((wp) => wp.name)).toEqual(['NICKL', 'AUGER']);
    expect(result.airway.waypoints[0]?.distanceToNextNm).toBe(undefined);
  });

  it('skips a segment record without a point record', () => {
    const src = source();
    src.points.delete(20);
    const result = assembleAirway('JET', src);
    assert(result.airway);
    expect(result.airway.waypoints.map((wp) => wp.name)).toEqual(['NICKL', 'AUGER']);
  });

  it('carries point remarks, counts unusable segments and carries route remarks', () => {
    const src = source({
      pointRemarks: new Map([[20, ['UNUSABLE']]]),
      remarks: ['HF COMM REQUIRED'],
    });
    const result = assembleAirway('JET', src);
    assert(result.airway);
    expect(result.airway.waypoints[1]?.unusable).toBe(true);
    expect(result.airway.waypoints[1]?.remarks).toEqual(['UNUSABLE']);
    expect(result.unusableSegments).toBe(1);
    expect(result.airway.remarks).toEqual(['HF COMM REQUIRED']);
  });

  it('reports a crossing altitude it could not place', () => {
    const src = source();
    src.segments.get(10)!.minimumCrossingAltitudePoint = undefined;
    const result = assembleAirway('JET', src);
    expect(result.crossingAltitudes.attached).toBe(0);
    expect(result.crossingAltitudes.unplaced).toEqual([
      'J70 seq 10: MCA 25000 without a named point',
    ]);
  });

  it('takes the region from the airway type character', () => {
    const result = assembleAirway('VICTOR', source({ designation: 'V320', airwayTypeChar: 'A' }));
    expect(result.airway?.region).toBe('ALASKA');
  });

  it('returns no airway when none of its points can be placed', () => {
    const result = assembleAirway(
      'JET',
      source({ points: new Map([[10, pointRecord({ latStr: '' })]]) }),
    );
    expect(result.airway).toBe(undefined);
    expect(result.crossingAltitudes.unplaced).toEqual([
      'J70 seq 10: MCA point AUGER is not a point of the airway',
    ]);
  });
});
