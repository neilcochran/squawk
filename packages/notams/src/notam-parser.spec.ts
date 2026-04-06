import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotam } from './notam-parser.js';

// ---------------------------------------------------------------------------
// Sample NOTAMs - constructed in ICAO format using real-world content from
// FAA NOTAM data and international examples.
// ---------------------------------------------------------------------------

// Runway closure at Anchorage (from KANC 04/030)
const ANC_RUNWAY_CLOSURE = [
  'A0030/26 NOTAMN',
  'Q) PAZA/QMRLC/IV/NBO/A/000/999/6110N14948W005',
  'A) PANC',
  'B) 2604120730',
  'C) 2604121430',
  'E) RWY 07R/25L CLSD EXC XNG',
  'F) SFC',
  'G) UNL',
].join('\n');

// Taxiway closure - no F/G items
const ANC_TAXIWAY_CLOSURE = [
  'A2228/25 NOTAMN',
  'Q) PAZA/QMXLC/IV/NBO/A/000/999/6110N14948W005',
  'A) PANC',
  'B) 2512111503',
  'C) 2605312200',
  'E) TWY Q, TWY R BTN ALASKA CARGO PORT RAMP AND TWY Q CLSD',
].join('\n');

// Obstacle crane at Atlanta - AE scope, non-zero Q-line upper
const ATL_OBSTACLE = [
  'A0437/26 NOTAMN',
  'Q) KZAT/QOBCE/IV/M/AE/000/012/3337N08426W005',
  'A) KATL',
  'B) 2603311951',
  'C) 2608311200',
  'E) OBST CRANE (ASN 2025-ASO-10025-NRA) 333744N0842609W (0.6NM SW ATL) 1152FT (155FT AGL) FLAGGED AND LGTD',
].join('\n');

// Airspace UAS at Atlanta - W scope, AGL limits
const ATL_AIRSPACE_UAS = [
  'A0024/26 NOTAMN',
  'Q) KZAT/QAALC/IV/NBO/W/000/003/3333N08424W001',
  'A) KATL',
  'B) 2604111600',
  'C) 2604120200',
  'E) AIRSPACE NUMEROUS UAS WI AN AREA DEFINED AS .1NM RADIUS OF 333328N0842456W (5.3NM SE ATL) SFC-300FT AGL',
  'F) SFC',
  'G) 300FT AGL',
].join('\n');

// Replacement NOTAM with EST end time
const ATL_REPLACEMENT = [
  'A1924/26 NOTAMR A1900/26',
  'Q) KZAT/QICAS/I/NBO/A/000/999/3338N08426W005',
  'A) KATL',
  'B) 2603201954',
  'C) 2610301953 EST',
  'E) ILS RWY 27L (CAT II), AMDT 19.',
].join('\n');

// Cancellation NOTAM
const CANCELLATION = [
  'A1485/24 NOTAMC A1484/24',
  'Q) EGLL/QMRLC/IV/NBO/A/000/999/5129N00028W005',
  'A) EGLL',
  'B) 2404201400',
  'C) 2404202200',
  'E) RWY 09L/27R CLSD DUE TO RESURFACING CONSTRUCTION',
].join('\n');

// Estimated end time - navaid outage, E scope
const ESTIMATED_END = [
  'A0321/26 NOTAMN',
  'Q) KZNY/QNALO/IV/NBO/E/000/999/4038N07347W010',
  'A) KZNY',
  'B) 2603010800',
  'C) 2604010800 EST',
  'E) VOR TNK U/S',
].join('\n');

// Until further notice
const UFN_NOTAM = [
  'A0500/26 NOTAMN',
  'Q) KZNY/QNALO/IV/NBO/E/000/999/4038N07347W010',
  'A) KZNY',
  'B) 2603010800',
  'C) UFN',
  'E) VOR JFK U/S DURING MAINTENANCE',
].join('\n');

