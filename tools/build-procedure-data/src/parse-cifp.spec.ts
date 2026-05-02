import { describe, it, expect, assert } from 'vitest';
import {
  buildFixIndex,
  composeName,
  findEmbeddedMissedApproachStart,
  isCommonRouteRouteType,
} from './parse-cifp.js';
import type { DecodedLegRecord } from './decode-leg.js';
import type { ProcedureLeg } from '@squawk/types';

/**
 * Builds a 132-character ARINC 424 record from field-keyed overrides.
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
 * Builds a PC (airport terminal waypoint) record with the given airport
 * region, waypoint region, and coordinates.
 */
function buildPcRecord(params: {
  airport: string;
  airportRegion: string;
  fixIdent: string;
  waypointRegion: string;
  lat: string; // 9 chars
  lon: string; // 10 chars
}): string {
  return buildRecord({
    0: 'S',
    1: 'USA',
    4: 'P',
    6: params.airport,
    10: params.airportRegion,
    12: 'C',
    13: params.fixIdent,
    19: params.waypointRegion,
    21: '0',
    32: params.lat,
    41: params.lon,
  });
}

/**
 * Builds an enroute airway waypoint (EA) record.
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

/**
 * Builds a VHF navaid (D) record. `voroLat`/`voroLon` can be blank to
 * test fallback to the DME coordinates.
 */
function buildVhfNavaidRecord(params: {
  ident: string;
  region: string;
  vorLat: string; // 9 chars or 9 spaces
  vorLon: string; // 10 chars or 10 spaces
  dmeLat: string;
  dmeLon: string;
}): string {
  return buildRecord({
    0: 'S',
    1: 'USA',
    4: 'D',
    13: params.ident,
    19: params.region,
    21: '0',
    32: params.vorLat,
    41: params.vorLon,
    55: params.dmeLat,
    64: params.dmeLon,
  });
}

/**
 * Builds an NDB navaid (DB) record.
 */
function buildNdbRecord(params: {
  ident: string;
  region: string;
  lat: string;
  lon: string;
}): string {
  return buildRecord({
    0: 'S',
    1: 'USA',
    4: 'D',
    5: 'B',
    13: params.ident,
    19: params.region,
    21: '0',
    32: params.lat,
    41: params.lon,
  });
}

/**
 * Builds an airport (PA) record.
 */
function buildAirportRecord(params: {
  airport: string;
  region: string;
  lat: string;
  lon: string;
}): string {
  return buildRecord({
    0: 'S',
    1: 'USA',
    4: 'P',
    6: params.airport,
    10: params.region,
    12: 'A',
    21: '0',
    32: params.lat,
    41: params.lon,
  });
}

/**
 * Builds a runway (PG) record with blank waypoint-region at r[19:21]
 * (runways never populate the waypoint-region slot - the index falls
 * back to the airport's region).
 */
function buildRunwayRecord(params: {
  airport: string;
  airportRegion: string;
  runwayIdent: string;
  lat: string;
  lon: string;
}): string {
  return buildRecord({
    0: 'S',
    1: 'USA',
    4: 'P',
    6: params.airport,
    10: params.airportRegion,
    12: 'G',
    13: params.runwayIdent,
    21: '0',
    32: params.lat,
    41: params.lon,
  });
}

