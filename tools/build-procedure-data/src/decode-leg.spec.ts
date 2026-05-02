import { describe, it, expect, assert } from 'vitest';
import { decodePrimaryLegRecord, isFirstMissedApproachLeg } from './decode-leg.js';

/**
 * Pads a string to the given length with spaces so record fragments
 * can be assembled into a full 132-character ARINC 424 record.
 */
function pad(value: string, length: number): string {
  return value.length >= length
    ? value.substring(0, length)
    : value + ' '.repeat(length - value.length);
}

/**
 * Builds a 132-character ARINC 424 airport-section primary record from
 * field-keyed overrides, filling unspecified fields with spaces. Field
 * keys are byte offsets; values are inserted at those positions.
 */
function buildRecord(overrides: Record<number, string>): string {
  const record = Array.from({ length: 132 }, () => ' ');
  for (const [offsetStr, value] of Object.entries(overrides)) {
    const offset = Number(offsetStr);
    for (let i = 0; i < value.length; i++) {
      record[offset + i] = value.charAt(i);
    }
  }
  return record.join('');
}

/**
 * Builds a minimal valid primary leg record for testing with supplied
 * overrides on top of a known-good baseline.
 */
function buildLegRecord(overrides: Record<number, string> = {}): string {
  return buildRecord({
    0: 'S',
    1: 'USA',
    4: 'P',
    6: 'KJFK',
    10: 'K6',
    12: 'F',
    13: 'I04L  ',
    19: 'I',
    26: '010',
    29: 'AROKE',
    34: 'K6',
    36: 'PC',
    38: '0',
    39: 'E   ',
    47: 'IF',
    ...overrides,
  });
}

