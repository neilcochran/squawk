import { describe, it, expect } from 'vitest';

import { buildWaypoint } from './build-waypoint.js';
import { parseAwy1, parseAwy2, parseAwy4, parseAwyRemark } from './parse-awy.js';
import { awy1Line, awy2Line, fixedWidthLine } from './test-utils.js';

describe('parseAwy1', () => {
  it('extracts the designation, type character and sequence number', () => {
    const rec = parseAwy1(
      awy1Line([
        { col: 5, len: 5, value: 'J60  ' },
        { col: 10, len: 1, value: 'A' },
        { col: 11, len: 5, value: '    3' },
      ]),
    );
    expect(rec.designation).toBe('J60');
    expect(rec.airwayTypeChar).toBe('A');
    expect(rec.sequenceNumber).toBe(3);
  });

  it('parses every published field', () => {
    const rec = parseAwy1(
      awy1Line([
        { col: 45, len: 6, value: ' 100.5' },
        { col: 57, len: 6, value: ' 060.0' },
        { col: 63, len: 6, value: ' 240.0' },
        { col: 69, len: 6, value: '0050.0' },
        { col: 75, len: 5, value: ' 4000' },
        { col: 80, len: 6, value: 'NE BND' },
        { col: 86, len: 5, value: ' 4500' },
        { col: 91, len: 6, value: 'SW BND' },
        { col: 97, len: 5, value: '18000' },
        { col: 102, len: 5, value: ' 3500' },
        { col: 107, len: 1, value: 'X' },
        { col: 108, len: 3, value: ' 12' },
        { col: 111, len: 5, value: ' 5000' },
        { col: 116, len: 7, value: 'NE BND' },
        { col: 123, len: 5, value: ' 4500' },
        { col: 128, len: 7, value: 'SW BND' },
        { col: 135, len: 1, value: 'Y' },
        { col: 136, len: 1, value: 'Y' },
        { col: 137, len: 5, value: '  08E' },
        { col: 142, len: 3, value: 'ZNY' },
        { col: 218, len: 5, value: ' 4000' },
        { col: 223, len: 6, value: 'E BND' },
        { col: 229, len: 5, value: ' 4000' },
        { col: 234, len: 6, value: 'W BND' },
        { col: 240, len: 40, value: 'V16  *AUGER*WI' },
        { col: 280, len: 5, value: '18000' },
        { col: 285, len: 6, value: 'E BND' },
        { col: 291, len: 5, value: '20000' },
        { col: 296, len: 6, value: 'W BND' },
        { col: 302, len: 1, value: 'Y' },
        { col: 303, len: 5, value: '01.00' },
        { col: 308, len: 1, value: 'U' },
      ]),
    );
    expect(rec.distanceToNextNm).toBe(100.5);
    expect(rec.magneticCourseDeg).toBe(60);
    expect(rec.magneticCourseOppositeDeg).toBe(240);
    expect(rec.segmentDistanceNm).toBe(50);
    expect(rec.minimumEnrouteAltitudeFt).toBe(4000);
    expect(rec.minimumEnrouteAltitudeDirection).toBe('NE BND');
    expect(rec.minimumEnrouteAltitudeOppositeFt).toBe(4500);
    expect(rec.minimumEnrouteAltitudeOppositeDirection).toBe('SW BND');
    expect(rec.maximumAuthorizedAltitudeFt).toBe(18000);
    expect(rec.minimumObstructionClearanceAltitudeFt).toBe(3500);
    expect(rec.discontinued).toBe(true);
    expect(rec.changeoverDistanceNm).toBe(12);
    expect(rec.minimumCrossingAltitudeFt).toBe(5000);
    expect(rec.minimumCrossingAltitudeDirection).toBe('NE BND');
    expect(rec.minimumCrossingAltitudeOppositeFt).toBe(4500);
    expect(rec.minimumCrossingAltitudeOppositeDirection).toBe('SW BND');
    expect(rec.minimumCrossingAltitudePoint).toBe('AUGER');
    expect(rec.signalGap).toBe(true);
    expect(rec.usAirspaceOnly).toBe(true);
    expect(rec.magneticVariation).toEqual({ degrees: 8, direction: 'E' });
    expect(rec.artccId).toBe('ZNY');
    expect(rec.gnssMinimumEnrouteAltitudeFt).toBe(4000);
    expect(rec.gnssMinimumEnrouteAltitudeDirection).toBe('E BND');
    expect(rec.gnssMinimumEnrouteAltitudeOppositeFt).toBe(4000);
    expect(rec.gnssMinimumEnrouteAltitudeOppositeDirection).toBe('W BND');
    expect(rec.dmeDmeIruMinimumEnrouteAltitudeFt).toBe(18000);
    expect(rec.dmeDmeIruMinimumEnrouteAltitudeDirection).toBe('E BND');
    expect(rec.dogleg).toBe(true);
    expect(rec.rnpNm).toBe(1);
    expect(rec.unusable).toBe(true);
  });

  it('returns undefined and false for blank fields', () => {
    const rec = parseAwy1(awy1Line());
    expect(rec.distanceToNextNm).toBe(undefined);
    expect(rec.minimumEnrouteAltitudeFt).toBe(undefined);
    expect(rec.minimumEnrouteAltitudeDirection).toBe(undefined);
    expect(rec.minimumCrossingAltitudePoint).toBe(undefined);
    expect(rec.magneticVariation).toBe(undefined);
    expect(rec.artccId).toBe(undefined);
    expect(rec.dmeDmeIruMinimumEnrouteAltitudeFt).toBe(undefined);
    expect(rec.rnpNm).toBe(undefined);
    expect(rec.discontinued).toBe(false);
    expect(rec.unusable).toBe(false);
  });

  it('drops the bare BND template from every direction column', () => {
    const rec = parseAwy1(
      awy1Line([
        { col: 75, len: 5, value: ' 4000' },
        { col: 80, len: 6, value: 'E BND' },
        { col: 91, len: 6, value: '  BND ' },
        { col: 116, len: 7, value: '  BND  ' },
        { col: 128, len: 7, value: '  BND  ' },
        { col: 234, len: 6, value: '  BND ' },
        { col: 296, len: 6, value: '  BND ' },
      ]),
    );
    expect(rec.minimumEnrouteAltitudeDirection).toBe('E BND');
    expect(rec.minimumEnrouteAltitudeOppositeDirection).toBe(undefined);
    expect(rec.minimumCrossingAltitudeDirection).toBe(undefined);
    expect(rec.minimumCrossingAltitudeOppositeDirection).toBe(undefined);
    expect(rec.gnssMinimumEnrouteAltitudeOppositeDirection).toBe(undefined);
  });

  it('reads the MEA GAP column as unusable only for U', () => {
    expect(parseAwy1(awy1Line([{ col: 308, len: 1, value: 'N' }])).unusable).toBe(false);
    expect(parseAwy1(awy1Line([{ col: 308, len: 1, value: 'U' }])).unusable).toBe(true);
  });

  it('returns undefined for numeric fields that parse to NaN', () => {
    const rec = parseAwy1(
      awy1Line([
        { col: 45, len: 6, value: 'XXXXXX' },
        { col: 75, len: 5, value: 'XXXXX' },
      ]),
    );
    expect(rec.distanceToNextNm).toBe(undefined);
    expect(rec.minimumEnrouteAltitudeFt).toBe(undefined);
  });
});