// Permanent NOTAM
const HNL_DECLARED_DIST = [
  'A0347/25 NOTAMN',
  'Q) PHNL/QMRXX/IV/NBO/A/000/999/2121N15757W005',
  'A) PHNL',
  'B) 2505241947',
  'C) PERM',
  'E) RWY 04R/22L CHANGED TO 9002FT X 150FT.',
].join('\n');

// NOTAM without Q-line (valid per ICAO when Q-line cannot be encoded)
const NO_Q_LINE = [
  'A9999/24 NOTAMN',
  'A) KJFK',
  'B) 2401010000',
  'C) 2401312359',
  'E) EXAMPLE NOTAM WITHOUT Q LINE',
].join('\n');

// B series with schedule (Item D), no F/G items
const NO_FG_ITEMS = [
  'B0987/24 NOTAMN',
  'Q) EGSS/QABXX/IV/NBO/A/000/015/5200N00015E003',
  'A) EGSS',
  'B) 2404100600',
  'C) 2404302359',
  'D) MON-FRI 0700-1700',
  'E) CRANE OPERATING HGT 450FT AGL AT 52 02 44N 000 15 32E',
].join('\n');

// NOTAM with Item E containing text that looks like item delimiters
const ITEM_E_WITH_DELIMITERS = [
  'A0100/26 NOTAMN',
  'Q) KZAT/QMXLC/IV/NBO/A/000/999/3338N08426W005',
  'A) KATL',
  'B) 2604060213',
  'C) 2604061000',
  'E) TWY A, B, E, K WIP. TWY C BTN CATEGORY A) AND CATEGORY B) ACFT RESTRICTED.',
  'F) SFC',
  'G) UNL',
].join('\n');

// Single-line NOTAM
const SINGLE_LINE =
  'A1000/24 NOTAMN Q) KZNY/QMRLC/IV/NBO/A/000/999/4038N07347W010 A) KJFK B) 2401010000 C) 2401012359 E) RWY 13L/31R CLSD';

// 1-digit serial number
const SHORT_ID = [
  'A1/26 NOTAMN',
  'Q) PAZA/QMRLC/IV/NBO/A/000/999/6110N14948W005',
  'A) PANC',
  'B) 2601010000',
  'C) 2601012359',
  'E) RWY 07L/25R CLSD',
].join('\n');

// 5-digit serial number
const LONG_ID = [
  'A12345/26 NOTAMN',
  'Q) LFFF/QMRLC/IV/NBO/A/000/999/4900N00220E005',
  'A) LFPG',
  'B) 2601010000',
  'C) 2601012359',
  'E) RWY 08L/26R CLSD',
].join('\n');

// Eastern hemisphere coordinates (N/E)
const EASTERN_HEMISPHERE = [
  'A0200/26 NOTAMN',
  'Q) LFFF/QMRLC/IV/NBO/A/000/999/4900N00220E005',
  'A) LFPG',
  'B) 2604010600',
  'C) 2604302359',
  'E) RWY 09R/27L CLSD FOR MAINTENANCE',
].join('\n');

// Southern hemisphere, eastern longitude (S/E)
const SOUTHERN_HEMISPHERE = [
  'A0300/26 NOTAMN',
  'Q) FAJS/QMRLC/IV/NBO/A/000/999/2608S02812E010',
  'A) FAOR',
  'B) 2604010600',
  'C) 2604302359',
  'E) RWY 03L/21R CLSD FOR RESURFACING',
].join('\n');

// Southern hemisphere, western longitude (S/W)
const SW_HEMISPHERE = [
  'A0400/26 NOTAMN',
  'Q) SBGL/QMRLC/IV/NBO/A/000/999/2249S04314W010',
  'A) SBGL',
  'B) 2604010600',
  'C) 2604302359',
  'E) RWY 10/28 CLSD FOR MAINTENANCE',
].join('\n');

// IFR-only traffic type
const IFR_ONLY = [
  'A0077/26 NOTAMN',
  'Q) KZNY/QICAS/I/NBO/A/000/999/4038N07347W010',
  'A) KJFK',
  'B) 2604010000',
  'C) 2604302359',
  'E) ILS RWY 04L CAT III NA',
].join('\n');

