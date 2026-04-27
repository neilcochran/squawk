import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTaf } from './taf-parser.js';

// ---------------------------------------------------------------------------
// Inline TAF strings - formatted with realistic multi-line indentation
// matching actual NWS/API output (5-space continuation indent for change groups)
// ---------------------------------------------------------------------------

const BASIC = [
  'TAF KJFK 041730Z 0418/0524 21012KT P6SM FEW250',
  '     FM042200 24015G25KT P6SM SCT040 BKN080',
  '     FM050300 28008KT P6SM SCT100',
  '     FM051200 18006KT P6SM FEW200',
].join('\n');

const TEMPO_BECMG = [
  'TAF KORD 041730Z 0418/0524 23010KT P6SM SCT040 BKN100',
  '     TEMPO 0418/0422 5SM -TSRA BKN030CB',
  '     BECMG 0422/0424 30012KT P6SM SCT060',
  '     FM050200 33008KT P6SM FEW120',
  '     BECMG 0512/0514 18010KT SCT200',
].join('\n');

const PROB_GROUPS = [
  'TAF KATL 041730Z 0418/0524 18008KT P6SM FEW040 SCT120',
  '     PROB30 0420/0424 3SM TSRA BKN025CB',
  '     FM050000 22006KT P6SM SCT080',
  '     PROB40 TEMPO 0506/0510 2SM BR BKN010',
].join('\n');

const AMENDED = [
  'TAF AMD KSFO 041800Z 0418/0524 28015KT P6SM FEW015 SCT025',
  '     FM042100 30010KT P6SM OVC012',
  '     FM050300 VRB03KT 3SM BR OVC006',
  '     FM051500 27012KT P6SM SCT020',
].join('\n');

const CORRECTED = [
  'TAF COR KBOS 041745Z 0418/0524 05012KT P6SM BKN030',
  '     FM042100 07015G25KT 5SM -RA OVC015',
  '     FM050200 03008KT 2SM BR OVC008',
  '     FM051000 36010KT P6SM SCT030',
].join('\n');

const CANCELLED = 'TAF KMDW 041800Z 0418/0524 CNL';

const WIND_SHEAR = [
  'TAF KDEN 041730Z 0418/0524 25012G22KT P6SM FEW080 SCT150',
  '     WS020/27050KT',
  '     FM042200 28018G30KT P6SM FEW100',
  '     FM050600 VRB05KT P6SM SKC',
].join('\n');

const TURBULENCE_ICING = [
  'TAF KDEN 041730Z 0418/0524 27015G28KT P6SM FEW080 SCT150',
  '     520804 620304',
  '     FM042200 30012KT P6SM SCT100',
  '     FM050600 VRB05KT P6SM SKC',
].join('\n');

const NSW_SKC = [
  'TAF KLAX 041730Z 0418/0524 25008KT P6SM SCT015',
  '     FM042000 26010KT P6SM FEW020',
  '     TEMPO 0420/0424 3SM BR BKN012',
  '     FM050400 VRB03KT P6SM NSW SKC',
].join('\n');

const INTL_CAVOK = [
  'TAF LFPG 041700Z 0418/0524 25012KT 9999 SCT035',
  '     BECMG 0420/0422 CAVOK',
  '     FM050200 VRB03KT 3000 BR BKN004',
  '     BECMG 0508/0510 18008KT 8000 NSW SCT020',
  '     TEMPO 0514/0518 SHRA BKN025CB',
].join('\n');

const INTL_METERS = [
  'TAF RJTT 041700Z 0418/0524 18010KT 9999 FEW030 SCT060',
  '     BECMG 0420/0422 4000 BR BKN010',
  '     FM050200 VRB02KT 1500 FG OVC003',
  '     BECMG 0508/0510 18008KT 8000 NSW SCT015',
  '     TEMPO 0515/0520 3000 SHRA BKN020CB',
].join('\n');

const REAL_PANC = [
  'TAF PANC 042101Z 0421/0524 06005KT P6SM BKN100',
  '     FM050800 15004KT P6SM VCSH OVC040',
  '     FM051200 VRB03KT 6SM -SHSN OVC030',
  '     FM051800 34005KT P6SM VCSH SCT030 OVC045',
].join('\n');

const REAL_EGLL = [
  'TAF EGLL 042254Z 0500/0606 22018G35KT 9999 SCT035',
  '     BECMG 0500/0503 26012KT',
  '     PROB30 TEMPO 0500/0515 6000 SHRA',
  '     PROB30 TEMPO 0503/0516 26018G28KT',
  '     BECMG 0522/0601 VRB02KT',
  '     PROB30 0603/0606 8000',
].join('\n');

