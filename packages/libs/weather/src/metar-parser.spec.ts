import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMetar } from './metar-parser.js';

// ---------------------------------------------------------------------------
// Report type
// ---------------------------------------------------------------------------

describe('parseMetar - report type', () => {
  it('identifies METAR type', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert.equal(result.type, 'METAR');
  });

  it('identifies SPECI type', () => {
    const result = parseMetar(
      'SPECI KJFK 041907Z 18010KT 3SM BR BKN005 OVC010 14/13 A2999 RMK AO2 CIG 003V008 SLP156 T01440133',
    );
    assert.equal(result.type, 'SPECI');
  });

  it('defaults to METAR when no prefix is present', () => {
    const result = parseMetar(
      'KJFK 041953Z 22012KT 10SM FEW250 19/07 A3010 RMK AO2 SLP195 T01890067',
    );
    assert.equal(result.type, 'METAR');
    assert.equal(result.stationId, 'KJFK');
  });
});

// ---------------------------------------------------------------------------
// Station and time
// ---------------------------------------------------------------------------

describe('parseMetar - station and time', () => {
  it('parses station ID and observation time', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert.equal(result.stationId, 'KJFK');
    assert.equal(result.observationTime.day, 4);
    assert.equal(result.observationTime.hour, 18);
    assert.equal(result.observationTime.minute, 53);
  });
});

// ---------------------------------------------------------------------------
// AUTO and COR
// ---------------------------------------------------------------------------

describe('parseMetar - AUTO and COR', () => {
  it('detects AUTO', () => {
    const result = parseMetar(
      'METAR K1V4 041856Z AUTO 31007KT 10SM SCT090 22/M01 A3018 RMK AO2 SLP148 T02220011',
    );
    assert.equal(result.isAutomated, true);
    assert.equal(result.isCorrected, false);
  });

  it('detects COR', () => {
    const result = parseMetar(
      'METAR KORD 041856Z COR 20015G25KT 6SM -RA BR SCT020 BKN035 OVC060 18/16 A2986 RMK AO2 RAB32 SLP108 P0012 T01830161',
    );
    assert.equal(result.isCorrected, true);
    assert.equal(result.isAutomated, false);
  });

  it('sets both false when neither present', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert.equal(result.isAutomated, false);
    assert.equal(result.isCorrected, false);
  });
});

// ---------------------------------------------------------------------------
// Wind
// ---------------------------------------------------------------------------

describe('parseMetar - wind', () => {
  it('parses basic wind', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert.ok(result.wind);
    assert.equal(result.wind.directionDeg, 210);
    assert.equal(result.wind.speedKt, 10);
    assert.equal(result.wind.isVariable, false);
    assert.equal(result.wind.isCalm, false);
    assert.equal(result.wind.gustKt, undefined);
  });

  it('parses calm wind', () => {
    const result = parseMetar(
      'METAR KLAX 041853Z 00000KT 10SM CLR 20/11 A2995 RMK AO2 SLP142 T02000111',
    );
    assert.ok(result.wind);
    assert.equal(result.wind.isCalm, true);
    assert.equal(result.wind.speedKt, 0);
    assert.equal(result.wind.directionDeg, undefined);
  });

  it('parses gusty wind', () => {
    const result = parseMetar(
      'METAR KDEN 041853Z 25015G30KT 10SM FEW080 SCT120 BKN200 28/08 A3002 RMK AO2 PK WND 26035/1822 SLP098 T02830078',
    );
    assert.ok(result.wind);
    assert.equal(result.wind.directionDeg, 250);
    assert.equal(result.wind.speedKt, 15);
    assert.equal(result.wind.gustKt, 30);
  });

  it('parses extreme wind with 3-digit gusts', () => {
    const result = parseMetar(
      'METAR KGRK 041855Z 22055G105KT 1/4SM +TSRA FEW005CB BKN015 OVC030 20/18 A2938 RMK AO2 PK WND 22115/1842 TORNADO B40 2 W MOV E PRESRR SLP918 P0088 T02000178',
    );
    assert.ok(result.wind);
    assert.equal(result.wind.directionDeg, 220);
    assert.equal(result.wind.speedKt, 55);
    assert.equal(result.wind.gustKt, 105);
  });

  it('parses variable wind direction', () => {
    const result = parseMetar(
      'METAR KORD 041851Z 23008KT 200V270 10SM SCT050 BKN120 22/14 A2987 RMK AO2 SLP109 T02220139',
    );
    assert.ok(result.wind);
    assert.equal(result.wind.directionDeg, 230);
    assert.equal(result.wind.variableFromDeg, 200);
    assert.equal(result.wind.variableToDeg, 270);
  });

  it('parses VRB (variable) wind', () => {
    const result = parseMetar(
      'METAR KAUS 041856Z VRB04KT 10SM SCT250 22/14 A3008 RMK AO2 SLP186 T02220139',
    );
    assert.ok(result.wind);
    assert.equal(result.wind.isVariable, true);
    assert.equal(result.wind.isCalm, false);
    assert.equal(result.wind.speedKt, 4);
    assert.equal(result.wind.directionDeg, undefined);
  });
});

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