// VFR-only traffic type
const VFR_ONLY = [
  'A0078/26 NOTAMN',
  'Q) KZAT/QARLC/V/NBO/A/000/999/3338N08426W005',
  'A) KATL',
  'B) 2604010000',
  'C) 2604302359',
  'E) VFR PATTERN NOT AUTHORIZED DUE TO CONSTRUCTION',
].join('\n');

// VI traffic type (reverse order of IV)
const VI_TRAFFIC = [
  'A0079/26 NOTAMN',
  'Q) KZNY/QMRLC/VI/NBO/A/000/999/4038N07347W010',
  'A) KJFK',
  'B) 2604010000',
  'C) 2604302359',
  'E) RWY 04R/22L CLSD',
].join('\n');

// Checklist traffic type
const CHECKLIST = [
  'A0001/26 NOTAMN',
  'Q) KZNY/QKKKK/K/K/A/000/999/4038N07347W999',
  'A) KJFK',
  'B) 2601010000',
  'C) 2601312359',
  'E) CHECKLIST YEAR=2026 0001-0050 LATEST PUBLICATIONS',
].join('\n');

// Unknown traffic type code (defaults to IFR_VFR)
const UNKNOWN_TRAFFIC = [
  'A0903/26 NOTAMN',
  'Q) KZNY/QMRLC/X/NBO/A/000/999/4038N07347W010',
  'A) KJFK',
  'B) 2604010000',
  'C) 2604302359',
  'E) SPECIAL CONDITIONS APPLY',
].join('\n');

// EW scope (enroute + warning)
const EW_SCOPE = [
  'A0601/26 NOTAMN',
  'Q) KZNY/QWELW/IV/NBO/EW/000/180/4038N07347W010',
  'A) KZNY',
  'B) 2604010000',
  'C) 2604012359',
  'E) AIRSPACE TFR IN EFFECT',
  'F) SFC',
  'G) FL180',
].join('\n');

// AEW scope (aerodrome + enroute + warning)
const AEW_SCOPE = [
  'A0602/26 NOTAMN',
  'Q) KZNY/QFAXX/IV/NBO/AEW/000/999/4038N07347W050',
  'A) KJFK',
  'B) 2604010000',
  'C) 2604012359',
  'E) SPECIAL NOTICE ALL OPERATIONS',
].join('\n');

// AW scope (aerodrome + warning)
const AW_SCOPE = [
  'A0600/26 NOTAMN',
  'Q) KZNY/QWELW/IV/NBO/AW/000/180/4038N07347W010',
  'A) KZNY',
  'B) 2604010000',
  'C) 2604012359',
  'E) AIRSPACE HAZARDOUS WX ADVISORY',
  'F) SFC',
  'G) FL180',
].join('\n');

// Unknown scope code (defaults to AERODROME)
const UNKNOWN_SCOPE = [
  'A0904/26 NOTAMN',
  'Q) KZNY/QMRLC/IV/NBO/X/000/999/4038N07347W010',
  'A) KJFK',
  'B) 2604010000',
  'C) 2604302359',
  'E) SPECIAL CONDITIONS APPLY',
].join('\n');

// Long Item E text - ODP procedure (from KBOS FDC 5/7941)
const LONG_TEXT = [
  'A7941/26 NOTAMN',
  'Q) KZBW/QPXXX/IV/NBO/A/000/999/4221N07100W010',
  'A) KBOS',
  'B) 2510081405',
  'C) 2710081405 EST',
  'E) ODP GENERAL EDWARD LAWRENCE LOGAN INTL, BOSTON, MA. TAKEOFF MINIMUMS AND (OBSTACLE) DEPARTURE PROCEDURES AMDT 15. NOTE: RWY 04L IN ADDITION TO EXISTING TAKEOFF OBSTACLE NOTES, ADD: TREE 3930 FT FROM DER, 1367 FT LEFT OF CENTERLINE, 172 FT MSL. TREES, SMOKESTACKS, POLES, BUILDINGS, TRAVERSE WAY BEGINNING 3972 FT FROM DER, 476 FT LEFT OF CENTERLINE, UP TO 74 FT AGL/198 FT MSL. TREES, POLE BEGINNING 4344 FT FROM DER, 1034 FT LEFT OF CENTERLINE, UP TO 202 FT MSL. TREES, POLE, BUILDING BEGINNING 4386 FT FROM DER, 755 FT LEFT OF CENTERLINE, UP TO 183 FT MSL.',
].join('\n');

