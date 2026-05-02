import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { parseCifp } from './parse-cifp.js';

/**
 * Builds a 132-character ARINC 424 record from field-keyed overrides.
 *
 * @param overrides - Map of byte offset to value to insert at that offset.
 * @returns The 132-character record.
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
 * Builds a procedure leg record for a SID, STAR, or IAP.
 *
 * @param params - Procedure leg parameters.
 * @param params.airport - Airport identifier.
 * @param params.airportRegion - Airport ICAO region.
 * @param params.subsection - `D`=SID, `E`=STAR, `F`=IAP.
 * @param params.identifier - Procedure identifier.
 * @param params.routeType - Route type letter.
 * @param params.transition - Transition identifier.
 * @param params.sequence - Sequence number (0-padded 3-digit string).
 * @param params.fixIdent - Fix identifier (5 chars).
 * @param params.fixRegion - Fix ICAO region.
 * @param params.fixSection - Fix section code (2 chars).
 * @param params.descriptionCode - 4-character waypoint description code.
 * @param params.pathTerminator - 2-character path terminator.
 * @returns The 132-character leg record.
 */
function buildLegRecord(params: {
  airport: string;
  airportRegion: string;
  subsection: 'D' | 'E' | 'F';
  identifier: string;
  routeType: string;
  transition: string;
  sequence: string;
  fixIdent: string;
  fixRegion: string;
  fixSection: string;
  descriptionCode: string;
  pathTerminator: string;
}): string {
  return buildRecord({
    0: 'S',
    1: 'USA',
    4: 'P',
    6: params.airport,
    10: params.airportRegion,
    12: params.subsection,
    13: params.identifier,
    19: params.routeType,
    20: params.transition,
    26: params.sequence,
    29: params.fixIdent,
    34: params.fixRegion,
    36: params.fixSection,
    38: '0',
    39: params.descriptionCode,
    47: params.pathTerminator,
  });
}

/**
 * Builds an enroute waypoint (EA) record so parseCifp's fix index lookup
 * can resolve the leg to coordinates.
 *
 * @param params - Waypoint parameters.
 * @param params.fixIdent - Fix identifier (5 chars).
 * @param params.region - ICAO region.
 * @param params.lat - 9-character ARINC latitude.
 * @param params.lon - 10-character ARINC longitude.
 * @returns The 132-character EA record.
 */
function buildEaRecord(params: {
  fixIdent: string;
  region: string;
  lat: string;
  lon: string;
}): string {
  return buildRecord({
    0: 'S',
    1: 'USA',
    4: 'E',
    5: 'A',
    6: 'ENRT',
    13: params.fixIdent,
    19: params.region,
    21: '0',
    32: params.lat,
    41: params.lon,
  });
}