describe('parseMetar - visibility', () => {
  it('parses whole statute miles', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert.ok(result.visibility);
    assert.equal(result.visibility.visibilitySm, 10);
    assert.equal(result.visibility.isLessThan, false);
  });

  it('parses fractional visibility (1 1/2SM)', () => {
    const result = parseMetar(
      'METAR KBOS 041854Z 05009KT 1 1/2SM BR SCT008 OVC015 09/08 A2991 RMK AO2 SLP132 T00890078',
    );
    assert.ok(result.visibility);
    assert.equal(result.visibility.visibilitySm, 1.5);
  });

  it('parses less-than visibility (M1/4SM)', () => {
    const result = parseMetar(
      'METAR KPHL 041856Z 00000KT M1/4SM FG VV002 08/08 A3005 RMK AO2 VIS 1/4V1 SLP178 T00830078',
    );
    assert.ok(result.visibility);
    assert.equal(result.visibility.visibilitySm, 0.25);
    assert.equal(result.visibility.isLessThan, true);
  });

  it('parses fraction-only visibility (1/4SM)', () => {
    const result = parseMetar(
      'METAR KGRK 041855Z 22055G105KT 1/4SM +TSRA FEW005CB BKN015 OVC030 20/18 A2938 RMK AO2 PK WND 22115/1842 TORNADO B40 2 W MOV E PRESRR SLP918 P0088 T02000178',
    );
    assert.ok(result.visibility);
    assert.equal(result.visibility.visibilitySm, 0.25);
  });

  it('parses half-mile visibility (1/2SM)', () => {
    const result = parseMetar(
      'METAR KBIS 041856Z 33025G38KT 1/2SM BLSN VV010 M15/M18 A3066 RMK AO2 PK WND 33045/1832 SLP400 T11501178',
    );
    assert.ok(result.visibility);
    assert.equal(result.visibility.visibilitySm, 0.5);
  });

  it('parses CAVOK', () => {
    const result = parseMetar('METAR EGLL 041850Z 24012KT CAVOK 19/08 Q1023 NOSIG');
    assert.equal(result.isCavok, true);
    assert.equal(result.visibility, undefined);
  });

  it('parses ICAO meters visibility', () => {
    const result = parseMetar('METAR LFPG 041830Z 27008KT 0800 FG BKN002 OVC005 08/08 Q1022');
    assert.ok(result.visibility);
    assert.equal(result.visibility.visibilityM, 800);
    assert.equal(result.visibility.visibilitySm, undefined);
    assert.equal(result.visibility.isLessThan, false);
  });
});

// ---------------------------------------------------------------------------
// RVR
// ---------------------------------------------------------------------------

