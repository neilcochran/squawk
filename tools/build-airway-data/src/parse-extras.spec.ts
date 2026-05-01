import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
    assert.equal(rec.rnavIndicator, 'R');
    assert.equal(rec.airwayTypeChar, 'H');
    assert.equal(rec.distanceToNextNm, 120.5);
    assert.equal(rec.magneticCourseDeg, 45);
    assert.equal(rec.magneticCourseOppositeDeg, 225);
    assert.equal(rec.segmentDistanceNm, 80);
    assert.equal(rec.minimumEnrouteAltitudeFt, 18000);
    assert.equal(rec.minimumEnrouteAltitudeDirection, 'NE-SW');
    assert.equal(rec.minimumEnrouteAltitudeOppositeFt, 17000);
    assert.equal(rec.minimumEnrouteAltitudeOppositeDirection, 'SW-NE');
    assert.equal(rec.maximumAuthorizedAltitudeFt, 45000);
    assert.equal(rec.minimumObstructionClearanceAltitudeFt, 13500);
    assert.equal(rec.discontinued, true);
    assert.equal(rec.changeoverDistanceNm, 25);
    assert.equal(rec.minimumCrossingAltitudeFt, 12000);
    assert.equal(rec.minimumCrossingAltitudeDirection, 'NE');
    assert.equal(rec.minimumCrossingAltitudeOppositeFt, 11500);
    assert.equal(rec.minimumCrossingAltitudeOppositeDirection, 'SW');
    assert.equal(rec.artccId, 'ZNY');
    assert.equal(rec.gnssMinimumEnrouteAltitudeFt, 14000);
    assert.equal(rec.gnssMinimumEnrouteAltitudeDirection, 'GNSS-NE');
    assert.equal(rec.gnssMinimumEnrouteAltitudeOppositeFt, 13000);
    assert.equal(rec.gnssMinimumEnrouteAltitudeOppositeDirection, 'GNSS-SW');
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
    assert.equal(rec.distanceToNextNm, undefined);
    assert.equal(rec.minimumEnrouteAltitudeFt, undefined);
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
    assert.equal(rec.fixCategory, 'NAVAID');
    assert.equal(rec.state, 'BM');
    assert.equal(rec.icaoRegionCode, 'TJ');
    assert.equal(rec.minimumReceptionAltitudeFt, 11500);
    assert.equal(rec.navaidIdentifier, 'BDA');
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
    assert.equal(rec.distanceToNextNm, 100.5);
    assert.equal(rec.magneticCourseDeg, 60);
    assert.equal(rec.magneticCourseOppositeDeg, 240);
    assert.equal(rec.segmentDistanceNm, 50);
    assert.equal(rec.minimumEnrouteAltitudeFt, 4000);
    assert.equal(rec.minimumEnrouteAltitudeDirection, 'NE-SW');
    assert.equal(rec.minimumEnrouteAltitudeOppositeFt, 4500);
    assert.equal(rec.minimumEnrouteAltitudeOppositeDirection, 'SW-NE');
    assert.equal(rec.maximumAuthorizedAltitudeFt, 18000);
    assert.equal(rec.minimumObstructionClearanceAltitudeFt, 3500);
    assert.equal(rec.discontinued, true);
    assert.equal(rec.changeoverDistanceNm, 12);
    assert.equal(rec.minimumCrossingAltitudeFt, 5000);
    assert.equal(rec.minimumCrossingAltitudeDirection, 'NE');
    assert.equal(rec.minimumCrossingAltitudeOppositeFt, 4500);
    assert.equal(rec.minimumCrossingAltitudeOppositeDirection, 'SW');
    assert.equal(rec.signalGap, true);
    assert.equal(rec.usAirspaceOnly, true);
    assert.equal(rec.artccId, 'ZNY');
    assert.equal(rec.gnssMinimumEnrouteAltitudeFt, 4000);
    assert.equal(rec.gnssMinimumEnrouteAltitudeDirection, 'GNS-NE');
    assert.equal(rec.gnssMinimumEnrouteAltitudeOppositeFt, 4000);
    assert.equal(rec.gnssMinimumEnrouteAltitudeOppositeDirection, 'GNS-SW');
    assert.equal(rec.dogleg, true);
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
    assert.equal(rec.distanceToNextNm, undefined);
    assert.equal(rec.minimumEnrouteAltitudeFt, undefined);
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
    assert.ok(wp);
    assert.equal(wp.minimumEnrouteAltitudeFt, 18000);
    assert.equal(wp.minimumEnrouteAltitudeDirection, 'NE-SW');
    assert.equal(wp.minimumEnrouteAltitudeOppositeFt, 17000);
    assert.equal(wp.minimumEnrouteAltitudeOppositeDirection, 'SW-NE');
    assert.equal(wp.maximumAuthorizedAltitudeFt, 45000);
    assert.equal(wp.minimumObstructionClearanceAltitudeFt, 13500);
    assert.equal(wp.gnssMinimumEnrouteAltitudeFt, 14000);
    assert.equal(wp.gnssMinimumEnrouteAltitudeDirection, 'GNSS-NE');
    assert.equal(wp.gnssMinimumEnrouteAltitudeOppositeFt, 13000);
    assert.equal(wp.gnssMinimumEnrouteAltitudeOppositeDirection, 'GNSS-SW');
    assert.equal(wp.minimumCrossingAltitudeFt, 12000);
    assert.equal(wp.minimumCrossingAltitudeDirection, 'NE');
    assert.equal(wp.minimumCrossingAltitudeOppositeFt, 11500);
    assert.equal(wp.minimumCrossingAltitudeOppositeDirection, 'SW');
    assert.equal(wp.distanceToNextNm, 100);
    assert.equal(wp.magneticCourseDeg, 45);
    assert.equal(wp.magneticCourseOppositeDeg, 225);
    assert.equal(wp.changeoverDistanceNm, 25);
    assert.equal(wp.signalGap, true);
    assert.equal(wp.usAirspaceOnly, true);
    assert.equal(wp.dogleg, true);
    assert.equal(wp.discontinued, true);
    assert.equal(wp.minimumReceptionAltitudeFt, 11500);
    assert.equal(wp.icaoRegionCode, 'TJ');
  });

  it('falls back to segmentDistanceNm when distanceToNextNm is undefined', () => {
    const a1 = fullAts1();
    a1.distanceToNextNm = undefined;
    const wp = buildAtsWaypoint(a1, fullAts2());
    assert.equal(wp?.distanceToNextNm, 80);
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
    assert.equal(rec.fixCategory, 'NAVAID');
    assert.equal(rec.state, 'MA');
    assert.equal(rec.icaoRegionCode, 'K6');
    assert.equal(rec.minimumReceptionAltitudeFt, 4000);
    assert.equal(rec.navaidIdentifier, 'BOS');
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
    assert.ok(wp);
    assert.equal(wp.minimumEnrouteAltitudeFt, 4000);
    assert.equal(wp.minimumEnrouteAltitudeDirection, 'NE-SW');
    assert.equal(wp.minimumEnrouteAltitudeOppositeFt, 4500);
    assert.equal(wp.minimumEnrouteAltitudeOppositeDirection, 'SW-NE');
    assert.equal(wp.maximumAuthorizedAltitudeFt, 18000);
    assert.equal(wp.minimumObstructionClearanceAltitudeFt, 3500);
    assert.equal(wp.gnssMinimumEnrouteAltitudeFt, 4000);
    assert.equal(wp.gnssMinimumEnrouteAltitudeDirection, 'GNS-NE');
    assert.equal(wp.gnssMinimumEnrouteAltitudeOppositeFt, 4000);
    assert.equal(wp.gnssMinimumEnrouteAltitudeOppositeDirection, 'GNS-SW');
    assert.equal(wp.minimumCrossingAltitudeFt, 5000);
    assert.equal(wp.minimumCrossingAltitudeDirection, 'NE');
    assert.equal(wp.minimumCrossingAltitudeOppositeFt, 4500);
    assert.equal(wp.minimumCrossingAltitudeOppositeDirection, 'SW');
    assert.equal(wp.distanceToNextNm, 100);
    assert.equal(wp.magneticCourseDeg, 60);
    assert.equal(wp.magneticCourseOppositeDeg, 240);
    assert.equal(wp.changeoverDistanceNm, 12);
    assert.equal(wp.signalGap, true);
    assert.equal(wp.usAirspaceOnly, true);
    assert.equal(wp.dogleg, true);
    assert.equal(wp.discontinued, true);
    assert.equal(wp.artccId, 'ZNY');
    assert.equal(wp.minimumReceptionAltitudeFt, 4000);
  });

  it('falls back to segmentDistanceNm when distanceToNextNm is undefined', () => {
    const a1 = fullAwy1();
    a1.distanceToNextNm = undefined;
    const wp = buildWaypoint(a1, fullAwy2());
    assert.equal(wp?.distanceToNextNm, 50);
  });
});