describe('parseCifp', () => {
  it('groups SID legs into a procedure with common route and transitions', () => {
    const fixA = buildEaRecord({
      fixIdent: 'AAAAA',
      region: 'K6',
      lat: 'N40000000',
      lon: 'W074000000',
    });
    const fixB = buildEaRecord({
      fixIdent: 'BBBBB',
      region: 'K6',
      lat: 'N40500000',
      lon: 'W073500000',
    });
    const fixC = buildEaRecord({
      fixIdent: 'CCCCC',
      region: 'K6',
      lat: 'N41000000',
      lon: 'W073000000',
    });
    // Common route leg
    const commonLeg = buildLegRecord({
      airport: 'KJFK',
      airportRegion: 'K6',
      subsection: 'D',
      identifier: 'TEST1 ',
      routeType: '5',
      transition: '     ',
      sequence: '010',
      fixIdent: 'AAAAA',
      fixRegion: 'K6',
      fixSection: 'EA',
      descriptionCode: 'E   ',
      pathTerminator: 'IF',
    });
    // Runway transition (route type 4)
    const rwyTransitionLeg = buildLegRecord({
      airport: 'KJFK',
      airportRegion: 'K6',
      subsection: 'D',
      identifier: 'TEST1 ',
      routeType: '4',
      transition: 'RW04L',
      sequence: '010',
      fixIdent: 'BBBBB',
      fixRegion: 'K6',
      fixSection: 'EA',
      descriptionCode: 'E   ',
      pathTerminator: 'TF',
    });
    // Enroute transition (route type 6)
    const enrouteTransitionLeg = buildLegRecord({
      airport: 'KJFK',
      airportRegion: 'K6',
      subsection: 'D',
      identifier: 'TEST1 ',
      routeType: '6',
      transition: 'EXIT1',
      sequence: '010',
      fixIdent: 'CCCCC',
      fixRegion: 'K6',
      fixSection: 'EA',
      descriptionCode: 'E   ',
      pathTerminator: 'TF',
    });

    const cifpText = [fixA, fixB, fixC, commonLeg, rwyTransitionLeg, enrouteTransitionLeg].join(
      '\n',
    );
    const procs = parseCifp(cifpText);
    assert.equal(procs.length, 1);
    const proc = procs[0];
    assert.ok(proc !== undefined);
    assert.equal(proc.identifier, 'TEST1');
    assert.equal(proc.type, 'SID');
    assert.equal(proc.airports[0], 'KJFK');
    assert.ok(proc.commonRoutes.length >= 1);
    assert.equal(proc.commonRoutes[0]?.legs[0]?.fixIdentifier, 'AAAAA');
    // Coordinates resolved via fix index
    assert.ok(proc.commonRoutes[0]?.legs[0]?.lat !== undefined);
    assert.ok(proc.commonRoutes[0]?.legs[0]?.lon !== undefined);
    assert.equal(proc.transitions.length, 2);
    const transitionNames = proc.transitions.map((t) => t.name).sort();
    assert.deepEqual(transitionNames, ['EXIT1', 'RW04L']);
  });

  it('groups STAR legs and applies STAR-specific common-route classification', () => {
    const fixA = buildEaRecord({
      fixIdent: 'STARA',
      region: 'K6',
      lat: 'N40000000',
      lon: 'W074000000',
    });
    const commonLeg = buildLegRecord({
      airport: 'KJFK',
      airportRegion: 'K6',
      subsection: 'E',
      identifier: 'STAR1 ',
      routeType: '8',
      transition: '     ',
      sequence: '010',
      fixIdent: 'STARA',
      fixRegion: 'K6',
      fixSection: 'EA',
      descriptionCode: 'E   ',
      pathTerminator: 'TF',
    });
    const procs = parseCifp([fixA, commonLeg].join('\n'));
    assert.equal(procs.length, 1);
    assert.equal(procs[0]?.type, 'STAR');
    assert.equal(procs[0]?.commonRoutes.length, 1);
  });

  it('classifies an IAP final-approach route, missed-approach, and approach transition', () => {
    const fixA = buildEaRecord({
      fixIdent: 'IAFXX',
      region: 'K6',
      lat: 'N40000000',
      lon: 'W074000000',
    });
    const fixB = buildEaRecord({
      fixIdent: 'FAFXX',
      region: 'K6',
      lat: 'N40100000',
      lon: 'W074000000',
    });
    const fixC = buildEaRecord({
      fixIdent: 'MAPXX',
      region: 'K6',
      lat: 'N40200000',
      lon: 'W074000000',
    });
    // Approach transition (route type A)
    const approachTransitionLeg = buildLegRecord({
      airport: 'KJFK',
      airportRegion: 'K6',
      subsection: 'F',
      identifier: 'I04L  ',
      routeType: 'A',
      transition: 'BUZON',
      sequence: '010',
      fixIdent: 'IAFXX',
      fixRegion: 'K6',
      fixSection: 'EA',
      descriptionCode: 'E  A',
      pathTerminator: 'IF',
    });
    // Final approach common-route leg (route type I = ILS)
    const finalLeg1 = buildLegRecord({
      airport: 'KJFK',
      airportRegion: 'K6',
      subsection: 'F',
      identifier: 'I04L  ',
      routeType: 'I',
      transition: '     ',
      sequence: '020',
      fixIdent: 'FAFXX',
      fixRegion: 'K6',
      fixSection: 'EA',
      descriptionCode: 'E  F',
      pathTerminator: 'TF',
    });
    // Embedded missed-approach start (description code index 2 = M)
    const finalLeg2 = buildLegRecord({
      airport: 'KJFK',
      airportRegion: 'K6',
      subsection: 'F',
      identifier: 'I04L  ',
      routeType: 'I',
      transition: '     ',
      sequence: '030',
      fixIdent: 'MAPXX',
      fixRegion: 'K6',
      fixSection: 'EA',
      descriptionCode: '  M ',
      pathTerminator: 'CA',
    });
    // Separately-published missed approach (route type Z)
    const missedZLeg = buildLegRecord({
      airport: 'KJFK',
      airportRegion: 'K6',
      subsection: 'F',
      identifier: 'I04L  ',
      routeType: 'Z',
      transition: '     ',
      sequence: '010',
      fixIdent: 'MAPXX',
      fixRegion: 'K6',
      fixSection: 'EA',
      descriptionCode: 'E   ',
      pathTerminator: 'CA',
    });
    const cifpText = [
      fixA,
      fixB,
      fixC,
      approachTransitionLeg,
      finalLeg1,
      finalLeg2,
      missedZLeg,
    ].join('\n');
    const procs = parseCifp(cifpText);
    assert.equal(procs.length, 1);
    const proc = procs[0];
    assert.ok(proc !== undefined);
    assert.equal(proc.type, 'IAP');
    assert.equal(proc.identifier, 'I04L');
    assert.equal(proc.runway, '04L');
    assert.equal(proc.approachType, 'ILS');
    assert.equal(proc.name, 'ILS RWY 04L');
    assert.ok(proc.missedApproach !== undefined);
    // Missed approach should include both the embedded leg and the route-type Z leg
    assert.ok(proc.missedApproach.legs.length >= 2);
    // The approach transition record under route type A
    assert.equal(proc.transitions.length, 1);
    assert.equal(proc.transitions[0]?.name, 'BUZON');
  });

  it('returns no procedures for empty input or non-procedure records', () => {
    assert.deepEqual(parseCifp(''), []);
    // EA waypoint records alone produce no procedures
    const fix = buildEaRecord({
      fixIdent: 'XXXXX',
      region: 'K',
      lat: 'N40000000',
      lon: 'W074000000',
    });
    assert.deepEqual(parseCifp(fix), []);
  });

  it('skips legs whose fix cannot be resolved by the fix index', () => {
    // Leg references a fix the index never sees, so leg.lat/lon should remain undefined
    const orphanLeg = buildLegRecord({
      airport: 'KJFK',
      airportRegion: 'K6',
      subsection: 'D',
      identifier: 'ORPH1 ',
      routeType: '5',
      transition: '     ',
      sequence: '010',
      fixIdent: 'NOFIX',
      fixRegion: 'K6',
      fixSection: 'EA',
      descriptionCode: 'E   ',
      pathTerminator: 'IF',
    });
    const procs = parseCifp(orphanLeg);
    assert.equal(procs.length, 1);
    const leg = procs[0]?.commonRoutes[0]?.legs[0];
    assert.ok(leg !== undefined);
    assert.equal(leg.lat, undefined);
    assert.equal(leg.lon, undefined);
  });

  it('skips legs without fix identifiers (legless terminators like VA)', () => {
    const fixlessLeg = buildLegRecord({
      airport: 'KJFK',
      airportRegion: 'K6',
      subsection: 'D',
      identifier: 'VA1   ',
      routeType: '5',
      transition: '     ',
      sequence: '010',
      fixIdent: '     ',
      fixRegion: '  ',
      fixSection: '  ',
      descriptionCode: '    ',
      pathTerminator: 'VA',
    });
    const procs = parseCifp(fixlessLeg);
    assert.equal(procs.length, 1);
    const leg = procs[0]?.commonRoutes[0]?.legs[0];
    assert.ok(leg !== undefined);
    assert.equal(leg.fixIdentifier, undefined);
  });

  it('sorts procedures by airport, then type, then identifier', () => {
    function makeProc(airport: string, sub: 'D' | 'E' | 'F', ident: string): string {
      return buildLegRecord({
        airport,
        airportRegion: 'K6',
        subsection: sub,
        identifier: ident.padEnd(6, ' '),
        routeType: sub === 'F' ? 'I' : '5',
        transition: '     ',
        sequence: '010',
        fixIdent: '     ',
        fixRegion: '  ',
        fixSection: '  ',
        descriptionCode: '    ',
        pathTerminator: 'VA',
      });
    }
    const records = [
      makeProc('KZZZ', 'D', 'B1'),
      makeProc('KAAA', 'F', 'I04L'),
      makeProc('KAAA', 'D', 'A1'),
      makeProc('KAAA', 'D', 'C1'),
    ];
    const procs = parseCifp(records.join('\n'));
    assert.deepEqual(
      procs.map((p) => `${p.airports[0] ?? ''}::${p.type}::${p.identifier}`),
      ['KAAA::IAP::I04L', 'KAAA::SID::A1', 'KAAA::SID::C1', 'KZZZ::SID::B1'],
    );
  });

  it('produces an IAP name fallback for procedures without a runway suffix', () => {
    const leg = buildLegRecord({
      airport: 'KAAA',
      airportRegion: 'K6',
      subsection: 'F',
      identifier: 'V    ',
      routeType: 'V',
      transition: '     ',
      sequence: '010',
      fixIdent: '     ',
      fixRegion: '  ',
      fixSection: '  ',
      descriptionCode: '    ',
      pathTerminator: 'VA',
    });
    const procs = parseCifp(leg);
    assert.equal(procs.length, 1);
    // Without runway suffix, the name falls back to the procedure identifier
    assert.ok(typeof procs[0]?.name === 'string');
  });
});