describe('parseMetar - RVR', () => {
  it('parses basic RVR and variable RVR', () => {
    const result = parseMetar(
      'METAR KATL 041852Z 18006KT 1/4SM R27L/2400FT R27R/1800V3000FT FG OVC001 14/14 A3001 RMK AO2 SLP165 T01440144',
    );
    assert.equal(result.rvr.length, 2);
    assert.equal(result.rvr[0]!.runway, '27L');
    assert.equal(result.rvr[0]!.visibilityFt, 2400);
    assert.equal(result.rvr[0]!.isMoreThan, false);
    assert.equal(result.rvr[0]!.isLessThan, false);
    assert.equal(result.rvr[0]!.variableMaxFt, undefined);
    assert.equal(result.rvr[1]!.runway, '27R');
    assert.equal(result.rvr[1]!.visibilityFt, 1800);
    assert.equal(result.rvr[1]!.variableMaxFt, 3000);
  });

  it('parses RVR with P (plus/more-than) prefix on variable max', () => {
    const result = parseMetar(
      'METAR KDFW 041153Z 36012KT 2SM R17C/4000VP6000FT TSRA BR FEW004 BKN010 OVC017CB 18/17 A2995',
    );
    assert.equal(result.rvr.length, 1);
    assert.equal(result.rvr[0]!.runway, '17C');
    assert.equal(result.rvr[0]!.visibilityFt, 4000);
    assert.equal(result.rvr[0]!.isMoreThan, false);
    assert.equal(result.rvr[0]!.variableMaxFt, 6000);
    assert.equal(result.rvr[0]!.isVariableMaxMoreThan, true);
  });

  it('parses RVR with P (plus/more-than) prefix on single value', () => {
    const result = parseMetar(
      'SPECI KMSP 042001Z 30018G23KT 1/2SM R30L/P6000FT SN FEW018 BKN029 OVC039 02/M01 A2984',
    );
    assert.equal(result.rvr.length, 1);
    assert.equal(result.rvr[0]!.runway, '30L');
    assert.equal(result.rvr[0]!.visibilityFt, 6000);
    assert.equal(result.rvr[0]!.isMoreThan, true);
  });

  it('parses RVR with M (minus/less-than) prefix', () => {
    const result = parseMetar(
      'METAR KORD 041856Z 36005KT 1/4SM R10L/M0200FT FG VV001 01/01 A3010 RMK AO2 SLP198 T00110011',
    );
    assert.equal(result.rvr.length, 1);
    assert.equal(result.rvr[0]!.runway, '10L');
    assert.equal(result.rvr[0]!.visibilityFt, 200);
    assert.equal(result.rvr[0]!.isLessThan, true);
    assert.equal(result.rvr[0]!.isMoreThan, false);
  });

  it('parses RVR trend suffixes (U/D/N)', () => {
    const result = parseMetar(
      'METAR KJFK 041856Z 05008KT 1/2SM R04R/2000FTU R22L/1400FTD R31L/0800FTN FG VV002 08/08 A3002 RMK AO2 SLP168 T00830083',
    );
    assert.equal(result.rvr.length, 3);
    assert.equal(result.rvr[0]!.trend, 'RISING');
    assert.equal(result.rvr[1]!.trend, 'FALLING');
    assert.equal(result.rvr[2]!.trend, 'NO_CHANGE');
  });

  it('reports empty RVR array when none present', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert.equal(result.rvr.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Weather phenomena
// ---------------------------------------------------------------------------

describe('parseMetar - weather phenomena', () => {
  it('parses heavy thunderstorm rain (+TSRA)', () => {
    const result = parseMetar(
      'METAR KGRK 041855Z 22055G105KT 1/4SM +TSRA FEW005CB BKN015 OVC030 20/18 A2938 RMK AO2 PK WND 22115/1842 TORNADO B40 2 W MOV E PRESRR SLP918 P0088 T02000178',
    );
    const tsra = result.weather.find((w) => w.raw === '+TSRA');
    assert.ok(tsra);
    assert.equal(tsra.intensity, 'HEAVY');
    assert.equal(tsra.descriptor, 'TS');
    assert.ok(tsra.phenomena.includes('RA'));
  });

  it('parses freezing rain (FZRA)', () => {
    const result = parseMetar(
      'METAR KGRR 041854Z 02012G18KT 3SM FZRA BR OVC008 M01/M03 A2982 RMK AO2 SLP104 P0008 I1005 T10111028',
    );
    const fzra = result.weather.find((w) => w.raw === 'FZRA');
    assert.ok(fzra);
    assert.equal(fzra.descriptor, 'FZ');
    assert.ok(fzra.phenomena.includes('RA'));
    assert.equal(fzra.intensity, 'MODERATE');
  });

  it('parses light drizzle (-DZ)', () => {
    const result = parseMetar(
      'METAR KPDX 041856Z 17008KT 5SM -DZ OVC008 09/08 A3012 RMK AO2 SLP204 P0001 T00890078',
    );
    const dz = result.weather.find((w) => w.phenomena.includes('DZ'));
    assert.ok(dz);
    assert.equal(dz.intensity, 'LIGHT');
  });

  it('parses snow (SN)', () => {
    const result = parseMetar(
      'METAR KMSN 041854Z 01012G20KT 1SM SN BKN010 OVC018 M02/M04 A3028 RMK AO2 SLP268 P0005 4/009 T10221039',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('SN')));
  });

  it('parses snow grains (SG)', () => {
    const result = parseMetar(
      'METAR KFAR 041855Z 35006KT 6SM SG OVC010 M08/M10 A3052 RMK AO2 SLP348 T10781100',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('SG')));
  });

  it('parses ice crystals (IC)', () => {
    const result = parseMetar(
      'METAR PAFA 041854Z 00000KT 5SM IC FEW005 M32/M35 A3068 RMK AO2 SLP382 T13221350 ICE CRYSTALS',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('IC')));
  });

  it('parses ice pellets (PL)', () => {
    const result = parseMetar(
      'METAR KCMH 041856Z 04010KT 2SM PL BR OVC012 M01/M03 A2994 RMK AO2 SLP142 P0003 T10111028',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('PL')));
  });

  it('parses hail with thunderstorm (+TSRAGR)', () => {
    const result = parseMetar(
      'METAR KICT 041853Z 22025G45KT 1SM +TSRAGR BKN020CB OVC040 18/16 A2968 RMK AO2 PK WND 23052/1840 TSB28 GR 1 3/4 SLP052 P0042 T01830161',
    );
    const gr = result.weather.find((w) => w.phenomena.includes('GR'));
    assert.ok(gr);
    assert.equal(gr.intensity, 'HEAVY');
    assert.equal(gr.descriptor, 'TS');
  });

  it('parses small hail (GS)', () => {
    const result = parseMetar(
      'METAR KSGF 041852Z 20018G30KT 2SM TSRAGS FEW012CB BKN025 OVC050 20/18 A2976 RMK AO2 TSB35 SLP074 GS P0018 T02000178',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('GS')));
  });

  it('parses unknown precipitation (UP)', () => {
    const result = parseMetar(
      'METAR K1G4 041856Z AUTO 24005KT 4SM UP OVC015 01/M01 A3004 RMK AO2 UP15 SLP178 T00111011',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('UP')));
  });

  it('parses mist (BR)', () => {
    const result = parseMetar(
      'METAR KSFO 041856Z 28012KT 1SM BR OVC004 12/11 A2998 RMK AO2 SLP152 T01220111',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('BR')));
  });

  it('parses fog (FG)', () => {
    const result = parseMetar(
      'METAR KPHL 041856Z 00000KT M1/4SM FG VV002 08/08 A3005 RMK AO2 VIS 1/4V1 SLP178 T00830078',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('FG')));
  });

  it('parses smoke (FU)', () => {
    const result = parseMetar(
      'METAR KRDD 041853Z 34010KT 3SM FU HZ FEW080 SCT150 34/11 A2988 RMK AO2 SLP108 T03390111',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('FU')));
  });

  it('parses volcanic ash (VA)', () => {
    const result = parseMetar(
      'METAR PADQ 041856Z 32015KT 3SM VA FEW015 BKN040 05/01 A2978 RMK AO2 SLP088 T00500011',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('VA')));
  });

  it('parses dust (DU)', () => {
    const result = parseMetar(
      'METAR KELP 041856Z 25025G40KT 2SM DU FEW080 SCT150 36/06 A2954 RMK AO2 PK WND 26048/1832 SLP002 BLDU T03610061',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('DU')));
  });

  it('parses sand (SA)', () => {
    const result = parseMetar(
      'METAR KTUS 041855Z 23030G45KT 1/2SM SA FEW040 35/08 A2948 RMK AO2 PK WND 24050/1840 BLSA SLP988 VIS N1/4 T03500078',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('SA')));
  });

  it('parses haze (HZ)', () => {
    const result = parseMetar(
      'METAR KPHX 041853Z 24008KT 5SM HZ FEW120 SCT200 38/09 A2962 RMK AO2 SLP022 T03830094',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('HZ')));
  });

  it('parses spray (PY)', () => {
    const result = parseMetar(
      'METAR PHKO 041856Z 27020G32KT 4SM PY FEW015 SCT030 26/20 A3002 RMK AO2 SLP168 T02610200',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('PY')));
  });

  it('parses squall (SQ)', () => {
    const result = parseMetar(
      'METAR KMOB 041853Z 22035G55KT 2SM +RA SQ BKN012 OVC025 23/22 A2964 RMK AO2 PK WND 23062/1840 PRESRR SLP040 P0048 T02280217',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('SQ')));
  });

  it('parses dust/sand whirls (PO)', () => {
    const result = parseMetar(
      'METAR KELP 041855Z 22015G30KT 5SM PO FEW100 38/08 A2960 RMK AO2 SLP018 T03830078',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('PO')));
  });

  it('parses funnel cloud (+FC)', () => {
    const result = parseMetar(
      'METAR KOKC 041856Z 20035G55KT 2SM +TSRA +FC BKN020CB OVC040 22/20 A2958 RMK AO2 PK WND 22065/1842 SLP012 T02220200',
    );
    const fc = result.weather.find((w) => w.phenomena.includes('FC'));
    assert.ok(fc);
    assert.equal(fc.intensity, 'HEAVY');
  });

  it('parses sandstorm (+SS)', () => {
    const result = parseMetar(
      'METAR KELP 041855Z 25040G60KT 1/4SM +SS FEW020 35/10 A2942 RMK AO2 PK WND 25068/1840 SLP982 T03500100',
    );
    const ss = result.weather.find((w) => w.phenomena.includes('SS'));
    assert.ok(ss);
    assert.equal(ss.intensity, 'HEAVY');
  });

  it('parses dust storm (+DS)', () => {
    const result = parseMetar(
      'METAR KTUS 041855Z 24035G55KT 1/4SM +DS FEW030 36/08 A2944 RMK AO2 PK WND 24060/1838 SLP986 T03610078',
    );
    assert.ok(result.weather.find((w) => w.phenomena.includes('DS')));
  });

  it('parses mixed precipitation (RASN)', () => {
    const result = parseMetar(
      'METAR KPWM 041855Z 03012KT 2SM RASN BR OVC009 01/00 A2988 RMK AO2 SLP122 SNBGNTIME0830 P0004 T00110000',
    );
    const rasn = result.weather.find(
      (w) => w.phenomena.includes('RA') && w.phenomena.includes('SN'),
    );
    assert.ok(rasn);
  });

  it('parses blowing snow (BL descriptor)', () => {
    const result = parseMetar(
      'METAR KBIS 041856Z 33025G38KT 1/2SM BLSN VV010 M15/M18 A3066 RMK AO2 PK WND 33045/1832 SLP400 T11501178',
    );
    const blsn = result.weather.find((w) => w.descriptor === 'BL');
    assert.ok(blsn);
    assert.ok(blsn.phenomena.includes('SN'));
  });

  it('parses drifting snow (DR descriptor)', () => {
    const result = parseMetar(
      'METAR KGFK 041854Z 31012KT 4SM DRSN FEW015 OVC025 M10/M14 A3058 RMK AO2 SLP378 T11001139',
    );
    const drsn = result.weather.find((w) => w.descriptor === 'DR');
    assert.ok(drsn);
    assert.ok(drsn.phenomena.includes('SN'));
  });

  it('parses freezing drizzle (FZ descriptor)', () => {
    const result = parseMetar(
      'METAR KBUF 041856Z 05008KT 4SM FZDZ BR OVC012 M00/M02 A2996 RMK AO2 SLP148 P0001 I1001 T10001017',
    );
    const fzdz = result.weather.find((w) => w.descriptor === 'FZ');
    assert.ok(fzdz);
    assert.ok(fzdz.phenomena.includes('DZ'));
  });

  it('parses shallow fog (MI descriptor)', () => {
    const result = parseMetar(
      'METAR KBNA 041856Z 00000KT 2SM MIFG SCT001 BKN120 14/14 A3004 RMK AO2 SLP174 T01440139',
    );
    const mifg = result.weather.find((w) => w.descriptor === 'MI');
    assert.ok(mifg);
    assert.ok(mifg.phenomena.includes('FG'));
  });

  it('parses patches of fog (BC descriptor)', () => {
    const result = parseMetar(
      'METAR KBOS 041856Z VRB03KT 3SM BCFG SCT002 BKN120 12/12 A3006 RMK AO2 SLP180 T01220117',
    );
    const bcfg = result.weather.find((w) => w.descriptor === 'BC');
    assert.ok(bcfg);
    assert.ok(bcfg.phenomena.includes('FG'));
  });

  it('parses shower hail (SH descriptor)', () => {
    const result = parseMetar(
      'METAR KAMA 041853Z 24022G35KT 2SM SHGR FEW015CB BKN030 OVC050 16/12 A2978 RMK AO2 GR 3/4 SLP078 P0015 T01610122',
    );
    const shgr = result.weather.find((w) => w.descriptor === 'SH');
    assert.ok(shgr);
    assert.ok(shgr.phenomena.includes('GR'));
  });

  it('parses thunderstorm without precipitation (TS)', () => {
    const result = parseMetar(
      'METAR KABQ 041856Z 22012KT 10SM TS FEW040CB SCT080 BKN150 30/10 A3004 RMK AO2 TSB42 OCNL LTGICCG SW TS SW MOV NE SLP098 T03000100',
    );
    const ts = result.weather.find((w) => w.descriptor === 'TS');
    assert.ok(ts);
  });

  it('parses vicinity showers (VCSH)', () => {
    const result = parseMetar(
      'METAR KPBI 041856Z 14010KT 10SM VCSH FEW030 SCT050 BKN080 29/24 A3006 RMK AO2 RAE42 SLP178 P0000 T02890239',
    );
    const vcsh = result.weather.find((w) => w.isVicinity);
    assert.ok(vcsh);
    assert.equal(vcsh.descriptor, 'SH');
  });

  it('parses vicinity thunderstorm (VCTS)', () => {
    const result = parseMetar(
      'METAR KMCO 041853Z 26008KT 10SM VCTS FEW035CB SCT060 BKN120 31/23 A3002 RMK AO2 LTG DSNT W OCNL LTGICCG W CB DSNT W SLP165 T03110228',
    );
    const vcts = result.weather.find((w) => w.isVicinity);
    assert.ok(vcts);
    assert.equal(vcts.descriptor, 'TS');
  });

  it('parses vicinity fog (VCFG)', () => {
    const result = parseMetar(
      'METAR KBNA 041856Z 18004KT 10SM VCFG SCT002 BKN120 16/15 A3004 RMK AO2 SLP174 70005 T01610150',
    );
    const vcfg = result.weather.find((w) => w.isVicinity);
    assert.ok(vcfg);
    assert.ok(vcfg.phenomena.includes('FG'));
  });

  it('parses multiple weather groups', () => {
    const result = parseMetar(
      'METAR KMCI 041853Z 19020G35KT 3SM +TSRA BR FEW015 BKN030CB OVC060 21/19 A2974 RMK AO2 TSB32 PRESRR SLP065 FRQ LTGICCG OHD TS OHD MOV NE P0048 T02110194',
    );
    assert.ok(result.weather.length >= 2);
  });
});

