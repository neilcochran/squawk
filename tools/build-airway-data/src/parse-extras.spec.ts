import { describe, it, expect, assert } from 'vitest';
import { parseAts1, parseAts2, buildAtsWaypoint } from './parse-ats.js';
import type { Ats1Record, Ats2Record } from './parse-ats.js';
import { parseAwy1, parseAwy2, buildWaypoint } from './parse-awy.js';
import type { Awy1Record, Awy2Record } from './parse-awy.js';

/**
 * Builds a fixed-width line by inserting field values at specific column
 * positions. Columns are 1-indexed to match FAA NASR specifications.
 *
 * @param entries - Field column/length/value triples.
 * @param maxLength - Total line length to pad to.
 * @returns The fully-padded line string.
 */
function fixedWidthLine(
  entries: { col: number; len: number; value: string }[],
  maxLength = 400,
): string {
  const chars = Array<string>(maxLength).fill(' ');
  for (const { col, len, value } of entries) {
    const padded = value.padEnd(len, ' ').slice(0, len);
    for (let i = 0; i < len; i++) {
      chars[col - 1 + i] = padded[i] ?? ' ';
    }
  }
  return chars.join('');
}

describe('parseAts1 - comprehensive field coverage', () => {
  it('parses every numeric, string, and flag field when populated', () => {
    const line = fixedWidthLine([
      { col: 1, len: 4, value: 'ATS1' },
      { col: 5, len: 2, value: 'AT' },
      { col: 7, len: 12, value: 'A315' },
      { col: 19, len: 1, value: 'R' },
      { col: 20, len: 1, value: 'H' },
      { col: 21, len: 5, value: '   10' },
      { col: 55, len: 6, value: ' 120.5' },
      { col: 67, len: 6, value: ' 045.0' },
      { col: 73, len: 6, value: ' 225.0' },
      { col: 79, len: 6, value: '0080.0' },
      { col: 85, len: 5, value: '18000' },
      { col: 90, len: 7, value: 'NE-SW' },
      { col: 97, len: 5, value: '17000' },
      { col: 102, len: 7, value: 'SW-NE' },
      { col: 109, len: 5, value: '45000' },
      { col: 114, len: 5, value: '13500' },
      { col: 119, len: 1, value: 'X' },
      { col: 120, len: 3, value: ' 25' },
      { col: 123, len: 5, value: '12000' },
      { col: 128, len: 7, value: 'NE' },
      { col: 135, len: 5, value: '11500' },
      { col: 140, len: 7, value: 'SW' },
      { col: 147, len: 1, value: 'Y' },
      { col: 148, len: 1, value: 'Y' },
      { col: 154, len: 3, value: 'ZNY' },
      { col: 247, len: 5, value: '14000' },
      { col: 252, len: 7, value: 'GNSS-NE' },
      { col: 259, len: 5, value: '13000' },
      { col: 264, len: 7, value: 'GNSS-SW' },
      { col: 343, len: 1, value: 'Y' },
    ]);
    const rec = parseAts1(line);
    expect(rec.rnavIndicator).toBe('R');
    expect(rec.airwayTypeChar).toBe('H');
    expect(rec.distanceToNextNm).toBe(120.5);
    expect(rec.magneticCourseDeg).toBe(45);
    expect(rec.magneticCourseOppositeDeg).toBe(225);
    expect(rec.segmentDistanceNm).toBe(80);
    expect(rec.minimumEnrouteAltitudeFt).toBe(18000);
    expect(rec.minimumEnrouteAltitudeDirection).toBe('NE-SW');
    expect(rec.minimumEnrouteAltitudeOppositeFt).toBe(17000);
    expect(rec.minimumEnrouteAltitudeOppositeDirection).toBe('SW-NE');
    expect(rec.maximumAuthorizedAltitudeFt).toBe(45000);
    expect(rec.minimumObstructionClearanceAltitudeFt).toBe(13500);
    expect(rec.discontinued).toBe(true);
    expect(rec.changeoverDistanceNm).toBe(25);
    expect(rec.minimumCrossingAltitudeFt).toBe(12000);
    expect(rec.minimumCrossingAltitudeDirection).toBe('NE');
    expect(rec.minimumCrossingAltitudeOppositeFt).toBe(11500);
    expect(rec.minimumCrossingAltitudeOppositeDirection).toBe('SW');
    expect(rec.artccId).toBe('ZNY');
    expect(rec.gnssMinimumEnrouteAltitudeFt).toBe(14000);
    expect(rec.gnssMinimumEnrouteAltitudeDirection).toBe('GNSS-NE');
    expect(rec.gnssMinimumEnrouteAltitudeOppositeFt).toBe(13000);
    expect(rec.gnssMinimumEnrouteAltitudeOppositeDirection).toBe('GNSS-SW');
  });

  it('returns undefined for numeric fields that parse to NaN', () => {
    const line = fixedWidthLine([
      { col: 1, len: 4, value: 'ATS1' },
      { col: 5, len: 2, value: 'AT' },
      { col: 7, len: 12, value: 'A315' },
      { col: 21, len: 5, value: '   10' },
      { col: 55, len: 6, value: 'XXXXXX' },
      { col: 85, len: 5, value: 'XXXXX' },
    ]);
    const rec = parseAts1(line);
    expect(rec.distanceToNextNm).toBe(undefined);
    expect(rec.minimumEnrouteAltitudeFt).toBe(undefined);
  });
});

