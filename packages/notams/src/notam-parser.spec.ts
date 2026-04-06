import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotam } from './notam-parser.js';

// ---------------------------------------------------------------------------
// Sample NOTAMs - constructed in ICAO format using real-world content from
// FAA NOTAM data for KANC, KATL, KBOS, and KHNL airports.
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

// Taxiway closure at Anchorage (from KANC 12/228)
const ANC_TAXIWAY_CLOSURE = [
  'A2228/25 NOTAMN',
  'Q) PAZA/QMXLC/IV/NBO/A/000/999/6110N14948W005',
  'A) PANC',
  'B) 2512111503',
  'C) 2605312200',
  'E) TWY Q, TWY R BTN ALASKA CARGO PORT RAMP AND TWY Q CLSD',
].join('\n');

// Apron condition report at Anchorage (from KANC 04/026)
const ANC_APRON_FICON = [
  'A0026/26 NOTAMN',
  'Q) PAZA/QMNXX/IV/NBO/A/000/999/6110N14948W005',
  'A) PANC',
  'B) 2604051041',
  'C) 2604061041',
  'E) APRON ALL FICON - PATCHY ICE AND PATCHY WET OBS AT 2604051041.',
].join('\n');

// Obstacle crane at Atlanta (from KATL 03/437)
const ATL_OBSTACLE = [
  'A0437/26 NOTAMN',
  'Q) KZAT/QOBCE/IV/M/AE/000/012/3337N08426W005',
  'A) KATL',
  'B) 2603311951',
  'C) 2608311200',
  'E) OBST CRANE (ASN 2025-ASO-10025-NRA) 333744N0842609W (0.6NM SW ATL) 1152FT (155FT AGL) FLAGGED AND LGTD',
].join('\n');

// Airspace UAS at Atlanta (from KATL 04/024)
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

// ILS RWY with inner marker out of service at Atlanta (from FDC 6/1928)
const ATL_ILS_NOTAM = [
  'A1928/26 NOTAMN',
  'Q) KZAT/QICAS/I/NBO/A/000/999/3338N08426W005',
  'A) KATL',
  'B) 2603201955',
  'C) 2610301955 EST',
  'E) ILS RWY 9R (CAT II-III), AMDT 20. CAT II NA EXCEPT FOR AIRCRAFT EQUIPPED WITH RADIO ALTIMETER. I-FUN INNER MARKER OUT OF SERVICE.',
].join('\n');

// Obstacle tower at Boston (from KBOS 04/043)
const BOS_OBSTACLE_TOWER = [
  'A0043/26 NOTAMN',
  'Q) KZBW/QOBCE/IV/M/AE/000/005/4225N07105W005',
  'A) KBOS',
  'B) 2604021116',
  'C) 2604171016',
  'E) OBST TOWER LGT (ASR 1017974) 422550.00N0710520.00W (5.4NM NW BOS) 428.8FT (252.6FT AGL) U/S',
].join('\n');

// Runway closure with phone number at Boston (from KBOS 04/101)
const BOS_RUNWAY_PHONE = [
  'A0101/26 NOTAMN',
  'Q) KZBW/QMRLC/IV/NBO/A/000/999/4221N07100W005',
  'A) KBOS',
  'B) 2604060220',
  'C) 2604060900',
  'E) RWY 04L/22R CLSD EXC TAX 30MIN PPR 617-561-1919',
].join('\n');

// Airspace UAS at Boston (from KBOS 01/502)
const BOS_AIRSPACE_UAS = [
  'A0502/26 NOTAMN',
  'Q) KZBW/QAALC/IV/NBO/W/000/004/4217N07121W005',
  'A) KBOS',
  'B) 2601190001',
  'C) 2607312359',
  'E) AIRSPACE UAS WI AN AREA DEFINED AS .5NM RADIUS OF 421722N0712148W (9.5NM NW OWD) SFC-400FT AGL',
  'F) SFC',
  'G) 400FT AGL',
].join('\n');

// Obstacle crane at Honolulu (from KHNL 11/343)
const HNL_OBSTACLE_CRANE = [
  'A0343/23 NOTAMN',
  'Q) PHNL/QOBCE/IV/M/AE/000/004/2121N15757W005',
  'A) PHNL',
  'B) 2311302236',
  'C) 2812312359',
  'E) OBST CRANE (ASN 2021-AWP-13793-OE) 212109N1575757W (3.7NM NW HNL) 395FT (395FT AGL) U/S',
].join('\n');