// ---------------------------------------------------------------------------
// Sky condition
// ---------------------------------------------------------------------------

describe('parseMetar - sky condition', () => {
  it('parses CLR sky', () => {
    const result = parseMetar(
      'METAR KLAX 041853Z 00000KT 10SM CLR 20/11 A2995 RMK AO2 SLP142 T02000111',
    );
    assert.equal(result.sky.clear, 'CLR');
    assert.equal(result.sky.layers.length, 0);
  });

  it('parses SKC (manual sky clear)', () => {
    const result = parseMetar(
      'METAR KJFK 041856Z 18008KT 10SM SKC 24/12 A3010 RMK SLP198 T02440122',
    );
    assert.equal(result.sky.clear, 'SKC');
    assert.equal(result.sky.layers.length, 0);
  });

  it('parses multiple cloud layers', () => {
    const result = parseMetar(
      'METAR KIAD 041856Z 17012KT 10SM FEW020 SCT040 BKN080 OVC120 24/18 A2996 RMK AO2 SLP144 T02390178',
    );
    assert.equal(result.sky.layers.length, 4);
    assert.equal(result.sky.layers[0]!.coverage, 'FEW');
    assert.equal(result.sky.layers[0]!.altitudeFtAgl, 2000);
    assert.equal(result.sky.layers[3]!.coverage, 'OVC');
    assert.equal(result.sky.layers[3]!.altitudeFtAgl, 12000);
  });

  it('parses CB cloud type', () => {
    const result = parseMetar(
      'METAR KGRK 041855Z 22055G105KT 1/4SM +TSRA FEW005CB BKN015 OVC030 20/18 A2938 RMK AO2 PK WND 22115/1842 TORNADO B40 2 W MOV E PRESRR SLP918 P0088 T02000178',
    );
    assert.ok(result.sky.layers.find((l) => l.type === 'CB'));
  });

  it('parses TCU cloud type', () => {
    const result = parseMetar(
      'METAR KJAX 041856Z 20010KT 10SM FEW025TCU SCT045 BKN080 30/23 A3004 RMK AO2 SLP174 TCU W-NW T03000228',
    );
    assert.ok(result.sky.layers.find((l) => l.type === 'TCU'));
  });

  it('parses vertical visibility', () => {
    const result = parseMetar(
      'METAR KSEA 041853Z 16005KT 1/4SM FG VV005 08/08 A3010 RMK AO2 SLP198 T00830078',
    );
    assert.equal(result.sky.verticalVisibilityFtAgl, 500);
    assert.equal(result.sky.layers.length, 0);
  });

  it('parses CAVOK as clear sky', () => {
    const result = parseMetar('METAR EGLL 041850Z 24012KT CAVOK 19/08 Q1023 NOSIG');
    assert.equal(result.sky.clear, 'SKC');
  });
});