describe('parseAts2 - comprehensive field coverage', () => {
  it('parses every populated field including MRA and navaid identifier', () => {
    const line = fixedWidthLine([
      { col: 1, len: 4, value: 'ATS2' },
      { col: 5, len: 2, value: 'AT' },
      { col: 7, len: 12, value: 'A315' },
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
    ]);
    const rec = parseAts2(line);
    expect(rec.fixCategory).toBe('NAVAID');
    expect(rec.state).toBe('BM');
    expect(rec.icaoRegionCode).toBe('TJ');
    expect(rec.minimumReceptionAltitudeFt).toBe(11500);
    expect(rec.navaidIdentifier).toBe('BDA');
  });
});

describe('parseAwy1 - comprehensive field coverage', () => {
  it('parses every numeric, string, and flag field when populated', () => {
    const line = fixedWidthLine([
      { col: 1, len: 4, value: 'AWY1' },
      { col: 5, len: 5, value: 'V16' },
      { col: 10, len: 1, value: 'A' },
      { col: 11, len: 5, value: '    1' },
      { col: 45, len: 6, value: ' 100.5' },
      { col: 57, len: 6, value: ' 060.0' },
      { col: 63, len: 6, value: ' 240.0' },
      { col: 69, len: 6, value: '0050.0' },
      { col: 75, len: 5, value: ' 4000' },
      { col: 80, len: 6, value: 'NE-SW' },
      { col: 86, len: 5, value: ' 4500' },
      { col: 91, len: 6, value: 'SW-NE' },
      { col: 97, len: 5, value: '18000' },
      { col: 102, len: 5, value: ' 3500' },
      { col: 107, len: 1, value: 'X' },
      { col: 108, len: 3, value: ' 12' },
      { col: 111, len: 5, value: ' 5000' },
      { col: 116, len: 7, value: 'NE' },
      { col: 123, len: 5, value: ' 4500' },
      { col: 128, len: 7, value: 'SW' },
      { col: 135, len: 1, value: 'Y' },
      { col: 136, len: 1, value: 'Y' },
      { col: 142, len: 3, value: 'ZNY' },
      { col: 218, len: 5, value: ' 4000' },
      { col: 223, len: 6, value: 'GNS-NE' },
      { col: 229, len: 5, value: ' 4000' },
      { col: 234, len: 6, value: 'GNS-SW' },
      { col: 302, len: 1, value: 'Y' },
    ]);
    const rec = parseAwy1(line);
    expect(rec.distanceToNextNm).toBe(100.5);
    expect(rec.magneticCourseDeg).toBe(60);
    expect(rec.magneticCourseOppositeDeg).toBe(240);
    expect(rec.segmentDistanceNm).toBe(50);
    expect(rec.minimumEnrouteAltitudeFt).toBe(4000);
    expect(rec.minimumEnrouteAltitudeDirection).toBe('NE-SW');
    expect(rec.minimumEnrouteAltitudeOppositeFt).toBe(4500);
    expect(rec.minimumEnrouteAltitudeOppositeDirection).toBe('SW-NE');
    expect(rec.maximumAuthorizedAltitudeFt).toBe(18000);
    expect(rec.minimumObstructionClearanceAltitudeFt).toBe(3500);
    expect(rec.discontinued).toBe(true);
    expect(rec.changeoverDistanceNm).toBe(12);
    expect(rec.minimumCrossingAltitudeFt).toBe(5000);
    expect(rec.minimumCrossingAltitudeDirection).toBe('NE');
    expect(rec.minimumCrossingAltitudeOppositeFt).toBe(4500);
    expect(rec.minimumCrossingAltitudeOppositeDirection).toBe('SW');
    expect(rec.signalGap).toBe(true);
    expect(rec.usAirspaceOnly).toBe(true);
    expect(rec.artccId).toBe('ZNY');
    expect(rec.gnssMinimumEnrouteAltitudeFt).toBe(4000);
    expect(rec.gnssMinimumEnrouteAltitudeDirection).toBe('GNS-NE');
    expect(rec.gnssMinimumEnrouteAltitudeOppositeFt).toBe(4000);
    expect(rec.gnssMinimumEnrouteAltitudeOppositeDirection).toBe('GNS-SW');
    expect(rec.dogleg).toBe(true);
  });

  it('returns undefined for numeric fields that parse to NaN', () => {
    const line = fixedWidthLine([
      { col: 1, len: 4, value: 'AWY1' },
      { col: 5, len: 5, value: 'V16' },
      { col: 11, len: 5, value: '    1' },
      { col: 45, len: 6, value: 'XXXXXX' },
      { col: 75, len: 5, value: 'XXXXX' },
    ]);
    const rec = parseAwy1(line);
    expect(rec.distanceToNextNm).toBe(undefined);
    expect(rec.minimumEnrouteAltitudeFt).toBe(undefined);
  });
});

