import { describe, it, expect, assert } from 'vitest';
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
    expect(result.stationId).toBe('KJFK');
    expect(result.issuedAt.day).toBe(4);
    expect(result.issuedAt.hour).toBe(17);
    expect(result.issuedAt.minute).toBe(30);
  });

  it('parses valid period', () => {
    const result = parseTaf(BASIC);
    expect(result.validFrom.day).toBe(4);
    expect(result.validFrom.hour).toBe(18);
    expect(result.validTo.day).toBe(5);
    expect(result.validTo.hour).toBe(24);
  });

  it('defaults to not amended and not corrected', () => {
    const result = parseTaf(BASIC);
    expect(result.isAmended).toBe(false);
    expect(result.isCorrected).toBe(false);
    expect(result.isCancelled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AMD and COR modifiers
// ---------------------------------------------------------------------------

describe('parseTaf - AMD and COR', () => {
  it('detects AMD modifier', () => {
    const result = parseTaf(AMENDED);
    expect(result.isAmended).toBe(true);
    expect(result.isCorrected).toBe(false);
    expect(result.stationId).toBe('KSFO');
  });

  it('detects COR modifier', () => {
    const result = parseTaf(CORRECTED);
    expect(result.isCorrected).toBe(true);
    expect(result.isAmended).toBe(false);
    expect(result.stationId).toBe('KBOS');
  });
});

// ---------------------------------------------------------------------------
// Cancelled TAF
// ---------------------------------------------------------------------------

describe('parseTaf - cancelled', () => {
  it('parses a cancelled TAF', () => {
    const result = parseTaf(CANCELLED);
    expect(result.isCancelled).toBe(true);
    expect(result.stationId).toBe('KMDW');
    expect(result.forecast.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Base forecast
// ---------------------------------------------------------------------------

describe('parseTaf - base forecast', () => {
  it('parses wind in base forecast', () => {
    const result = parseTaf('TAF KJFK 041730Z 0418/0524 21012KT P6SM FEW250');
    expect(result.forecast.length).toBe(1);
    const base = result.forecast[0]!;
    expect(base.changeType).toBe(undefined);
    expect(base.wind?.directionDeg).toBe(210);
    expect(base.wind?.speedKt).toBe(12);
    expect(base.wind?.isVariable).toBe(false);
    expect(base.wind?.isCalm).toBe(false);
  });

  it('parses gusty wind', () => {
    const result = parseTaf('TAF KDEN 041730Z 0418/0524 25012G22KT P6SM FEW080 SCT150');
    const base = result.forecast[0]!;
    expect(base.wind?.speedKt).toBe(12);
    expect(base.wind?.gustKt).toBe(22);
  });

  it('parses P6SM visibility as more-than 6 statute miles', () => {
    const result = parseTaf('TAF KJFK 041730Z 0418/0524 21012KT P6SM FEW250');
    const base = result.forecast[0]!;
    expect(base.visibility?.visibilitySm).toBe(6);
    expect(base.visibility?.isMoreThan).toBe(true);
    expect(base.visibility?.isLessThan).toBe(false);
  });

  it('parses regular statute mile visibility', () => {
    const result = parseTaf('TAF KMSP 041730Z 0418/0524 21015G25KT 4SM -TSRA BKN030CB OVC060');
    const base = result.forecast[0]!;
    expect(base.visibility?.visibilitySm).toBe(4);
    expect(base.visibility?.isMoreThan).toBe(false);
  });

  it('parses ICAO meter visibility', () => {
    const result = parseTaf('TAF EGLL 042254Z 0500/0606 22018G35KT 9999 SCT035');
    const base = result.forecast[0]!;
    expect(base.visibility?.visibilityM).toBe(9999);
    expect(base.visibility?.isMoreThan).toBe(false);
  });

  it('parses cloud layers', () => {
    const result = parseTaf('TAF KMSP 041730Z 0418/0524 16008KT P6SM SCT050 BKN100');
    const base = result.forecast[0]!;
    expect(base.sky.layers.length).toBe(2);
    expect(base.sky.layers[0]!.coverage).toBe('SCT');
    expect(base.sky.layers[0]!.altitudeFtAgl).toBe(5000);
    expect(base.sky.layers[1]!.coverage).toBe('BKN');
    expect(base.sky.layers[1]!.altitudeFtAgl).toBe(10000);
  });

  it('parses cloud layers with CB type', () => {
    const result = parseTaf('TAF KMSP 041730Z 0418/0524 21015G25KT 4SM -TSRA BKN030CB OVC060');
    const base = result.forecast[0]!;
    expect(base.sky.layers[0]!.type).toBe('CB');
    expect(base.sky.layers[0]!.altitudeFtAgl).toBe(3000);
  });

  it('parses weather phenomena', () => {
    const result = parseTaf('TAF KMSP 041730Z 0418/0524 21015G25KT 4SM -TSRA BKN030CB OVC060');
    const base = result.forecast[0]!;
    expect(base.weather.length).toBe(1);
    expect(base.weather[0]!.intensity).toBe('LIGHT');
    expect(base.weather[0]!.descriptor).toBe('TS');
    expect(base.weather[0]!.phenomena).toEqual(['RA']);
  });

  it('parses VRB wind', () => {
    const result = parseTaf('TAF KLAX 041730Z 0418/0524 VRB03KT P6SM SKC');
    const base = result.forecast[0]!;
    expect(base.wind?.isVariable).toBe(true);
    expect(base.wind?.speedKt).toBe(3);
    expect(base.wind?.directionDeg).toBe(undefined);
  });

  it('parses SKC clear sky', () => {
    const result = parseTaf('TAF KLAX 041730Z 0418/0524 VRB03KT P6SM SKC');
    const base = result.forecast[0]!;
    expect(base.sky.clear).toBe('SKC');
    expect(base.sky.layers.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FM groups
// ---------------------------------------------------------------------------

describe('parseTaf - FM groups', () => {
  it('parses FM group with time and weather', () => {
    const result = parseTaf(BASIC);
    expect(result.forecast.length).toBe(4);

    const fm1 = result.forecast[1]!;
    expect(fm1.changeType).toBe('FM');
    expect(fm1.start!.day).toBe(4);
    expect(fm1.start!.hour).toBe(22);
    expect(fm1.start!.minute).toBe(0);
    expect(fm1.wind?.directionDeg).toBe(240);
    expect(fm1.wind?.speedKt).toBe(15);
    expect(fm1.wind?.gustKt).toBe(25);
    expect(fm1.visibility?.visibilitySm).toBe(6);
    expect(fm1.visibility?.isMoreThan).toBe(true);
  });

  it('parses multiple consecutive FM groups', () => {
    const result = parseTaf(MULTIPLE_FM);

    // Base + 6 FM groups
    expect(result.forecast.length).toBe(7);

    const fm5 = result.forecast[5]!;
    expect(fm5.changeType).toBe('FM');
    expect(fm5.start!.day).toBe(5);
    expect(fm5.start!.hour).toBe(12);
    expect(fm5.start!.minute).toBe(0);
    expect(fm5.wind?.directionDeg).toBe(300);

    const fm6 = result.forecast[6]!;
    expect(fm6.start!.day).toBe(5);
    expect(fm6.start!.hour).toBe(18);
    expect(fm6.sky.clear).toBe('SKC');
  });

  it('has no endDay/endHour on FM groups', () => {
    const result = parseTaf(BASIC);
    const fm = result.forecast[1]!;
    expect(fm.end).toBe(undefined);
  });
});

// ---------------------------------------------------------------------------
// TEMPO and BECMG groups
// ---------------------------------------------------------------------------

describe('parseTaf - TEMPO and BECMG groups', () => {
  it('parses TEMPO group with validity period', () => {
    const result = parseTaf(TEMPO_BECMG);

    const tempo = result.forecast[1]!;
    expect(tempo.changeType).toBe('TEMPO');
    expect(tempo.start!.day).toBe(4);
    expect(tempo.start!.hour).toBe(18);
    expect(tempo.end!.day).toBe(4);
    expect(tempo.end!.hour).toBe(22);
    expect(tempo.visibility?.visibilitySm).toBe(5);
    expect(tempo.weather[0]!.intensity).toBe('LIGHT');
    expect(tempo.weather[0]!.descriptor).toBe('TS');
    expect(tempo.weather[0]!.phenomena).toEqual(['RA']);
    expect(tempo.sky.layers[0]!.coverage).toBe('BKN');
    expect(tempo.sky.layers[0]!.type).toBe('CB');
  });

  it('parses BECMG group with validity period', () => {
    const result = parseTaf(TEMPO_BECMG);

    const becmg = result.forecast[2]!;
    expect(becmg.changeType).toBe('BECMG');
    expect(becmg.start!.day).toBe(4);
    expect(becmg.start!.hour).toBe(22);
    expect(becmg.end!.day).toBe(4);
    expect(becmg.end!.hour).toBe(24);
    expect(becmg.wind?.directionDeg).toBe(300);
    expect(becmg.wind?.speedKt).toBe(12);
  });

  it('parses BECMG with only wind (partial update)', () => {
    const result = parseTaf(TEMPO_BECMG);

    // Last BECMG: BECMG 0512/0514 18010KT SCT200
    const becmg2 = result.forecast[4]!;
    expect(becmg2.changeType).toBe('BECMG');
    expect(becmg2.wind?.directionDeg).toBe(180);
    expect(becmg2.wind?.speedKt).toBe(10);
    expect(becmg2.visibility).toBe(undefined);
  });

  it('parses multiple TEMPO groups with varied weather', () => {
    const result = parseTaf(TEMPO_MULTI);

    // TEMPO 0418/0422 3SM +TSRA BR BKN020CB
    const tempo1 = result.forecast[1]!;
    expect(tempo1.changeType).toBe('TEMPO');
    expect(tempo1.weather.length).toBe(2);
    expect(tempo1.weather[0]!.intensity).toBe('HEAVY');
    expect(tempo1.weather[0]!.descriptor).toBe('TS');
    expect(tempo1.weather[0]!.phenomena).toEqual(['RA']);
    expect(tempo1.weather[1]!.phenomena).toEqual(['BR']);

    // TEMPO 0422/0502 5SM -RASN BR BKN015 OVC025
    const tempo2 = result.forecast[2]!;
    expect(tempo2.weather[0]!.intensity).toBe('LIGHT');
    expect(tempo2.weather[0]!.phenomena).toEqual(['RA', 'SN']);
    expect(tempo2.sky.layers.length).toBe(2);

    // TEMPO 0506/0512 2SM FZDZ BR OVC008
    const tempo3 = result.forecast[4]!;
    expect(tempo3.weather[0]!.descriptor).toBe('FZ');
    expect(tempo3.weather[0]!.phenomena).toEqual(['DZ']);
  });
});

// ---------------------------------------------------------------------------
// PROB groups
// ---------------------------------------------------------------------------

describe('parseTaf - PROB groups', () => {
  it('parses PROB30 standalone with validity period', () => {
    const result = parseTaf(PROB_GROUPS);

    const prob30 = result.forecast[1]!;
    expect(prob30.probability).toBe(30);
    expect(prob30.changeType).toBe(undefined);
    expect(prob30.start!.day).toBe(4);
    expect(prob30.start!.hour).toBe(20);
    expect(prob30.end!.day).toBe(4);
    expect(prob30.end!.hour).toBe(24);
    expect(prob30.visibility?.visibilitySm).toBe(3);
  });

  it('parses PROB40 TEMPO combined group', () => {
    const result = parseTaf(PROB_GROUPS);

    const prob40tempo = result.forecast[3]!;
    expect(prob40tempo.probability).toBe(40);
    expect(prob40tempo.changeType).toBe('TEMPO');
    expect(prob40tempo.start!.day).toBe(5);
    expect(prob40tempo.start!.hour).toBe(6);
    expect(prob40tempo.end!.day).toBe(5);
    expect(prob40tempo.end!.hour).toBe(10);
    expect(prob40tempo.visibility?.visibilitySm).toBe(2);
    expect(prob40tempo.weather[0]!.phenomena).toEqual(['BR']);
  });

  it('parses PROB30 TEMPO from EGLL real data', () => {
    const result = parseTaf(REAL_EGLL);

    // PROB30 TEMPO 0500/0515 6000 SHRA
    const probTempo = result.forecast[2]!;
    expect(probTempo.probability).toBe(30);
    expect(probTempo.changeType).toBe('TEMPO');
    expect(probTempo.visibility?.visibilityM).toBe(6000);
    expect(probTempo.weather[0]!.phenomena).toEqual(['RA']);
    expect(probTempo.weather[0]!.descriptor).toBe('SH');
  });

  it('parses standalone PROB30 with only visibility', () => {
    const result = parseTaf(REAL_EGLL);

    // PROB30 0603/0606 8000
    const prob = result.forecast[5]!;
    expect(prob.probability).toBe(30);
    expect(prob.changeType).toBe(undefined);
    expect(prob.visibility?.visibilityM).toBe(8000);
    expect(prob.weather.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Wind shear
// ---------------------------------------------------------------------------

describe('parseTaf - wind shear', () => {
  it('parses WS group in base forecast', () => {
    const result = parseTaf(WIND_SHEAR);

    const base = result.forecast[0]!;
    assert(base.windShear, 'expected wind shear on base forecast');
    expect(base.windShear.altitudeFtAgl).toBe(2000);
    expect(base.windShear.directionDeg).toBe(270);
    expect(base.windShear.speedKt).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Turbulence and icing layers
// ---------------------------------------------------------------------------

describe('parseTaf - turbulence and icing', () => {
  it('parses turbulence layer (5-group)', () => {
    const result = parseTaf(TURBULENCE_ICING);

    const base = result.forecast[0]!;
    assert(base.turbulence, 'expected turbulence layers');
    expect(base.turbulence.length).toBe(1);
    expect(base.turbulence[0]!.intensity).toBe(2);
    expect(base.turbulence[0]!.baseAltitudeFt).toBe(8000);
    expect(base.turbulence[0]!.depthFt).toBe(4000);
  });

  it('parses icing layer (6-group)', () => {
    const result = parseTaf(TURBULENCE_ICING);

    const base = result.forecast[0]!;
    assert(base.icing, 'expected icing layers');
    expect(base.icing.length).toBe(1);
    expect(base.icing[0]!.intensity).toBe(2);
    expect(base.icing[0]!.baseAltitudeFt).toBe(3000);
    expect(base.icing[0]!.depthFt).toBe(4000);
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
    expect(becmg.changeType).toBe('BECMG');
    expect(becmg.isCavok).toBe(true);
    expect(becmg.sky.clear).toBe('SKC');
  });

  it('parses NSW in FM group', () => {
    const result = parseTaf(NSW_SKC);

    // FM050400 VRB03KT P6SM NSW SKC
    const fm = result.forecast[3]!;
    expect(fm.changeType).toBe('FM');
    expect(fm.isNoSignificantWeather).toBe(true);
    expect(fm.sky.clear).toBe('SKC');
    expect(fm.weather.length).toBe(0);
  });

  it('parses NSW in BECMG group with international visibility', () => {
    const result = parseTaf(INTL_METERS);

    // BECMG 0508/0510 18008KT 8000 NSW SCT015
    const becmg = result.forecast[3]!;
    expect(becmg.isNoSignificantWeather).toBe(true);
    expect(becmg.visibility?.visibilityM).toBe(8000);
  });
});

// ---------------------------------------------------------------------------
// International formats
// ---------------------------------------------------------------------------

describe('parseTaf - international formats', () => {
  it('parses ICAO meter visibility (9999)', () => {
    const result = parseTaf(INTL_CAVOK);

    const base = result.forecast[0]!;
    expect(base.visibility?.visibilityM).toBe(9999);
    expect(base.visibility?.isMoreThan).toBe(false);
  });

  it('parses low meter visibility (1500, 3000)', () => {
    const result = parseTaf(INTL_METERS);

    // FM050200 VRB02KT 1500 FG OVC003
    const fm = result.forecast[2]!;
    expect(fm.visibility?.visibilityM).toBe(1500);
    expect(fm.weather[0]!.phenomena).toEqual(['FG']);
  });

  it('parses real EGLL TAF with mixed group types', () => {
    const result = parseTaf(REAL_EGLL);

    expect(result.stationId).toBe('EGLL');
    expect(result.forecast.length).toBe(6);

    // Base: 22018G35KT 9999 SCT035
    const base = result.forecast[0]!;
    expect(base.wind?.speedKt).toBe(18);
    expect(base.wind?.gustKt).toBe(35);
    expect(base.visibility?.visibilityM).toBe(9999);
  });
});

// ---------------------------------------------------------------------------
// Real-world TAFs
// ---------------------------------------------------------------------------

describe('parseTaf - real-world TAFs', () => {
  it('parses real PANC TAF', () => {
    const result = parseTaf(REAL_PANC);

    expect(result.stationId).toBe('PANC');
    expect(result.issuedAt.day).toBe(4);
    expect(result.issuedAt.hour).toBe(21);
    expect(result.issuedAt.minute).toBe(1);

    // Base: 06005KT P6SM BKN100
    const base = result.forecast[0]!;
    expect(base.wind?.directionDeg).toBe(60);
    expect(base.wind?.speedKt).toBe(5);

    // FM050800 15004KT P6SM VCSH OVC040
    const fm1 = result.forecast[1]!;
    expect(fm1.weather[0]!.isVicinity).toBe(true);
    expect(fm1.weather[0]!.descriptor).toBe('SH');

    // FM051200 VRB03KT 6SM -SHSN OVC030
    const fm2 = result.forecast[2]!;
    expect(fm2.wind?.isVariable).toBe(true);
    expect(fm2.visibility?.visibilitySm).toBe(6);
    expect(fm2.weather[0]!.intensity).toBe('LIGHT');
    expect(fm2.weather[0]!.descriptor).toBe('SH');
    expect(fm2.weather[0]!.phenomena).toEqual(['SN']);
  });

  it('parses amended TAF', () => {
    const result = parseTaf(AMENDED);

    expect(result.isAmended).toBe(true);
    expect(result.stationId).toBe('KSFO');
    expect(result.forecast.length).toBe(4);

    // FM050300 VRB03KT 3SM BR OVC006
    const fm2 = result.forecast[2]!;
    expect(fm2.visibility?.visibilitySm).toBe(3);
    expect(fm2.weather[0]!.phenomena).toEqual(['BR']);
    expect(fm2.sky.layers[0]!.coverage).toBe('OVC');
    expect(fm2.sky.layers[0]!.altitudeFtAgl).toBe(600);
  });

  it('parses corrected TAF', () => {
    const result = parseTaf(CORRECTED);

    expect(result.isCorrected).toBe(true);
    expect(result.stationId).toBe('KBOS');

    // FM042100 07015G25KT 5SM -RA OVC015
    const fm1 = result.forecast[1]!;
    expect(fm1.wind?.gustKt).toBe(25);
    expect(fm1.visibility?.visibilitySm).toBe(5);
    expect(fm1.weather[0]!.intensity).toBe('LIGHT');
    expect(fm1.weather[0]!.phenomena).toEqual(['RA']);
  });
});

// ---------------------------------------------------------------------------
// NSW and SKC in FM group
// ---------------------------------------------------------------------------

describe('parseTaf - NSW and SKC in FM group', () => {
  it('parses FM group with NSW followed by SKC', () => {
    const result = parseTaf(NSW_SKC);

    expect(result.stationId).toBe('KLAX');
    expect(result.forecast.length).toBe(4);

    // TEMPO 0420/0424 3SM BR BKN012
    const tempo = result.forecast[2]!;
    expect(tempo.changeType).toBe('TEMPO');
    expect(tempo.visibility?.visibilitySm).toBe(3);
    expect(tempo.weather[0]!.phenomena).toEqual(['BR']);
    expect(tempo.sky.layers[0]!.coverage).toBe('BKN');
    expect(tempo.sky.layers[0]!.altitudeFtAgl).toBe(1200);
  });
});

// ---------------------------------------------------------------------------
// Coverage edge cases
// ---------------------------------------------------------------------------

describe('parseTaf - coverage edge cases', () => {
  it('parses a TAF base forecast with vertical visibility (VV)', () => {
    const raw = `TAF KSFO 041730Z 0418/0524 21012KT 1/4SM FG VV002`;
    const result = parseTaf(raw);
    expect(result.forecast[0]!.sky.verticalVisibilityFtAgl).toBe(200);
  });

  it('parses a TAF base forecast with SKC (sky clear)', () => {
    const raw = `TAF KAUS 041730Z 0418/0524 18012KT P6SM SKC`;
    const result = parseTaf(raw);
    expect(result.forecast[0]!.sky.clear).toBe('SKC');
  });

  it('parses a TAF with a wind shear group (WS###/dddssKT)', () => {
    const raw = `TAF KJFK 041730Z 0418/0524 21012KT P6SM SCT250 WS020/22045KT`;
    const result = parseTaf(raw);
    expect(result.forecast[0]!.windShear).toBeDefined();
  });

  it('parses a TAF with a turbulence layer 5-group', () => {
    const raw = `TAF KORD 041730Z 0418/0524 24012KT P6SM SCT250 520304`;
    const result = parseTaf(raw);
    expect(result.forecast[0]!.turbulence?.length).toBeGreaterThanOrEqual(1);
  });

  it('parses a TAF with an icing layer 6-group', () => {
    const raw = `TAF KBOS 041730Z 0418/0524 24012KT P6SM SCT250 620304`;
    const result = parseTaf(raw);
    expect(result.forecast[0]!.icing?.length).toBeGreaterThanOrEqual(1);
  });
});