// Declared distances at Honolulu (from KHNL 05/347)
const HNL_DECLARED_DIST = [
  'A0347/25 NOTAMN',
  'Q) PHNL/QMRXX/IV/NBO/A/000/999/2121N15757W005',
  'A) PHNL',
  'B) 2505241947',
  'C) PERM',
  'E) RWY 04R/22L CHANGED TO 9002FT X 150FT. DECLARED DIST: RWY 04R TORA 9002FT TODA 9002FT ASDA 8950FT LDA 8950FT. RWY 22L TORA 9002FT TODA 9002FT ASDA 8937FT LDA 8937FT.',
].join('\n');

// STAR not authorized at Honolulu (from KHNL FDC 5/2652)
const HNL_STAR_NOT_AUTH = [
  'A2652/25 NOTAMN',
  'Q) PHNL/QSTXX/IV/NBO/AE/000/999/2121N15757W025',
  'A) PHNL',
  'B) 2512312251',
  'C) 2612312359',
  'E) STAR DANIEL K INOUYE INTL AIRPORT, HONOLULU HI. SHLAE ONE ARRIVAL NOT AUTHORIZED',
].join('\n');

// Controlled burn with nav warning scope at Atlanta (from KATL 03/213)
const ATL_CONTROLLED_BURN = [
  'A0213/26 NOTAMN',
  'Q) KZAT/QWLLW/IV/NBO/W/000/020/3338N08426W005',
  'A) KATL',
  'B) 2603121638',
  'C) 2611191700',
  'E) AIRSPACE CONTROLLED BURN WI AN AREA DEFINED AS .5NM RADIUS OF ATL SFC-2000FT AGL',
  'F) SFC',
  'G) 2000FT AGL',
].join('\n');

