import { describe, it, expect, assert } from 'vitest';

import type { AirwayWaypoint } from '@squawk/types';

import { buildWaypoint } from './build-waypoint.js';
import { attachCrossingAltitudes } from './crossing-altitudes.js';
import { fixRecord, pointRecord, segmentRecord } from './test-utils.js';

/** Three fixes in sequence, then the Kennedy VOR/DME. */
const points = [
  fixRecord('NICKL', 10),
  fixRecord('WILDD', 20),
  fixRecord('AUGER', 30),
  pointRecord({ sequenceNumber: 40 }),
];

function segments(
  overrides: Partial<Parameters<typeof segmentRecord>[0]>[] = [],
): ReturnType<typeof segmentRecord>[] {
  return points.map((point, i) =>
    segmentRecord({ sequenceNumber: point.sequenceNumber, ...overrides[i] }),
  );
}

function build(segs: ReturnType<typeof segmentRecord>[]): (AirwayWaypoint | undefined)[] {
  return segs.map((segment, i) => {
    const point = points[i];
    return point === undefined ? undefined : buildWaypoint(segment, point);
  });
}

describe('attachCrossingAltitudes', () => {
  it('attaches the MCA to the named waypoint further along the airway', () => {
    const segs = segments([
      {
        minimumCrossingAltitudeFt: 25000,
        minimumCrossingAltitudeDirection: 'W BND',
        minimumCrossingAltitudePoint: 'AUGER',
      },
    ]);
    const waypoints = build(segs);
    const result = attachCrossingAltitudes('J70', segs, points, waypoints);
    expect(result).toEqual({ attached: 1, unplaced: [] });
    expect(waypoints[0]?.minimumCrossingAltitudeFt).toBe(undefined);
    expect(waypoints[2]?.minimumCrossingAltitudeFt).toBe(25000);
    expect(waypoints[2]?.minimumCrossingAltitudeDirection).toBe('W BND');
  });

  it("attaches the MCA to the record's own waypoint when it names that point", () => {
    const segs = segments([
      {
        minimumCrossingAltitudeFt: 6000,
        minimumCrossingAltitudeDirection: 'E BND',
        minimumCrossingAltitudePoint: 'NICKL',
      },
    ]);
    const waypoints = build(segs);
    attachCrossingAltitudes('V1', segs, points, waypoints);
    expect(waypoints[0]?.minimumCrossingAltitudeFt).toBe(6000);
  });

  it('matches a navaid by identifier and copies the opposite-direction MCA', () => {
    const segs = segments([
      {},
      {},
      {
        minimumCrossingAltitudeFt: 3800,
        minimumCrossingAltitudeDirection: 'NE BND',
        minimumCrossingAltitudeOppositeFt: 4200,
        minimumCrossingAltitudeOppositeDirection: 'SW BND',
        minimumCrossingAltitudePoint: 'JFK',
      },
    ]);
    const waypoints = build(segs);
    attachCrossingAltitudes('T291', segs, points, waypoints);
    const jfk = waypoints[3];
    assert(jfk);
    expect(jfk.minimumCrossingAltitudeFt).toBe(3800);
    expect(jfk.minimumCrossingAltitudeDirection).toBe('NE BND');
    expect(jfk.minimumCrossingAltitudeOppositeFt).toBe(4200);
    expect(jfk.minimumCrossingAltitudeOppositeDirection).toBe('SW BND');
  });

  it('omits directions the record does not publish', () => {
    const segs = segments([
      {
        minimumCrossingAltitudeFt: 5000,
        minimumCrossingAltitudeOppositeFt: 5500,
        minimumCrossingAltitudePoint: 'WILDD',
      },
    ]);
    const waypoints = build(segs);
    attachCrossingAltitudes('V1', segs, points, waypoints);
    const wildd = waypoints[1];
    assert(wildd);
    expect(wildd.minimumCrossingAltitudeFt).toBe(5000);
    expect(wildd.minimumCrossingAltitudeOppositeFt).toBe(5500);
    expect('minimumCrossingAltitudeDirection' in wildd).toBe(false);
    expect('minimumCrossingAltitudeOppositeDirection' in wildd).toBe(false);
  });

  it('reports an MCA without a named point and leaves it off', () => {
    const segs = segments([
      { minimumCrossingAltitudeFt: 3800, minimumCrossingAltitudeDirection: 'NE BND' },
    ]);
    const waypoints = build(segs);
    const result = attachCrossingAltitudes('T291', segs, points, waypoints);
    expect(result.attached).toBe(0);
    expect(result.unplaced).toEqual(['T291 seq 10: MCA 3800 without a named point']);
    expect(waypoints.every((wp) => wp?.minimumCrossingAltitudeFt === undefined)).toBe(true);
  });

  it('reports a point that is not on the airway', () => {
    const segs = segments([
      { minimumCrossingAltitudeFt: 3800, minimumCrossingAltitudePoint: 'NOWHERE' },
    ]);
    const result = attachCrossingAltitudes('V1', segs, points, build(segs));
    expect(result.unplaced).toEqual(['V1 seq 10: MCA point NOWHERE is not a point of the airway']);
  });

  it('reports a named point that could not be placed', () => {
    const segs = segments([
      { minimumCrossingAltitudeFt: 3800, minimumCrossingAltitudePoint: 'AUGER' },
    ]);
    const waypoints = build(segs);
    waypoints[2] = undefined;
    const result = attachCrossingAltitudes('V1', segs, points, waypoints);
    expect(result.unplaced).toEqual(['V1 seq 10: MCA point AUGER has no coordinates']);
  });

  it('keeps the first MCA when two records name the same point', () => {
    const segs = segments([
      { minimumCrossingAltitudeFt: 3000, minimumCrossingAltitudePoint: 'AUGER' },
      { minimumCrossingAltitudeFt: 4000, minimumCrossingAltitudePoint: 'AUGER' },
    ]);
    const waypoints = build(segs);
    const result = attachCrossingAltitudes('V1', segs, points, waypoints);
    expect(result.attached).toBe(1);
    expect(result.unplaced).toEqual(['V1 seq 20: MCA point AUGER already carries an MCA']);
    expect(waypoints[2]?.minimumCrossingAltitudeFt).toBe(3000);
  });

  it('does nothing for records without an MCA', () => {
    const segs = segments();
    const waypoints = build(segs);
    expect(attachCrossingAltitudes('V1', segs, points, waypoints)).toEqual({
      attached: 0,
      unplaced: [],
    });
  });
});
