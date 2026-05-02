import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { parseAts1, parseAts2, buildAtsWaypoint } from './parse-ats.js';
import type { Ats1Record, Ats2Record } from './parse-ats.js';

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

describe('parseAts1', () => {
  it('splits the designation into prefix and id with a full designation', () => {
    const line = fixedWidthLine([
      { col: 1, len: 4, value: 'ATS1' },
      { col: 5, len: 2, value: 'AT' },
      { col: 7, len: 12, value: 'A315        ' },
      { col: 21, len: 5, value: '    1' },
    ]);
    const rec = parseAts1(line);
    assert.equal(rec.designationPrefix, 'AT');
    assert.equal(rec.airwayId, 'A315');
    assert.equal(rec.fullDesignation, 'ATA315');
    assert.equal(rec.sequenceNumber, 1);
  });

  it('extracts signal gap, us-airspace-only and dogleg flags', () => {
    const line = fixedWidthLine([
      { col: 1, len: 4, value: 'ATS1' },
      { col: 5, len: 2, value: 'PA' },
      { col: 7, len: 12, value: 'R580        ' },
      { col: 21, len: 5, value: '    5' },
      { col: 147, len: 1, value: 'Y' },
      { col: 148, len: 1, value: 'Y' },
      { col: 343, len: 1, value: 'Y' },
    ]);
    const rec = parseAts1(line);
    assert.equal(rec.signalGap, true);
    assert.equal(rec.usAirspaceOnly, true);
    assert.equal(rec.dogleg, true);
  });

  it('parses numeric altitude fields', () => {
    const line = fixedWidthLine([
      { col: 1, len: 4, value: 'ATS1' },
      { col: 5, len: 2, value: 'AT' },
      { col: 7, len: 12, value: 'A315        ' },
      { col: 21, len: 5, value: '    1' },
      { col: 55, len: 6, value: ' 120.0' },
      { col: 85, len: 5, value: '18000' },
      { col: 109, len: 5, value: '45000' },
    ]);
    const rec = parseAts1(line);
    assert.equal(rec.distanceToNextNm, 120);
    assert.equal(rec.minimumEnrouteAltitudeFt, 18000);
    assert.equal(rec.maximumAuthorizedAltitudeFt, 45000);
  });
});

describe('parseAts2', () => {
  it('extracts name, facility type, and lat/lon strings', () => {
    const line = fixedWidthLine([
      { col: 1, len: 4, value: 'ATS2' },
      { col: 5, len: 2, value: 'AT' },
      { col: 7, len: 12, value: 'A315        ' },
      { col: 21, len: 5, value: '    1' },
      { col: 26, len: 40, value: 'BERMUDA                                 ' },
      { col: 66, len: 25, value: 'VOR/DME                  ' },
      { col: 110, len: 14, value: '32-21-54.00N  ' },
      { col: 124, len: 14, value: '064-40-33.00W ' },
    ]);
    const rec = parseAts2(line);
    assert.equal(rec.name, 'BERMUDA');
    assert.equal(rec.facilityType, 'VOR/DME');
    assert.equal(rec.latStr, '32-21-54.00N');
    assert.equal(rec.lonStr, '064-40-33.00W');
  });
});

describe('buildAtsWaypoint', () => {
  function ats1(overrides: Partial<Ats1Record> = {}): Ats1Record {
    return {
      designationPrefix: 'AT',
      airwayId: 'A315',
      fullDesignation: 'ATA315',
      rnavIndicator: '',
      airwayTypeChar: '',
      sequenceNumber: 1,
      distanceToNextNm: undefined,
      magneticCourseDeg: undefined,
      magneticCourseOppositeDeg: undefined,
      segmentDistanceNm: undefined,
      minimumEnrouteAltitudeFt: undefined,
      minimumEnrouteAltitudeDirection: undefined,
      minimumEnrouteAltitudeOppositeFt: undefined,
      minimumEnrouteAltitudeOppositeDirection: undefined,
      maximumAuthorizedAltitudeFt: undefined,
      minimumObstructionClearanceAltitudeFt: undefined,
      discontinued: false,
      changeoverDistanceNm: undefined,
      minimumCrossingAltitudeFt: undefined,
      minimumCrossingAltitudeDirection: undefined,
      minimumCrossingAltitudeOppositeFt: undefined,
      minimumCrossingAltitudeOppositeDirection: undefined,
      signalGap: false,
      usAirspaceOnly: false,
      artccId: undefined,
      gnssMinimumEnrouteAltitudeFt: undefined,
      gnssMinimumEnrouteAltitudeDirection: undefined,
      gnssMinimumEnrouteAltitudeOppositeFt: undefined,
      gnssMinimumEnrouteAltitudeOppositeDirection: undefined,
      dogleg: false,
      ...overrides,
    };
  }

  function ats2(overrides: Partial<Ats2Record> = {}): Ats2Record {
    return {
      fullDesignation: 'ATA315',
      airwayTypeChar: '',
      sequenceNumber: 1,
      name: 'BERMUDA',
      facilityType: 'VOR/DME',
      fixCategory: '',
      state: '',
      icaoRegionCode: '',
      latStr: '32-21-54.00N',
      lonStr: '064-40-33.00W',
      minimumReceptionAltitudeFt: undefined,
      navaidIdentifier: 'BDA',
      ...overrides,
    };
  }

  it('builds a NAVAID waypoint with navaid identifier', () => {
    const wp = buildAtsWaypoint(ats1(), ats2());
    assert.ok(wp);
    assert.equal(wp.waypointType, 'NAVAID');
    assert.equal(wp.identifier, 'BDA');
    assert.equal(wp.navaidFacilityType, 'VOR/DME');
    assert.ok(wp.lat > 32 && wp.lat < 33);
    assert.ok(wp.lon < -64 && wp.lon > -65);
  });

  it('sets identifier to name when FIX waypoint has no navaid identifier', () => {
    const wp = buildAtsWaypoint(
      ats1(),
      ats2({ facilityType: 'REP-PT', navaidIdentifier: '', name: 'HAIST' }),
    );
    assert.equal(wp?.identifier, 'HAIST');
  });

  it('returns undefined when coordinates cannot be parsed', () => {
    assert.equal(buildAtsWaypoint(ats1(), ats2({ latStr: '' })), undefined);
  });

  it('propagates ARTCC id, state, and distance fields', () => {
    const wp = buildAtsWaypoint(
      ats1({ artccId: 'ZNY', distanceToNextNm: 100, signalGap: true }),
      ats2({ state: 'FL' }),
    );
    assert.equal(wp?.artccId, 'ZNY');
    assert.equal(wp?.state, 'FL');
    assert.equal(wp?.distanceToNextNm, 100);
    assert.equal(wp?.signalGap, true);
  });
});