// Replacement NOTAM - ILS procedure change at Atlanta (from FDC 6/1924)
const ATL_REPLACEMENT = [
  'A1924/26 NOTAMR A1900/26',
  'Q) KZAT/QICAS/I/NBO/A/000/999/3338N08426W005',
  'A) KATL',
  'B) 2603201954',
  'C) 2610301953 EST',
  'E) ILS RWY 27L (CAT II), AMDT 19. PROCEDURE NA EXCEPT FOR ACFT EQUIPPED WITH RADIO ALTIMETER. I-FSQ INNER MARKER OUT OF SERVICE.',
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

// Estimated end time - navaid outage
const ESTIMATED_END = [
  'A0321/26 NOTAMN',
  'Q) KZNY/QNALO/IV/NBO/E/000/999/4038N07347W010',
  'A) KZNY',
  'B) 2603010800',
  'C) 2604010800 EST',
  'E) VOR TNK U/S',
].join('\n');

// Until Further Notice
const UFN_NOTAM = [
  'A0500/26 NOTAMN',
  'Q) KZNY/QNALO/IV/NBO/E/000/999/4038N07347W010',
  'A) KZNY',
  'B) 2603010800',
  'C) UFN',
  'E) VOR JFK U/S DURING MAINTENANCE',
].join('\n');

// NOTAM without Q-line (valid per ICAO when Q-line cannot be encoded)
const NO_Q_LINE = [
  'A9999/24 NOTAMN',
  'A) KJFK',
  'B) 2401010000',
  'C) 2401312359',
  'E) EXAMPLE NOTAM WITHOUT Q LINE',
].join('\n');

// NOTAM without items F and G
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

// NOTAM with short serial number (1 digit)
const SHORT_ID = [
  'A1/26 NOTAMN',
  'Q) PAZA/QMRLC/IV/NBO/A/000/999/6110N14948W005',
  'A) PANC',
  'B) 2601010000',
  'C) 2601012359',
  'E) RWY 07L/25R CLSD',
].join('\n');

// NOTAM with long serial number (5 digits)
const LONG_ID = [
  'A12345/26 NOTAMN',
  'Q) LFFF/QMRLC/IV/NBO/A/000/999/4900N00220E005',
  'A) LFPG',
  'B) 2601010000',
  'C) 2601012359',
  'E) RWY 08L/26R CLSD',
].join('\n');

// NOTAM with eastern hemisphere coordinates
const EASTERN_HEMISPHERE = [
  'A0200/26 NOTAMN',
  'Q) LFFF/QMRLC/IV/NBO/A/000/999/4900N00220E005',
  'A) LFPG',
  'B) 2604010600',
  'C) 2604302359',
  'E) RWY 09R/27L CLSD FOR MAINTENANCE',
  'F) SFC',
  'G) UNL',
].join('\n');

// NOTAM with southern hemisphere coordinates
const SOUTHERN_HEMISPHERE = [
  'A0300/26 NOTAMN',
  'Q) FAJS/QMRLC/IV/NBO/A/000/999/2608S02812E010',
  'A) FAOR',
  'B) 2604010600',
  'C) 2604302359',
  'E) RWY 03L/21R CLSD FOR RESURFACING',
  'F) SFC',
  'G) UNL',
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

// Checklist traffic type
const CHECKLIST = [
  'A0001/26 NOTAMN',
  'Q) KZNY/QKKKK/K/K/A/000/999/4038N07347W999',
  'A) KJFK',
  'B) 2601010000',
  'C) 2601312359',
  'E) CHECKLIST YEAR=2026 0001-0050 LATEST PUBLICATIONS',
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

// NOTAM with schedule (Item D) and daily pattern
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

// Navaid TACAN outage at Honolulu (from KHNL 02/122)
const HNL_TACAN_OUTAGE = [
  'A0122/26 NOTAMN',
  'Q) PHNL/QNALT/IV/NBO/E/000/999/2121N15757W025',
  'A) PHNL',
  'B) 2602092104',
  'C) 2612312359 EST',
  'E) NAV TACAN AZM U/S',
].join('\n');

// NOTAM with AW scope
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseNotam - basic parsing', () => {
  it('throws on empty input', () => {
    assert.throws(() => parseNotam(''), /Empty NOTAM string/);
  });

  it('throws on invalid header', () => {
    assert.throws(() => parseNotam('not a notam at all'), /Unable to parse NOTAM header/);
  });

  it('preserves the raw string', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.equal(result.raw, ANC_RUNWAY_CLOSURE);
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

  it('parses different series letters', () => {
    const result = parseNotam(NO_FG_ITEMS);
    assert.equal(result.id, 'B0987/24');
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

  it('parses subject and condition codes', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.subjectCode, 'MR');
    assert.equal(result.qualifier.conditionCode, 'LC');
  });

  it('parses traffic type as IFR_VFR for IV qualifier', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
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

  it('parses purpose codes', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.purpose, 'NBO');
  });

  it('parses aerodrome scope', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'AERODROME');
  });

  it('parses en route scope', () => {
    const result = parseNotam(ESTIMATED_END);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'ENROUTE');
  });

  it('parses navigation warning scope', () => {
    const result = parseNotam(ATL_CONTROLLED_BURN);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'NAV_WARNING');
  });

  it('parses aerodrome+enroute scope', () => {
    const result = parseNotam(ATL_OBSTACLE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'AERODROME_ENROUTE');
  });

  it('parses aerodrome+warning scope', () => {
    const result = parseNotam(AW_SCOPE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'AERODROME_WARNING');
  });

  it('parses lower and upper altitude limits', () => {
    const result = parseNotam(WITH_SCHEDULE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.lowerFt, 5000);
    assert.equal(result.qualifier.upperFt, 35000);
  });

  it('omits lowerFt when surface (000)', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.lowerFt, undefined);
    assert.equal(result.qualifier.upperFt, 99900);
  });

  it('parses western hemisphere coordinates', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.ok(result.qualifier);
    const lat = result.qualifier.coordinates.lat;
    const lon = result.qualifier.coordinates.lon;
    assert.ok(lat > 61.0 && lat < 61.3, `expected lat near 61.17, got ${lat}`);
    assert.ok(lon < -149.7 && lon > -150.0, `expected lon near -149.8, got ${lon}`);
    assert.equal(result.qualifier.radiusNm, 5);
  });

  it('parses eastern hemisphere coordinates', () => {
    const result = parseNotam(EASTERN_HEMISPHERE);
    assert.ok(result.qualifier);
    assert.ok(result.qualifier.coordinates.lat > 48.9, 'expected lat near 49');
    assert.ok(
      result.qualifier.coordinates.lon > 2.2 && result.qualifier.coordinates.lon < 2.5,
      'expected lon near 2.33',
    );
    assert.equal(result.qualifier.radiusNm, 5);
  });

  it('parses southern hemisphere coordinates', () => {
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
});