// ---------------------------------------------------------------------------
// Temperature and dewpoint
// ---------------------------------------------------------------------------

describe('parseMetar - temperature and dewpoint', () => {
  it('parses positive temps', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert.equal(result.temperatureC, 18);
    assert.equal(result.dewpointC, 6);
  });

  it('parses negative temps', () => {
    const result = parseMetar(
      'METAR KMSN 041854Z 33012G22KT 10SM FEW040 M04/M18 A3042 RMK AO2 SLP312 T10441183',
    );
    assert.equal(result.temperatureC, -4);
    assert.equal(result.dewpointC, -18);
  });

  it('parses M00 as zero', () => {
    const result = parseMetar(
      'METAR KBUF 041856Z 05008KT 4SM FZDZ BR OVC012 M00/M02 A2996 RMK AO2 SLP148 P0001 I1001 T10001017',
    );
    assert.equal(result.temperatureC, 0);
    assert.equal(result.dewpointC, -2);
  });
});

// ---------------------------------------------------------------------------
// Altimeter
// ---------------------------------------------------------------------------

describe('parseMetar - altimeter', () => {
  it('parses US altimeter (A group)', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert.ok(result.altimeter);
    assert.equal(result.altimeter.inHg, 30.12);
  });

  it('parses ICAO altimeter (Q group)', () => {
    const result = parseMetar('METAR EGLL 041850Z 24012KT CAVOK 19/08 Q1023 NOSIG');
    assert.ok(result.altimeter);
    assert.equal(result.altimeter.hPa, 1023);
  });
});

// ---------------------------------------------------------------------------
// NOSIG
// ---------------------------------------------------------------------------

describe('parseMetar - NOSIG', () => {
  it('detects NOSIG', () => {
    const result = parseMetar('METAR EGLL 041850Z 24012KT CAVOK 19/08 Q1023 NOSIG');
    assert.equal(result.isNoSignificantChange, true);
  });

  it('defaults to false when not present', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert.equal(result.isNoSignificantChange, false);
  });
});

// ---------------------------------------------------------------------------
// Remarks
// ---------------------------------------------------------------------------

