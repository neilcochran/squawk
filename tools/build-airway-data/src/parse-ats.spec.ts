import { describe, it, expect, assert } from 'vitest';

import { buildWaypoint } from './build-waypoint.js';
import { parseAts1, parseAts2, parseAts4, parseAtsRemark } from './parse-ats.js';
import { ats1Line, ats2Line, fixedWidthLine } from './test-utils.js';

describe('parseAts1', () => {
  it('splits the designation into prefix and id with a full designation', () => {
    const rec = parseAts1(ats1Line());
    expect(rec.designationPrefix).toBe('AT');
    expect(rec.airwayId).toBe('A315');
    expect(rec.fullDesignation).toBe('ATA315');
    expect(rec.sequenceNumber).toBe(1);
  });

  it('reads a special route designation', () => {
    const rec = parseAts1(
      ats1Line([
        { col: 5, len: 2, value: 'SP' },
        { col: 7, len: 12, value: 'ZK214' },
      ]),
    );
    expect(rec.designationPrefix).toBe('SP');
    expect(rec.fullDesignation).toBe('SPZK214');
  });

  it('parses every published field', () => {
    const rec = parseAts1(
      ats1Line([
        { col: 19, len: 1, value: 'R' },
        { col: 20, len: 1, value: 'H' },
        { col: 21, len: 5, value: '   10' },
        { col: 55, len: 6, value: ' 120.5' },
        { col: 67, len: 6, value: ' 045.0' },
        { col: 73, len: 6, value: ' 225.0' },
        { col: 79, len: 6, value: '0080.0' },
        { col: 85, len: 5, value: '18000' },
        { col: 90, len: 7, value: 'NE BND' },
        { col: 97, len: 5, value: '17000' },
        { col: 102, len: 7, value: 'SW BND' },
        { col: 109, len: 5, value: '45000' },
        { col: 114, len: 5, value: '13500' },
        { col: 119, len: 1, value: 'X' },
        { col: 120, len: 3, value: ' 25' },
        { col: 123, len: 5, value: '12000' },
        { col: 128, len: 7, value: 'NE BND' },
        { col: 135, len: 5, value: '11500' },
        { col: 140, len: 7, value: 'SW BND' },
        { col: 147, len: 1, value: 'Y' },
        { col: 148, len: 1, value: 'Y' },
        { col: 149, len: 5, value: '  10W' },
        { col: 154, len: 3, value: 'ZNY' },
        { col: 247, len: 5, value: '14000' },
        { col: 252, len: 7, value: 'NE BND' },
        { col: 259, len: 5, value: '13000' },
        { col: 264, len: 7, value: 'SW BND' },
        { col: 271, len: 50, value: 'A A315 *HAIST*BM' },
        { col: 321, len: 5, value: '18000' },
        { col: 326, len: 6, value: 'N BND' },
        { col: 332, len: 5, value: '20000' },
        { col: 337, len: 6, value: 'S BND' },
        { col: 343, len: 1, value: 'Y' },
        { col: 344, len: 5, value: '01.00' },
        { col: 349, len: 1, value: 'U' },
      ]),
    );
    expect(rec.rnavIndicator).toBe('R');
    expect(rec.airwayTypeChar).toBe('H');
    expect(rec.sequenceNumber).toBe(10);
    expect(rec.distanceToNextNm).toBe(120.5);
    expect(rec.magneticCourseDeg).toBe(45);
    expect(rec.magneticCourseOppositeDeg).toBe(225);
    expect(rec.segmentDistanceNm).toBe(80);
    expect(rec.minimumEnrouteAltitudeFt).toBe(18000);
    expect(rec.minimumEnrouteAltitudeDirection).toBe('NE BND');
    expect(rec.minimumEnrouteAltitudeOppositeFt).toBe(17000);
    expect(rec.minimumEnrouteAltitudeOppositeDirection).toBe('SW BND');
    expect(rec.maximumAuthorizedAltitudeFt).toBe(45000);
    expect(rec.minimumObstructionClearanceAltitudeFt).toBe(13500);
    expect(rec.discontinued).toBe(true);
    expect(rec.changeoverDistanceNm).toBe(25);
    expect(rec.minimumCrossingAltitudeFt).toBe(12000);
    expect(rec.minimumCrossingAltitudeDirection).toBe('NE BND');
    expect(rec.minimumCrossingAltitudeOppositeFt).toBe(11500);
    expect(rec.minimumCrossingAltitudeOppositeDirection).toBe('SW BND');
    expect(rec.minimumCrossingAltitudePoint).toBe('HAIST');
    expect(rec.signalGap).toBe(true);
    expect(rec.usAirspaceOnly).toBe(true);
    expect(rec.magneticVariation).toEqual({ degrees: 10, direction: 'W' });
    expect(rec.artccId).toBe('ZNY');
    expect(rec.gnssMinimumEnrouteAltitudeFt).toBe(14000);
    expect(rec.gnssMinimumEnrouteAltitudeDirection).toBe('NE BND');
    expect(rec.gnssMinimumEnrouteAltitudeOppositeFt).toBe(13000);
    expect(rec.gnssMinimumEnrouteAltitudeOppositeDirection).toBe('SW BND');
    expect(rec.dmeDmeIruMinimumEnrouteAltitudeFt).toBe(18000);
    expect(rec.dmeDmeIruMinimumEnrouteAltitudeDirection).toBe('N BND');
    expect(rec.dogleg).toBe(true);
    expect(rec.rnpNm).toBe(1);
    expect(rec.unusable).toBe(true);
  });

  it('returns undefined and false for blank fields and NaN', () => {
    const blank = parseAts1(ats1Line());
    expect(blank.minimumEnrouteAltitudeFt).toBe(undefined);
    expect(blank.minimumEnrouteAltitudeDirection).toBe(undefined);
    expect(blank.minimumCrossingAltitudePoint).toBe(undefined);
    expect(blank.magneticVariation).toBe(undefined);
    expect(blank.rnpNm).toBe(undefined);
    expect(blank.unusable).toBe(false);
    const nan = parseAts1(
      ats1Line([
        { col: 55, len: 6, value: 'XXXXXX' },
        { col: 85, len: 5, value: 'XXXXX' },
      ]),
    );
    expect(nan.distanceToNextNm).toBe(undefined);
    expect(nan.minimumEnrouteAltitudeFt).toBe(undefined);
  });

  it('drops the bare BND template from the seven-character direction columns', () => {
    const rec = parseAts1(
      ats1Line([
        { col: 85, len: 5, value: '17500' },
        { col: 90, len: 7, value: '  BND  ' },
        { col: 102, len: 7, value: '  BND  ' },
        { col: 128, len: 7, value: '  BND  ' },
      ]),
    );
    expect(rec.minimumEnrouteAltitudeFt).toBe(17500);
    expect(rec.minimumEnrouteAltitudeDirection).toBe(undefined);
    expect(rec.minimumEnrouteAltitudeOppositeDirection).toBe(undefined);
    expect(rec.minimumCrossingAltitudeDirection).toBe(undefined);
  });
});

