import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
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
    assert.ok(decoded !== undefined);
    assert.equal(decoded.airport, 'KJFK');
    assert.equal(decoded.airportIcaoRegionCode, 'K6');
    assert.equal(decoded.procedureIdentifier, 'I04L');
    assert.equal(decoded.procedureType, 'IAP');
    assert.equal(decoded.routeType, 'I');
    assert.equal(decoded.sequenceNumber, 10);
    assert.equal(decoded.fixSectionCode, 'PC');
    assert.equal(decoded.leg.pathTerminator, 'IF');
    assert.equal(decoded.leg.fixIdentifier, 'AROKE');
    assert.equal(decoded.leg.icaoRegionCode, 'K6');
    assert.equal(decoded.leg.category, 'FIX');
  });

  it('returns undefined for records shorter than 132 characters', () => {
    const truncated = buildLegRecord().substring(0, 100);
    assert.equal(decodePrimaryLegRecord(truncated), undefined);
  });

  it('returns undefined for non-Standard (T prefix) records', () => {
    const raw = buildLegRecord({ 0: 'T' });
    assert.equal(decodePrimaryLegRecord(raw), undefined);
  });

  it('accepts non-USA customer codes', () => {
    // CIFP publishes Canadian / Pacific / Latin American procedures too
    const raw = buildLegRecord({ 1: 'CAN' });
    assert.ok(decodePrimaryLegRecord(raw) !== undefined);
  });

  it('returns undefined for heliport (H) section records', () => {
    const raw = buildLegRecord({ 4: 'H' });
    assert.equal(decodePrimaryLegRecord(raw), undefined);
  });

  it('returns undefined for unknown subsection codes', () => {
    const raw = buildLegRecord({ 12: 'X' });
    assert.equal(decodePrimaryLegRecord(raw), undefined);
  });

  it('recognizes SID, STAR, and IAP subsections', () => {
    const sid = decodePrimaryLegRecord(buildLegRecord({ 12: 'D' }));
    const star = decodePrimaryLegRecord(buildLegRecord({ 12: 'E' }));
    const iap = decodePrimaryLegRecord(buildLegRecord({ 12: 'F' }));
    assert.equal(sid?.procedureType, 'SID');
    assert.equal(star?.procedureType, 'STAR');
    assert.equal(iap?.procedureType, 'IAP');
  });

  it('returns undefined for continuation records', () => {
    // Continuation number 2 = first continuation record
    const raw = buildLegRecord({ 38: '2' });
    assert.equal(decodePrimaryLegRecord(raw), undefined);
  });

  it('returns undefined for unknown path terminators', () => {
    const raw = buildLegRecord({ 47: 'XX' });
    assert.equal(decodePrimaryLegRecord(raw), undefined);
  });

  it('decodes an altitude constraint with single altitude', () => {
    const raw = buildLegRecord({
      82: '+', // at or above
      84: '03000', // 3000 ft
    });
    const decoded = decodePrimaryLegRecord(raw);
    assert.ok(decoded !== undefined);
    assert.deepEqual(decoded.leg.altitudeConstraint, {
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
    assert.ok(decoded !== undefined);
    assert.deepEqual(decoded.leg.altitudeConstraint, {
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
    assert.equal(decoded?.leg.altitudeConstraint?.primaryFt, 18000);
  });

  it('omits the altitude constraint when the descriptor is blank', () => {
    const raw = buildLegRecord({ 84: '03000' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.altitudeConstraint, undefined);
  });

  it('decodes a speed constraint with an explicit descriptor', () => {
    const raw = buildLegRecord({
      99: '250',
      117: '-',
    });
    const decoded = decodePrimaryLegRecord(raw);
    assert.deepEqual(decoded?.leg.speedConstraint, {
      descriptor: '-',
      speedKt: 250,
    });
  });

  it('defaults a blank speed descriptor to at-or-below', () => {
    const raw = buildLegRecord({ 99: '180' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.speedConstraint?.descriptor, '-');
  });

  it('decodes magnetic course from the 4-character field', () => {
    const raw = buildLegRecord({ 70: '2238', 47: 'CF' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.courseDeg, 223.8);
    assert.equal(decoded?.leg.courseIsTrue, undefined);
  });

  it('decodes true bearing courses (T suffix)', () => {
    const raw = buildLegRecord({ 70: '090T', 47: 'CF' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.courseDeg, 9);
    assert.equal(decoded?.leg.courseIsTrue, true);
  });

  it('decodes a distance in nautical miles', () => {
    const raw = buildLegRecord({ 74: '0060', 47: 'CF' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.distanceNm, 6);
    assert.equal(decoded?.leg.holdTimeMin, undefined);
  });

  it('decodes a holding-pattern time (T prefix)', () => {
    const raw = buildLegRecord({ 74: 'T010', 47: 'HM' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.holdTimeMin, 1);
    assert.equal(decoded?.leg.distanceNm, undefined);
  });

  it('sets the FAF flag from the waypoint description code (index 3 = F)', () => {
    const raw = buildLegRecord({ 39: 'E  F' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.isFinalApproachFix, true);
  });

  it('sets the MAP flag from the waypoint description code (index 3 = M)', () => {
    const raw = buildLegRecord({ 39: 'GY M' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.isMissedApproachPoint, true);
    assert.equal(decoded?.leg.isFlyover, true); // index 1 = Y
  });

  it('sets the IAF flag from the waypoint description code (index 3 = A)', () => {
    const raw = buildLegRecord({ 39: 'E  A' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.isInitialApproachFix, true);
  });

  it('sets the FACF flag from the waypoint description code (index 3 = I)', () => {
    const raw = buildLegRecord({ 39: 'E  I' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.isFinalApproachCourseFix, true);
  });

  it('sets the flyover flag from index 1 = B', () => {
    const raw = buildLegRecord({ 39: 'EB  ' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.isFlyover, true);
  });

  it('decodes the turn direction', () => {
    const left = decodePrimaryLegRecord(buildLegRecord({ 43: 'L' }));
    const right = decodePrimaryLegRecord(buildLegRecord({ 43: 'R' }));
    assert.equal(left?.leg.turnDirection, 'L');
    assert.equal(right?.leg.turnDirection, 'R');
  });

  it('ignores unknown turn direction characters', () => {
    const raw = buildLegRecord({ 43: 'E' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.turnDirection, undefined);
  });

  it('decodes RNP values with the mantissa / negated-exponent encoding', () => {
    // 101 = 10 * 10^-1 = 1.0 NM
    const rnp1 = decodePrimaryLegRecord(buildLegRecord({ 44: '101' }));
    assert.equal(rnp1?.leg.rnpNm, 1);
    // 303 = 30 * 10^-3 = 0.03 NM
    const rnp003 = decodePrimaryLegRecord(buildLegRecord({ 44: '303' }));
    assert.equal(rnp003?.leg.rnpNm, 0.03);
  });

  it('decodes the recommended navaid with its region', () => {
    const raw = buildLegRecord({ 50: 'IHIQ', 54: 'K6' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.recommendedNavaid, 'IHIQ');
    assert.equal(decoded?.leg.recommendedNavaidIcaoRegionCode, 'K6');
  });

  it('decodes theta (bearing) and rho (distance) to the recommended navaid', () => {
    const raw = buildLegRecord({ 62: '2238', 66: '0125' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.thetaDeg, 223.8);
    assert.equal(decoded?.leg.rhoNm, 12.5);
  });

  it('populates centerFix only for RF (constant radius arc) legs', () => {
    const cfLeg = decodePrimaryLegRecord(buildLegRecord({ 47: 'CF', 106: 'JFK  ', 112: 'K6' }));
    assert.equal(cfLeg?.leg.centerFix, undefined);

    const rfLeg = decodePrimaryLegRecord(buildLegRecord({ 47: 'RF', 106: 'JFK  ', 112: 'K6' }));
    assert.equal(rfLeg?.leg.centerFix, 'JFK');
    assert.equal(rfLeg?.leg.centerFixIcaoRegionCode, 'K6');
  });

  it('omits fix fields on a legless leg (e.g. VA heading-to-altitude)', () => {
    const raw = buildLegRecord({
      29: '     ', // no fix
      34: '  ', // no ICAO
      36: '  ', // no section
      47: 'VA',
    });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.leg.fixIdentifier, undefined);
    assert.equal(decoded?.leg.lat, undefined);
    assert.equal(decoded?.leg.lon, undefined);
    assert.equal(decoded?.leg.category, undefined);
  });

  it('flags startsEmbeddedMissedApproach when description code index 2 = M', () => {
    const raw = buildLegRecord({ 39: '  M ' });
    const decoded = decodePrimaryLegRecord(raw);
    assert.equal(decoded?.startsEmbeddedMissedApproach, true);
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
      assert.equal(decoded?.leg.category, expected, `section ${section}`);
    }
  });
});

describe('isFirstMissedApproachLeg', () => {
  it('returns true when description code index 2 is M', () => {
    assert.equal(isFirstMissedApproachLeg('  M '), true);
    assert.equal(isFirstMissedApproachLeg('E M '), true);
  });

  it('returns false when index 2 is not M', () => {
    assert.equal(isFirstMissedApproachLeg('E  F'), false);
    assert.equal(isFirstMissedApproachLeg('E   '), false);
  });

  it('returns false for a description code shorter than 3 characters', () => {
    assert.equal(isFirstMissedApproachLeg(''), false);
    assert.equal(isFirstMissedApproachLeg('E'), false);
    assert.equal(isFirstMissedApproachLeg('EB'), false);
  });
});