const MULTIPLE_FM = [
  'TAF KMSP 041730Z 0418/0524 16008KT P6SM SCT050 BKN100',
  '     FM041900 19012KT P6SM SCT040 BKN070',
  '     FM042200 21015G25KT 4SM -TSRA BKN030CB OVC060',
  '     FM050100 24012KT P6SM BKN080',
  '     FM050600 27008KT P6SM SCT100',
  '     FM051200 30010KT P6SM FEW150',
  '     FM051800 33006KT P6SM SKC',
].join('\n');

const TEMPO_MULTI = [
  'TAF KMEM 041730Z 0418/0524 22010KT P6SM SCT040 BKN100',
  '     TEMPO 0418/0422 3SM +TSRA BR BKN020CB',
  '     TEMPO 0422/0502 5SM -RASN BR BKN015 OVC025',
  '     FM050200 34012KT P6SM BKN050',
  '     TEMPO 0506/0512 2SM FZDZ BR OVC008',
].join('\n');

// ---------------------------------------------------------------------------
// Header parsing
// ---------------------------------------------------------------------------

describe('parseTaf - header', () => {
  it('parses station ID and issuance time', () => {
    const result = parseTaf(BASIC);
    assert.equal(result.stationId, 'KJFK');
    assert.equal(result.issuedAt.day, 4);
    assert.equal(result.issuedAt.hour, 17);
    assert.equal(result.issuedAt.minute, 30);
  });

  it('parses valid period', () => {
    const result = parseTaf(BASIC);
    assert.equal(result.validFrom.day, 4);
    assert.equal(result.validFrom.hour, 18);
    assert.equal(result.validTo.day, 5);
    assert.equal(result.validTo.hour, 24);
  });

  it('defaults to not amended and not corrected', () => {
    const result = parseTaf(BASIC);
    assert.equal(result.isAmended, false);
    assert.equal(result.isCorrected, false);
    assert.equal(result.isCancelled, false);
  });
});

// ---------------------------------------------------------------------------
// AMD and COR modifiers
// ---------------------------------------------------------------------------

describe('parseTaf - AMD and COR', () => {
  it('detects AMD modifier', () => {
    const result = parseTaf(AMENDED);
    assert.equal(result.isAmended, true);
    assert.equal(result.isCorrected, false);
    assert.equal(result.stationId, 'KSFO');
  });

  it('detects COR modifier', () => {
    const result = parseTaf(CORRECTED);
    assert.equal(result.isCorrected, true);
    assert.equal(result.isAmended, false);
    assert.equal(result.stationId, 'KBOS');
  });
});

// ---------------------------------------------------------------------------
// Cancelled TAF
// ---------------------------------------------------------------------------

