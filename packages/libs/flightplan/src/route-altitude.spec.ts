import { describe, expect, it } from 'vitest';

import { magnetic } from '@squawk/flight-math';
import { greatCircle } from '@squawk/geo';
import type { Airway, AirwayRegion, AirwayType, AirwayWaypoint } from '@squawk/types';

import type { AirwayRouteElement, SpeedAltitudeRouteElement } from './resolver.js';
import { checkRouteAltitudes } from './route-altitude.js';
import type { RouteAltitudeCheckOptions, RouteAltitudeFindingCode } from './route-altitude.js';
import { computeRouteDistance } from './route-distance.js';
import { makeAirport, makeDirect, makeSid, makeStar, makeWaypoint, route } from './test-utils.js';

/** A waypoint for {@link airway}: identifier, longitude on the 40N parallel, and any published fields. */
type TestWaypoint = Partial<AirwayWaypoint> & { identifier: string; lon: number };

/**
 * Builds an airway element whose waypoints lie along 40N, flown in published
 * order unless `reversed` is set, with every segment and point field taken
 * from the given waypoints.
 */
function airway(
  designation: string,
  waypoints: TestWaypoint[],
  options: {
    reversed?: boolean | undefined;
    type?: AirwayType;
    region?: AirwayRegion;
    remarks?: string[];
  } = {},
): AirwayRouteElement {
  const built: AirwayWaypoint[] = waypoints.map((wp) => ({
    name: wp.identifier,
    waypointType: 'FIX',
    lat: 40,
    ...wp,
  }));
  const ordered = options.reversed === true ? [...built].reverse() : built;
  const record: Airway = {
    designation,
    type: options.type ?? 'VICTOR',
    region: options.region ?? 'US',
    waypoints: built,
  };
  if (options.remarks !== undefined) {
    record.remarks = options.remarks;
  }
  const element: AirwayRouteElement = {
    type: 'airway',
    raw: designation,
    airway: record,
    entryFix: ordered[0]!.identifier!,
    exitFix: ordered[ordered.length - 1]!.identifier!,
    waypoints: ordered,
    gaps: [],
    unusable: [],
  };
  if (!('reversed' in options)) {
    element.reversed = false;
  } else if (options.reversed !== undefined) {
    element.reversed = options.reversed;
  }
  return element;
}

/** Builds a standalone or attached speed/altitude group at a flight level. */
function level(flightLevel: number, fromPoint?: string): SpeedAltitudeRouteElement {
  const raw = `N0450F${String(flightLevel).padStart(3, '0')}`;
  const group: SpeedAltitudeRouteElement = {
    type: 'speedAltitude',
    raw,
    speedKt: 450,
    flightLevel,
  };
  if (fromPoint !== undefined) {
    group.fromPoint = fromPoint;
  }
  return group;
}

/** Builds a speed/altitude group in feet. */
function feet(altitudeFt: number, fromPoint?: string): SpeedAltitudeRouteElement {
  const raw = `N0250A${String(altitudeFt / 100).padStart(3, '0')}`;
  const group: SpeedAltitudeRouteElement = { type: 'speedAltitude', raw, speedKt: 250, altitudeFt };
  if (fromPoint !== undefined) {
    group.fromPoint = fromPoint;
  }
  return group;
}

/** Returns the finding codes of a leg or point. */
function codes(target: {
  findings: { code: RouteAltitudeFindingCode }[];
}): RouteAltitudeFindingCode[] {
  return target.findings.map((finding) => finding.code);
}

const CONVENTIONAL: RouteAltitudeCheckOptions['equipment'] = ['conventional'];
const GNSS: RouteAltitudeCheckOptions['equipment'] = ['gnss'];

/** A two-segment Victor airway with a 5000 ft conventional MEA and a 17500 ft MAA. */
function simpleAirway(): AirwayRouteElement {
  return airway('V1', [
    {
      identifier: 'AAA',
      lon: -75,
      minimumEnrouteAltitudeFt: 5000,
      maximumAuthorizedAltitudeFt: 17500,
      magneticCourseDeg: 90,
      magneticCourseOppositeDeg: 270,
    },
    {
      identifier: 'BBB',
      lon: -74,
      minimumEnrouteAltitudeFt: 5000,
      maximumAuthorizedAltitudeFt: 17500,
      magneticCourseDeg: 90,
      magneticCourseOppositeDeg: 270,
    },
    { identifier: 'CCC', lon: -73 },
  ]);
}