describe('parseAts2', () => {
  it('parses every published field', () => {
    const rec = parseAts2(
      ats2Line([
        { col: 20, len: 1, value: 'H' },
        { col: 21, len: 5, value: '   10' },
        { col: 26, len: 40, value: 'BERMUDA' },
        { col: 66, len: 25, value: 'VOR/DME' },
        { col: 91, len: 15, value: 'NAVAID' },
        { col: 106, len: 2, value: 'BM' },
        { col: 108, len: 2, value: 'TJ' },
        { col: 110, len: 14, value: '32-21-54.00N' },
        { col: 124, len: 14, value: '064-40-33.00W' },
        { col: 138, len: 5, value: '11500' },
        { col: 143, len: 4, value: 'BDA' },
      ]),
    );
    expect(rec.fullDesignation).toBe('ATA315');
    expect(rec.airwayTypeChar).toBe('H');
    expect(rec.sequenceNumber).toBe(10);
    expect(rec.name).toBe('BERMUDA');
    expect(rec.facilityType).toBe('VOR/DME');
    expect(rec.fixCategory).toBe('NAVAID');
    expect(rec.state).toBe('BM');
    expect(rec.icaoRegionCode).toBe('TJ');
    expect(rec.latStr).toBe('32-21-54.00N');
    expect(rec.lonStr).toBe('064-40-33.00W');
    expect(rec.minimumReceptionAltitudeFt).toBe(11500);
    expect(rec.navaidIdentifier).toBe('BDA');
  });
});