describe('buildFixIndex', () => {
  it('indexes a terminal waypoint (PC) by the waypoint own region, not the airport region', () => {
    // 02G airport is in region K5, but its terminal waypoint FEYPU is in K6.
    // The procedure leg reference uses r[34:36] which is the fix's own region,
    // so the index must key by r[19:21] (waypoint's region).
    const record = buildPcRecord({
      airport: '02G ',
      airportRegion: 'K5',
      fixIdent: 'FEYPU',
      waypointRegion: 'K6',
      lat: 'N40455575',
      lon: 'W080253243',
    });
    const index = buildFixIndex([record]);
    assert(index.has('FEYPU::K6::PC'), 'expected index under waypoint region K6');
    expect(index.has('FEYPU::K5::PC'), 'must not index under airport region K5').toBe(false);
  });

  it('falls back to the airport region when the waypoint region is blank (PG/PI/PN)', () => {
    // Runways never populate r[19:21]; we must index them by the airport's region.
    const record = buildRunwayRecord({
      airport: 'KJFK',
      airportRegion: 'K6',
      runwayIdent: 'RW04L',
      lat: 'N40372318',
      lon: 'W073470505',
    });
    const index = buildFixIndex([record]);
    assert(index.has('RW04L::K6::PG'), 'expected runway indexed under airport region');
  });

  it('dual-indexes NDB (DB) records under both DB and PN section codes', () => {
    // CIFP publishes NDBs under section DB even when airport-associated,
    // but procedure legs at airports reference them via section PN.
    const record = buildNdbRecord({
      ident: 'AB  ',
      region: 'K4',
      lat: 'N32175591',
      lon: 'W099402722',
    });
    const index = buildFixIndex([record]);
    assert(index.has('AB::K4::DB'), 'expected DB section key');
    assert(index.has('AB::K4::PN'), 'expected PN section key (dual-index)');
    const dbEntry = index.get('AB::K4::DB');
    const pnEntry = index.get('AB::K4::PN');
    expect(dbEntry, 'DB and PN entries must point to the same coordinates').toEqual(pnEntry);
  });

  it('uses VOR lat/lon when populated (VHF navaid)', () => {
    const record = buildVhfNavaidRecord({
      ident: 'ABI ',
      region: 'K4',
      vorLat: 'N32285279',
      vorLon: 'W099514843',
      dmeLat: 'N32285279',
      dmeLon: 'W099514843',
    });
    const index = buildFixIndex([record]);
    const entry = index.get('ABI::K4::D ');
    assert(entry);
    // N32° 28' 52.79" = 32.481331
    assert(Math.abs(entry.lat - 32.481331) < 1e-4, `got ${entry.lat}`);
    // W99° 51' 48.43" = -99.863453
    assert(Math.abs(entry.lon - -99.863453) < 1e-4, `got ${entry.lon}`);
  });

  it('falls back to DME lat/lon when the VOR coordinates are blank (DME-only station)', () => {
    const record = buildVhfNavaidRecord({
      ident: 'AAT ',
      region: 'K2',
      vorLat: '         ',
      vorLon: '          ',
      dmeLat: 'N41290007',
      dmeLon: 'W120334155',
    });
    const index = buildFixIndex([record]);
    const entry = index.get('AAT::K2::D ');
    assert(entry, 'expected DME-only navaid to be indexed via fallback');
    assert(entry.lat > 41 && entry.lat < 42);
    assert(entry.lon < -120 && entry.lon > -121);
  });

  it('indexes enroute waypoints (EA) with FIX category', () => {
    const record = buildEaRecord({
      fixIdent: 'AAARG',
      region: 'K ',
      lat: 'N32413827',
      lon: 'W078030466',
    });
    const index = buildFixIndex([record]);
    const entry = index.get('AAARG::K::EA');
    assert(entry);
    expect(entry.category).toBe('FIX');
  });

  it('indexes airports (PA) with AIRPORT category', () => {
    const record = buildAirportRecord({
      airport: 'KJFK',
      region: 'K6',
      lat: 'N40382374',
      lon: 'W073464320',
    });
    const index = buildFixIndex([record]);
    const entry = index.get('KJFK::K6::PA');
    assert(entry);
    expect(entry.category).toBe('AIRPORT');
  });

  it('skips continuation records (continuation number not 0 or 1)', () => {
    const record = buildPcRecord({
      airport: 'KJFK',
      airportRegion: 'K6',
      fixIdent: 'TESTA',
      waypointRegion: 'K6',
      lat: 'N40000000',
      lon: 'W074000000',
    });
    const contRecord = record.substring(0, 21) + '2' + record.substring(22);
    const index = buildFixIndex([contRecord]);
    expect(index.size, 'continuation records must not populate the index').toBe(0);
  });

  it('skips records missing coordinates', () => {
    const record = buildPcRecord({
      airport: 'KJFK',
      airportRegion: 'K6',
      fixIdent: 'NOCOO',
      waypointRegion: 'K6',
      lat: '         ',
      lon: '          ',
    });
    const index = buildFixIndex([record]);
    expect(index.has('NOCOO::K6::PC')).toBe(false);
  });

  it('skips records shorter than 132 bytes or without an S prefix', () => {
    const short = buildEaRecord({
      fixIdent: 'SHORT',
      region: 'K',
      lat: 'N40000000',
      lon: 'W074000000',
    }).substring(0, 100);
    const badPrefix = buildEaRecord({
      fixIdent: 'BADPF',
      region: 'K',
      lat: 'N40000000',
      lon: 'W074000000',
    });
    const mutated = 'T' + badPrefix.substring(1);
    const index = buildFixIndex([short, mutated]);
    expect(index.has('SHORT::K::EA')).toBe(false);
    expect(index.has('BADPF::K::EA')).toBe(false);
  });
});