// NOTAM with schedule (Item D) and FL limits
const WITH_SCHEDULE = [
  'A1856/24 NOTAMN',
  'Q) KZNY/QNALO/IV/NBO/E/050/350/4000N07400W025',
  'A) KZNY',
  'B) 2404151000',
  'C) 2404161000',
  'D) MON-FRI 1000-1600 EXCEPT 26',
  'E) VOR JFK INOP DURING MAINTENANCE',
  'F) FL050',
  'G) FL350',
].join('\n');

// Multi-location Item A
const MULTI_LOCATION = [
  'A0555/26 NOTAMN',
  'Q) KZNY/QFAXX/IV/NBO/AE/000/999/4038N07347W050',
  'A) KJFK KLGA KEWR',
  'B) 2604010000',
  'C) 2604012359',
  'E) SPECIAL SECURITY NOTICE. ALL AIRCRAFT OPERATIONS WITHIN THE NYC TERMINAL AREA ARE SUBJECT TO ADDITIONAL SECURITY PROCEDURES.',
].join('\n');

// C-series NOTAM ID (Canadian)
const C_SERIES = [
  'C0156/26 NOTAMN',
  'Q) CZUL/QMRLC/IV/NBO/A/000/999/4527N07339W005',
  'A) CYUL',
  'B) 2604010000',
  'C) 2604302359',
  'E) RWY 06L/24R CLSD',
].join('\n');

// Non-standard Q-code (3 chars instead of 5) - empty subject/condition codes
const SHORT_QCODE = [
  'A0700/26 NOTAMN',
  'Q) KZNY/QMR/IV/NBO/A/000/999/4038N07347W010',
  'A) KJFK',
  'B) 2604010000',
  'C) 2604302359',
  'E) SPECIAL CONDITION',
].join('\n');

// Q-line with invalid coordinate field - qualifier becomes undefined
const INVALID_QCOORDS = [
  'A0901/26 NOTAMN',
  'Q) KZNY/QMRLC/IV/NBO/A/000/999/INVALID',
  'A) KJFK',
  'B) 2604010000',
  'C) 2604012359',
  'E) RWY CLSD',
].join('\n');

// No Item C at all (not PERM, not UFN, just absent)
const NO_ITEM_C = [
  'A0800/26 NOTAMN',
  'Q) KZNY/QMRLC/IV/NBO/A/000/999/4038N07347W010',
  'A) KJFK',
  'B) 2604010000',
  'E) RWY 04L/22R CLSD FOR EMERGENCY REPAIRS',
].join('\n');

// CRLF line endings
const CRLF_FORMAT = [
  'A0900/26 NOTAMN',
  'Q) KZNY/QMRLC/IV/NBO/A/000/999/4038N07347W010',
  'A) KJFK',
  'B) 2604010000',
  'C) 2604012359',
  'E) RWY 13R/31L CLSD',
].join('\r\n');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseNotam - basic parsing', () => {
  it('throws on empty input', () => {
    assert.throws(() => parseNotam(''), /Empty NOTAM string/);
  });

  it('throws on whitespace-only input', () => {
    assert.throws(() => parseNotam('   \n  \t  '), /Empty NOTAM string/);
  });

  it('throws on invalid header', () => {
    assert.throws(() => parseNotam('not a notam at all'), /Unable to parse NOTAM header/);
  });

  it('preserves the raw string', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.equal(result.raw, ANC_RUNWAY_CLOSURE);
  });

  it('handles \\r\\n line endings', () => {
    const result = parseNotam(CRLF_FORMAT);
    assert.equal(result.id, 'A0900/26');
    assert.deepEqual(result.locationCodes, ['KJFK']);
    assert.equal(result.text, 'RWY 13R/31L CLSD');
  });
});