describe('parseAwy2', () => {
  it('parses every published field', () => {
    const rec = parseAwy2(
      awy2Line([
        { col: 16, len: 30, value: 'BOSTON' },
        { col: 46, len: 19, value: 'VOR/DME' },
        { col: 65, len: 15, value: 'NAVAID' },
        { col: 80, len: 2, value: 'MA' },
        { col: 82, len: 2, value: 'K6' },
        { col: 84, len: 14, value: '42-22-44.00N' },
        { col: 98, len: 14, value: '070-59-23.00W' },
        { col: 112, len: 5, value: ' 4000' },
        { col: 117, len: 4, value: 'BOS' },
      ]),
    );
    expect(rec.designation).toBe('V16');
    expect(rec.sequenceNumber).toBe(1);
    expect(rec.name).toBe('BOSTON');
    expect(rec.facilityType).toBe('VOR/DME');
    expect(rec.fixCategory).toBe('NAVAID');
    expect(rec.state).toBe('MA');
    expect(rec.icaoRegionCode).toBe('K6');
    expect(rec.latStr).toBe('42-22-44.00N');
    expect(rec.lonStr).toBe('070-59-23.00W');
    expect(rec.minimumReceptionAltitudeFt).toBe(4000);
    expect(rec.navaidIdentifier).toBe('BOS');
  });

  it('returns empty strings and undefined for blank fields', () => {
    const rec = parseAwy2(awy2Line());
    expect(rec.name).toBe('');
    expect(rec.facilityType).toBe('');
    expect(rec.minimumReceptionAltitudeFt).toBe(undefined);
    expect(rec.navaidIdentifier).toBe('');
  });
});

describe('parseAwy4', () => {
  it('reads the point remark with its airway key and sequence number', () => {
    const rec = parseAwy4(
      fixedWidthLine([
        { col: 1, len: 4, value: 'AWY4' },
        { col: 5, len: 5, value: 'J15' },
        { col: 10, len: 1, value: ' ' },
        { col: 11, len: 5, value: '   60' },
        { col: 16, len: 202, value: 'WINK R-311 UNUSABLE, USE CHISUM R-129' },
      ]),
    );
    expect(rec).toEqual({
      designation: 'J15',
      airwayTypeChar: '',
      sequenceNumber: 60,
      text: 'WINK R-311 UNUSABLE, USE CHISUM R-129',
    });
  });
});

describe('parseAwyRemark', () => {
  it('reads the route remark text after the sequence and reference columns', () => {
    const rec = parseAwyRemark(
      fixedWidthLine([
        { col: 1, len: 4, value: 'RMK ' },
        { col: 5, len: 5, value: 'T227' },
        { col: 10, len: 1, value: 'A' },
        { col: 11, len: 3, value: '001' },
        { col: 20, len: 220, value: 'HF COMM REQUIRED' },
      ]),
    );
    expect(rec).toEqual({ designation: 'T227', airwayTypeChar: 'A', text: 'HF COMM REQUIRED' });
  });
});

describe('buildWaypoint from AWY records', () => {
  it('uses the segment distance from a record whose header distance is 000.00', () => {
    const rec = parseAwy1(
      awy1Line([
        { col: 5, len: 5, value: 'J60  ' },
        { col: 45, len: 6, value: '000.00' },
        { col: 69, len: 6, value: '045.05' },
      ]),
    );
    expect(rec.distanceToNextNm).toBe(0);
    expect(rec.segmentDistanceNm).toBe(45.05);
    const point = parseAwy2(
      awy2Line([
        { col: 16, len: 30, value: 'JOLIET' },
        { col: 46, len: 19, value: 'VORTAC' },
        { col: 84, len: 14, value: '41-32-46.00N' },
        { col: 98, len: 14, value: '088-19-07.00W' },
        { col: 117, len: 4, value: 'JOT' },
      ]),
    );
    const wp = buildWaypoint(rec, point);
    expect(wp?.identifier).toBe('JOT');
    expect(wp?.distanceToNextNm).toBe(45.05);
  });
});