describe('buildAtsWaypoint - all optional fields', () => {
  function fullAts1(): Ats1Record {
    return {
      designationPrefix: 'AT',
      airwayId: 'A315',
      fullDesignation: 'ATA315',
      rnavIndicator: '',
      airwayTypeChar: '',
      sequenceNumber: 1,
      distanceToNextNm: 100,
      magneticCourseDeg: 45,
      magneticCourseOppositeDeg: 225,
      segmentDistanceNm: 80,
      minimumEnrouteAltitudeFt: 18000,
      minimumEnrouteAltitudeDirection: 'NE-SW',
      minimumEnrouteAltitudeOppositeFt: 17000,
      minimumEnrouteAltitudeOppositeDirection: 'SW-NE',
      maximumAuthorizedAltitudeFt: 45000,
      minimumObstructionClearanceAltitudeFt: 13500,
      discontinued: true,
      changeoverDistanceNm: 25,
      minimumCrossingAltitudeFt: 12000,
      minimumCrossingAltitudeDirection: 'NE',
      minimumCrossingAltitudeOppositeFt: 11500,
      minimumCrossingAltitudeOppositeDirection: 'SW',
      signalGap: true,
      usAirspaceOnly: true,
      artccId: 'ZNY',
      gnssMinimumEnrouteAltitudeFt: 14000,
      gnssMinimumEnrouteAltitudeDirection: 'GNSS-NE',
      gnssMinimumEnrouteAltitudeOppositeFt: 13000,
      gnssMinimumEnrouteAltitudeOppositeDirection: 'GNSS-SW',
      dogleg: true,
    };
  }

  function fullAts2(): Ats2Record {
    return {
      fullDesignation: 'ATA315',
      airwayTypeChar: '',
      sequenceNumber: 1,
      name: 'BERMUDA',
      facilityType: 'VOR/DME',
      fixCategory: 'NAVAID',
      state: 'BM',
      icaoRegionCode: 'TJ',
      latStr: '32-21-54.00N',
      lonStr: '064-40-33.00W',
      minimumReceptionAltitudeFt: 11500,
      navaidIdentifier: 'BDA',
    };
  }

  it('propagates every optional field from ats1 and ats2', () => {
    const wp = buildAtsWaypoint(fullAts1(), fullAts2());
    assert(wp);
    expect(wp.minimumEnrouteAltitudeFt).toBe(18000);
    expect(wp.minimumEnrouteAltitudeDirection).toBe('NE-SW');
    expect(wp.minimumEnrouteAltitudeOppositeFt).toBe(17000);
    expect(wp.minimumEnrouteAltitudeOppositeDirection).toBe('SW-NE');
    expect(wp.maximumAuthorizedAltitudeFt).toBe(45000);
    expect(wp.minimumObstructionClearanceAltitudeFt).toBe(13500);
    expect(wp.gnssMinimumEnrouteAltitudeFt).toBe(14000);
    expect(wp.gnssMinimumEnrouteAltitudeDirection).toBe('GNSS-NE');
    expect(wp.gnssMinimumEnrouteAltitudeOppositeFt).toBe(13000);
    expect(wp.gnssMinimumEnrouteAltitudeOppositeDirection).toBe('GNSS-SW');
    expect(wp.minimumCrossingAltitudeFt).toBe(12000);
    expect(wp.minimumCrossingAltitudeDirection).toBe('NE');
    expect(wp.minimumCrossingAltitudeOppositeFt).toBe(11500);
    expect(wp.minimumCrossingAltitudeOppositeDirection).toBe('SW');
    expect(wp.distanceToNextNm).toBe(100);
    expect(wp.magneticCourseDeg).toBe(45);
    expect(wp.magneticCourseOppositeDeg).toBe(225);
    expect(wp.changeoverDistanceNm).toBe(25);
    expect(wp.signalGap).toBe(true);
    expect(wp.usAirspaceOnly).toBe(true);
    expect(wp.dogleg).toBe(true);
    expect(wp.discontinued).toBe(true);
    expect(wp.minimumReceptionAltitudeFt).toBe(11500);
    expect(wp.icaoRegionCode).toBe('TJ');
  });

  it('falls back to segmentDistanceNm when distanceToNextNm is undefined', () => {
    const a1 = fullAts1();
    a1.distanceToNextNm = undefined;
    const wp = buildAtsWaypoint(a1, fullAts2());
    expect(wp?.distanceToNextNm).toBe(80);
  });
});