describe('parseNotam - header and action', () => {
  it('parses a new NOTAM (NOTAMN)', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.equal(result.id, 'A0030/26');
    assert.equal(result.action, 'NEW');
    assert.equal(result.referencedId, undefined);
  });

  it('parses a replacement NOTAM (NOTAMR)', () => {
    const result = parseNotam(ATL_REPLACEMENT);
    assert.equal(result.id, 'A1924/26');
    assert.equal(result.action, 'REPLACE');
    assert.equal(result.referencedId, 'A1900/26');
  });

  it('parses a cancellation NOTAM (NOTAMC)', () => {
    const result = parseNotam(CANCELLATION);
    assert.equal(result.id, 'A1485/24');
    assert.equal(result.action, 'CANCEL');
    assert.equal(result.referencedId, 'A1484/24');
  });

  it('parses a 1-digit serial number', () => {
    const result = parseNotam(SHORT_ID);
    assert.equal(result.id, 'A1/26');
  });

  it('parses a 5-digit serial number', () => {
    const result = parseNotam(LONG_ID);
    assert.equal(result.id, 'A12345/26');
  });

  it('parses B-series NOTAM ID', () => {
    const result = parseNotam(NO_FG_ITEMS);
    assert.equal(result.id, 'B0987/24');
  });

  it('parses C-series NOTAM ID', () => {
    const result = parseNotam(C_SERIES);
    assert.equal(result.id, 'C0156/26');
    assert.deepEqual(result.locationCodes, ['CYUL']);
  });
});