describe('checkRouteAltitudes', () => {
  describe('altitude source', () => {
    it('returns noAltitude with nothing else when no altitude is known anywhere', () => {
      const result = checkRouteAltitudes(route([simpleAirway()]), { equipment: CONVENTIONAL });
      expect(result).toEqual({ status: 'noAltitude', legs: [], points: [], airwayRemarks: [] });
    });

    it('uses the altitudeFt option and names it as the source', () => {
      const result = checkRouteAltitudes(route([simpleAirway()]), {
        altitudeFt: 7000,
        equipment: CONVENTIONAL,
      });
      expect(result.status).toBe('pass');
      expect(result.legs).toHaveLength(2);
      for (const leg of result.legs) {
        expect(leg.status).toBe('pass');
        expect(leg.altitudeFt).toBe(7000);
        expect(leg.altitudeSource).toEqual({ type: 'input' });
        expect(leg.airway).toBe('V1');
        expect(leg.maximumAuthorizedAltitudeFt).toBe(17500);
        expect(leg.minimumEnrouteAltitude).toEqual({
          altitudeFt: 5000,
          kind: 'conventional',
          basis: 'published',
        });
      }
    });

    it('uses the opening speed/altitude group when no altitudeFt is given', () => {
      const result = checkRouteAltitudes(route([feet(9000), simpleAirway()]), {
        equipment: CONVENTIONAL,
      });
      expect(result.legs[0]!.altitudeFt).toBe(9000);
      expect(result.legs[0]!.altitudeSource).toEqual({ type: 'route', raw: 'N0250A090' });
    });

    it('lets altitudeFt replace the opening group but keeps later attached groups', () => {
      const result = checkRouteAltitudes(
        route([
          feet(9000),
          makeWaypoint('AAA', 40, -75),
          simpleAirway(),
          level(150, 'CCC'),
          makeDirect(),
          makeWaypoint('DDD', 40, -72),
        ]),
        { altitudeFt: 6000, equipment: CONVENTIONAL },
      );
      expect(result.legs.map((leg) => leg.altitudeFt)).toEqual([6000, 6000, 15000]);
      expect(result.legs[2]!.altitudeSource).toEqual({
        type: 'route',
        raw: 'N0450F150',
        fromPoint: 'CCC',
      });
    });

    it('crosses a point with an attached group at the altitude of the leg arriving at it', () => {
      const first = airway('V1', [
        { identifier: 'AAA', lon: -75, minimumEnrouteAltitudeFt: 5000, magneticCourseDeg: 90 },
        { identifier: 'BBB', lon: -74, minimumReceptionAltitudeFt: 8000 },
      ]);
      const second = airway('V2', [
        {
          identifier: 'BBB',
          lon: -74,
          minimumEnrouteAltitudeFt: 5000,
          magneticCourseDeg: 90,
          minimumReceptionAltitudeFt: 8000,
        },
        { identifier: 'CCC', lon: -73 },
      ]);
      const result = checkRouteAltitudes(route([first, level(100, 'BBB'), second]), {
        altitudeFt: 6000,
        equipment: CONVENTIONAL,
      });
      expect(result.legs.map((leg) => leg.altitudeFt)).toEqual([6000, 10000]);
      expect(result.points.map((point) => point.altitudeFt)).toEqual([6000, 6000, 10000]);
      expect(codes(result.points[1]!)).toEqual(['belowMra']);
    });

    it('marks legs before the first attached group as having no altitude', () => {
      const result = checkRouteAltitudes(
        route([
          makeWaypoint('AAA', 40, -75),
          simpleAirway(),
          level(100, 'CCC'),
          makeDirect(),
          makeWaypoint('DDD', 40, -72),
        ]),
        { equipment: CONVENTIONAL },
      );
      expect(result.status).toBe('notDeterminable');
      expect(result.legs[0]!.status).toBe('notDeterminable');
      expect(codes(result.legs[0]!)).toEqual(['noAltitude']);
      expect(result.legs[0]!.altitudeFt).toBeUndefined();
      expect(result.legs[0]!.altitudeSource).toBeUndefined();
      expect(result.legs[0]!.minimumEnrouteAltitude?.altitudeFt).toBe(5000);
      expect(result.legs[2]!.altitudeFt).toBe(10000);
      expect(codes(result.legs[2]!)).toEqual(['notOnAirway']);
    });
  });

  describe('legs', () => {
    it('lines up with computeRouteDistance legs', () => {
      const parsed = route([
        makeAirport('KAAA', 40, -76),
        makeDirect(),
        simpleAirway(),
        makeDirect(),
        makeAirport('KDDD', 40, -72),
      ]);
      const result = checkRouteAltitudes(parsed, { altitudeFt: 7000, equipment: CONVENTIONAL });
      const distance = computeRouteDistance(parsed);
      expect(result.legs.map((leg) => [leg.from, leg.to])).toEqual(
        distance.legs.map((leg) => [leg.from, leg.to]),
      );
      expect(result.points.map((point) => point.label)).toEqual([
        'KAAA',
        'AAA',
        'BBB',
        'CCC',
        'KDDD',
      ]);
    });

    it('cannot determine legs that are not airway segments', () => {
      const result = checkRouteAltitudes(
        route([makeAirport('KAAA', 40, -76), makeDirect(), simpleAirway()]),
        { altitudeFt: 7000, equipment: CONVENTIONAL },
      );
      expect(result.legs[0]!.status).toBe('notDeterminable');
      expect(result.legs[0]!.airway).toBeUndefined();
      expect(codes(result.legs[0]!)).toEqual(['notOnAirway']);
      expect(result.legs[1]!.status).toBe('pass');
      expect(result.status).toBe('notDeterminable');
    });

    it('fails below the MEA and above the MAA', () => {
      const below = checkRouteAltitudes(route([simpleAirway()]), {
        altitudeFt: 4000,
        equipment: CONVENTIONAL,
      });
      expect(below.status).toBe('fail');
      expect(codes(below.legs[0]!)).toEqual(['belowMea']);
      expect(below.legs[0]!.findings[0]!.message).toBe(
        '4000 ft is below the conventional MEA of 5000 ft.',
      );

      const above = checkRouteAltitudes(route([simpleAirway()]), {
        altitudeFt: 18000,
        equipment: CONVENTIONAL,
      });
      expect(codes(above.legs[0]!)).toEqual(['aboveMaa']);
      expect(above.legs[0]!.findings[0]!.kind).toBe('fail');
    });

    it('passes at exactly the MEA and the MAA', () => {
      for (const altitudeFt of [5000, 17500]) {
        const result = checkRouteAltitudes(route([simpleAirway()]), {
          altitudeFt,
          equipment: CONVENTIONAL,
        });
        expect(result.status).toBe('pass');
      }
    });

    it('fails a leg across a published gap or along an unusable segment', () => {
      const gapped = simpleAirway();
      gapped.gaps = [{ index: 0, from: 'AAA', to: 'BBB' }];
      gapped.unusable = [{ index: 1, from: 'BBB', to: 'CCC' }];
      const result = checkRouteAltitudes(route([gapped]), {
        altitudeFt: 7000,
        equipment: CONVENTIONAL,
      });
      expect(codes(result.legs[0]!)).toEqual(['acrossGap']);
      expect(codes(result.legs[1]!)).toEqual(['unusableSegment']);
      expect(result.legs[0]!.minimumEnrouteAltitude).toBeUndefined();
      expect(result.status).toBe('fail');
    });

    it('cannot determine a segment that publishes no MEA', () => {
      const result = checkRouteAltitudes(
        route([
          airway('V1', [
            { identifier: 'AAA', lon: -75 },
            { identifier: 'BBB', lon: -74 },
          ]),
        ]),
        { altitudeFt: 7000, equipment: GNSS },
      );
      expect(codes(result.legs[0]!)).toEqual(['noPublishedMea']);
      expect(result.legs[0]!.status).toBe('notDeterminable');
    });

    it('cannot determine the segment when the airway direction is unknown', () => {
      const result = checkRouteAltitudes(
        route([
          airway(
            'V1',
            [
              { identifier: 'AAA', lon: -75, minimumEnrouteAltitudeFt: 5000 },
              { identifier: 'BBB', lon: -74 },
            ],
            { reversed: undefined },
          ),
        ]),
        { altitudeFt: 7000, equipment: CONVENTIONAL },
      );
      expect(codes(result.legs[0]!)).toEqual(['airwayDirectionUnknown']);
    });

    it('reads the airway segment on a leg whose entry fix merges with the preceding waypoint', () => {
      const result = checkRouteAltitudes(route([makeWaypoint('AAA', 40, -75), simpleAirway()]), {
        altitudeFt: 4000,
        equipment: CONVENTIONAL,
      });
      expect(result.legs).toHaveLength(2);
      expect(codes(result.legs[0]!)).toEqual(['belowMea']);
    });
  });

  describe('applicable MEA by equipment', () => {
    /** A segment publishing a 9000 ft conventional, 6000 ft GNSS and 8000 ft DME/DME/IRU MEA. */
    function mixed(
      fields: Partial<AirwayWaypoint>,
      type: AirwayType = 'VICTOR',
      region: AirwayRegion = 'US',
    ): AirwayRouteElement {
      return airway(
        'X1',
        [
          { identifier: 'AAA', lon: -75, magneticCourseDeg: 90, ...fields },
          { identifier: 'BBB', lon: -74 },
        ],
        { type, region },
      );
    }

    it('uses the lowest MEA usable with any of the equipment', () => {
      const segment = mixed({
        minimumEnrouteAltitudeFt: 9000,
        gnssMinimumEnrouteAltitudeFt: 6000,
        dmeDmeIruMinimumEnrouteAltitudeFt: 8000,
      });
      function meaFor(equipment: RouteAltitudeCheckOptions['equipment']): unknown {
        return checkRouteAltitudes(route([segment]), { altitudeFt: 10000, equipment }).legs[0]!
          .minimumEnrouteAltitude;
      }
      expect(meaFor(['conventional'])).toEqual({
        altitudeFt: 9000,
        kind: 'conventional',
        basis: 'published',
      });
      expect(meaFor(['dmeDmeIru'])).toEqual({
        altitudeFt: 8000,
        kind: 'dmeDmeIru',
        basis: 'published',
      });
      expect(meaFor(['gnss'])).toEqual({ altitudeFt: 6000, kind: 'gnss', basis: 'published' });
      expect(meaFor(['conventional', 'dmeDmeIru'])).toEqual({
        altitudeFt: 8000,
        kind: 'dmeDmeIru',
        basis: 'published',
      });
    });

    it('falls back to the conventional MEA for GNSS when no GNSS MEA is published', () => {
      const result = checkRouteAltitudes(route([mixed({ minimumEnrouteAltitudeFt: 9000 })]), {
        altitudeFt: 8000,
        equipment: GNSS,
      });
      expect(result.legs[0]!.minimumEnrouteAltitude).toEqual({
        altitudeFt: 9000,
        kind: 'conventional',
        basis: 'published',
      });
      expect(codes(result.legs[0]!)).toEqual(['belowMea']);
    });

    it('does not let DME/DME/IRU use the conventional MEA', () => {
      const result = checkRouteAltitudes(route([mixed({ minimumEnrouteAltitudeFt: 9000 })]), {
        altitudeFt: 10000,
        equipment: ['dmeDmeIru'],
      });
      expect(codes(result.legs[0]!)).toEqual(['noMeaForEquipment']);
      expect(result.legs[0]!.status).toBe('notDeterminable');
    });

    it('cannot determine a GNSS-only segment for conventional equipment', () => {
      const result = checkRouteAltitudes(route([mixed({ gnssMinimumEnrouteAltitudeFt: 4000 })]), {
        altitudeFt: 10000,
        equipment: CONVENTIONAL,
      });
      expect(codes(result.legs[0]!)).toEqual(['noMeaForEquipment']);
    });

    it('gives GNSS FL180 on a US Jet route segment with no GNSS MEA', () => {
      const result = checkRouteAltitudes(
        route([mixed({ minimumEnrouteAltitudeFt: 24000 }, 'JET')]),
        { altitudeFt: 20000, equipment: GNSS },
      );
      expect(result.legs[0]!.status).toBe('pass');
      expect(result.legs[0]!.minimumEnrouteAltitude).toEqual({
        altitudeFt: 18000,
        kind: 'gnss',
        basis: 'highRouteGnssDefault',
      });

      const conventional = checkRouteAltitudes(
        route([mixed({ minimumEnrouteAltitudeFt: 24000 }, 'JET')]),
        { altitudeFt: 20000, equipment: CONVENTIONAL },
      );
      expect(codes(conventional.legs[0]!)).toEqual(['belowMea']);
    });

    it('gives GNSS FL180 on a US Q route segment with only a DME/DME/IRU MEA', () => {
      const result = checkRouteAltitudes(
        route([mixed({ dmeDmeIruMinimumEnrouteAltitudeFt: 24000 }, 'RNAV_Q')]),
        { altitudeFt: 17000, equipment: GNSS },
      );
      expect(result.legs[0]!.minimumEnrouteAltitude?.altitudeFt).toBe(18000);
      expect(result.legs[0]!.findings[0]!.message).toBe(
        '17000 ft is below the GNSS high altitude route MEA of 18000 ft.',
      );
    });

    it('keeps a published GNSS MEA on a high altitude route even when above FL180', () => {
      const result = checkRouteAltitudes(
        route([
          mixed(
            { gnssMinimumEnrouteAltitudeFt: 21000, dmeDmeIruMinimumEnrouteAltitudeFt: 24000 },
            'RNAV_Q',
          ),
        ]),
        { altitudeFt: 20000, equipment: GNSS },
      );
      expect(result.legs[0]!.minimumEnrouteAltitude).toEqual({
        altitudeFt: 21000,
        kind: 'gnss',
        basis: 'published',
      });
      expect(result.legs[0]!.status).toBe('fail');
    });

    it('does not apply the FL180 GNSS default outside the US region or where no MEA is published', () => {
      const alaska = checkRouteAltitudes(
        route([mixed({ minimumEnrouteAltitudeFt: 24000 }, 'JET', 'ALASKA')]),
        { altitudeFt: 20000, equipment: GNSS },
      );
      expect(alaska.legs[0]!.minimumEnrouteAltitude?.altitudeFt).toBe(24000);

      const blank = checkRouteAltitudes(route([mixed({}, 'JET')]), {
        altitudeFt: 20000,
        equipment: GNSS,
      });
      expect(codes(blank.legs[0]!)).toEqual(['noPublishedMea']);
    });
  });

  describe('directional MEAs', () => {
    /** V190-style segment: 10000 W BND / 13000 E BND conventional, 11000 GNSS, course 080 / 260. */
    function directional(reversed: boolean, withCourse = true): AirwayRouteElement {
      const course = withCourse ? { magneticCourseDeg: 80, magneticCourseOppositeDeg: 260 } : {};
      return airway(
        'V190',
        [
          {
            identifier: 'PEAKS',
            lon: -75,
            minimumEnrouteAltitudeFt: 10000,
            minimumEnrouteAltitudeDirection: 'W BND',
            minimumEnrouteAltitudeOppositeFt: 13000,
            minimumEnrouteAltitudeOppositeDirection: 'E BND',
            gnssMinimumEnrouteAltitudeFt: 11000,
            ...course,
          },
          { identifier: 'TEDDI', lon: -74 },
        ],
        { reversed },
      );
    }

    it('picks the published direction closest to the course flown', () => {
      const eastbound = checkRouteAltitudes(route([directional(false)]), {
        altitudeFt: 12000,
        equipment: CONVENTIONAL,
      });
      expect(eastbound.legs[0]!.minimumEnrouteAltitude).toEqual({
        altitudeFt: 13000,
        kind: 'conventional',
        direction: 'E BND',
        basis: 'published',
      });
      expect(eastbound.legs[0]!.findings[0]!.message).toBe(
        '12000 ft is below the conventional MEA of 13000 ft E BND.',
      );

      const westbound = checkRouteAltitudes(route([directional(true)]), {
        altitudeFt: 12000,
        equipment: CONVENTIONAL,
      });
      expect(westbound.legs[0]!.from).toBe('TEDDI');
      expect(westbound.legs[0]!.minimumEnrouteAltitude?.altitudeFt).toBe(10000);
      expect(westbound.legs[0]!.status).toBe('pass');
    });

    it('gives a GNSS and conventional aircraft the lower value each way', () => {
      const equipment: RouteAltitudeCheckOptions['equipment'] = ['conventional', 'gnss'];
      const east = checkRouteAltitudes(route([directional(false)]), {
        altitudeFt: 12000,
        equipment,
      });
      const west = checkRouteAltitudes(route([directional(true)]), {
        altitudeFt: 12000,
        equipment,
      });
      expect(east.legs[0]!.minimumEnrouteAltitude?.altitudeFt).toBe(11000);
      expect(east.legs[0]!.minimumEnrouteAltitude?.kind).toBe('gnss');
      expect(west.legs[0]!.minimumEnrouteAltitude?.altitudeFt).toBe(10000);
      expect(west.legs[0]!.minimumEnrouteAltitude?.kind).toBe('conventional');
    });

    it('applies a single directional value with no opposite both ways', () => {
      const segment = airway(
        'V2',
        [
          {
            identifier: 'AAA',
            lon: -75,
            minimumEnrouteAltitudeFt: 6000,
            minimumEnrouteAltitudeDirection: 'E BND',
          },
          { identifier: 'BBB', lon: -74 },
        ],
        { reversed: true },
      );
      const result = checkRouteAltitudes(route([segment]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      });
      expect(result.legs[0]!.minimumEnrouteAltitude?.altitudeFt).toBe(6000);
      expect(codes(result.legs[0]!)).toEqual(['belowMea']);
    });

    it('cannot determine a directional pair without a published course', () => {
      const result = checkRouteAltitudes(route([directional(false, false)]), {
        altitudeFt: 14000,
        equipment: CONVENTIONAL,
      });
      expect(codes(result.legs[0]!)).toEqual(['noPublishedCourse']);
    });
  });

  describe('points', () => {
    /**
     * An eastbound airway (course 090) with an MCA at BBB and the given
     * MCA fields.
     */
    function withMca(fields: Partial<AirwayWaypoint>, reversed = false): AirwayRouteElement {
      return airway(
        'V3',
        [
          {
            identifier: 'AAA',
            lon: -75,
            minimumEnrouteAltitudeFt: 4000,
            magneticCourseDeg: 90,
            magneticCourseOppositeDeg: 270,
          },
          {
            identifier: 'BBB',
            lon: -74,
            minimumEnrouteAltitudeFt: 4000,
            magneticCourseDeg: 90,
            magneticCourseOppositeDeg: 270,
            ...fields,
          },
          { identifier: 'CCC', lon: -73 },
        ],
        { reversed },
      );
    }

    it('fails a point crossed below an MCA for the direction flown', () => {
      const result = checkRouteAltitudes(
        route([
          withMca({ minimumCrossingAltitudeFt: 6000, minimumCrossingAltitudeDirection: 'E BND' }),
        ]),
        { altitudeFt: 5000, equipment: CONVENTIONAL },
      );
      const point = result.points[1]!;
      expect(point.minimumCrossingAltitude).toEqual({
        altitudeFt: 6000,
        direction: 'E BND',
        airway: 'V3',
      });
      expect(codes(point)).toEqual(['belowMca']);
      expect(point.status).toBe('fail');
      expect(result.status).toBe('fail');
    });

    it('does not apply an MCA for the opposite direction', () => {
      const result = checkRouteAltitudes(
        route([
          withMca({ minimumCrossingAltitudeFt: 6000, minimumCrossingAltitudeDirection: 'W BND' }),
        ]),
        { altitudeFt: 5000, equipment: CONVENTIONAL },
      );
      expect(result.points[1]!.minimumCrossingAltitude).toBeUndefined();
      expect(result.points[1]!.findings).toEqual([]);
      expect(result.status).toBe('pass');
    });

    it('picks the MCA for the direction flown from a directional pair', () => {
      const fields: Partial<AirwayWaypoint> = {
        minimumCrossingAltitudeFt: 6000,
        minimumCrossingAltitudeDirection: 'E BND',
        minimumCrossingAltitudeOppositeFt: 7000,
        minimumCrossingAltitudeOppositeDirection: 'W BND',
      };
      const east = checkRouteAltitudes(route([withMca(fields)]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      });
      const west = checkRouteAltitudes(route([withMca(fields, true)]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      });
      expect(east.points[1]!.minimumCrossingAltitude?.altitudeFt).toBe(6000);
      expect(west.points[1]!.minimumCrossingAltitude?.altitudeFt).toBe(7000);
    });

    it('applies equal directional MCA values both ways', () => {
      const result = checkRouteAltitudes(
        route([
          withMca({
            minimumCrossingAltitudeFt: 6000,
            minimumCrossingAltitudeDirection: 'N BND',
            minimumCrossingAltitudeOppositeFt: 6000,
            minimumCrossingAltitudeOppositeDirection: 'S BND',
          }),
        ]),
        { altitudeFt: 5000, equipment: CONVENTIONAL },
      );
      expect(result.points[1]!.minimumCrossingAltitude).toEqual({ altitudeFt: 6000, airway: 'V3' });
      expect(codes(result.points[1]!)).toEqual(['belowMca']);
    });

    it('reports an MCA matching neither direction of travel as not applicable', () => {
      const result = checkRouteAltitudes(
        route([
          withMca({ minimumCrossingAltitudeFt: 6000, minimumCrossingAltitudeDirection: 'N BND' }),
        ]),
        { altitudeFt: 5000, equipment: CONVENTIONAL },
      );
      const point = result.points[1]!;
      expect(point.minimumCrossingAltitude).toBeUndefined();
      expect(codes(point)).toEqual(['mcaNotApplicable']);
      expect(point.findings[0]!.kind).toBe('info');
      expect(point.status).toBe('pass');
    });

    it('matches an MCA at the airway exit fix to the course arriving at it', () => {
      const segment = airway('V4', [
        { identifier: 'AAA', lon: -75, minimumEnrouteAltitudeFt: 4000, magneticCourseDeg: 90 },
        {
          identifier: 'BBB',
          lon: -74,
          minimumCrossingAltitudeFt: 6000,
          minimumCrossingAltitudeDirection: 'E BND',
        },
      ]);
      const result = checkRouteAltitudes(route([segment]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      });
      expect(codes(result.points[1]!)).toEqual(['belowMca']);
    });

    it('reports the highest applicable MCA where two airways meet', () => {
      const first = airway('V5', [
        { identifier: 'AAA', lon: -75, minimumEnrouteAltitudeFt: 4000, magneticCourseDeg: 90 },
        {
          identifier: 'BBB',
          lon: -74,
          minimumCrossingAltitudeFt: 5500,
          minimumCrossingAltitudeDirection: 'E BND',
        },
      ]);
      const second = airway('V6', [
        {
          identifier: 'BBB',
          lon: -74,
          minimumEnrouteAltitudeFt: 4000,
          magneticCourseDeg: 90,
          minimumCrossingAltitudeFt: 6500,
          minimumCrossingAltitudeDirection: 'E BND',
          remarks: ['SHARED REMARK'],
        },
        { identifier: 'CCC', lon: -73 },
      ]);
      first.waypoints[1]!.remarks = ['SHARED REMARK', 'V5 REMARK'];
      const result = checkRouteAltitudes(route([first, second]), {
        altitudeFt: 7000,
        equipment: CONVENTIONAL,
      });
      expect(result.points).toHaveLength(3);
      expect(result.points[1]!.minimumCrossingAltitude).toEqual({
        altitudeFt: 6500,
        direction: 'E BND',
        airway: 'V6',
      });
      expect(result.points[1]!.remarks).toEqual(['SHARED REMARK', 'V5 REMARK']);
      expect(result.legs[1]!.airway).toBe('V6');
    });

    it('fails below an MRA only for conventional-only equipment', () => {
      const segment = withMca({ minimumReceptionAltitudeFt: 8000 });
      const conventional = checkRouteAltitudes(route([segment]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      });
      expect(conventional.points[1]!.minimumReceptionAltitudeFt).toBe(8000);
      expect(conventional.points[1]!.findings[0]!.kind).toBe('fail');
      expect(conventional.status).toBe('fail');

      const gnss = checkRouteAltitudes(route([segment]), {
        altitudeFt: 5000,
        equipment: ['conventional', 'gnss'],
      });
      expect(codes(gnss.points[1]!)).toEqual(['belowMra']);
      expect(gnss.points[1]!.findings[0]!.kind).toBe('info');
      expect(gnss.status).toBe('pass');
    });

    it('cannot determine an MCA crossing with no altitude', () => {
      const result = checkRouteAltitudes(
        route([
          withMca({ minimumCrossingAltitudeFt: 6000, minimumCrossingAltitudeDirection: 'E BND' }),
          level(100, 'CCC'),
        ]),
        { equipment: CONVENTIONAL },
      );
      expect(codes(result.points[1]!)).toEqual(['noAltitude']);
      expect(result.points[1]!.altitudeFt).toBeUndefined();
    });

    it('cannot determine a directional MCA without a published course', () => {
      const segment = airway('V7', [
        { identifier: 'AAA', lon: -75, minimumEnrouteAltitudeFt: 4000 },
        {
          identifier: 'BBB',
          lon: -74,
          minimumCrossingAltitudeFt: 6000,
          minimumCrossingAltitudeDirection: 'E BND',
        },
      ]);
      const result = checkRouteAltitudes(route([segment]), {
        altitudeFt: 7000,
        equipment: CONVENTIONAL,
      });
      expect(codes(result.points[1]!)).toEqual(['noPublishedCourse']);
    });
  });

  describe('airway remarks', () => {
    it('lists each airway that publishes remarks once, in route order', () => {
      const remarks = ['HF COMM REQUIRED'];
      const first = airway(
        'R99',
        [
          { identifier: 'AAA', lon: -75, minimumEnrouteAltitudeFt: 4000 },
          { identifier: 'BBB', lon: -74 },
        ],
        { remarks },
      );
      const second = airway(
        'R99',
        [
          { identifier: 'CCC', lon: -73, minimumEnrouteAltitudeFt: 4000 },
          { identifier: 'DDD', lon: -72 },
        ],
        { remarks },
      );
      const result = checkRouteAltitudes(route([first, makeDirect(), second, simpleAirway()]), {
        altitudeFt: 7000,
        equipment: CONVENTIONAL,
      });
      expect(result.airwayRemarks).toEqual([{ airway: 'R99', remarks: ['HF COMM REQUIRED'] }]);
    });
  });
  describe('cruising altitude for the direction of flight', () => {
    /** An airway along 40N with a published 090 / 270 course and no MAA. */
    function eastWest(reversed = false): AirwayRouteElement {
      return airway(
        'V9',
        [
          {
            identifier: 'AAA',
            lon: -75,
            minimumEnrouteAltitudeFt: 3000,
            magneticCourseDeg: 90,
            magneticCourseOppositeDeg: 270,
          },
          { identifier: 'BBB', lon: -74 },
        ],
        { reversed },
      );
    }

    /** Returns the cruising altitude check of the single leg at an altitude. */
    function cruising(altitudeFt: number, reversed = false): unknown {
      return checkRouteAltitudes(route([eastWest(reversed)]), {
        altitudeFt,
        equipment: CONVENTIONAL,
      }).legs[0]!.cruisingAltitude;
    }

    it('uses the published course in the direction flown', () => {
      expect(cruising(7000)).toEqual({
        status: 'appropriate',
        message: '7000 ft is a cruising altitude for eastbound flight (magnetic course 090).',
        magneticCourseDeg: 90,
        courseSource: 'published',
        direction: 'eastbound',
      });
      expect(cruising(8000, true)).toMatchObject({
        status: 'appropriate',
        magneticCourseDeg: 270,
        direction: 'westbound',
      });
    });

    it('names the nearest cruising altitudes when the altitude is wrong for the direction', () => {
      expect(cruising(8000)).toMatchObject({
        status: 'inappropriate',
        message:
          '8000 ft is not a cruising altitude for eastbound flight (magnetic course 090); the nearest are 7000 ft and 9000 ft.',
      });
      expect(cruising(6500, true)).toMatchObject({
        status: 'inappropriate',
        message:
          '6500 ft is not a cruising altitude for westbound flight (magnetic course 270); the nearest are 6000 ft and 8000 ft.',
      });
    });

    it('does not affect the leg or route status', () => {
      const result = checkRouteAltitudes(route([eastWest()]), {
        altitudeFt: 8000,
        equipment: CONVENTIONAL,
      });
      expect(result.legs[0]!.cruisingAltitude.status).toBe('inappropriate');
      expect(result.legs[0]!.status).toBe('pass');
      expect(result.status).toBe('pass');
    });

    it('applies odd and even flight levels from FL180 through the RVSM band', () => {
      for (const altitudeFt of [19000, 29000, 35000, 41000]) {
        expect(cruising(altitudeFt)).toMatchObject({ status: 'appropriate' });
        expect(cruising(altitudeFt, true)).toMatchObject({ status: 'inappropriate' });
      }
      for (const altitudeFt of [18000, 28000, 30000, 40000]) {
        expect(cruising(altitudeFt, true)).toMatchObject({ status: 'appropriate' });
        expect(cruising(altitudeFt)).toMatchObject({ status: 'inappropriate' });
      }
    });

    it('applies 4000 ft spacing above FL410', () => {
      for (const altitudeFt of [45000, 49000, 53000]) {
        expect(cruising(altitudeFt)).toMatchObject({ status: 'appropriate' });
      }
      for (const altitudeFt of [43000, 47000, 51000]) {
        expect(cruising(altitudeFt, true)).toMatchObject({ status: 'appropriate' });
        expect(cruising(altitudeFt)).toMatchObject({ status: 'inappropriate' });
      }
      expect(cruising(42000)).toMatchObject({
        status: 'inappropriate',
        message:
          '42000 ft is not a cruising altitude for eastbound flight (magnetic course 090); the nearest are 41000 ft and 45000 ft.',
      });
      expect(cruising(44000, true)).toMatchObject({ status: 'inappropriate' });
    });

    it('converts the initial great-circle course to magnetic on a direct leg', () => {
      const result = checkRouteAltitudes(
        route([
          makeWaypoint('AAA', 40, -75),
          makeDirect(),
          makeWaypoint('BBB', 41, -75.2),
          makeDirect(),
          makeWaypoint('CCC', 40.2, -76.5),
        ]),
        { altitudeFt: 7000, equipment: CONVENTIONAL },
      );
      const north = result.legs[0]!.cruisingAltitude;
      const expected = magnetic.trueToMagnetic(greatCircle.bearing(40, -75, 41, -75.2), 40, -75);
      expect(north.courseSource).toBe('computed');
      expect(north.magneticCourseDeg).toBeCloseTo(expected, 6);
      expect(north.direction).toBe('eastbound');
      expect(north.status).toBe('appropriate');
      const southwest = result.legs[1]!.cruisingAltitude;
      expect(southwest.direction).toBe('westbound');
      expect(southwest.status).toBe('inappropriate');
    });

    it('computes the course on a leg across a published gap', () => {
      const gapped = eastWest();
      gapped.gaps = [{ index: 0, from: 'AAA', to: 'BBB' }];
      const leg = checkRouteAltitudes(route([gapped]), {
        altitudeFt: 7000,
        equipment: CONVENTIONAL,
      }).legs[0]!;
      expect(leg.cruisingAltitude.courseSource).toBe('computed');
      expect(leg.cruisingAltitude.direction).toBe('eastbound');
    });

    it('does not check SID and STAR legs, including the legs joining them to their airports', () => {
      const result = checkRouteAltitudes(
        route([
          makeAirport('KAAA', 40, -77),
          makeSid('SID1', [
            { fixIdentifier: 'S1', lat: 40, lon: -76.8 },
            { fixIdentifier: 'S2', lat: 40, lon: -76.5 },
          ]),
          makeDirect(),
          makeWaypoint('MID', 40, -75),
          makeStar('STAR1', [
            { fixIdentifier: 'T1', lat: 40, lon: -74.5 },
            { fixIdentifier: 'T2', lat: 40, lon: -74.2 },
          ]),
          makeAirport('KBBB', 40, -74),
        ]),
        { altitudeFt: 7000, equipment: CONVENTIONAL },
      );
      expect(result.legs.map((leg) => [leg.from, leg.cruisingAltitude.status])).toEqual([
        ['KAAA', 'notDeterminable'],
        ['S1', 'notDeterminable'],
        ['S2', 'appropriate'],
        ['MID', 'appropriate'],
        ['T1', 'notDeterminable'],
        ['T2', 'notDeterminable'],
      ]);
      expect(result.legs[0]!.cruisingAltitude).toEqual({
        status: 'notDeterminable',
        message: 'The leg is part of a SID or STAR, where the aircraft is climbing or descending.',
      });
    });

    it('cannot determine a leg with no altitude', () => {
      const result = checkRouteAltitudes(
        route([
          makeWaypoint('AAA', 40, -75),
          makeDirect(),
          makeWaypoint('BBB', 40, -74),
          feet(7000, 'BBB'),
          makeDirect(),
          makeWaypoint('CCC', 40, -73),
        ]),
        { equipment: CONVENTIONAL },
      );
      expect(result.legs[0]!.cruisingAltitude).toEqual({
        status: 'notDeterminable',
        message: 'No altitude is known for the leg.',
      });
      expect(result.legs[1]!.cruisingAltitude.status).toBe('appropriate');
    });
  });
  describe('flight below the MEA down to the MOCA', () => {
    /** A VORTAC waypoint at a longitude on 40N. */
    function vor(
      identifier: string,
      lon: number,
      fields: Partial<AirwayWaypoint> = {},
    ): TestWaypoint {
      return { identifier, lon, waypointType: 'NAVAID', navaidFacilityType: 'VORTAC', ...fields };
    }

    /** Segment fields: a 6000 ft conventional MEA and a 4000 ft MOCA, course 090 / 270. */
    const SEGMENT: Partial<AirwayWaypoint> = {
      minimumEnrouteAltitudeFt: 6000,
      minimumObstructionClearanceAltitudeFt: 4000,
      magneticCourseDeg: 90,
      magneticCourseOppositeDeg: 270,
    };

    /** VOR AAA, fix BBB about 16 NM east, VOR CCC about 37 NM east; flown AAA to BBB. */
    function nearVors(reversed = false): AirwayRouteElement {
      const element = airway(
        'V10',
        [
          vor('AAA', -75, SEGMENT),
          { identifier: 'BBB', lon: -74.65, ...SEGMENT },
          vor('CCC', -74.2),
        ],
        { reversed },
      );
      return element;
    }

    it('reports the MOCA and fails below it for any equipment', () => {
      for (const equipment of [CONVENTIONAL, GNSS]) {
        const leg = checkRouteAltitudes(route([nearVors()]), { altitudeFt: 3000, equipment })
          .legs[0]!;
        expect(leg.minimumObstructionClearanceAltitudeFt).toBe(4000);
        expect(codes(leg)).toEqual(['belowMoca']);
        expect(leg.findings[0]!.message).toBe(
          '3000 ft is below the conventional MEA of 6000 ft and the MOCA of 4000 ft.',
        );
        expect(leg.belowMeaAllowance).toBeUndefined();
      }
    });

    it('lets GNSS-equipped aircraft use the MOCA anywhere on the segment', () => {
      const far = airway('V11', [
        { identifier: 'AAA', lon: -75, ...SEGMENT },
        { identifier: 'BBB', lon: -73 },
      ]);
      const leg = checkRouteAltitudes(route([far]), { altitudeFt: 5000, equipment: GNSS }).legs[0]!;
      expect(leg.status).toBe('pass');
      expect(codes(leg)).toEqual(['mocaAllowance']);
      expect(leg.findings[0]!.kind).toBe('info');
      expect(leg.belowMeaAllowance).toEqual({
        basis: 'gnss',
        altitudeFt: 4000,
        cautions: [
          'Communications are not assured below the MEA.',
          'On a radio or navigation failure, climb to the MEA for the segment.',
        ],
      });
    });

    it('lets a conventional aircraft use the MOCA within 22 NM of the VOR it navigates by', () => {
      const result = checkRouteAltitudes(route([nearVors()]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      });
      const leg = result.legs[0]!;
      expect(leg.status).toBe('pass');
      expect(leg.belowMeaAllowance).toMatchObject({
        basis: 'vorWithin22Nm',
        altitudeFt: 4000,
        vors: ['AAA'],
      });
      expect(leg.findings[0]!.message).toBe(
        '5000 ft is below the conventional MEA of 6000 ft but at or above the MOCA of 4000 ft, and the leg stays within 22 NM of AAA.',
      );
    });

    it('finds the VORs the same way when the airway is flown in reverse', () => {
      const result = checkRouteAltitudes(route([nearVors(true)]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      });
      expect(result.legs.map((leg) => [leg.from, leg.to])).toEqual([
        ['CCC', 'BBB'],
        ['BBB', 'AAA'],
      ]);
      expect(result.legs[1]!.belowMeaAllowance).toMatchObject({ vors: ['AAA'] });
    });

    it('fails a conventional aircraft beyond 22 NM of the VOR it navigates by', () => {
      const element = airway('V12', [
        vor('AAA', -75, SEGMENT),
        { identifier: 'BBB', lon: -74, ...SEGMENT },
        { identifier: 'CCC', lon: -73.5 },
      ]);
      const leg = checkRouteAltitudes(route([element]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      }).legs[0]!;
      expect(leg.status).toBe('fail');
      expect(codes(leg)).toEqual(['mocaBeyondVorRange']);
      expect(leg.findings[0]!.message).toMatch(
        /^5000 ft is below the conventional MEA of 6000 ft; the MOCA of 4000 ft applies only within 22 NM of the VOR navigated by, and the leg reaches 4\d\.\d NM from AAA, 2\d\.\d NM beyond it\.$/,
      );
      expect(leg.belowMeaAllowance).toBeUndefined();
    });

    it('switches VORs at the published changeover point instead of midway', () => {
      // AAA-BBB is about 21 NM and CCC about 41 NM from AAA: midway, AAA covers the
      // whole leg, but a changeover 5 NM from AAA hands most of it to the far VOR.
      function build(changeoverDistanceNm?: number): AirwayRouteElement {
        const first =
          changeoverDistanceNm === undefined
            ? vor('AAA', -75, SEGMENT)
            : vor('AAA', -75, { ...SEGMENT, changeoverDistanceNm });
        return airway('V13', [first, { identifier: 'BBB', lon: -74.55 }, vor('CCC', -74.1)]);
      }
      const midway = checkRouteAltitudes(route([build()]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      }).legs[0]!;
      expect(midway.belowMeaAllowance).toMatchObject({ vors: ['AAA'] });

      const published = checkRouteAltitudes(route([build(5)]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      }).legs[0]!;
      expect(codes(published)).toEqual(['mocaBeyondVorRange']);
      expect(published.findings[0]!.message).toContain('NM from CCC');
    });

    it('fails a conventional aircraft when the airway has no VOR to navigate the leg by', () => {
      const element = airway('V14', [
        { identifier: 'AAA', lon: -75, ...SEGMENT },
        { identifier: 'BBB', lon: -74.9 },
        { identifier: 'CCC', lon: -74.8, waypointType: 'NAVAID', navaidFacilityType: 'NDB' },
      ]);
      const leg = checkRouteAltitudes(route([element]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      }).legs[0]!;
      expect(codes(leg)).toEqual(['mocaBeyondVorRange']);
      expect(leg.findings[0]!.message).toBe(
        '5000 ft is below the conventional MEA of 6000 ft; the MOCA of 4000 ft applies only within 22 NM of a VOR, and the airway has no VOR to navigate the leg by.',
      );
    });

    it('does not look for a VOR across a published gap', () => {
      const full: AirwayWaypoint[] = [
        {
          name: 'AAA',
          identifier: 'AAA',
          waypointType: 'NAVAID',
          navaidFacilityType: 'VORTAC',
          lat: 40,
          lon: -75,
        },
        {
          name: 'BBB',
          identifier: 'BBB',
          waypointType: 'FIX',
          lat: 40,
          lon: -74.95,
          discontinued: true,
        },
        { name: 'CCC', identifier: 'CCC', waypointType: 'FIX', lat: 40, lon: -74.9, ...SEGMENT },
        { name: 'DDD', identifier: 'DDD', waypointType: 'FIX', lat: 40, lon: -74.85 },
      ];
      const element = airway('V15', [
        { identifier: 'CCC', lon: -74.9 },
        { identifier: 'DDD', lon: -74.85 },
      ]);
      element.airway.waypoints = full;
      element.waypoints = full.slice(2);
      const leg = checkRouteAltitudes(route([element]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      }).legs[0]!;
      expect(codes(leg)).toEqual(['mocaBeyondVorRange']);

      delete full[1]!.discontinued;
      const continuous = checkRouteAltitudes(route([element]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      }).legs[0]!;
      expect(continuous.belowMeaAllowance).toMatchObject({ vors: ['AAA'] });
    });

    it("reads only the expansion when its waypoints are not the airway record's own", () => {
      const element = nearVors();
      element.airway.waypoints = element.airway.waypoints.map((waypoint) => ({ ...waypoint }));
      const leg = checkRouteAltitudes(route([element]), {
        altitudeFt: 5000,
        equipment: CONVENTIONAL,
      }).legs[0]!;
      expect(leg.belowMeaAllowance).toMatchObject({ vors: ['AAA'] });
    });

    it('gives DME/DME/IRU equipment alone no MOCA allowance', () => {
      const element = airway('Q99', [
        {
          identifier: 'AAA',
          lon: -75,
          dmeDmeIruMinimumEnrouteAltitudeFt: 6000,
          minimumObstructionClearanceAltitudeFt: 4000,
          magneticCourseDeg: 90,
        },
        { identifier: 'BBB', lon: -74.9 },
      ]);
      const leg = checkRouteAltitudes(route([element]), {
        altitudeFt: 5000,
        equipment: ['dmeDmeIru'],
      }).legs[0]!;
      expect(codes(leg)).toEqual(['belowMea']);
      expect(leg.findings[0]!.message).toBe(
        '5000 ft is below the dmeDmeIru MEA of 6000 ft; the MOCA of 4000 ft may be used only with GNSS or within 22 NM of a VOR.',
      );
    });
  });
});