describe('parseAwy2 - comprehensive field coverage', () => {
  it('parses every populated field including MRA and navaid identifier', () => {
    const line = fixedWidthLine([
      { col: 1, len: 4, value: 'AWY2' },
      { col: 5, len: 5, value: 'V16' },
      { col: 11, len: 5, value: '    1' },
      { col: 16, len: 30, value: 'BOSTON' },
      { col: 46, len: 19, value: 'VOR/DME' },
      { col: 65, len: 15, value: 'NAVAID' },
      { col: 80, len: 2, value: 'MA' },
      { col: 82, len: 2, value: 'K6' },
      { col: 84, len: 14, value: '42-22-44.00N' },
      { col: 98, len: 14, value: '070-59-23.00W' },
      { col: 112, len: 5, value: ' 4000' },
      { col: 117, len: 4, value: 'BOS' },
    ]);
    const rec = parseAwy2(line);
    expect(rec.fixCategory).toBe('NAVAID');
    expect(rec.state).toBe('MA');
    expect(rec.icaoRegionCode).toBe('K6');
    expect(rec.minimumReceptionAltitudeFt).toBe(4000);
    expect(rec.navaidIdentifier).toBe('BOS');
  });
});

describe('buildWaypoint - all optional fields', () => {
  function fullAwy1(): Awy1Record {
    return {
      designation: 'V16',
      airwayTypeChar: 'A',
      sequenceNumber: 1,
      distanceToNextNm: 100,
      magneticCourseDeg: 60,
      magneticCourseOppositeDeg: 240,
      segmentDistanceNm: 50,
      minimumEnrouteAltitudeFt: 4000,
      minimumEnrouteAltitudeDirection: 'NE-SW',
      minimumEnrouteAltitudeOppositeFt: 4500,
      minimumEnrouteAltitudeOppositeDirection: 'SW-NE',
      maximumAuthorizedAltitudeFt: 18000,
      minimumObstructionClearanceAltitudeFt: 3500,
      discontinued: true,
      changeoverDistanceNm: 12,
      minimumCrossingAltitudeFt: 5000,
      minimumCrossingAltitudeDirection: 'NE',
      minimumCrossingAltitudeOppositeFt: 4500,
      minimumCrossingAltitudeOppositeDirection: 'SW',
      signalGap: true,
      usAirspaceOnly: true,
      artccId: 'ZNY',
      gnssMinimumEnrouteAltitudeFt: 4000,
      gnssMinimumEnrouteAltitudeDirection: 'GNS-NE',
      gnssMinimumEnrouteAltitudeOppositeFt: 4000,
      gnssMinimumEnrouteAltitudeOppositeDirection: 'GNS-SW',
      dogleg: true,
    };
  }

  function fullAwy2(): Awy2Record {
    return {
      designation: 'V16',
      airwayTypeChar: 'A',
      sequenceNumber: 1,
      name: 'BOSTON',
      facilityType: 'VOR/DME',
      fixCategory: 'NAVAID',
      state: 'MA',
      icaoRegionCode: 'K6',
      latStr: '42-22-44.00N',
      lonStr: '070-59-23.00W',
      minimumReceptionAltitudeFt: 4000,
      navaidIdentifier: 'BOS',
    };
  }

  it('propagates every optional field from awy1 and awy2', () => {
    const wp = buildWaypoint(fullAwy1(), fullAwy2());
    assert(wp);
    expect(wp.minimumEnrouteAltitudeFt).toBe(4000);
    expect(wp.minimumEnrouteAltitudeDirection).toBe('NE-SW');
    expect(wp.minimumEnrouteAltitudeOppositeFt).toBe(4500);
    expect(wp.minimumEnrouteAltitudeOppositeDirection).toBe('SW-NE');
    expect(wp.maximumAuthorizedAltitudeFt).toBe(18000);
    expect(wp.minimumObstructionClearanceAltitudeFt).toBe(3500);
    expect(wp.gnssMinimumEnrouteAltitudeFt).toBe(4000);
    expect(wp.gnssMinimumEnrouteAltitudeDirection).toBe('GNS-NE');
    expect(wp.gnssMinimumEnrouteAltitudeOppositeFt).toBe(4000);
    expect(wp.gnssMinimumEnrouteAltitudeOppositeDirection).toBe('GNS-SW');
    expect(wp.minimumCrossingAltitudeFt).toBe(5000);
    expect(wp.minimumCrossingAltitudeDirection).toBe('NE');
    expect(wp.minimumCrossingAltitudeOppositeFt).toBe(4500);
    expect(wp.minimumCrossingAltitudeOppositeDirection).toBe('SW');
    expect(wp.distanceToNextNm).toBe(100);
    expect(wp.magneticCourseDeg).toBe(60);
    expect(wp.magneticCourseOppositeDeg).toBe(240);
    expect(wp.changeoverDistanceNm).toBe(12);
    expect(wp.signalGap).toBe(true);
    expect(wp.usAirspaceOnly).toBe(true);
    expect(wp.dogleg).toBe(true);
    expect(wp.discontinued).toBe(true);
    expect(wp.artccId).toBe('ZNY');
    expect(wp.minimumReceptionAltitudeFt).toBe(4000);
  });

  it('falls back to segmentDistanceNm when distanceToNextNm is undefined', () => {
    const a1 = fullAwy1();
    a1.distanceToNextNm = undefined;
    const wp = buildWaypoint(a1, fullAwy2());
    expect(wp?.distanceToNextNm).toBe(50);
  });
});
