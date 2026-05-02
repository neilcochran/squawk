import { describe, it, expect, assert } from 'vitest';
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
    assert(result !== undefined);
    assert(Math.abs(result - 32.54044) < 1e-4);
  });

  it('parses a western longitude as negative decimal degrees', () => {
    const result = parseDms('116-57-09.72W');
    assert(result !== undefined);
    assert(result < 0);
    assert(Math.abs(Math.abs(result) - 116.9527) < 1e-3);
  });

  it('parses a southern latitude as negative', () => {
    const result = parseDms('14-19-47.00S');
    assert(result !== undefined);
    assert(result < 0);
  });

  it('parses an eastern longitude as positive', () => {
    const result = parseDms('144-47-59.00E');
    assert(result !== undefined);
    assert(result > 144 && result < 145);
  });

  it('returns undefined for empty input', () => {
    expect(parseDms('')).toBe(undefined);
  });

  it('returns undefined for a malformed string', () => {
    expect(parseDms('nope')).toBe(undefined);
    expect(parseDms('32-32N')).toBe(undefined);
  });

  it('rounds to 6 decimal places', () => {
    const result = parseDms('32-32-25.59N');
    assert(result !== undefined);
    const str = String(result);
    const decimals = str.includes('.') ? str.split('.')[1]!.length : 0;
    assert(decimals <= 6);
  });
});

describe('classifyWaypointType', () => {
  it('classifies VOR/VORTAC/NDB/TACAN/DME facility types as NAVAID', () => {
    expect(classifyWaypointType('VOR/DME', 'JFK')).toBe('NAVAID');
    expect(classifyWaypointType('VORTAC', 'BOS')).toBe('NAVAID');
    expect(classifyWaypointType('NDB', 'XYZ')).toBe('NAVAID');
    expect(classifyWaypointType('TACAN', 'XYZ')).toBe('NAVAID');
    expect(classifyWaypointType('VOR/DME/TACAN', 'XYZ')).toBe('NAVAID');
  });

  it('classifies WAY-PT as WAYPOINT', () => {
    expect(classifyWaypointType('WAY-PT', 'OBAAK')).toBe('WAYPOINT');
  });

  it('classifies REP-PT, AWY-INTXN, COORDN-FIX, MIL-REP-PT, FIX, TURN-PT as FIX', () => {
    expect(classifyWaypointType('REP-PT', 'ABC')).toBe('FIX');
    expect(classifyWaypointType('AWY-INTXN', 'ABC')).toBe('FIX');
    expect(classifyWaypointType('COORDN-FIX', 'ABC')).toBe('FIX');
    expect(classifyWaypointType('MIL-REP-PT', 'ABC')).toBe('FIX');
    expect(classifyWaypointType('FIX', 'ABC')).toBe('FIX');
    expect(classifyWaypointType('TURN-PT', 'ABC')).toBe('FIX');
  });

  it('classifies ARTCC-BDRY as OTHER', () => {
    expect(classifyWaypointType('ARTCC-BDRY', 'ABC')).toBe('OTHER');
  });

  it('classifies border names when facilityType is empty', () => {
    expect(classifyWaypointType('', 'US/CANADIAN BORDER')).toBe('BORDER');
    expect(classifyWaypointType('', 'MEXICAN BORDER')).toBe('BORDER');
    expect(classifyWaypointType('', 'RANDOM')).toBe('OTHER');
  });

  it('falls back to OTHER for unknown facility types', () => {
    expect(classifyWaypointType('UNKNOWN', 'ABC')).toBe('OTHER');
  });

  it('matches NAVAID facility types case-insensitively via toUpperCase', () => {
    expect(classifyWaypointType('vor/dme', 'ABC')).toBe('NAVAID');
    expect(classifyWaypointType('way-pt', 'ABC')).toBe('WAYPOINT');
  });
});

describe('parseAwy1', () => {
  it('extracts the designation and sequence number', () => {
    const line = awy1Defaults([
      { col: 5, len: 5, value: 'V16  ' },
      { col: 11, len: 5, value: '    3' },
    ]);
    const rec = parseAwy1(line);
    expect(rec.designation).toBe('V16');
    expect(rec.sequenceNumber).toBe(3);
  });

  it('trims whitespace from the designation', () => {
    const line = awy1Defaults([{ col: 5, len: 5, value: 'J60  ' }]);
    const rec = parseAwy1(line);
    expect(rec.designation).toBe('J60');
  });

  it('returns airwayTypeChar as A for Alaska airways', () => {
    const line = awy1Defaults([{ col: 10, len: 1, value: 'A' }]);
    const rec = parseAwy1(line);
    expect(rec.airwayTypeChar).toBe('A');
  });

  it('parses numeric and integer altitude fields', () => {
    const line = awy1Defaults([
      { col: 45, len: 6, value: '  45.5' },
      { col: 75, len: 5, value: ' 4000' },
      { col: 97, len: 5, value: '18000' },
    ]);
    const rec = parseAwy1(line);
    expect(rec.distanceToNextNm).toBe(45.5);
    expect(rec.minimumEnrouteAltitudeFt).toBe(4000);
    expect(rec.maximumAuthorizedAltitudeFt).toBe(18000);
  });

  it('sets boolean flags from single character markers', () => {
    const discontinuedLine = awy1Defaults([
      { col: 107, len: 1, value: 'X' },
      { col: 135, len: 1, value: 'Y' },
      { col: 136, len: 1, value: 'Y' },
      { col: 302, len: 1, value: 'Y' },
    ]);
    const rec = parseAwy1(discontinuedLine);
    expect(rec.discontinued).toBe(true);
    expect(rec.signalGap).toBe(true);
    expect(rec.usAirspaceOnly).toBe(true);
    expect(rec.dogleg).toBe(true);
  });

  it('returns undefined for blank numeric fields', () => {
    const line = awy1Defaults();
    const rec = parseAwy1(line);
    expect(rec.distanceToNextNm).toBe(undefined);
    expect(rec.minimumEnrouteAltitudeFt).toBe(undefined);
    expect(rec.artccId).toBe(undefined);
  });

  it('captures the ARTCC id', () => {
    const line = awy1Defaults([{ col: 142, len: 3, value: 'ZNY' }]);
    const rec = parseAwy1(line);
    expect(rec.artccId).toBe('ZNY');
  });
});