describe('parseMetar - remarks', () => {
  it('parses AO2 station type', () => {
    const result = parseMetar(
      'METAR K1V4 041856Z AUTO 31007KT 10SM SCT090 22/M01 A3018 RMK AO2 SLP148 T02220011',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.stationType, 'AO2');
  });

  it('parses AO1 station type', () => {
    const result = parseMetar(
      'METAR KITH 041855Z AUTO 00000KT 10SM CLR 16/10 A3008 RMK AO1 SLP189 T01610100',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.stationType, 'AO1');
  });

  it('parses sea level pressure', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.seaLevelPressureMb, 1020.3);
  });

  it('parses low SLP correctly (900 range)', () => {
    const result = parseMetar(
      'METAR PANC 041854Z 12035G52KT 1SM RA BR OVC008 04/03 A2882 RMK AO2 PK WND 13058/1838 SLP782 P0022 T00390028',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.seaLevelPressureMb, 978.2);
  });

  it('parses SLPNO', () => {
    const result = parseMetar(
      'METAR KDEN 041856Z 25015G30KT 10SM FEW080 28/08 A3002 RMK AO2 SLPNO T02830078',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.seaLevelPressureNotAvailable, true);
    assert.equal(result.remarks.seaLevelPressureMb, undefined);
  });

  it('parses precise temperature and dewpoint', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.preciseTemperatureC, 18.3);
    assert.equal(result.remarks.preciseDewpointC, 6.1);
  });

  it('parses negative precise temps', () => {
    const result = parseMetar(
      'METAR KMSN 041854Z 33012G22KT 10SM FEW040 M04/M18 A3042 RMK AO2 SLP312 T10441183',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.preciseTemperatureC, -4.4);
    assert.equal(result.remarks.preciseDewpointC, -18.3);
  });

  it('parses hourly precipitation', () => {
    const result = parseMetar(
      'METAR KORD 041856Z COR 20015G25KT 6SM -RA BR SCT020 BKN035 OVC060 18/16 A2986 RMK AO2 RAB32 SLP108 P0012 T01830161',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.hourlyPrecipitationIn, 0.12);
  });

  it('parses 3/6 hour precipitation', () => {
    const result = parseMetar(
      'METAR KSTL 041856Z 21012KT 4SM -RA BR OVC015 16/14 A2990 RMK AO2 RAB22 SLP126 P0022 60048 70102 T01610139',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.threeSixHourPrecipitationIn, 0.48);
  });

  it('parses 24 hour precipitation', () => {
    const result = parseMetar(
      'METAR KSTL 041856Z 21012KT 4SM -RA BR OVC015 16/14 A2990 RMK AO2 RAB22 SLP126 P0022 60048 70102 T01610139',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.twentyFourHourPrecipitationIn, 1.02);
  });

  it('parses snow depth', () => {
    const result = parseMetar(
      'METAR KBTV 041856Z 35008KT 3SM -SN BR OVC012 M03/M05 A3034 RMK AO2 SLP298 4/012 P0004 T10281050',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.snowDepthIn, 12);
  });

  it('parses 24h max/min temperature', () => {
    const result = parseMetar(
      'METAR KMKE 041856Z 33010KT 10SM FEW040 SCT120 08/M02 A3020 RMK AO2 SLP238 401280028 T00830017',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.twentyFourHourMaxTemperatureC, 12.8);
    assert.equal(result.remarks.twentyFourHourMinTemperatureC, 2.8);
  });

  it('parses 6-hour max temperature', () => {
    const result = parseMetar(
      'METAR KORD 041856Z 33010KT 10SM FEW040 SCT120 08/M02 A3020 RMK AO2 SLP238 10066 21012 T00830017',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.sixHourMaxTemperatureC, 6.6);
  });

  it('parses 6-hour min temperature', () => {
    const result = parseMetar(
      'METAR KORD 041856Z 33010KT 10SM FEW040 SCT120 08/M02 A3020 RMK AO2 SLP238 10066 21012 T00830017',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.sixHourMinTemperatureC, -1.2);
  });

  it('parses peak wind with explicit hour', () => {
    const result = parseMetar(
      'METAR KDEN 041853Z 25015G30KT 10SM FEW080 SCT120 BKN200 28/08 A3002 RMK AO2 PK WND 26035/1822 SLP098 T02830078',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.peakWind);
    assert.equal(result.remarks.peakWind.directionDeg, 260);
    assert.equal(result.remarks.peakWind.speedKt, 35);
    assert.equal(result.remarks.peakWind.time.hour, 18);
    assert.equal(result.remarks.peakWind.time.minute, 22);
  });

  it('backfills peak wind hour from observation time when omitted', () => {
    // PK WND 33045/32 - only minute provided, hour backfilled from observation time (18Z)
    const result = parseMetar(
      'METAR KBIS 041856Z 33025G38KT 1/2SM BLSN VV010 M15/M18 A3066 RMK AO2 PK WND 33045/32 SLP400 T11501178',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.peakWind);
    assert.equal(result.remarks.peakWind.speedKt, 45);
    assert.equal(result.remarks.peakWind.time.hour, 18);
    assert.equal(result.remarks.peakWind.time.minute, 32);
  });

  it('backfills wind shift hour from observation time when omitted', () => {
    // WSHFT 35 - only minute provided, hour backfilled from observation time (19Z)
    const result = parseMetar(
      'SPECI KDFW 041942Z 35022G40KT 5SM TSRA FEW015CB BKN030 OVC060 19/17 A2986 RMK AO2 WSHFT 35 TSB30 SLP108 T01940172',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.windShift);
    assert.equal(result.remarks.windShift.time.hour, 19);
    assert.equal(result.remarks.windShift.time.minute, 35);
  });

  it('backfills precipitation event hours from observation time when omitted', () => {
    // RAB15E32B48 - all 2-digit (minute only), hours backfilled from observation time (18Z)
    const result = parseMetar(
      'METAR KCLE 041856Z 24012KT 6SM -RA BR BKN018 OVC030 14/12 A2992 RMK AO2 RAB15E32B48 SNE10 SLP134 P0008 60012 70028 T01390117',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.precipitationEvents);
    for (const event of result.remarks.precipitationEvents) {
      assert.equal(
        event.time.hour,
        18,
        `expected hour 18 for ${event.phenomenon} ${event.eventType}`,
      );
    }
  });

  it('preserves explicit hours on precipitation events', () => {
    // TSB0545E0615 - 4-digit times with explicit hours, should not be overwritten
    const result = parseMetar(
      'METAR KORD 041856Z 24012KT 6SM -RA BKN018 OVC030 14/12 A2992 RMK AO2 TSB0545E0615 SLP134 T01390117',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.precipitationEvents);
    const begin = result.remarks.precipitationEvents.find((e) => e.eventType === 'BEGIN');
    assert.ok(begin);
    assert.equal(begin.time.hour, 5);
    assert.equal(begin.time.minute, 45);
    const end = result.remarks.precipitationEvents.find((e) => e.eventType === 'END');
    assert.ok(end);
    assert.equal(end.time.hour, 6);
    assert.equal(end.time.minute, 15);
  });

  it('parses pressure falling rapidly', () => {
    const result = parseMetar(
      'METAR KBWI 041854Z 18018G28KT 4SM -TSRA BR BKN020CB OVC045 22/20 A2978 RMK AO2 TSB22 PRESFR SLP082 LTGICCG OHD TS OHD MOV NE P0018 T02220200',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.pressureFallingRapidly, true);
  });

  it('parses pressure rising rapidly', () => {
    const result = parseMetar(
      'METAR KGRK 041855Z 22055G105KT 1/4SM +TSRA FEW005CB BKN015 OVC030 20/18 A2938 RMK AO2 PK WND 22115/1842 TORNADO B40 2 W MOV E PRESRR SLP918 P0088 T02000178',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.pressureRisingRapidly, true);
  });

  it('parses pressure tendency', () => {
    const result = parseMetar(
      'METAR KSTL 041856Z 21010KT 10SM FEW040 SCT120 22/14 A3002 RMK AO2 SLP162 52032 T02220139',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.pressureTendency);
    assert.equal(result.remarks.pressureTendency.character, 2);
    assert.equal(result.remarks.pressureTendency.changeHpa, 3.2);
  });

  it('parses maintenance indicator', () => {
    const result = parseMetar(
      'METAR PANC 042253Z 04007KT 10SM BKN100 02/M09 A3012 RMK AO2 SLP202 T00221089 $',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.maintenanceIndicator, true);
  });

  it('parses variable visibility', () => {
    const result = parseMetar(
      'METAR KEWR 041854Z 03008KT 1SM BR OVC005 10/09 A2998 RMK AO2 VIS 1/2V2 CIG 003V008 SLP154 T01000089',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.variableVisibility);
    assert.equal(result.remarks.variableVisibility.minVisibilitySm, 0.5);
    assert.equal(result.remarks.variableVisibility.maxVisibilitySm, 2);
  });

  it('parses variable ceiling', () => {
    const result = parseMetar(
      'METAR KEWR 041854Z 03008KT 1SM BR OVC005 10/09 A2998 RMK AO2 VIS 1/2V2 CIG 003V008 SLP154 T01000089',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.variableCeiling);
    assert.equal(result.remarks.variableCeiling.minFtAgl, 300);
    assert.equal(result.remarks.variableCeiling.maxFtAgl, 800);
  });

  it('parses sector visibility', () => {
    const result = parseMetar(
      'METAR KMSY 041856Z 17006KT 5SM BR FEW003 SCT010 OVC020 22/21 A3002 RMK AO2 VIS N2 VIS NE3 SLP168 T02220211',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.sectorVisibility);
    assert.ok(result.remarks.sectorVisibility.length >= 2);
    const north = result.remarks.sectorVisibility.find((s) => s.direction === 'N');
    assert.ok(north);
    assert.equal(north.visibilitySm, 2);
  });

  it('parses sensor status codes', () => {
    const result = parseMetar(
      'METAR K2G9 041856Z AUTO 27005KT 10SM CLR 18/08 A3010 RMK AO2 TSNO PWINO FZRANO PNO SLP196 T01780078',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.missingData);
    assert.ok(result.remarks.missingData.includes('TSNO'));
    assert.ok(result.remarks.missingData.includes('PWINO'));
    assert.ok(result.remarks.missingData.includes('FZRANO'));
    assert.ok(result.remarks.missingData.includes('PNO'));
  });

  it('parses VISNO and CHINO with locations', () => {
    const result = parseMetar(
      'METAR K2G9 041856Z AUTO 27005KT 10SM CLR 18/08 A3010 RMK AO2 VISNO RWY06 CHINO RWY24 SLP196 T01780078',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.missingData);
    assert.ok(result.remarks.missingData.includes('VISNO RWY06'));
    assert.ok(result.remarks.missingData.includes('CHINO RWY24'));
  });

  it('parses RVRNO', () => {
    const result = parseMetar(
      'METAR KPIT 041856Z AUTO 28006KT 3SM BR OVC008 08/07 A2994 RMK AO2 RVRNO SLP144 T00830072',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.missingData);
    assert.ok(result.remarks.missingData.includes('RVRNO'));
  });

  it('parses wind shift with FROPA', () => {
    const result = parseMetar(
      'SPECI KDFW 041942Z 35022G40KT 5SM TSRA FEW015CB BKN030 OVC060 19/17 A2986 RMK AO2 PK WND 35045/1938 WSHFT 1935 FROPA TSB30 SLP108 T01940172',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.windShift);
    assert.equal(result.remarks.windShift.frontalPassage, true);
    assert.equal(result.remarks.windShift.time.minute, 35);
    assert.equal(result.remarks.windShift.time.hour, 19);
  });

  it('parses hail size (whole + fraction)', () => {
    const result = parseMetar(
      'METAR KICT 041853Z 22025G45KT 1SM +TSRAGR BKN020CB OVC040 18/16 A2968 RMK AO2 PK WND 23052/1840 TSB28 GR 1 3/4 SLP052 P0042 T01830161',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.hailSizeIn, 1.75);
  });

  it('parses hail size (fraction only)', () => {
    const result = parseMetar(
      'METAR KAMA 041853Z 24022G35KT 2SM SHGR FEW015CB BKN030 OVC050 16/12 A2978 RMK AO2 GR 3/4 SLP078 P0015 T01610122',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.hailSizeIn, 0.75);
  });

  it('parses precipitation begin/end events', () => {
    const result = parseMetar(
      'METAR KCLE 041856Z 24012KT 6SM -RA BR BKN018 OVC030 14/12 A2992 RMK AO2 RAB15E32B48 SNE10 SLP134 P0008 60012 70028 T01390117',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.precipitationEvents);
    assert.ok(result.remarks.precipitationEvents.length > 0);
  });

  it('parses ice accretion amounts', () => {
    const result = parseMetar(
      'METAR KBUF 041856Z 04010KT 2SM FZRA BR OVC012 M01/M03 A2996 RMK AO2 SLP148 I1005 I3012 I6025 T10111028',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.iceAccretion);
    assert.equal(result.remarks.iceAccretion.length, 3);
    assert.equal(result.remarks.iceAccretion[0]!.periodHours, 1);
    assert.equal(result.remarks.iceAccretion[0]!.amountIn, 0.05);
    assert.equal(result.remarks.iceAccretion[1]!.periodHours, 3);
    assert.equal(result.remarks.iceAccretion[1]!.amountIn, 0.12);
    assert.equal(result.remarks.iceAccretion[2]!.periodHours, 6);
    assert.equal(result.remarks.iceAccretion[2]!.amountIn, 0.25);
  });

  it('parses snow increasing rapidly', () => {
    const result = parseMetar(
      'METAR KMSN 041856Z 01015G25KT 1SM SN BKN010 OVC018 M02/M04 A3028 RMK AO2 SNINCR 2/10 SLP268 P0005 T10221039',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.snowIncreasing);
    assert.equal(result.remarks.snowIncreasing.lastHourIn, 2);
    assert.equal(result.remarks.snowIncreasing.totalDepthIn, 10);
  });

  it('parses water equivalent of snow', () => {
    const result = parseMetar(
      'METAR KBTV 041856Z 35008KT 3SM -SN BR OVC012 M03/M05 A3034 RMK AO2 SLP298 933036 4/012 T10281050',
    );
    assert.ok(result.remarks);
    assert.equal(result.remarks.waterEquivalentSnowIn, 3.6);
  });

  it('parses tower and surface visibility', () => {
    const result = parseMetar(
      'METAR KJFK 041856Z 18006KT 2SM BR OVC008 12/11 A2998 RMK AO2 TWR VIS 3 SFC VIS 1 SLP152 T01220111',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.towerSurfaceVisibility);
    assert.equal(result.remarks.towerSurfaceVisibility.length, 2);
    const twr = result.remarks.towerSurfaceVisibility.find((v) => v.source === 'TWR');
    assert.ok(twr);
    assert.equal(twr.visibilitySm, 3);
    const sfc = result.remarks.towerSurfaceVisibility.find((v) => v.source === 'SFC');
    assert.ok(sfc);
    assert.equal(sfc.visibilitySm, 1);
  });

  it('parses lightning', () => {
    const result = parseMetar(
      'METAR KTPA 041853Z 20015G25KT 5SM TSRA FEW018CB BKN035 OVC060 28/24 A3000 RMK AO2 FRQ LTGICCGCA OHD-NW TS OHD-NW MOV E SLP158 P0028 T02830239',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.lightning);
    assert.ok(result.remarks.lightning.length > 0);
    assert.ok(result.remarks.lightning[0]!.types.length > 0);
  });

  it('parses thunderstorm location/movement', () => {
    const result = parseMetar(
      'METAR KTPA 041853Z 20015G25KT 5SM TSRA FEW018CB BKN035 OVC060 28/24 A3000 RMK AO2 FRQ LTGICCGCA OHD-NW TS OHD-NW MOV E SLP158 P0028 T02830239',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.thunderstormInfo);
    assert.ok(result.remarks.thunderstormInfo.length > 0);
  });

  it('parses virga with direction', () => {
    const result = parseMetar(
      'METAR KLAS 041856Z 24010KT 10SM FEW090 SCT150 38/06 A2974 RMK AO2 VIRGA SW-W SLP048 T03830061',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.virga);
    assert.ok(result.remarks.virga.length > 0);
    assert.equal(result.remarks.virga[0]!.direction, 'SW-W');
  });

  it('parses variable sky condition', () => {
    const result = parseMetar(
      'METAR KIAD 041856Z 17008KT 10SM BKN015 OVC040 18/16 A2996 RMK AO2 BKN015 V OVC SLP144 T01830161',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.variableSkyCondition);
    assert.equal(result.remarks.variableSkyCondition.length, 1);
    assert.equal(result.remarks.variableSkyCondition[0]!.coverageLow, 'BKN');
    assert.equal(result.remarks.variableSkyCondition[0]!.coverageHigh, 'OVC');
    assert.equal(result.remarks.variableSkyCondition[0]!.altitudeFtAgl, 1500);
  });

  it('parses significant cloud types in remarks', () => {
    const result = parseMetar(
      'METAR KJAX 041856Z 20010KT 10SM FEW025TCU SCT045 BKN080 30/23 A3004 RMK AO2 SLP174 TCU W-NW T03000228',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.significantClouds);
    assert.ok(result.remarks.significantClouds.length > 0);
    assert.equal(result.remarks.significantClouds[0]!.type, 'TCU');
  });

  it('parses obscurations in remarks', () => {
    const result = parseMetar(
      'METAR KSFO 041856Z 28004KT 1SM BR OVC004 12/11 A2998 RMK AO2 FG SCT000 FU BKN010 SLP152 T01220111',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.obscurations);
    assert.ok(result.remarks.obscurations.length >= 1);
    const fg = result.remarks.obscurations.find((o) => o.phenomenon === 'FG');
    assert.ok(fg);
    assert.equal(fg.coverage, 'SCT');
    assert.equal(fg.altitudeFtAgl, 0);
  });

  it('parses visibility and ceiling at second location', () => {
    const result = parseMetar(
      'METAR KIAH 041856Z 18012KT 6SM HZ SCT025 BKN040 OVC080 29/23 A2988 RMK AO2 VIS 3/4 RWY15 CIG 013 RWY15 WS R15L SLP113 T02890228',
    );
    assert.ok(result.remarks);
    assert.ok(result.remarks.secondLocationObservations);
    assert.equal(result.remarks.secondLocationObservations.length, 2);
    const vis = result.remarks.secondLocationObservations.find((o) => o.type === 'VIS');
    assert.ok(vis);
    assert.equal(vis.visibilitySm, 0.75);
    assert.equal(vis.location, 'RWY15');
    const cig = result.remarks.secondLocationObservations.find((o) => o.type === 'CIG');
    assert.ok(cig);
    assert.equal(cig.ceilingFtAgl, 1300);
    assert.equal(cig.location, 'RWY15');
  });
});

// ---------------------------------------------------------------------------
// Flight category
// ---------------------------------------------------------------------------

describe('parseMetar - flight category', () => {
  it('derives VFR', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert.equal(result.flightCategory, 'VFR');
  });

  it('derives LIFR for low ceiling and low visibility', () => {
    const result = parseMetar(
      'METAR KSFO 041856Z 28012KT 1SM BR OVC004 12/11 A2998 RMK AO2 SLP152 T01220111',
    );
    assert.equal(result.flightCategory, 'LIFR');
  });

  it('derives LIFR for less-than visibility', () => {
    const result = parseMetar(
      'METAR KPHL 041856Z 00000KT M1/4SM FG VV002 08/08 A3005 RMK AO2 VIS 1/4V1 SLP178 T00830078',
    );
    assert.equal(result.flightCategory, 'LIFR');
  });

  it('derives VFR for CAVOK', () => {
    const result = parseMetar('METAR EGLL 041850Z 24012KT CAVOK 19/08 Q1023 NOSIG');
    assert.equal(result.flightCategory, 'VFR');
  });
});