describe('parseTaf - cancelled', () => {
  it('parses a cancelled TAF', () => {
    const result = parseTaf(CANCELLED);
    assert.equal(result.isCancelled, true);
    assert.equal(result.stationId, 'KMDW');
    assert.equal(result.forecast.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Base forecast
// ---------------------------------------------------------------------------

describe('parseTaf - base forecast', () => {
  it('parses wind in base forecast', () => {
    const result = parseTaf('TAF KJFK 041730Z 0418/0524 21012KT P6SM FEW250');
    assert.equal(result.forecast.length, 1);
    const base = result.forecast[0]!;
    assert.equal(base.changeType, undefined);
    assert.equal(base.wind?.directionDeg, 210);
    assert.equal(base.wind?.speedKt, 12);
    assert.equal(base.wind?.isVariable, false);
    assert.equal(base.wind?.isCalm, false);
  });

  it('parses gusty wind', () => {
    const result = parseTaf('TAF KDEN 041730Z 0418/0524 25012G22KT P6SM FEW080 SCT150');
    const base = result.forecast[0]!;
    assert.equal(base.wind?.speedKt, 12);
    assert.equal(base.wind?.gustKt, 22);
  });

  it('parses P6SM visibility as more-than 6 statute miles', () => {
    const result = parseTaf('TAF KJFK 041730Z 0418/0524 21012KT P6SM FEW250');
    const base = result.forecast[0]!;
    assert.equal(base.visibility?.visibilitySm, 6);
    assert.equal(base.visibility?.isMoreThan, true);
    assert.equal(base.visibility?.isLessThan, false);
  });

  it('parses regular statute mile visibility', () => {
    const result = parseTaf('TAF KMSP 041730Z 0418/0524 21015G25KT 4SM -TSRA BKN030CB OVC060');
    const base = result.forecast[0]!;
    assert.equal(base.visibility?.visibilitySm, 4);
    assert.equal(base.visibility?.isMoreThan, false);
  });

  it('parses ICAO meter visibility', () => {
    const result = parseTaf('TAF EGLL 042254Z 0500/0606 22018G35KT 9999 SCT035');
    const base = result.forecast[0]!;
    assert.equal(base.visibility?.visibilityM, 9999);
    assert.equal(base.visibility?.isMoreThan, false);
  });

  it('parses cloud layers', () => {
    const result = parseTaf('TAF KMSP 041730Z 0418/0524 16008KT P6SM SCT050 BKN100');
    const base = result.forecast[0]!;
    assert.equal(base.sky.layers.length, 2);
    assert.equal(base.sky.layers[0]!.coverage, 'SCT');
    assert.equal(base.sky.layers[0]!.altitudeFtAgl, 5000);
    assert.equal(base.sky.layers[1]!.coverage, 'BKN');
    assert.equal(base.sky.layers[1]!.altitudeFtAgl, 10000);
  });

  it('parses cloud layers with CB type', () => {
    const result = parseTaf('TAF KMSP 041730Z 0418/0524 21015G25KT 4SM -TSRA BKN030CB OVC060');
    const base = result.forecast[0]!;
    assert.equal(base.sky.layers[0]!.type, 'CB');
    assert.equal(base.sky.layers[0]!.altitudeFtAgl, 3000);
  });

  it('parses weather phenomena', () => {
    const result = parseTaf('TAF KMSP 041730Z 0418/0524 21015G25KT 4SM -TSRA BKN030CB OVC060');
    const base = result.forecast[0]!;
    assert.equal(base.weather.length, 1);
    assert.equal(base.weather[0]!.intensity, 'LIGHT');
    assert.equal(base.weather[0]!.descriptor, 'TS');
    assert.deepEqual(base.weather[0]!.phenomena, ['RA']);
  });

  it('parses VRB wind', () => {
    const result = parseTaf('TAF KLAX 041730Z 0418/0524 VRB03KT P6SM SKC');
    const base = result.forecast[0]!;
    assert.equal(base.wind?.isVariable, true);
    assert.equal(base.wind?.speedKt, 3);
    assert.equal(base.wind?.directionDeg, undefined);
  });

  it('parses SKC clear sky', () => {
    const result = parseTaf('TAF KLAX 041730Z 0418/0524 VRB03KT P6SM SKC');
    const base = result.forecast[0]!;
    assert.equal(base.sky.clear, 'SKC');
    assert.equal(base.sky.layers.length, 0);
  });
});

// ---------------------------------------------------------------------------
// FM groups
// ---------------------------------------------------------------------------

describe('parseTaf - FM groups', () => {
  it('parses FM group with time and weather', () => {
    const result = parseTaf(BASIC);
    assert.equal(result.forecast.length, 4);

    const fm1 = result.forecast[1]!;
    assert.equal(fm1.changeType, 'FM');
    assert.equal(fm1.start!.day, 4);
    assert.equal(fm1.start!.hour, 22);
    assert.equal(fm1.start!.minute, 0);
    assert.equal(fm1.wind?.directionDeg, 240);
    assert.equal(fm1.wind?.speedKt, 15);
    assert.equal(fm1.wind?.gustKt, 25);
    assert.equal(fm1.visibility?.visibilitySm, 6);
    assert.equal(fm1.visibility?.isMoreThan, true);
  });

  it('parses multiple consecutive FM groups', () => {
    const result = parseTaf(MULTIPLE_FM);

    // Base + 6 FM groups
    assert.equal(result.forecast.length, 7);

    const fm5 = result.forecast[5]!;
    assert.equal(fm5.changeType, 'FM');
    assert.equal(fm5.start!.day, 5);
    assert.equal(fm5.start!.hour, 12);
    assert.equal(fm5.start!.minute, 0);
    assert.equal(fm5.wind?.directionDeg, 300);

    const fm6 = result.forecast[6]!;
    assert.equal(fm6.start!.day, 5);
    assert.equal(fm6.start!.hour, 18);
    assert.equal(fm6.sky.clear, 'SKC');
  });

  it('has no endDay/endHour on FM groups', () => {
    const result = parseTaf(BASIC);
    const fm = result.forecast[1]!;
    assert.equal(fm.end, undefined);
  });
});

// ---------------------------------------------------------------------------
// TEMPO and BECMG groups
// ---------------------------------------------------------------------------

describe('parseTaf - TEMPO and BECMG groups', () => {
  it('parses TEMPO group with validity period', () => {
    const result = parseTaf(TEMPO_BECMG);

    const tempo = result.forecast[1]!;
    assert.equal(tempo.changeType, 'TEMPO');
    assert.equal(tempo.start!.day, 4);
    assert.equal(tempo.start!.hour, 18);
    assert.equal(tempo.end!.day, 4);
    assert.equal(tempo.end!.hour, 22);
    assert.equal(tempo.visibility?.visibilitySm, 5);
    assert.equal(tempo.weather[0]!.intensity, 'LIGHT');
    assert.equal(tempo.weather[0]!.descriptor, 'TS');
    assert.deepEqual(tempo.weather[0]!.phenomena, ['RA']);
    assert.equal(tempo.sky.layers[0]!.coverage, 'BKN');
    assert.equal(tempo.sky.layers[0]!.type, 'CB');
  });

  it('parses BECMG group with validity period', () => {
    const result = parseTaf(TEMPO_BECMG);

    const becmg = result.forecast[2]!;
    assert.equal(becmg.changeType, 'BECMG');
    assert.equal(becmg.start!.day, 4);
    assert.equal(becmg.start!.hour, 22);
    assert.equal(becmg.end!.day, 4);
    assert.equal(becmg.end!.hour, 24);
    assert.equal(becmg.wind?.directionDeg, 300);
    assert.equal(becmg.wind?.speedKt, 12);
  });

  it('parses BECMG with only wind (partial update)', () => {
    const result = parseTaf(TEMPO_BECMG);

    // Last BECMG: BECMG 0512/0514 18010KT SCT200
    const becmg2 = result.forecast[4]!;
    assert.equal(becmg2.changeType, 'BECMG');
    assert.equal(becmg2.wind?.directionDeg, 180);
    assert.equal(becmg2.wind?.speedKt, 10);
    assert.equal(becmg2.visibility, undefined);
  });

  it('parses multiple TEMPO groups with varied weather', () => {
    const result = parseTaf(TEMPO_MULTI);

    // TEMPO 0418/0422 3SM +TSRA BR BKN020CB
    const tempo1 = result.forecast[1]!;
    assert.equal(tempo1.changeType, 'TEMPO');
    assert.equal(tempo1.weather.length, 2);
    assert.equal(tempo1.weather[0]!.intensity, 'HEAVY');
    assert.equal(tempo1.weather[0]!.descriptor, 'TS');
    assert.deepEqual(tempo1.weather[0]!.phenomena, ['RA']);
    assert.deepEqual(tempo1.weather[1]!.phenomena, ['BR']);

    // TEMPO 0422/0502 5SM -RASN BR BKN015 OVC025
    const tempo2 = result.forecast[2]!;
    assert.equal(tempo2.weather[0]!.intensity, 'LIGHT');
    assert.deepEqual(tempo2.weather[0]!.phenomena, ['RA', 'SN']);
    assert.equal(tempo2.sky.layers.length, 2);

    // TEMPO 0506/0512 2SM FZDZ BR OVC008
    const tempo3 = result.forecast[4]!;
    assert.equal(tempo3.weather[0]!.descriptor, 'FZ');
    assert.deepEqual(tempo3.weather[0]!.phenomena, ['DZ']);
  });
});

// ---------------------------------------------------------------------------
// PROB groups
// ---------------------------------------------------------------------------

describe('parseTaf - PROB groups', () => {
  it('parses PROB30 standalone with validity period', () => {
    const result = parseTaf(PROB_GROUPS);

    const prob30 = result.forecast[1]!;
    assert.equal(prob30.probability, 30);
    assert.equal(prob30.changeType, undefined);
    assert.equal(prob30.start!.day, 4);
    assert.equal(prob30.start!.hour, 20);
    assert.equal(prob30.end!.day, 4);
    assert.equal(prob30.end!.hour, 24);
    assert.equal(prob30.visibility?.visibilitySm, 3);
  });

  it('parses PROB40 TEMPO combined group', () => {
    const result = parseTaf(PROB_GROUPS);

    const prob40tempo = result.forecast[3]!;
    assert.equal(prob40tempo.probability, 40);
    assert.equal(prob40tempo.changeType, 'TEMPO');
    assert.equal(prob40tempo.start!.day, 5);
    assert.equal(prob40tempo.start!.hour, 6);
    assert.equal(prob40tempo.end!.day, 5);
    assert.equal(prob40tempo.end!.hour, 10);
    assert.equal(prob40tempo.visibility?.visibilitySm, 2);
    assert.deepEqual(prob40tempo.weather[0]!.phenomena, ['BR']);
  });

  it('parses PROB30 TEMPO from EGLL real data', () => {
    const result = parseTaf(REAL_EGLL);

    // PROB30 TEMPO 0500/0515 6000 SHRA
    const probTempo = result.forecast[2]!;
    assert.equal(probTempo.probability, 30);
    assert.equal(probTempo.changeType, 'TEMPO');
    assert.equal(probTempo.visibility?.visibilityM, 6000);
    assert.deepEqual(probTempo.weather[0]!.phenomena, ['RA']);
    assert.equal(probTempo.weather[0]!.descriptor, 'SH');
  });

  it('parses standalone PROB30 with only visibility', () => {
    const result = parseTaf(REAL_EGLL);

    // PROB30 0603/0606 8000
    const prob = result.forecast[5]!;
    assert.equal(prob.probability, 30);
    assert.equal(prob.changeType, undefined);
    assert.equal(prob.visibility?.visibilityM, 8000);
    assert.equal(prob.weather.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Wind shear
// ---------------------------------------------------------------------------

describe('parseTaf - wind shear', () => {
  it('parses WS group in base forecast', () => {
    const result = parseTaf(WIND_SHEAR);

    const base = result.forecast[0]!;
    assert.ok(base.windShear, 'expected wind shear on base forecast');
    assert.equal(base.windShear.altitudeFtAgl, 2000);
    assert.equal(base.windShear.directionDeg, 270);
    assert.equal(base.windShear.speedKt, 50);
  });
});

// ---------------------------------------------------------------------------
// Turbulence and icing layers
// ---------------------------------------------------------------------------

describe('parseTaf - turbulence and icing', () => {
  it('parses turbulence layer (5-group)', () => {
    const result = parseTaf(TURBULENCE_ICING);

    const base = result.forecast[0]!;
    assert.ok(base.turbulence, 'expected turbulence layers');
    assert.equal(base.turbulence.length, 1);
    assert.equal(base.turbulence[0]!.intensity, 2);
    assert.equal(base.turbulence[0]!.baseAltitudeFt, 8000);
    assert.equal(base.turbulence[0]!.depthFt, 4000);
  });

  it('parses icing layer (6-group)', () => {
    const result = parseTaf(TURBULENCE_ICING);

    const base = result.forecast[0]!;
    assert.ok(base.icing, 'expected icing layers');
    assert.equal(base.icing.length, 1);
    assert.equal(base.icing[0]!.intensity, 2);
    assert.equal(base.icing[0]!.baseAltitudeFt, 3000);
    assert.equal(base.icing[0]!.depthFt, 4000);
  });
});

// ---------------------------------------------------------------------------
// CAVOK and NSW
// ---------------------------------------------------------------------------

describe('parseTaf - CAVOK and NSW', () => {
  it('parses CAVOK in BECMG group', () => {
    const result = parseTaf(INTL_CAVOK);

    // BECMG 0420/0422 CAVOK
    const becmg = result.forecast[1]!;
    assert.equal(becmg.changeType, 'BECMG');
    assert.equal(becmg.isCavok, true);
    assert.equal(becmg.sky.clear, 'SKC');
  });

  it('parses NSW in FM group', () => {
    const result = parseTaf(NSW_SKC);

    // FM050400 VRB03KT P6SM NSW SKC
    const fm = result.forecast[3]!;
    assert.equal(fm.changeType, 'FM');
    assert.equal(fm.isNoSignificantWeather, true);
    assert.equal(fm.sky.clear, 'SKC');
    assert.equal(fm.weather.length, 0);
  });

  it('parses NSW in BECMG group with international visibility', () => {
    const result = parseTaf(INTL_METERS);

    // BECMG 0508/0510 18008KT 8000 NSW SCT015
    const becmg = result.forecast[3]!;
    assert.equal(becmg.isNoSignificantWeather, true);
    assert.equal(becmg.visibility?.visibilityM, 8000);
  });
});

// ---------------------------------------------------------------------------
// International formats
// ---------------------------------------------------------------------------

describe('parseTaf - international formats', () => {
  it('parses ICAO meter visibility (9999)', () => {
    const result = parseTaf(INTL_CAVOK);

    const base = result.forecast[0]!;
    assert.equal(base.visibility?.visibilityM, 9999);
    assert.equal(base.visibility?.isMoreThan, false);
  });

  it('parses low meter visibility (1500, 3000)', () => {
    const result = parseTaf(INTL_METERS);

    // FM050200 VRB02KT 1500 FG OVC003
    const fm = result.forecast[2]!;
    assert.equal(fm.visibility?.visibilityM, 1500);
    assert.deepEqual(fm.weather[0]!.phenomena, ['FG']);
  });

  it('parses real EGLL TAF with mixed group types', () => {
    const result = parseTaf(REAL_EGLL);

    assert.equal(result.stationId, 'EGLL');
    assert.equal(result.forecast.length, 6);

    // Base: 22018G35KT 9999 SCT035
    const base = result.forecast[0]!;
    assert.equal(base.wind?.speedKt, 18);
    assert.equal(base.wind?.gustKt, 35);
    assert.equal(base.visibility?.visibilityM, 9999);
  });
});

// ---------------------------------------------------------------------------
// Real-world TAFs
// ---------------------------------------------------------------------------

describe('parseTaf - real-world TAFs', () => {
  it('parses real PANC TAF', () => {
    const result = parseTaf(REAL_PANC);

    assert.equal(result.stationId, 'PANC');
    assert.equal(result.issuedAt.day, 4);
    assert.equal(result.issuedAt.hour, 21);
    assert.equal(result.issuedAt.minute, 1);

    // Base: 06005KT P6SM BKN100
    const base = result.forecast[0]!;
    assert.equal(base.wind?.directionDeg, 60);
    assert.equal(base.wind?.speedKt, 5);

    // FM050800 15004KT P6SM VCSH OVC040
    const fm1 = result.forecast[1]!;
    assert.equal(fm1.weather[0]!.isVicinity, true);
    assert.equal(fm1.weather[0]!.descriptor, 'SH');

    // FM051200 VRB03KT 6SM -SHSN OVC030
    const fm2 = result.forecast[2]!;
    assert.equal(fm2.wind?.isVariable, true);
    assert.equal(fm2.visibility?.visibilitySm, 6);
    assert.equal(fm2.weather[0]!.intensity, 'LIGHT');
    assert.equal(fm2.weather[0]!.descriptor, 'SH');
    assert.deepEqual(fm2.weather[0]!.phenomena, ['SN']);
  });

  it('parses amended TAF', () => {
    const result = parseTaf(AMENDED);

    assert.equal(result.isAmended, true);
    assert.equal(result.stationId, 'KSFO');
    assert.equal(result.forecast.length, 4);

    // FM050300 VRB03KT 3SM BR OVC006
    const fm2 = result.forecast[2]!;
    assert.equal(fm2.visibility?.visibilitySm, 3);
    assert.deepEqual(fm2.weather[0]!.phenomena, ['BR']);
    assert.equal(fm2.sky.layers[0]!.coverage, 'OVC');
    assert.equal(fm2.sky.layers[0]!.altitudeFtAgl, 600);
  });

  it('parses corrected TAF', () => {
    const result = parseTaf(CORRECTED);

    assert.equal(result.isCorrected, true);
    assert.equal(result.stationId, 'KBOS');

    // FM042100 07015G25KT 5SM -RA OVC015
    const fm1 = result.forecast[1]!;
    assert.equal(fm1.wind?.gustKt, 25);
    assert.equal(fm1.visibility?.visibilitySm, 5);
    assert.equal(fm1.weather[0]!.intensity, 'LIGHT');
    assert.deepEqual(fm1.weather[0]!.phenomena, ['RA']);
  });
});

// ---------------------------------------------------------------------------
// NSW and SKC in FM group
// ---------------------------------------------------------------------------

describe('parseTaf - NSW and SKC in FM group', () => {
  it('parses FM group with NSW followed by SKC', () => {
    const result = parseTaf(NSW_SKC);

    assert.equal(result.stationId, 'KLAX');
    assert.equal(result.forecast.length, 4);

    // TEMPO 0420/0424 3SM BR BKN012
    const tempo = result.forecast[2]!;
    assert.equal(tempo.changeType, 'TEMPO');
    assert.equal(tempo.visibility?.visibilitySm, 3);
    assert.deepEqual(tempo.weather[0]!.phenomena, ['BR']);
    assert.equal(tempo.sky.layers[0]!.coverage, 'BKN');
    assert.equal(tempo.sky.layers[0]!.altitudeFtAgl, 1200);
  });
});