describe('parseNotam - items A and B', () => {
  it('parses location code', () => {
    const result = parseNotam(ANC_RUNWAY_CLOSURE);
    assert.equal(result.locationCode, 'PANC');
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
    assert.equal(result.locationCode, 'KJFK KLGA KEWR');
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

  it('parses a permanent NOTAM', () => {
    const result = parseNotam(HNL_DECLARED_DIST);
    assert.equal(result.effectiveUntil, undefined);
    assert.equal(result.isPermanent, true);
    assert.equal(result.isEstimatedEnd, false);
    assert.equal(result.isUntilFurtherNotice, false);
  });

  it('parses an estimated end time', () => {
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

  it('parses ILS procedure text', () => {
    const result = parseNotam(ATL_ILS_NOTAM);
    assert.ok(result.text.includes('ILS RWY 9R (CAT II-III)'));
    assert.ok(result.text.includes('I-FUN INNER MARKER OUT OF SERVICE'));
  });

  it('parses long multi-sentence text', () => {
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

  it('parses text with phone numbers', () => {
    const result = parseNotam(BOS_RUNWAY_PHONE);
    assert.ok(result.text.includes('617-561-1919'));
  });

  it('parses declared distances text', () => {
    const result = parseNotam(HNL_DECLARED_DIST);
    assert.ok(result.text.includes('DECLARED DIST'));
    assert.ok(result.text.includes('RWY 04R TORA 9002FT'));
  });

  it('parses FICON text with observation timestamp', () => {
    const result = parseNotam(ANC_APRON_FICON);
    assert.ok(result.text.includes('FICON'));
    assert.ok(result.text.includes('PATCHY ICE'));
    assert.ok(result.text.includes('OBS AT 2604051041'));
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
    assert.equal(result.locationCode, 'KJFK');
    assert.equal(result.text, 'EXAMPLE NOTAM WITHOUT Q LINE');
  });

  it('handles single-line NOTAM', () => {
    const result = parseNotam(SINGLE_LINE);
    assert.equal(result.id, 'A1000/24');
    assert.equal(result.locationCode, 'KJFK');
    assert.equal(result.text, 'RWY 13L/31R CLSD');
  });

  it('handles NOTAM with TACAN outage and estimated end', () => {
    const result = parseNotam(HNL_TACAN_OUTAGE);
    assert.equal(result.text, 'NAV TACAN AZM U/S');
    assert.equal(result.isEstimatedEnd, true);
    assert.ok(result.effectiveUntil);
    assert.equal(result.effectiveUntil.year, 26);
  });

  it('handles NOTAM with STAR procedure text', () => {
    const result = parseNotam(HNL_STAR_NOT_AUTH);
    assert.ok(result.text.includes('SHLAE ONE ARRIVAL NOT AUTHORIZED'));
  });

  it('handles airspace UAS NOTAM with small radius', () => {
    const result = parseNotam(ATL_AIRSPACE_UAS);
    assert.ok(result.qualifier);
    assert.equal(result.qualifier.scope, 'NAV_WARNING');
    assert.ok(result.text.includes('UAS'));
  });

  it('handles obstacle tower with ASR number', () => {
    const result = parseNotam(BOS_OBSTACLE_TOWER);
    assert.equal(result.locationCode, 'KBOS');
    assert.ok(result.text.includes('OBST TOWER LGT (ASR 1017974)'));
    assert.ok(result.text.includes('428.8FT (252.6FT AGL) U/S'));
  });

  it('handles airspace UAS with defined area', () => {
    const result = parseNotam(BOS_AIRSPACE_UAS);
    assert.ok(result.text.includes('.5NM RADIUS'));
    assert.equal(result.lowerLimit, 'SFC');
    assert.equal(result.upperLimit, '400FT AGL');
  });

  it('handles obstacle crane with long effective period', () => {
    const result = parseNotam(HNL_OBSTACLE_CRANE);
    assert.equal(result.id, 'A0343/23');
    assert.ok(result.text.includes('395FT (395FT AGL)'));
    assert.ok(result.effectiveUntil);
    assert.equal(result.effectiveUntil.year, 28);
  });
});
