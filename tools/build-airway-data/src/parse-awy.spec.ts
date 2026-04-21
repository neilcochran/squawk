import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDms,
  parseAwy1,
  parseAwy2,
  classifyWaypointType,
  buildWaypoint,
} from './parse-awy.js';
import type { Awy1Record, Awy2Record } from './parse-awy.js';

/**
 * Builds a fixed-width record line by placing values at 1-based column
 * positions and padding the rest with spaces. Positions past the last value
 * are filled with spaces up to maxLength.
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

function awy1Defaults(overrides: { col: number; len: number; value: string }[] = []): string {
  return fixedWidthLine([
    { col: 1, len: 4, value: 'AWY1' },
    { col: 5, len: 5, value: 'V16' },
    { col: 10, len: 1, value: ' ' },
    { col: 11, len: 5, value: '    1' },
    ...overrides,
  ]);
}

function awy2Defaults(overrides: { col: number; len: number; value: string }[] = []): string {
  return fixedWidthLine([
    { col: 1, len: 4, value: 'AWY2' },
    { col: 5, len: 5, value: 'V16' },
    { col: 10, len: 1, value: ' ' },
    { col: 11, len: 5, value: '    1' },
    ...overrides,
  ]);
}

describe('parseDms', () => {
  it('parses a northern latitude as positive decimal degrees', () => {
    const result = parseDms('32-32-25.59N');
    assert.ok(result !== undefined);
    assert.ok(Math.abs(result - 32.54044) < 1e-4);
  });

  it('parses a western longitude as negative decimal degrees', () => {
    const result = parseDms('116-57-09.72W');
    assert.ok(result !== undefined);
    assert.ok(result < 0);
    assert.ok(Math.abs(Math.abs(result) - 116.9527) < 1e-3);
  });

  it('parses a southern latitude as negative', () => {
    const result = parseDms('14-19-47.00S');
    assert.ok(result !== undefined);
    assert.ok(result < 0);
  });

  it('parses an eastern longitude as positive', () => {
    const result = parseDms('144-47-59.00E');
    assert.ok(result !== undefined);
    assert.ok(result > 144 && result < 145);
  });

  it('returns undefined for empty input', () => {
    assert.equal(parseDms(''), undefined);
  });

  it('returns undefined for a malformed string', () => {
    assert.equal(parseDms('nope'), undefined);
    assert.equal(parseDms('32-32N'), undefined);
  });

  it('rounds to 6 decimal places', () => {
    const result = parseDms('32-32-25.59N');
    assert.ok(result !== undefined);
    const str = String(result);
    const decimals = str.includes('.') ? str.split('.')[1]!.length : 0;
    assert.ok(decimals <= 6);
  });
});

describe('classifyWaypointType', () => {
  it('classifies VOR/VORTAC/NDB/TACAN/DME facility types as NAVAID', () => {
    assert.equal(classifyWaypointType('VOR/DME', 'JFK'), 'NAVAID');
    assert.equal(classifyWaypointType('VORTAC', 'BOS'), 'NAVAID');
    assert.equal(classifyWaypointType('NDB', 'XYZ'), 'NAVAID');
    assert.equal(classifyWaypointType('TACAN', 'XYZ'), 'NAVAID');
    assert.equal(classifyWaypointType('VOR/DME/TACAN', 'XYZ'), 'NAVAID');
  });

  it('classifies WAY-PT as WAYPOINT', () => {
    assert.equal(classifyWaypointType('WAY-PT', 'OBAAK'), 'WAYPOINT');
  });

  it('classifies REP-PT, AWY-INTXN, COORDN-FIX, MIL-REP-PT, FIX, TURN-PT as FIX', () => {
    assert.equal(classifyWaypointType('REP-PT', 'ABC'), 'FIX');
    assert.equal(classifyWaypointType('AWY-INTXN', 'ABC'), 'FIX');
    assert.equal(classifyWaypointType('COORDN-FIX', 'ABC'), 'FIX');
    assert.equal(classifyWaypointType('MIL-REP-PT', 'ABC'), 'FIX');
    assert.equal(classifyWaypointType('FIX', 'ABC'), 'FIX');
    assert.equal(classifyWaypointType('TURN-PT', 'ABC'), 'FIX');
  });

  it('classifies ARTCC-BDRY as OTHER', () => {
    assert.equal(classifyWaypointType('ARTCC-BDRY', 'ABC'), 'OTHER');
  });

  it('classifies border names when facilityType is empty', () => {
    assert.equal(classifyWaypointType('', 'US/CANADIAN BORDER'), 'BORDER');
    assert.equal(classifyWaypointType('', 'MEXICAN BORDER'), 'BORDER');
    assert.equal(classifyWaypointType('', 'RANDOM'), 'OTHER');
  });

  it('falls back to OTHER for unknown facility types', () => {
    assert.equal(classifyWaypointType('UNKNOWN', 'ABC'), 'OTHER');
  });

  it('matches NAVAID facility types case-insensitively via toUpperCase', () => {
    assert.equal(classifyWaypointType('vor/dme', 'ABC'), 'NAVAID');
    assert.equal(classifyWaypointType('way-pt', 'ABC'), 'WAYPOINT');
  });
});

describe('parseAwy1', () => {
  it('extracts the designation and sequence number', () => {
    const line = awy1Defaults([
      { col: 5, len: 5, value: 'V16  ' },
      { col: 11, len: 5, value: '    3' },
    ]);
    const rec = parseAwy1(line);
    assert.equal(rec.designation, 'V16');
    assert.equal(rec.sequenceNumber, 3);
  });

  it('trims whitespace from the designation', () => {
    const line = awy1Defaults([{ col: 5, len: 5, value: 'J60  ' }]);
    const rec = parseAwy1(line);
    assert.equal(rec.designation, 'J60');
  });

  it('returns airwayTypeChar as A for Alaska airways', () => {
    const line = awy1Defaults([{ col: 10, len: 1, value: 'A' }]);
    const rec = parseAwy1(line);
    assert.equal(rec.airwayTypeChar, 'A');
  });

  it('parses numeric and integer altitude fields', () => {
    const line = awy1Defaults([
      { col: 45, len: 6, value: '  45.5' },
      { col: 75, len: 5, value: ' 4000' },
      { col: 97, len: 5, value: '18000' },
    ]);
    const rec = parseAwy1(line);
    assert.equal(rec.distanceToNextNm, 45.5);
    assert.equal(rec.minimumEnrouteAltitudeFt, 4000);
    assert.equal(rec.maximumAuthorizedAltitudeFt, 18000);
  });

  it('sets boolean flags from single character markers', () => {
    const discontinuedLine = awy1Defaults([
      { col: 107, len: 1, value: 'X' },
      { col: 135, len: 1, value: 'Y' },
      { col: 136, len: 1, value: 'Y' },
      { col: 302, len: 1, value: 'Y' },
    ]);
    const rec = parseAwy1(discontinuedLine);
    assert.equal(rec.discontinued, true);
    assert.equal(rec.signalGap, true);
    assert.equal(rec.usAirspaceOnly, true);
    assert.equal(rec.dogleg, true);
  });

  it('returns undefined for blank numeric fields', () => {
    const line = awy1Defaults();
    const rec = parseAwy1(line);
    assert.equal(rec.distanceToNextNm, undefined);
    assert.equal(rec.minimumEnrouteAltitudeFt, undefined);
    assert.equal(rec.artccId, undefined);
  });

  it('captures the ARTCC id', () => {
    const line = awy1Defaults([{ col: 142, len: 3, value: 'ZNY' }]);
    const rec = parseAwy1(line);
    assert.equal(rec.artccId, 'ZNY');
  });
});

describe('parseAwy2', () => {
  it('extracts the waypoint name', () => {
    const line = awy2Defaults([{ col: 16, len: 30, value: 'KENNEDY                    ' }]);
    const rec = parseAwy2(line);
    assert.equal(rec.name, 'KENNEDY');
  });

  it('extracts the facility type and lat/lon strings', () => {
    const line = awy2Defaults([
      { col: 46, len: 19, value: 'VOR/DME            ' },
      { col: 84, len: 14, value: '32-32-25.59N  ' },
      { col: 98, len: 14, value: '116-57-09.72W ' },
    ]);
    const rec = parseAwy2(line);
    assert.equal(rec.facilityType, 'VOR/DME');
    assert.equal(rec.latStr, '32-32-25.59N');
    assert.equal(rec.lonStr, '116-57-09.72W');
  });

  it('extracts state, icaoRegionCode, and navaidIdentifier', () => {
    const line = awy2Defaults([
      { col: 80, len: 2, value: 'NY' },
      { col: 82, len: 2, value: 'K6' },
      { col: 117, len: 4, value: 'JFK ' },
    ]);
    const rec = parseAwy2(line);
    assert.equal(rec.state, 'NY');
    assert.equal(rec.icaoRegionCode, 'K6');
    assert.equal(rec.navaidIdentifier, 'JFK');
  });
});

describe('buildWaypoint', () => {
  function awy1(overrides: Partial<Awy1Record> = {}): Awy1Record {
    return {
      designation: 'V16',
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

  function awy2(overrides: Partial<Awy2Record> = {}): Awy2Record {
    return {
      designation: 'V16',
      airwayTypeChar: '',
      sequenceNumber: 1,
      name: 'KENNEDY',
      facilityType: 'VOR/DME',
      fixCategory: '',
      state: 'NY',
      icaoRegionCode: 'K6',
      latStr: '40-38-23.00N',
      lonStr: '073-46-43.00W',
      minimumReceptionAltitudeFt: undefined,
      navaidIdentifier: 'JFK',
      ...overrides,
    };
  }

  it('returns undefined when coordinates cannot be parsed', () => {
    assert.equal(buildWaypoint(awy1(), awy2({ latStr: '' })), undefined);
    assert.equal(buildWaypoint(awy1(), awy2({ lonStr: 'nope' })), undefined);
  });

  it('builds a NAVAID waypoint with navaid identifier and facility type', () => {
    const wp = buildWaypoint(awy1(), awy2());
    assert.ok(wp);
    assert.equal(wp.name, 'KENNEDY');
    assert.equal(wp.waypointType, 'NAVAID');
    assert.equal(wp.identifier, 'JFK');
    assert.equal(wp.navaidFacilityType, 'VOR/DME');
    assert.ok(Math.abs(wp.lat - 40.639722) < 1e-4);
    assert.ok(wp.lon < 0 && Math.abs(Math.abs(wp.lon) - 73.778611) < 1e-4);
    assert.equal(wp.state, 'NY');
    assert.equal(wp.icaoRegionCode, 'K6');
  });

  it('uses the name as identifier for FIX waypoints lacking a navaid identifier', () => {
    const wp = buildWaypoint(
      awy1(),
      awy2({ facilityType: 'REP-PT', navaidIdentifier: '', name: 'OBAAK' }),
    );
    assert.ok(wp);
    assert.equal(wp.waypointType, 'FIX');
    assert.equal(wp.identifier, 'OBAAK');
  });

  it('falls back to segmentDistanceNm when distanceToNextNm is undefined', () => {
    const wp = buildWaypoint(
      awy1({ distanceToNextNm: undefined, segmentDistanceNm: 42.5 }),
      awy2(),
    );
    assert.equal(wp?.distanceToNextNm, 42.5);
  });

  it('prefers distanceToNextNm over segmentDistanceNm', () => {
    const wp = buildWaypoint(awy1({ distanceToNextNm: 10, segmentDistanceNm: 99 }), awy2());
    assert.equal(wp?.distanceToNextNm, 10);
  });

  it('propagates boolean flags when set', () => {
    const wp = buildWaypoint(
      awy1({ signalGap: true, usAirspaceOnly: true, dogleg: true, discontinued: true }),
      awy2(),
    );
    assert.equal(wp?.signalGap, true);
    assert.equal(wp?.usAirspaceOnly, true);
    assert.equal(wp?.dogleg, true);
    assert.equal(wp?.discontinued, true);
  });

  it('propagates altitude fields when present', () => {
    const wp = buildWaypoint(
      awy1({
        minimumEnrouteAltitudeFt: 4000,
        minimumEnrouteAltitudeDirection: 'SE',
        maximumAuthorizedAltitudeFt: 18000,
        minimumObstructionClearanceAltitudeFt: 3200,
      }),
      awy2({ minimumReceptionAltitudeFt: 2500 }),
    );
    assert.equal(wp?.minimumEnrouteAltitudeFt, 4000);
    assert.equal(wp?.minimumEnrouteAltitudeDirection, 'SE');
    assert.equal(wp?.maximumAuthorizedAltitudeFt, 18000);
    assert.equal(wp?.minimumObstructionClearanceAltitudeFt, 3200);
    assert.equal(wp?.minimumReceptionAltitudeFt, 2500);
  });
});