describe('parseNotam - Q-line qualifier', () => {
  it('parses FIR identifier', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.fir, 'PAZA');
  });

  it('parses the full NOTAM code', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.notamCode, 'QMRLC');
  });

  it('parses subject and condition codes from a 5-letter Q-code', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.subjectCode, 'MR');
    assert.equal(result.qualifier.conditionCode, 'LC');
  });

  it('defaults subject and condition codes to XX for non-5-letter Q-code', () => {
    const result = parseNotam(SHORT_QCODE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.notamCode, 'QMR');
    assert.equal(result.qualifier.subjectCode, 'XX');
    assert.equal(result.qualifier.conditionCode, 'XX');
  });

  it('parses IV traffic type as IFR_VFR', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.trafficType, 'IFR_VFR');
  });

  it('parses VI traffic type as IFR_VFR', () => {
    const result = parseNotam(VI_TRAFFIC);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.trafficType, 'IFR_VFR');
  });

  it('parses IFR-only traffic type', () => {
    const result = parseNotam(IFR_ONLY);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.trafficType, 'IFR');
  });

  it('parses VFR-only traffic type', () => {
    const result = parseNotam(VFR_ONLY);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.trafficType, 'VFR');
  });

  it('parses checklist traffic type', () => {
    const result = parseNotam(CHECKLIST);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.trafficType, 'CHECKLIST');
  });

  it('defaults unknown traffic type to IFR_VFR', () => {
    const result = parseNotam(UNKNOWN_TRAFFIC);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.trafficType, 'IFR_VFR');
  });

  it('parses purpose codes', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.qualifier);
    assert.deepEqual(result.qualifier.purposes, ['N', 'B', 'O']);
  });

  it('parses aerodrome scope (A)', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'AERODROME');
  });

  it('parses en route scope (E)', () => {
    const result = parseNotam(ESTIMATED_END);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'ENROUTE');
  });

  it('parses navigation warning scope (W)', () => {
    const result = parseNotam(ATL_AIRSPACE_UAS);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'NAV_WARNING');
  });

  it('parses aerodrome+enroute scope (AE)', () => {
    const result = parseNotam(ATL_OBSTACLE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'AERODROME_ENROUTE');
  });

  it('parses aerodrome+warning scope (AW)', () => {
    const result = parseNotam(AW_SCOPE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'AERODROME_WARNING');
  });

  it('parses enroute+warning scope (EW)', () => {
    const result = parseNotam(EW_SCOPE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'ENROUTE_WARNING');
  });

  it('parses aerodrome+enroute+warning scope (AEW)', () => {
    const result = parseNotam(AEW_SCOPE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'AERODROME_ENROUTE_WARNING');
  });

  it('defaults unknown scope to AERODROME', () => {
    const result = parseNotam(UNKNOWN_SCOPE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'AERODROME');
  });

  it('parses non-zero lower and upper altitude limits', () => {
    const result = parseNotam(WITH_SCHEDULE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.lowerFt, 5000);
    assert.equal(result.qualifier.upperFt, 35000);
  });

  it('omits lowerFt when surface (000) and parses 999 as 99900', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.lowerFt, undefined);
    assert.equal(result.qualifier.upperFt, 99900);
  });

  it('parses northern/western hemisphere coordinates', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.qualifier);
    const { lat, lon } = result.qualifier.coordinates;
    assert.ok(lat > 61.0 && lat < 61.3, `expected lat near 61.17, got ${lat}`);
    assert.ok(lon < -149.7 && lon > -150.0, `expected lon near -149.8, got ${lon}`);
    assert.equal(result.qualifier.radiusNm, 5);
  });

  it('parses northern/eastern hemisphere coordinates', () => {
    const result = parseNotam(EASTERN_HEMISPHERE);
    assert.ok(result.qualifier);
    assert.ok(result.qualifier.coordinates.lat > 48.9, 'expected lat near 49');
    assert.ok(
      result.qualifier.coordinates.lon > 2.2 && result.qualifier.coordinates.lon < 2.5,
      'expected lon near 2.33',
    );
    assert.equal(result.qualifier.radiusNm, 5);
  });

  it('parses southern/eastern hemisphere coordinates', () => {
    const result = parseNotam(SOUTHERN_HEMISPHERE);
    assert.ok(result.qualifier);
    assert.ok(
      result.qualifier.coordinates.lat < -26.0,
      'expected negative lat for southern hemisphere',
    );
    assert.ok(
      result.qualifier.coordinates.lon > 28.0,
      'expected positive lon for eastern hemisphere',
    );
    assert.equal(result.qualifier.radiusNm, 10);
  });

  it('parses southern/western hemisphere coordinates', () => {
    const result = parseNotam(SW_HEMISPHERE);
    assert.ok(result.qualifier);
    assert.ok(
      result.qualifier.coordinates.lat < -22.0,
      'expected negative lat for southern hemisphere',
    );
    assert.ok(
      result.qualifier.coordinates.lon < -43.0,
      'expected negative lon for western hemisphere',
    );
    assert.equal(result.qualifier.radiusNm, 10);
  });

  it('parses large radius value', () => {
    const result = parseNotam(CHECKLIST);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.radiusNm, 999);
  });

  it('sets qualifier to undefined when Q-line has invalid coordinates', () => {
    const result = parseNotam(INVALID_QCOORDS);
    assert.equal(result.qualifier, undefined);
    assert.deepEqual(result.locationCodes, ['KJFK']);
    assert.equal(result.text, 'RWY CLSD');
  });

  it('sets qualifier to undefined when Q-line is absent', () => {
    const result = parseNotam(NO_Q_LINE);
    assert.equal(result.qualifier, undefined);
  });
});