describe('parseAwy2', () => {
  it('extracts the waypoint name', () => {
    const line = awy2Defaults([{ col: 16, len: 30, value: 'KENNEDY                    ' }]);
    const rec = parseAwy2(line);
    expect(rec.name).toBe('KENNEDY');
  });

  it('extracts the facility type and lat/lon strings', () => {
    const line = awy2Defaults([
      { col: 46, len: 19, value: 'VOR/DME            ' },
      { col: 84, len: 14, value: '32-32-25.59N  ' },
      { col: 98, len: 14, value: '116-57-09.72W ' },
    ]);
    const rec = parseAwy2(line);
    expect(rec.facilityType).toBe('VOR/DME');
    expect(rec.latStr).toBe('32-32-25.59N');
    expect(rec.lonStr).toBe('116-57-09.72W');
  });

  it('extracts state, icaoRegionCode, and navaidIdentifier', () => {
    const line = awy2Defaults([
      { col: 80, len: 2, value: 'NY' },
      { col: 82, len: 2, value: 'K6' },
      { col: 117, len: 4, value: 'JFK ' },
    ]);
    const rec = parseAwy2(line);
    expect(rec.state).toBe('NY');
    expect(rec.icaoRegionCode).toBe('K6');
    expect(rec.navaidIdentifier).toBe('JFK');
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
    expect(buildWaypoint(awy1(), awy2({ latStr: '' }))).toBe(undefined);
    expect(buildWaypoint(awy1(), awy2({ lonStr: 'nope' }))).toBe(undefined);
  });

  it('builds a NAVAID waypoint with navaid identifier and facility type', () => {
    const wp = buildWaypoint(awy1(), awy2());
    assert(wp);
    expect(wp.name).toBe('KENNEDY');
    expect(wp.waypointType).toBe('NAVAID');
    expect(wp.identifier).toBe('JFK');
    expect(wp.navaidFacilityType).toBe('VOR/DME');
    assert(Math.abs(wp.lat - 40.639722) < 1e-4);
    assert(wp.lon < 0 && Math.abs(Math.abs(wp.lon) - 73.778611) < 1e-4);
    expect(wp.state).toBe('NY');
    expect(wp.icaoRegionCode).toBe('K6');
  });

  it('uses the name as identifier for FIX waypoints lacking a navaid identifier', () => {
    const wp = buildWaypoint(
      awy1(),
      awy2({ facilityType: 'REP-PT', navaidIdentifier: '', name: 'OBAAK' }),
    );
    assert(wp);
    expect(wp.waypointType).toBe('FIX');
    expect(wp.identifier).toBe('OBAAK');
  });

  it('falls back to segmentDistanceNm when distanceToNextNm is undefined', () => {
    const wp = buildWaypoint(
      awy1({ distanceToNextNm: undefined, segmentDistanceNm: 42.5 }),
      awy2(),
    );
    expect(wp?.distanceToNextNm).toBe(42.5);
  });

  it('prefers distanceToNextNm over segmentDistanceNm', () => {
    const wp = buildWaypoint(awy1({ distanceToNextNm: 10, segmentDistanceNm: 99 }), awy2());
    expect(wp?.distanceToNextNm).toBe(10);
  });

  it('propagates boolean flags when set', () => {
    const wp = buildWaypoint(
      awy1({ signalGap: true, usAirspaceOnly: true, dogleg: true, discontinued: true }),
      awy2(),
    );
    expect(wp?.signalGap).toBe(true);
    expect(wp?.usAirspaceOnly).toBe(true);
    expect(wp?.dogleg).toBe(true);
    expect(wp?.discontinued).toBe(true);
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
    expect(wp?.minimumEnrouteAltitudeFt).toBe(4000);
    expect(wp?.minimumEnrouteAltitudeDirection).toBe('SE');
    expect(wp?.maximumAuthorizedAltitudeFt).toBe(18000);
    expect(wp?.minimumObstructionClearanceAltitudeFt).toBe(3200);
    expect(wp?.minimumReceptionAltitudeFt).toBe(2500);
  });
});