describe('decodePrimaryLegRecord', () => {
  it('decodes a minimal valid IAP leg record', () => {
    const raw = buildLegRecord();
    const decoded = decodePrimaryLegRecord(raw);
    assert(decoded !== undefined);
    expect(decoded.airport).toBe('KJFK');
    expect(decoded.airportIcaoRegionCode).toBe('K6');
    expect(decoded.procedureIdentifier).toBe('I04L');
    expect(decoded.procedureType).toBe('IAP');
    expect(decoded.routeType).toBe('I');
    expect(decoded.sequenceNumber).toBe(10);
    expect(decoded.fixSectionCode).toBe('PC');
    expect(decoded.leg.pathTerminator).toBe('IF');
    expect(decoded.leg.fixIdentifier).toBe('AROKE');
    expect(decoded.leg.icaoRegionCode).toBe('K6');
    expect(decoded.leg.category).toBe('FIX');
  });

  it('returns undefined for records shorter than 132 characters', () => {
    const truncated = buildLegRecord().substring(0, 100);
    expect(decodePrimaryLegRecord(truncated)).toBe(undefined);
  });

  it('returns undefined for non-Standard (T prefix) records', () => {
    const raw = buildLegRecord({ 0: 'T' });
    expect(decodePrimaryLegRecord(raw)).toBe(undefined);
  });

  it('accepts non-USA customer codes', () => {
    // CIFP publishes Canadian / Pacific / Latin American procedures too
    const raw = buildLegRecord({ 1: 'CAN' });
    assert(decodePrimaryLegRecord(raw) !== undefined);
  });

  it('returns undefined for heliport (H) section records', () => {
    const raw = buildLegRecord({ 4: 'H' });
    expect(decodePrimaryLegRecord(raw)).toBe(undefined);
  });

  it('returns undefined for unknown subsection codes', () => {
    const raw = buildLegRecord({ 12: 'X' });
    expect(decodePrimaryLegRecord(raw)).toBe(undefined);
  });

  it('recognizes SID, STAR, and IAP subsections', () => {
    const sid = decodePrimaryLegRecord(buildLegRecord({ 12: 'D' }));
    const star = decodePrimaryLegRecord(buildLegRecord({ 12: 'E' }));
    const iap = decodePrimaryLegRecord(buildLegRecord({ 12: 'F' }));
    expect(sid?.procedureType).toBe('SID');
    expect(star?.procedureType).toBe('STAR');
    expect(iap?.procedureType).toBe('IAP');
  });

  it('returns undefined for continuation records', () => {
    // Continuation number 2 = first continuation record
    const raw = buildLegRecord({ 38: '2' });
    expect(decodePrimaryLegRecord(raw)).toBe(undefined);
  });

  it('returns undefined for unknown path terminators', () => {
    const raw = buildLegRecord({ 47: 'XX' });
    expect(decodePrimaryLegRecord(raw)).toBe(undefined);
  });

  it('decodes an altitude constraint with single altitude', () => {
    const raw = buildLegRecord({
      82: '+', // at or above
      84: '03000', // 3000 ft
    });
    const decoded = decodePrimaryLegRecord(raw);
    assert(decoded !== undefined);
    expect(decoded.leg.altitudeConstraint).toEqual({
      descriptor: '+',
      primaryFt: 3000,
    });
  });

  it('decodes an altitude constraint with primary and secondary altitudes', () => {
    const raw = buildLegRecord({
      82: 'B', // between
      84: '05000',
      89: '03000',
    });
    const decoded = decodePrimaryLegRecord(raw);
    assert(decoded !== undefined);
    expect(decoded.leg.altitudeConstraint).toEqual({
      descriptor: 'B',
      primaryFt: 5000,
      secondaryFt: 3000,
    });
  });

  it('decodes FL flight-level altitudes as hundreds of feet', () => {
    const raw = buildLegRecord({
      82: '+',
      84: 'FL180',
    });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.altitudeConstraint?.primaryFt).toBe(18000);
  });

  it('omits the altitude constraint when the descriptor is blank', () => {
    const raw = buildLegRecord({ 84: '03000' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.altitudeConstraint).toBe(undefined);
  });

  it('decodes a speed constraint with an explicit descriptor', () => {
    const raw = buildLegRecord({
      99: '250',
      117: '-',
    });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.speedConstraint).toEqual({
      descriptor: '-',
      speedKt: 250,
    });
  });

  it('defaults a blank speed descriptor to at-or-below', () => {
    const raw = buildLegRecord({ 99: '180' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.speedConstraint?.descriptor).toBe('-');
  });

  it('decodes magnetic course from the 4-character field', () => {
    const raw = buildLegRecord({ 70: '2238', 47: 'CF' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.courseDeg).toBe(223.8);
    expect(decoded?.leg.courseIsTrue).toBe(undefined);
  });

  it('decodes true bearing courses (T suffix)', () => {
    const raw = buildLegRecord({ 70: '090T', 47: 'CF' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.courseDeg).toBe(9);
    expect(decoded?.leg.courseIsTrue).toBe(true);
  });

  it('decodes a distance in nautical miles', () => {
    const raw = buildLegRecord({ 74: '0060', 47: 'CF' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.distanceNm).toBe(6);
    expect(decoded?.leg.holdTimeMin).toBe(undefined);
  });

  it('decodes a holding-pattern time (T prefix)', () => {
    const raw = buildLegRecord({ 74: 'T010', 47: 'HM' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.holdTimeMin).toBe(1);
    expect(decoded?.leg.distanceNm).toBe(undefined);
  });

  it('sets the FAF flag from the waypoint description code (index 3 = F)', () => {
    const raw = buildLegRecord({ 39: 'E  F' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.isFinalApproachFix).toBe(true);
  });

  it('sets the MAP flag from the waypoint description code (index 3 = M)', () => {
    const raw = buildLegRecord({ 39: 'GY M' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.isMissedApproachPoint).toBe(true);
    expect(decoded?.leg.isFlyover).toBe(true); // index 1 = Y
  });

  it('sets the IAF flag from the waypoint description code (index 3 = A)', () => {
    const raw = buildLegRecord({ 39: 'E  A' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.isInitialApproachFix).toBe(true);
  });

  it('sets the FACF flag from the waypoint description code (index 3 = I)', () => {
    const raw = buildLegRecord({ 39: 'E  I' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.isFinalApproachCourseFix).toBe(true);
  });

  it('sets the flyover flag from index 1 = B', () => {
    const raw = buildLegRecord({ 39: 'EB  ' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.isFlyover).toBe(true);
  });

  it('decodes the turn direction', () => {
    const left = decodePrimaryLegRecord(buildLegRecord({ 43: 'L' }));
    const right = decodePrimaryLegRecord(buildLegRecord({ 43: 'R' }));
    expect(left?.leg.turnDirection).toBe('L');
    expect(right?.leg.turnDirection).toBe('R');
  });

  it('ignores unknown turn direction characters', () => {
    const raw = buildLegRecord({ 43: 'E' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.turnDirection).toBe(undefined);
  });

  it('decodes RNP values with the mantissa / negated-exponent encoding', () => {
    // 101 = 10 * 10^-1 = 1.0 NM
    const rnp1 = decodePrimaryLegRecord(buildLegRecord({ 44: '101' }));
    expect(rnp1?.leg.rnpNm).toBe(1);
    // 303 = 30 * 10^-3 = 0.03 NM
    const rnp003 = decodePrimaryLegRecord(buildLegRecord({ 44: '303' }));
    expect(rnp003?.leg.rnpNm).toBe(0.03);
  });

  it('decodes the recommended navaid with its region', () => {
    const raw = buildLegRecord({ 50: 'IHIQ', 54: 'K6' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.recommendedNavaid).toBe('IHIQ');
    expect(decoded?.leg.recommendedNavaidIcaoRegionCode).toBe('K6');
  });

  it('decodes theta (bearing) and rho (distance) to the recommended navaid', () => {
    const raw = buildLegRecord({ 62: '2238', 66: '0125' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.thetaDeg).toBe(223.8);
    expect(decoded?.leg.rhoNm).toBe(12.5);
  });

  it('populates centerFix only for RF (constant radius arc) legs', () => {
    const cfLeg = decodePrimaryLegRecord(buildLegRecord({ 47: 'CF', 106: 'JFK  ', 112: 'K6' }));
    expect(cfLeg?.leg.centerFix).toBe(undefined);

    const rfLeg = decodePrimaryLegRecord(buildLegRecord({ 47: 'RF', 106: 'JFK  ', 112: 'K6' }));
    expect(rfLeg?.leg.centerFix).toBe('JFK');
    expect(rfLeg?.leg.centerFixIcaoRegionCode).toBe('K6');
  });

  it('omits fix fields on a legless leg (e.g. VA heading-to-altitude)', () => {
    const raw = buildLegRecord({
      29: '     ', // no fix
      34: '  ', // no ICAO
      36: '  ', // no section
      47: 'VA',
    });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.leg.fixIdentifier).toBe(undefined);
    expect(decoded?.leg.lat).toBe(undefined);
    expect(decoded?.leg.lon).toBe(undefined);
    expect(decoded?.leg.category).toBe(undefined);
  });

  it('flags startsEmbeddedMissedApproach when description code index 2 = M', () => {
    const raw = buildLegRecord({ 39: '  M ' });
    const decoded = decodePrimaryLegRecord(raw);
    expect(decoded?.startsEmbeddedMissedApproach).toBe(true);
  });

  it('maps fix section codes to the expected categories', () => {
    const cases: Array<[string, string]> = [
      ['EA', 'FIX'],
      ['PC', 'FIX'],
      ['D ', 'NAVAID'],
      ['DB', 'NAVAID'],
      ['PI', 'NAVAID'],
      ['PN', 'NAVAID'],
      ['PA', 'AIRPORT'],
      ['PG', 'RUNWAY'],
    ];
    for (const [section, expected] of cases) {
      const decoded = decodePrimaryLegRecord(buildLegRecord({ 36: section }));
      expect(decoded?.leg.category, `section ${section}`).toBe(expected);
    }
  });
});

describe('isFirstMissedApproachLeg', () => {
  it('returns true when description code index 2 is M', () => {
    expect(isFirstMissedApproachLeg('  M ')).toBe(true);
    expect(isFirstMissedApproachLeg('E M ')).toBe(true);
  });

  it('returns false when index 2 is not M', () => {
    expect(isFirstMissedApproachLeg('E  F')).toBe(false);
    expect(isFirstMissedApproachLeg('E   ')).toBe(false);
  });

  it('returns false for a description code shorter than 3 characters', () => {
    expect(isFirstMissedApproachLeg('')).toBe(false);
    expect(isFirstMissedApproachLeg('E')).toBe(false);
    expect(isFirstMissedApproachLeg('EB')).toBe(false);
  });
});