describe('parseNotam - items A and B', () => {
  it('parses location code', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.deepEqual(result.locationCodes, ['PANC']);
  });

  it('parses effective from datetime', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.equal(result.effectiveFrom.year, 26);
    assert.equal(result.effectiveFrom.month, 4);
    assert.equal(result.effectiveFrom.day, 12);
    assert.equal(result.effectiveFrom.hour, 7);
    assert.equal(result.effectiveFrom.minute, 30);
  });

  it('parses multi-location Item A', () => {
    const result = parseNotam(MULTI_LOCATION);
    assert.deepEqual(result.locationCodes, ['KJFK', 'KLGA', 'KEWR']);
  });

  it('throws when Item A is missing', () => {
    const noItemA = [
      'A1234/26 NOTAMN',
      'Q) KZNY/QMRLC/IV/NBO/A/000/999/4038N07347W010',
      'B) 2604010000',
      'C) 2604012359',
      'E) RWY CLSD',
    ].join('\n');
    assert.throws(() => parseNotam(noItemA), /Unable to parse NOTAM Item A/);
  });

  it('throws when Item B is missing', () => {
    const noItemB = ['A1234/26 NOTAMN', 'A) KJFK', 'C) 2604012359', 'E) RWY CLSD'].join('\n');
    assert.throws(() => parseNotam(noItemB), /Unable to parse NOTAM Item B/);
  });

  it('throws when Item B has invalid datetime', () => {
    const invalidItemB = [
      'A1234/26 NOTAMN',
      'A) KJFK',
      'B) ABCDEFGHIJ',
      'C) 2604012359',
      'E) RWY CLSD',
    ].join('\n');
    assert.throws(() => parseNotam(invalidItemB), /Unable to parse NOTAM Item B datetime/);
  });
});

describe('parseNotam - item C (effective until)', () => {
  it('parses a definite end time', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.effectiveUntil);
    assert.equal(result.effectiveUntil.year, 26);
    assert.equal(result.effectiveUntil.month, 4);
    assert.equal(result.effectiveUntil.day, 12);
    assert.equal(result.effectiveUntil.hour, 14);
    assert.equal(result.effectiveUntil.minute, 30);
    assert.equal(result.isEstimatedEnd, false);
    assert.equal(result.isPermanent, false);
    assert.equal(result.isUntilFurtherNotice, false);
  });

  it('parses a permanent NOTAM (PERM)', () => {
    const result = parseNotam(HNL_DECLARED_DIST);
    assert.equal(result.effectiveUntil, undefined);
    assert.equal(result.isPermanent, true);
    assert.equal(result.isEstimatedEnd, false);
    assert.equal(result.isUntilFurtherNotice, false);
  });

  it('parses an estimated end time (EST)', () => {
    const result = parseNotam(ESTIMATED_END);
    assert.ok(result.effectiveUntil);
    assert.equal(result.effectiveUntil.year, 26);
    assert.equal(result.effectiveUntil.month, 4);
    assert.equal(result.effectiveUntil.day, 1);
    assert.equal(result.isEstimatedEnd, true);
    assert.equal(result.isPermanent, false);
    assert.equal(result.isUntilFurtherNotice, false);
  });

  it('parses until further notice (UFN)', () => {
    const result = parseNotam(UFN_NOTAM);
    assert.equal(result.effectiveUntil, undefined);
    assert.equal(result.isUntilFurtherNotice, true);
    assert.equal(result.isPermanent, false);
    assert.equal(result.isEstimatedEnd, false);
  });

  it('handles absent Item C with all flags false and no effectiveUntil', () => {
    const result = parseNotam(NO_ITEM_C);
    assert.equal(result.effectiveUntil, undefined);
    assert.equal(result.isPermanent, false);
    assert.equal(result.isEstimatedEnd, false);
    assert.equal(result.isUntilFurtherNotice, false);
  });
});

describe('parseNotam - item D (schedule)', () => {
  it('parses schedule when present', () => {
    const result = parseNotam(WITH_SCHEDULE);
    assert.equal(result.schedule, 'MON-FRI 1000-1600 EXCEPT 26');
  });

  it('parses daily schedule', () => {
    const result = parseNotam(NO_FG_ITEMS);
    assert.equal(result.schedule, 'MON-FRI 0700-1700');
  });

  it('has no schedule when item D is absent', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.equal(result.schedule, undefined);
  });
});