describe('parseAts4', () => {
  it('reads the point remark with its full designation and sequence number', () => {
    const rec = parseAts4(
      fixedWidthLine([
        { col: 1, len: 4, value: 'ATS4' },
        { col: 5, len: 2, value: 'AT' },
        { col: 7, len: 12, value: 'AR11' },
        { col: 20, len: 1, value: ' ' },
        { col: 21, len: 5, value: '   10' },
        { col: 26, len: 200, value: 'VIRGINIA KEY R-058 UNUSABLE JANUS TO VALLY' },
      ]),
    );
    expect(rec).toEqual({
      fullDesignation: 'ATAR11',
      airwayTypeChar: '',
      sequenceNumber: 10,
      text: 'VIRGINIA KEY R-058 UNUSABLE JANUS TO VALLY',
    });
  });
});

describe('parseAtsRemark', () => {
  it('reads the route remark text after the sequence and reference columns', () => {
    const rec = parseAtsRemark(
      fixedWidthLine([
        { col: 1, len: 4, value: 'RMK ' },
        { col: 5, len: 2, value: 'PA' },
        { col: 7, len: 12, value: 'B757' },
        { col: 20, len: 1, value: 'A' },
        { col: 21, len: 3, value: '001' },
        { col: 29, len: 200, value: 'CHART NORTH PACIFIC ROUTE CHART' },
      ]),
    );
    expect(rec).toEqual({
      fullDesignation: 'PAB757',
      airwayTypeChar: 'A',
      text: 'CHART NORTH PACIFIC ROUTE CHART',
    });
  });
});

describe('buildWaypoint from ATS records', () => {
  it('builds a navaid waypoint and prefers the segment distance over a 000.00 header distance', () => {
    const segment = parseAts1(
      ats1Line([
        { col: 55, len: 6, value: '000.00' },
        { col: 79, len: 6, value: '018.46' },
      ]),
    );
    const point = parseAts2(
      ats2Line([
        { col: 26, len: 40, value: 'BERMUDA' },
        { col: 66, len: 25, value: 'VOR/DME' },
        { col: 110, len: 14, value: '32-21-54.00N' },
        { col: 124, len: 14, value: '064-40-33.00W' },
        { col: 143, len: 4, value: 'BDA' },
      ]),
    );
    const wp = buildWaypoint(segment, point);
    assert(wp);
    expect(wp.waypointType).toBe('NAVAID');
    expect(wp.identifier).toBe('BDA');
    expect(wp.navaidFacilityType).toBe('VOR/DME');
    assert(wp.lat > 32 && wp.lat < 33);
    assert(wp.lon < -64 && wp.lon > -65);
    expect(wp.distanceToNextNm).toBe(18.46);
  });

  it('sets identifier to name when a fix has no navaid identifier', () => {
    const wp = buildWaypoint(
      parseAts1(ats1Line()),
      parseAts2(
        ats2Line([
          { col: 26, len: 40, value: 'HAIST' },
          { col: 66, len: 25, value: 'REP-PT' },
          { col: 110, len: 14, value: '32-21-54.00N' },
          { col: 124, len: 14, value: '064-40-33.00W' },
        ]),
      ),
    );
    expect(wp?.identifier).toBe('HAIST');
  });
});
