import { describe, expect, it } from 'vitest';

import type { Airway, AirwayRegion, AirwayType, AirwayWaypoint } from '@squawk/types';

import type { AirwayRouteElement, SpeedAltitudeRouteElement } from './resolver.js';
import { checkRouteAltitudes } from './route-altitude.js';
import type { RouteAltitudeCheckOptions, RouteAltitudeFindingCode } from './route-altitude.js';
import { computeRouteDistance } from './route-distance.js';
import { makeAirport, makeDirect, makeWaypoint, route } from './test-utils.js';

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
});