describe('parseNotam - item E (text)', () => {
  it('parses runway closure text', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.equal(result.text, 'RWY 07R/25L CLSD EXC XNG');
  });

  it('parses obstacle text with coordinates and dimensions', () => {
    const result = parseNotam(ATL_OBSTACLE);
    assert.ok(result.text.includes('OBST CRANE'));
    assert.ok(result.text.includes('1152FT (155FT AGL)'));
    assert.ok(result.text.includes('FLAGGED AND LGTD'));
  });

  it('parses long multi-sentence text without truncation', () => {
    const result = parseNotam(LONG_TEXT);
    assert.ok(result.text.includes('ODP GENERAL EDWARD LAWRENCE LOGAN INTL'));
    assert.ok(result.text.includes('TREE 3930 FT FROM DER'));
    assert.ok(result.text.includes('UP TO 183 FT MSL.'));
  });

  it('does not truncate text containing item-delimiter-like patterns', () => {
    const result = parseNotam(ITEM_E_WITH_DELIMITERS);
    assert.ok(
      result.text.includes('CATEGORY A) AND CATEGORY B) ACFT RESTRICTED'),
      `expected full text with embedded delimiters, got: "${result.text}"`,
    );
  });

  it('throws when Item E is missing', () => {
    const noItemE = ['A1234/26 NOTAMN', 'A) KJFK', 'B) 2604010000', 'C) 2604012359'].join('\n');
    assert.throws(() => parseNotam(noItemE), /Unable to parse NOTAM Item E/);
  });
});

describe('parseNotam - items F and G (altitude limits)', () => {
  it('parses SFC and UNL limits', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.equal(result.lowerLimit, 'SFC');
    assert.equal(result.upperLimit, 'UNL');
  });

  it('parses flight level limits', () => {
    const result = parseNotam(WITH_SCHEDULE);
    assert.equal(result.lowerLimit, 'FL050');
    assert.equal(result.upperLimit, 'FL350');
  });

  it('parses AGL limits', () => {
    const result = parseNotam(ATL_AIRSPACE_UAS);
    assert.equal(result.lowerLimit, 'SFC');
    assert.equal(result.upperLimit, '300FT AGL');
  });

  it('omits limits when items F and G are absent', () => {
    const result = parseNotam(ANC_TAXIWAY_CLOSURE);
    assert.equal(result.lowerLimit, undefined);
    assert.equal(result.upperLimit, undefined);
  });
});

describe('parseNotam - edge cases', () => {
  it('handles NOTAM with no Q-line', () => {
    const result = parseNotam(NO_Q_LINE);
    assert.equal(result.id, 'A9999/24');
    assert.equal(result.qualifier, undefined);
    assert.deepEqual(result.locationCodes, ['KJFK']);
    assert.equal(result.text, 'EXAMPLE NOTAM WITHOUT Q LINE');
  });

  it('handles single-line NOTAM', () => {
    const result = parseNotam(SINGLE_LINE);
    assert.equal(result.id, 'A1000/24');
    assert.deepEqual(result.locationCodes, ['KJFK']);
    assert.equal(result.text, 'RWY 13L/31R CLSD');
    assert.ok(result.qualifier, 'expected qualifier from single-line Q-line');
    assert.equal(result.qualifier.fir, 'KZNY');
  });

  it('handles extra leading and trailing whitespace', () => {
    const padded = '  \n  ' + ANC_RUNWAY_CLOSURE + '  \n  ';
    const result = parseNotam(padded);
    assert.equal(result.id, 'A0030/26');
    assert.deepEqual(result.locationCodes, ['PANC']);
  });

  it('handles NOTAM with only required items (A, B, E) and no C', () => {
    const result = parseNotam(NO_ITEM_C);
    assert.equal(result.id, 'A0800/26');
    assert.deepEqual(result.locationCodes, ['KJFK']);
    assert.equal(result.text, 'RWY 04L/22R CLSD FOR EMERGENCY REPAIRS');
    assert.equal(result.effectiveUntil, undefined);
    assert.equal(result.schedule, undefined);
    assert.equal(result.lowerLimit, undefined);
    assert.equal(result.upperLimit, undefined);
  });
});
