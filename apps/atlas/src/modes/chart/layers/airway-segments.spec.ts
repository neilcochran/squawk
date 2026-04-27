import { describe, it, expect } from 'vitest';
import type { AirwayWaypoint } from '@squawk/types';
import { buildSegments } from './airway-segments.ts';

/**
 * Builds a minimal `AirwayWaypoint` for tests. Only the fields the
 * antimeridian splitter actually reads (`lat`, `lon`) need realistic
 * values; the rest are stubbed.
 */
function makeWaypoint(lon: number, lat: number): AirwayWaypoint {
  return { lon, lat, name: 'TEST', waypointType: 'OTHER' };
}

describe('buildSegments', () => {
  it('returns one segment when no antimeridian crossing', () => {
    const waypoints = [makeWaypoint(-98, 39), makeWaypoint(-95, 40), makeWaypoint(-92, 41)];
    const segments = buildSegments(waypoints);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual([
      [-98, 39],
      [-95, 40],
      [-92, 41],
    ]);
  });

  it('splits at the antimeridian when lonDiff > 180 (numerically east, physically west across +/-180)', () => {
    const waypoints = [makeWaypoint(-179, 60), makeWaypoint(178, 62)];
    const segments = buildSegments(waypoints);
    expect(segments).toHaveLength(2);

    // First segment closes at lon = -180 with the linearly-interpolated
    // crossing latitude. prev is 1 deg west of -180, wp is 2 deg east of
    // +180, so the crossing is 1/3 of the way along the wp's lat.
    const firstSegment = segments[0];
    expect(firstSegment).toBeDefined();
    expect(firstSegment?.[0]).toEqual([-179, 60]);
    expect(firstSegment?.[1]?.[0]).toBe(-180);
    expect(firstSegment?.[1]?.[1]).toBeCloseTo(60.667, 2);

    // Second segment resumes from lon = +180 at the same crossing latitude.
    const secondSegment = segments[1];
    expect(secondSegment).toBeDefined();
    expect(secondSegment?.[0]?.[0]).toBe(180);
    expect(secondSegment?.[0]?.[1]).toBeCloseTo(60.667, 2);
    expect(secondSegment?.[1]).toEqual([178, 62]);
  });

  it('splits at the antimeridian when lonDiff < -180 (numerically west, physically east across +/-180)', () => {
    const waypoints = [makeWaypoint(179, 55), makeWaypoint(-178, 57)];
    const segments = buildSegments(waypoints);
    expect(segments).toHaveLength(2);

    const firstSegment = segments[0];
    expect(firstSegment).toBeDefined();
    expect(firstSegment?.[0]).toEqual([179, 55]);
    expect(firstSegment?.[1]?.[0]).toBe(180);
    expect(firstSegment?.[1]?.[1]).toBeCloseTo(55.667, 2);

    const secondSegment = segments[1];
    expect(secondSegment).toBeDefined();
    expect(secondSegment?.[0]?.[0]).toBe(-180);
    expect(secondSegment?.[0]?.[1]).toBeCloseTo(55.667, 2);
    expect(secondSegment?.[1]).toEqual([-178, 57]);
  });

  it('splits into three segments when the path crosses the antimeridian twice', () => {
    const waypoints = [makeWaypoint(-179, 60), makeWaypoint(178, 62), makeWaypoint(-178, 64)];
    const segments = buildSegments(waypoints);
    expect(segments).toHaveLength(3);

    // Segment 2 (the middle one) starts at +180, includes the +178/62
    // waypoint, then closes at +180 again before the second crossing.
    const middleSegment = segments[1];
    expect(middleSegment).toBeDefined();
    expect(middleSegment?.[0]?.[0]).toBe(180);
    expect(middleSegment?.[1]).toEqual([178, 62]);
    expect(middleSegment?.[middleSegment.length - 1]?.[0]).toBe(180);
  });

  it('does not split when consecutive waypoints are within 180 degrees of each other', () => {
    // Boundary case: lonDiff is exactly +180. The implementation splits
    // only when |lonDiff| is strictly greater than 180, so this should
    // stay as one segment.
    const waypoints = [makeWaypoint(-90, 30), makeWaypoint(90, 30)];
    const segments = buildSegments(waypoints);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(2);
  });
});