describe('isCommonRouteRouteType', () => {
  it('identifies SID common-route route types (2, 5, M, N)', () => {
    expect(isCommonRouteRouteType('SID', '2')).toBe(true);
    expect(isCommonRouteRouteType('SID', '5')).toBe(true);
    expect(isCommonRouteRouteType('SID', 'M')).toBe(true);
    expect(isCommonRouteRouteType('SID', 'N')).toBe(true);
  });

  it('rejects SID runway and enroute transition route types', () => {
    for (const rt of ['1', '4', 'F', 'R', 'T', '3', '6', 'S', 'V', 'P', '0']) {
      expect(isCommonRouteRouteType('SID', rt), `SID ${rt} should not be common`).toBe(false);
    }
  });

  it('identifies STAR common-route route types (2, 5, 8, M, N)', () => {
    expect(isCommonRouteRouteType('STAR', '2')).toBe(true);
    expect(isCommonRouteRouteType('STAR', '5')).toBe(true);
    expect(isCommonRouteRouteType('STAR', '8')).toBe(true);
    expect(isCommonRouteRouteType('STAR', 'M')).toBe(true);
    expect(isCommonRouteRouteType('STAR', 'N')).toBe(true);
  });

  it('rejects STAR runway and enroute transition route types', () => {
    for (const rt of ['1', '3', '4', '6', '7', '9', 'F', 'R', 'S', 'P']) {
      expect(isCommonRouteRouteType('STAR', rt), `STAR ${rt} should not be common`).toBe(false);
    }
  });

  it('returns false for IAPs (they use a different dispatch)', () => {
    expect(isCommonRouteRouteType('IAP', '2')).toBe(false);
    expect(isCommonRouteRouteType('IAP', 'A')).toBe(false);
  });
});

describe('findEmbeddedMissedApproachStart', () => {
  function makeRec(startsMap: boolean, sequence: number): DecodedLegRecord {
    const leg: ProcedureLeg = { pathTerminator: 'TF' };
    return {
      airport: 'X',
      airportIcaoRegionCode: 'X',
      procedureIdentifier: 'X',
      procedureType: 'IAP',
      routeType: 'I',
      transitionIdentifier: '',
      sequenceNumber: sequence,
      fixSectionCode: '  ',
      startsEmbeddedMissedApproach: startsMap,
      leg,
    };
  }

  it('returns -1 when no record carries the embedded-MAP flag', () => {
    const bucket = [makeRec(false, 10), makeRec(false, 20), makeRec(false, 30)];
    expect(findEmbeddedMissedApproachStart(bucket)).toBe(-1);
  });

  it('returns the index of the first flagged record', () => {
    const bucket = [makeRec(false, 10), makeRec(false, 20), makeRec(true, 30), makeRec(false, 40)];
    expect(findEmbeddedMissedApproachStart(bucket)).toBe(2);
  });

  it('returns 0 when the first record is already the MAP start', () => {
    const bucket = [makeRec(true, 10), makeRec(false, 20)];
    expect(findEmbeddedMissedApproachStart(bucket)).toBe(0);
  });

  it('returns -1 for an empty bucket', () => {
    expect(findEmbeddedMissedApproachStart([])).toBe(-1);
  });
});

describe('composeName', () => {
  function makeRec(type: 'SID' | 'STAR' | 'IAP', identifier: string): DecodedLegRecord {
    return {
      airport: 'KJFK',
      airportIcaoRegionCode: 'K6',
      procedureIdentifier: identifier,
      procedureType: type,
      routeType: 'I',
      transitionIdentifier: '',
      sequenceNumber: 10,
      fixSectionCode: '  ',
      startsEmbeddedMissedApproach: false,
      leg: { pathTerminator: 'IF' },
    };
  }

  function makeBuckets(routeType: string): Map<string, DecodedLegRecord[]> {
    const m = new Map<string, DecodedLegRecord[]>();
    m.set(routeType, [makeRec('IAP', 'I04L')]);
    return m;
  }

  it('uses the identifier as the name for SIDs', () => {
    const rec = makeRec('SID', 'AALLE4');
    expect(composeName(rec, new Map())).toBe('AALLE4');
  });

  it('uses the identifier as the name for STARs', () => {
    const rec = makeRec('STAR', 'NUBLE4');
    expect(composeName(rec, new Map())).toBe('NUBLE4');
  });

  it('composes an ILS approach name with the runway', () => {
    const rec = makeRec('IAP', 'I04L');
    expect(composeName(rec, makeBuckets('I'))).toBe('ILS RWY 04L');
  });

  it('composes an RNAV approach name with the runway', () => {
    const rec = makeRec('IAP', 'R13');
    expect(composeName(rec, makeBuckets('R'))).toBe('RNAV RWY 13');
  });

  it('composes a LOC backcourse approach name', () => {
    const rec = makeRec('IAP', 'B22');
    expect(composeName(rec, makeBuckets('B'))).toBe('LOC_BC RWY 22');
  });

  it('composes a runway name with sidedness and variant suffix', () => {
    const rec = makeRec('IAP', 'I04LY');
    expect(composeName(rec, makeBuckets('I'))).toBe('ILS RWY 04L');
  });
});
