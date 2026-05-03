import { describe, it, expect, assert } from 'vitest';

import { parseMetar } from './metar-parser.js';

// ---------------------------------------------------------------------------
// Report type
// ---------------------------------------------------------------------------

describe('parseMetar - report type', () => {
  it('identifies METAR type', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    expect(result.type).toBe('METAR');
  });

  it('identifies SPECI type', () => {
    const result = parseMetar(
      'SPECI KJFK 041907Z 18010KT 3SM BR BKN005 OVC010 14/13 A2999 RMK AO2 CIG 003V008 SLP156 T01440133',
    );
    expect(result.type).toBe('SPECI');
  });

  it('defaults to METAR when no prefix is present', () => {
    const result = parseMetar(
      'KJFK 041953Z 22012KT 10SM FEW250 19/07 A3010 RMK AO2 SLP195 T01890067',
    );
    expect(result.type).toBe('METAR');
    expect(result.stationId).toBe('KJFK');
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
    expect(result.stationId).toBe('KJFK');
    expect(result.observationTime.day).toBe(4);
    expect(result.observationTime.hour).toBe(18);
    expect(result.observationTime.minute).toBe(53);
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
    expect(result.isAutomated).toBe(true);
    expect(result.isCorrected).toBe(false);
  });

  it('detects COR', () => {
    const result = parseMetar(
      'METAR KORD 041856Z COR 20015G25KT 6SM -RA BR SCT020 BKN035 OVC060 18/16 A2986 RMK AO2 RAB32 SLP108 P0012 T01830161',
    );
    expect(result.isCorrected).toBe(true);
    expect(result.isAutomated).toBe(false);
  });

  it('sets both false when neither present', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    expect(result.isAutomated).toBe(false);
    expect(result.isCorrected).toBe(false);
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
    assert(result.wind);
    expect(result.wind.directionDeg).toBe(210);
    expect(result.wind.speedKt).toBe(10);
    expect(result.wind.isVariable).toBe(false);
    expect(result.wind.isCalm).toBe(false);
    expect(result.wind.gustKt).toBe(undefined);
  });

  it('parses calm wind', () => {
    const result = parseMetar(
      'METAR KLAX 041853Z 00000KT 10SM CLR 20/11 A2995 RMK AO2 SLP142 T02000111',
    );
    assert(result.wind);
    expect(result.wind.isCalm).toBe(true);
    expect(result.wind.speedKt).toBe(0);
    expect(result.wind.directionDeg).toBe(undefined);
  });

  it('parses gusty wind', () => {
    const result = parseMetar(
      'METAR KDEN 041853Z 25015G30KT 10SM FEW080 SCT120 BKN200 28/08 A3002 RMK AO2 PK WND 26035/1822 SLP098 T02830078',
    );
    assert(result.wind);
    expect(result.wind.directionDeg).toBe(250);
    expect(result.wind.speedKt).toBe(15);
    expect(result.wind.gustKt).toBe(30);
  });

  it('parses extreme wind with 3-digit gusts', () => {
    const result = parseMetar(
      'METAR KGRK 041855Z 22055G105KT 1/4SM +TSRA FEW005CB BKN015 OVC030 20/18 A2938 RMK AO2 PK WND 22115/1842 TORNADO B40 2 W MOV E PRESRR SLP918 P0088 T02000178',
    );
    assert(result.wind);
    expect(result.wind.directionDeg).toBe(220);
    expect(result.wind.speedKt).toBe(55);
    expect(result.wind.gustKt).toBe(105);
  });

  it('parses variable wind direction', () => {
    const result = parseMetar(
      'METAR KORD 041851Z 23008KT 200V270 10SM SCT050 BKN120 22/14 A2987 RMK AO2 SLP109 T02220139',
    );
    assert(result.wind);
    expect(result.wind.directionDeg).toBe(230);
    expect(result.wind.variableFromDeg).toBe(200);
    expect(result.wind.variableToDeg).toBe(270);
  });

  it('parses VRB (variable) wind', () => {
    const result = parseMetar(
      'METAR KAUS 041856Z VRB04KT 10SM SCT250 22/14 A3008 RMK AO2 SLP186 T02220139',
    );
    assert(result.wind);
    expect(result.wind.isVariable).toBe(true);
    expect(result.wind.isCalm).toBe(false);
    expect(result.wind.speedKt).toBe(4);
    expect(result.wind.directionDeg).toBe(undefined);
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
    assert(result.visibility);
    expect(result.visibility.visibilitySm).toBe(10);
    expect(result.visibility.isLessThan).toBe(false);
  });

  it('parses fractional visibility (1 1/2SM)', () => {
    const result = parseMetar(
      'METAR KBOS 041854Z 05009KT 1 1/2SM BR SCT008 OVC015 09/08 A2991 RMK AO2 SLP132 T00890078',
    );
    assert(result.visibility);
    expect(result.visibility.visibilitySm).toBe(1.5);
  });

  it('parses less-than visibility (M1/4SM)', () => {
    const result = parseMetar(
      'METAR KPHL 041856Z 00000KT M1/4SM FG VV002 08/08 A3005 RMK AO2 VIS 1/4V1 SLP178 T00830078',
    );
    assert(result.visibility);
    expect(result.visibility.visibilitySm).toBe(0.25);
    expect(result.visibility.isLessThan).toBe(true);
  });

  it('parses fraction-only visibility (1/4SM)', () => {
    const result = parseMetar(
      'METAR KGRK 041855Z 22055G105KT 1/4SM +TSRA FEW005CB BKN015 OVC030 20/18 A2938 RMK AO2 PK WND 22115/1842 TORNADO B40 2 W MOV E PRESRR SLP918 P0088 T02000178',
    );
    assert(result.visibility);
    expect(result.visibility.visibilitySm).toBe(0.25);
  });

  it('parses half-mile visibility (1/2SM)', () => {
    const result = parseMetar(
      'METAR KBIS 041856Z 33025G38KT 1/2SM BLSN VV010 M15/M18 A3066 RMK AO2 PK WND 33045/1832 SLP400 T11501178',
    );
    assert(result.visibility);
    expect(result.visibility.visibilitySm).toBe(0.5);
  });

  it('parses CAVOK', () => {
    const result = parseMetar('METAR EGLL 041850Z 24012KT CAVOK 19/08 Q1023 NOSIG');
    expect(result.isCavok).toBe(true);
    expect(result.visibility).toBe(undefined);
  });

  it('parses ICAO meters visibility', () => {
    const result = parseMetar('METAR LFPG 041830Z 27008KT 0800 FG BKN002 OVC005 08/08 Q1022');
    assert(result.visibility);
    expect(result.visibility.visibilityM).toBe(800);
    expect(result.visibility.visibilitySm).toBe(undefined);
    expect(result.visibility.isLessThan).toBe(false);
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
    expect(result.rvr.length).toBe(2);
    expect(result.rvr[0]!.runway).toBe('27L');
    expect(result.rvr[0]!.visibilityFt).toBe(2400);
    expect(result.rvr[0]!.isMoreThan).toBe(false);
    expect(result.rvr[0]!.isLessThan).toBe(false);
    expect(result.rvr[0]!.variableMaxFt).toBe(undefined);
    expect(result.rvr[1]!.runway).toBe('27R');
    expect(result.rvr[1]!.visibilityFt).toBe(1800);
    expect(result.rvr[1]!.variableMaxFt).toBe(3000);
  });

  it('parses RVR with P (plus/more-than) prefix on variable max', () => {
    const result = parseMetar(
      'METAR KDFW 041153Z 36012KT 2SM R17C/4000VP6000FT TSRA BR FEW004 BKN010 OVC017CB 18/17 A2995',
    );
    expect(result.rvr.length).toBe(1);
    expect(result.rvr[0]!.runway).toBe('17C');
    expect(result.rvr[0]!.visibilityFt).toBe(4000);
    expect(result.rvr[0]!.isMoreThan).toBe(false);
    expect(result.rvr[0]!.variableMaxFt).toBe(6000);
    expect(result.rvr[0]!.isVariableMaxMoreThan).toBe(true);
  });

  it('parses RVR with P (plus/more-than) prefix on single value', () => {
    const result = parseMetar(
      'SPECI KMSP 042001Z 30018G23KT 1/2SM R30L/P6000FT SN FEW018 BKN029 OVC039 02/M01 A2984',
    );
    expect(result.rvr.length).toBe(1);
    expect(result.rvr[0]!.runway).toBe('30L');
    expect(result.rvr[0]!.visibilityFt).toBe(6000);
    expect(result.rvr[0]!.isMoreThan).toBe(true);
  });

  it('parses RVR with M (minus/less-than) prefix', () => {
    const result = parseMetar(
      'METAR KORD 041856Z 36005KT 1/4SM R10L/M0200FT FG VV001 01/01 A3010 RMK AO2 SLP198 T00110011',
    );
    expect(result.rvr.length).toBe(1);
    expect(result.rvr[0]!.runway).toBe('10L');
    expect(result.rvr[0]!.visibilityFt).toBe(200);
    expect(result.rvr[0]!.isLessThan).toBe(true);
    expect(result.rvr[0]!.isMoreThan).toBe(false);
  });

  it('parses RVR trend suffixes (U/D/N)', () => {
    const result = parseMetar(
      'METAR KJFK 041856Z 05008KT 1/2SM R04R/2000FTU R22L/1400FTD R31L/0800FTN FG VV002 08/08 A3002 RMK AO2 SLP168 T00830083',
    );
    expect(result.rvr.length).toBe(3);
    expect(result.rvr[0]!.trend).toBe('RISING');
    expect(result.rvr[1]!.trend).toBe('FALLING');
    expect(result.rvr[2]!.trend).toBe('NO_CHANGE');
  });

  it('reports empty RVR array when none present', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    expect(result.rvr.length).toBe(0);
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
    assert(tsra);
    expect(tsra.intensity).toBe('HEAVY');
    expect(tsra.descriptor).toBe('TS');
    assert(tsra.phenomena.includes('RA'));
  });

  it('parses freezing rain (FZRA)', () => {
    const result = parseMetar(
      'METAR KGRR 041854Z 02012G18KT 3SM FZRA BR OVC008 M01/M03 A2982 RMK AO2 SLP104 P0008 I1005 T10111028',
    );
    const fzra = result.weather.find((w) => w.raw === 'FZRA');
    assert(fzra);
    expect(fzra.descriptor).toBe('FZ');
    assert(fzra.phenomena.includes('RA'));
    expect(fzra.intensity).toBe('MODERATE');
  });

  it('parses light drizzle (-DZ)', () => {
    const result = parseMetar(
      'METAR KPDX 041856Z 17008KT 5SM -DZ OVC008 09/08 A3012 RMK AO2 SLP204 P0001 T00890078',
    );
    const dz = result.weather.find((w) => w.phenomena.includes('DZ'));
    assert(dz);
    expect(dz.intensity).toBe('LIGHT');
  });

  it('parses snow (SN)', () => {
    const result = parseMetar(
      'METAR KMSN 041854Z 01012G20KT 1SM SN BKN010 OVC018 M02/M04 A3028 RMK AO2 SLP268 P0005 4/009 T10221039',
    );
    assert(result.weather.find((w) => w.phenomena.includes('SN')));
  });

  it('parses snow grains (SG)', () => {
    const result = parseMetar(
      'METAR KFAR 041855Z 35006KT 6SM SG OVC010 M08/M10 A3052 RMK AO2 SLP348 T10781100',
    );
    assert(result.weather.find((w) => w.phenomena.includes('SG')));
  });

  it('parses ice crystals (IC)', () => {
    const result = parseMetar(
      'METAR PAFA 041854Z 00000KT 5SM IC FEW005 M32/M35 A3068 RMK AO2 SLP382 T13221350 ICE CRYSTALS',
    );
    assert(result.weather.find((w) => w.phenomena.includes('IC')));
  });

  it('parses ice pellets (PL)', () => {
    const result = parseMetar(
      'METAR KCMH 041856Z 04010KT 2SM PL BR OVC012 M01/M03 A2994 RMK AO2 SLP142 P0003 T10111028',
    );
    assert(result.weather.find((w) => w.phenomena.includes('PL')));
  });

  it('parses hail with thunderstorm (+TSRAGR)', () => {
    const result = parseMetar(
      'METAR KICT 041853Z 22025G45KT 1SM +TSRAGR BKN020CB OVC040 18/16 A2968 RMK AO2 PK WND 23052/1840 TSB28 GR 1 3/4 SLP052 P0042 T01830161',
    );
    const gr = result.weather.find((w) => w.phenomena.includes('GR'));
    assert(gr);
    expect(gr.intensity).toBe('HEAVY');
    expect(gr.descriptor).toBe('TS');
  });

  it('parses small hail (GS)', () => {
    const result = parseMetar(
      'METAR KSGF 041852Z 20018G30KT 2SM TSRAGS FEW012CB BKN025 OVC050 20/18 A2976 RMK AO2 TSB35 SLP074 GS P0018 T02000178',
    );
    assert(result.weather.find((w) => w.phenomena.includes('GS')));
  });

  it('parses unknown precipitation (UP)', () => {
    const result = parseMetar(
      'METAR K1G4 041856Z AUTO 24005KT 4SM UP OVC015 01/M01 A3004 RMK AO2 UP15 SLP178 T00111011',
    );
    assert(result.weather.find((w) => w.phenomena.includes('UP')));
  });

  it('parses mist (BR)', () => {
    const result = parseMetar(
      'METAR KSFO 041856Z 28012KT 1SM BR OVC004 12/11 A2998 RMK AO2 SLP152 T01220111',
    );
    assert(result.weather.find((w) => w.phenomena.includes('BR')));
  });

  it('parses fog (FG)', () => {
    const result = parseMetar(
      'METAR KPHL 041856Z 00000KT M1/4SM FG VV002 08/08 A3005 RMK AO2 VIS 1/4V1 SLP178 T00830078',
    );
    assert(result.weather.find((w) => w.phenomena.includes('FG')));
  });

  it('parses smoke (FU)', () => {
    const result = parseMetar(
      'METAR KRDD 041853Z 34010KT 3SM FU HZ FEW080 SCT150 34/11 A2988 RMK AO2 SLP108 T03390111',
    );
    assert(result.weather.find((w) => w.phenomena.includes('FU')));
  });

  it('parses volcanic ash (VA)', () => {
    const result = parseMetar(
      'METAR PADQ 041856Z 32015KT 3SM VA FEW015 BKN040 05/01 A2978 RMK AO2 SLP088 T00500011',
    );
    assert(result.weather.find((w) => w.phenomena.includes('VA')));
  });

  it('parses dust (DU)', () => {
    const result = parseMetar(
      'METAR KELP 041856Z 25025G40KT 2SM DU FEW080 SCT150 36/06 A2954 RMK AO2 PK WND 26048/1832 SLP002 BLDU T03610061',
    );
    assert(result.weather.find((w) => w.phenomena.includes('DU')));
  });

  it('parses sand (SA)', () => {
    const result = parseMetar(
      'METAR KTUS 041855Z 23030G45KT 1/2SM SA FEW040 35/08 A2948 RMK AO2 PK WND 24050/1840 BLSA SLP988 VIS N1/4 T03500078',
    );
    assert(result.weather.find((w) => w.phenomena.includes('SA')));
  });

  it('parses haze (HZ)', () => {
    const result = parseMetar(
      'METAR KPHX 041853Z 24008KT 5SM HZ FEW120 SCT200 38/09 A2962 RMK AO2 SLP022 T03830094',
    );
    assert(result.weather.find((w) => w.phenomena.includes('HZ')));
  });

  it('parses spray (PY)', () => {
    const result = parseMetar(
      'METAR PHKO 041856Z 27020G32KT 4SM PY FEW015 SCT030 26/20 A3002 RMK AO2 SLP168 T02610200',
    );
    assert(result.weather.find((w) => w.phenomena.includes('PY')));
  });

  it('parses squall (SQ)', () => {
    const result = parseMetar(
      'METAR KMOB 041853Z 22035G55KT 2SM +RA SQ BKN012 OVC025 23/22 A2964 RMK AO2 PK WND 23062/1840 PRESRR SLP040 P0048 T02280217',
    );
    assert(result.weather.find((w) => w.phenomena.includes('SQ')));
  });

  it('parses dust/sand whirls (PO)', () => {
    const result = parseMetar(
      'METAR KELP 041855Z 22015G30KT 5SM PO FEW100 38/08 A2960 RMK AO2 SLP018 T03830078',
    );
    assert(result.weather.find((w) => w.phenomena.includes('PO')));
  });

  it('parses funnel cloud (+FC)', () => {
    const result = parseMetar(
      'METAR KOKC 041856Z 20035G55KT 2SM +TSRA +FC BKN020CB OVC040 22/20 A2958 RMK AO2 PK WND 22065/1842 SLP012 T02220200',
    );
    const fc = result.weather.find((w) => w.phenomena.includes('FC'));
    assert(fc);
    expect(fc.intensity).toBe('HEAVY');
  });

  it('parses sandstorm (+SS)', () => {
    const result = parseMetar(
      'METAR KELP 041855Z 25040G60KT 1/4SM +SS FEW020 35/10 A2942 RMK AO2 PK WND 25068/1840 SLP982 T03500100',
    );
    const ss = result.weather.find((w) => w.phenomena.includes('SS'));
    assert(ss);
    expect(ss.intensity).toBe('HEAVY');
  });

  it('parses dust storm (+DS)', () => {
    const result = parseMetar(
      'METAR KTUS 041855Z 24035G55KT 1/4SM +DS FEW030 36/08 A2944 RMK AO2 PK WND 24060/1838 SLP986 T03610078',
    );
    assert(result.weather.find((w) => w.phenomena.includes('DS')));
  });

  it('parses mixed precipitation (RASN)', () => {
    const result = parseMetar(
      'METAR KPWM 041855Z 03012KT 2SM RASN BR OVC009 01/00 A2988 RMK AO2 SLP122 SNBGNTIME0830 P0004 T00110000',
    );
    const rasn = result.weather.find(
      (w) => w.phenomena.includes('RA') && w.phenomena.includes('SN'),
    );
    assert(rasn);
  });

  it('parses blowing snow (BL descriptor)', () => {
    const result = parseMetar(
      'METAR KBIS 041856Z 33025G38KT 1/2SM BLSN VV010 M15/M18 A3066 RMK AO2 PK WND 33045/1832 SLP400 T11501178',
    );
    const blsn = result.weather.find((w) => w.descriptor === 'BL');
    assert(blsn);
    assert(blsn.phenomena.includes('SN'));
  });

  it('parses drifting snow (DR descriptor)', () => {
    const result = parseMetar(
      'METAR KGFK 041854Z 31012KT 4SM DRSN FEW015 OVC025 M10/M14 A3058 RMK AO2 SLP378 T11001139',
    );
    const drsn = result.weather.find((w) => w.descriptor === 'DR');
    assert(drsn);
    assert(drsn.phenomena.includes('SN'));
  });

  it('parses freezing drizzle (FZ descriptor)', () => {
    const result = parseMetar(
      'METAR KBUF 041856Z 05008KT 4SM FZDZ BR OVC012 M00/M02 A2996 RMK AO2 SLP148 P0001 I1001 T10001017',
    );
    const fzdz = result.weather.find((w) => w.descriptor === 'FZ');
    assert(fzdz);
    assert(fzdz.phenomena.includes('DZ'));
  });

  it('parses shallow fog (MI descriptor)', () => {
    const result = parseMetar(
      'METAR KBNA 041856Z 00000KT 2SM MIFG SCT001 BKN120 14/14 A3004 RMK AO2 SLP174 T01440139',
    );
    const mifg = result.weather.find((w) => w.descriptor === 'MI');
    assert(mifg);
    assert(mifg.phenomena.includes('FG'));
  });

  it('parses patches of fog (BC descriptor)', () => {
    const result = parseMetar(
      'METAR KBOS 041856Z VRB03KT 3SM BCFG SCT002 BKN120 12/12 A3006 RMK AO2 SLP180 T01220117',
    );
    const bcfg = result.weather.find((w) => w.descriptor === 'BC');
    assert(bcfg);
    assert(bcfg.phenomena.includes('FG'));
  });

  it('parses shower hail (SH descriptor)', () => {
    const result = parseMetar(
      'METAR KAMA 041853Z 24022G35KT 2SM SHGR FEW015CB BKN030 OVC050 16/12 A2978 RMK AO2 GR 3/4 SLP078 P0015 T01610122',
    );
    const shgr = result.weather.find((w) => w.descriptor === 'SH');
    assert(shgr);
    assert(shgr.phenomena.includes('GR'));
  });

  it('parses thunderstorm without precipitation (TS)', () => {
    const result = parseMetar(
      'METAR KABQ 041856Z 22012KT 10SM TS FEW040CB SCT080 BKN150 30/10 A3004 RMK AO2 TSB42 OCNL LTGICCG SW TS SW MOV NE SLP098 T03000100',
    );
    const ts = result.weather.find((w) => w.descriptor === 'TS');
    assert(ts);
  });

  it('parses vicinity showers (VCSH)', () => {
    const result = parseMetar(
      'METAR KPBI 041856Z 14010KT 10SM VCSH FEW030 SCT050 BKN080 29/24 A3006 RMK AO2 RAE42 SLP178 P0000 T02890239',
    );
    const vcsh = result.weather.find((w) => w.isVicinity);
    assert(vcsh);
    expect(vcsh.descriptor).toBe('SH');
  });

  it('parses vicinity thunderstorm (VCTS)', () => {
    const result = parseMetar(
      'METAR KMCO 041853Z 26008KT 10SM VCTS FEW035CB SCT060 BKN120 31/23 A3002 RMK AO2 LTG DSNT W OCNL LTGICCG W CB DSNT W SLP165 T03110228',
    );
    const vcts = result.weather.find((w) => w.isVicinity);
    assert(vcts);
    expect(vcts.descriptor).toBe('TS');
  });

  it('parses vicinity fog (VCFG)', () => {
    const result = parseMetar(
      'METAR KBNA 041856Z 18004KT 10SM VCFG SCT002 BKN120 16/15 A3004 RMK AO2 SLP174 70005 T01610150',
    );
    const vcfg = result.weather.find((w) => w.isVicinity);
    assert(vcfg);
    assert(vcfg.phenomena.includes('FG'));
  });

  it('parses multiple weather groups', () => {
    const result = parseMetar(
      'METAR KMCI 041853Z 19020G35KT 3SM +TSRA BR FEW015 BKN030CB OVC060 21/19 A2974 RMK AO2 TSB32 PRESRR SLP065 FRQ LTGICCG OHD TS OHD MOV NE P0048 T02110194',
    );
    assert(result.weather.length >= 2);
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
    expect(result.sky.clear).toBe('CLR');
    expect(result.sky.layers.length).toBe(0);
  });

  it('parses SKC (manual sky clear)', () => {
    const result = parseMetar(
      'METAR KJFK 041856Z 18008KT 10SM SKC 24/12 A3010 RMK SLP198 T02440122',
    );
    expect(result.sky.clear).toBe('SKC');
    expect(result.sky.layers.length).toBe(0);
  });

  it('parses multiple cloud layers', () => {
    const result = parseMetar(
      'METAR KIAD 041856Z 17012KT 10SM FEW020 SCT040 BKN080 OVC120 24/18 A2996 RMK AO2 SLP144 T02390178',
    );
    expect(result.sky.layers.length).toBe(4);
    expect(result.sky.layers[0]!.coverage).toBe('FEW');
    expect(result.sky.layers[0]!.altitudeFtAgl).toBe(2000);
    expect(result.sky.layers[3]!.coverage).toBe('OVC');
    expect(result.sky.layers[3]!.altitudeFtAgl).toBe(12000);
  });

  it('parses CB cloud type', () => {
    const result = parseMetar(
      'METAR KGRK 041855Z 22055G105KT 1/4SM +TSRA FEW005CB BKN015 OVC030 20/18 A2938 RMK AO2 PK WND 22115/1842 TORNADO B40 2 W MOV E PRESRR SLP918 P0088 T02000178',
    );
    assert(result.sky.layers.find((l) => l.type === 'CB'));
  });

  it('parses TCU cloud type', () => {
    const result = parseMetar(
      'METAR KJAX 041856Z 20010KT 10SM FEW025TCU SCT045 BKN080 30/23 A3004 RMK AO2 SLP174 TCU W-NW T03000228',
    );
    assert(result.sky.layers.find((l) => l.type === 'TCU'));
  });

  it('parses vertical visibility', () => {
    const result = parseMetar(
      'METAR KSEA 041853Z 16005KT 1/4SM FG VV005 08/08 A3010 RMK AO2 SLP198 T00830078',
    );
    expect(result.sky.verticalVisibilityFtAgl).toBe(500);
    expect(result.sky.layers.length).toBe(0);
  });

  it('parses CAVOK as clear sky', () => {
    const result = parseMetar('METAR EGLL 041850Z 24012KT CAVOK 19/08 Q1023 NOSIG');
    expect(result.sky.clear).toBe('SKC');
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
    expect(result.temperatureC).toBe(18);
    expect(result.dewpointC).toBe(6);
  });

  it('parses negative temps', () => {
    const result = parseMetar(
      'METAR KMSN 041854Z 33012G22KT 10SM FEW040 M04/M18 A3042 RMK AO2 SLP312 T10441183',
    );
    expect(result.temperatureC).toBe(-4);
    expect(result.dewpointC).toBe(-18);
  });

  it('parses M00 as zero', () => {
    const result = parseMetar(
      'METAR KBUF 041856Z 05008KT 4SM FZDZ BR OVC012 M00/M02 A2996 RMK AO2 SLP148 P0001 I1001 T10001017',
    );
    expect(result.temperatureC).toBe(0);
    expect(result.dewpointC).toBe(-2);
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
    assert(result.altimeter);
    expect(result.altimeter.inHg).toBe(30.12);
  });

  it('parses ICAO altimeter (Q group)', () => {
    const result = parseMetar('METAR EGLL 041850Z 24012KT CAVOK 19/08 Q1023 NOSIG');
    assert(result.altimeter);
    expect(result.altimeter.hPa).toBe(1023);
  });
});

// ---------------------------------------------------------------------------
// NOSIG
// ---------------------------------------------------------------------------

describe('parseMetar - NOSIG', () => {
  it('detects NOSIG', () => {
    const result = parseMetar('METAR EGLL 041850Z 24012KT CAVOK 19/08 Q1023 NOSIG');
    expect(result.isNoSignificantChange).toBe(true);
  });

  it('defaults to false when not present', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    expect(result.isNoSignificantChange).toBe(false);
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
    assert(result.remarks);
    expect(result.remarks.stationType).toBe('AO2');
  });

  it('parses AO1 station type', () => {
    const result = parseMetar(
      'METAR KITH 041855Z AUTO 00000KT 10SM CLR 16/10 A3008 RMK AO1 SLP189 T01610100',
    );
    assert(result.remarks);
    expect(result.remarks.stationType).toBe('AO1');
  });

  it('parses sea level pressure', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert(result.remarks);
    expect(result.remarks.seaLevelPressureMb).toBe(1020.3);
  });

  it('parses low SLP correctly (900 range)', () => {
    const result = parseMetar(
      'METAR PANC 041854Z 12035G52KT 1SM RA BR OVC008 04/03 A2882 RMK AO2 PK WND 13058/1838 SLP782 P0022 T00390028',
    );
    assert(result.remarks);
    expect(result.remarks.seaLevelPressureMb).toBe(978.2);
  });

  it('parses SLPNO', () => {
    const result = parseMetar(
      'METAR KDEN 041856Z 25015G30KT 10SM FEW080 28/08 A3002 RMK AO2 SLPNO T02830078',
    );
    assert(result.remarks);
    expect(result.remarks.seaLevelPressureNotAvailable).toBe(true);
    expect(result.remarks.seaLevelPressureMb).toBe(undefined);
  });

  it('parses precise temperature and dewpoint', () => {
    const result = parseMetar(
      'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
    );
    assert(result.remarks);
    expect(result.remarks.preciseTemperatureC).toBe(18.3);
    expect(result.remarks.preciseDewpointC).toBe(6.1);
  });

  it('parses negative precise temps', () => {
    const result = parseMetar(
      'METAR KMSN 041854Z 33012G22KT 10SM FEW040 M04/M18 A3042 RMK AO2 SLP312 T10441183',
    );
    assert(result.remarks);
    expect(result.remarks.preciseTemperatureC).toBe(-4.4);
    expect(result.remarks.preciseDewpointC).toBe(-18.3);
  });

  it('parses hourly precipitation', () => {
    const result = parseMetar(
      'METAR KORD 041856Z COR 20015G25KT 6SM -RA BR SCT020 BKN035 OVC060 18/16 A2986 RMK AO2 RAB32 SLP108 P0012 T01830161',
    );
    assert(result.remarks);
    expect(result.remarks.hourlyPrecipitationIn).toBe(0.12);
  });

  it('parses 3/6 hour precipitation', () => {
    const result = parseMetar(
      'METAR KSTL 041856Z 21012KT 4SM -RA BR OVC015 16/14 A2990 RMK AO2 RAB22 SLP126 P0022 60048 70102 T01610139',
    );
    assert(result.remarks);
    expect(result.remarks.threeSixHourPrecipitationIn).toBe(0.48);
  });

  it('parses 24 hour precipitation', () => {
    const result = parseMetar(
      'METAR KSTL 041856Z 21012KT 4SM -RA BR OVC015 16/14 A2990 RMK AO2 RAB22 SLP126 P0022 60048 70102 T01610139',
    );
    assert(result.remarks);
    expect(result.remarks.twentyFourHourPrecipitationIn).toBe(1.02);
  });

  it('parses snow depth', () => {
    const result = parseMetar(
      'METAR KBTV 041856Z 35008KT 3SM -SN BR OVC012 M03/M05 A3034 RMK AO2 SLP298 4/012 P0004 T10281050',
    );
    assert(result.remarks);
    expect(result.remarks.snowDepthIn).toBe(12);
  });

  it('parses 24h max/min temperature', () => {
    const result = parseMetar(
      'METAR KMKE 041856Z 33010KT 10SM FEW040 SCT120 08/M02 A3020 RMK AO2 SLP238 401280028 T00830017',
    );
    assert(result.remarks);
    expect(result.remarks.twentyFourHourMaxTemperatureC).toBe(12.8);
    expect(result.remarks.twentyFourHourMinTemperatureC).toBe(2.8);
  });

  it('parses 6-hour max temperature', () => {
    const result = parseMetar(
      'METAR KORD 041856Z 33010KT 10SM FEW040 SCT120 08/M02 A3020 RMK AO2 SLP238 10066 21012 T00830017',
    );
    assert(result.remarks);
    expect(result.remarks.sixHourMaxTemperatureC).toBe(6.6);
  });

  it('parses 6-hour min temperature', () => {
    const result = parseMetar(
      'METAR KORD 041856Z 33010KT 10SM FEW040 SCT120 08/M02 A3020 RMK AO2 SLP238 10066 21012 T00830017',
    );
    assert(result.remarks);
    expect(result.remarks.sixHourMinTemperatureC).toBe(-1.2);
  });

  it('parses peak wind with explicit hour', () => {
    const result = parseMetar(
      'METAR KDEN 041853Z 25015G30KT 10SM FEW080 SCT120 BKN200 28/08 A3002 RMK AO2 PK WND 26035/1822 SLP098 T02830078',
    );
    assert(result.remarks);
    assert(result.remarks.peakWind);
    expect(result.remarks.peakWind.directionDeg).toBe(260);
    expect(result.remarks.peakWind.speedKt).toBe(35);
    expect(result.remarks.peakWind.time.hour).toBe(18);
    expect(result.remarks.peakWind.time.minute).toBe(22);
  });

  it('backfills peak wind hour from observation time when omitted', () => {
    // PK WND 33045/32 - only minute provided, hour backfilled from observation time (18Z)
    const result = parseMetar(
      'METAR KBIS 041856Z 33025G38KT 1/2SM BLSN VV010 M15/M18 A3066 RMK AO2 PK WND 33045/32 SLP400 T11501178',
    );
    assert(result.remarks);
    assert(result.remarks.peakWind);
    expect(result.remarks.peakWind.speedKt).toBe(45);
    expect(result.remarks.peakWind.time.hour).toBe(18);
    expect(result.remarks.peakWind.time.minute).toBe(32);
  });

  it('backfills wind shift hour from observation time when omitted', () => {
    // WSHFT 35 - only minute provided, hour backfilled from observation time (19Z)
    const result = parseMetar(
      'SPECI KDFW 041942Z 35022G40KT 5SM TSRA FEW015CB BKN030 OVC060 19/17 A2986 RMK AO2 WSHFT 35 TSB30 SLP108 T01940172',
    );
    assert(result.remarks);
    assert(result.remarks.windShift);
    expect(result.remarks.windShift.time.hour).toBe(19);
    expect(result.remarks.windShift.time.minute).toBe(35);
  });

  it('backfills precipitation event hours from observation time when omitted', () => {
    // RAB15E32B48 - all 2-digit (minute only), hours backfilled from observation time (18Z)
    const result = parseMetar(
      'METAR KCLE 041856Z 24012KT 6SM -RA BR BKN018 OVC030 14/12 A2992 RMK AO2 RAB15E32B48 SNE10 SLP134 P0008 60012 70028 T01390117',
    );
    assert(result.remarks);
    assert(result.remarks.precipitationEvents);
    for (const event of result.remarks.precipitationEvents) {
      expect(event.time.hour, `expected hour 18 for ${event.phenomenon} ${event.eventType}`).toBe(
        18,
      );
    }
  });

  it('preserves explicit hours on precipitation events', () => {
    // TSB0545E0615 - 4-digit times with explicit hours, should not be overwritten
    const result = parseMetar(
      'METAR KORD 041856Z 24012KT 6SM -RA BKN018 OVC030 14/12 A2992 RMK AO2 TSB0545E0615 SLP134 T01390117',
    );
    assert(result.remarks);
    assert(result.remarks.precipitationEvents);
    const begin = result.remarks.precipitationEvents.find((e) => e.eventType === 'BEGIN');
    assert(begin);
    expect(begin.time.hour).toBe(5);
    expect(begin.time.minute).toBe(45);
    const end = result.remarks.precipitationEvents.find((e) => e.eventType === 'END');
    assert(end);
    expect(end.time.hour).toBe(6);
    expect(end.time.minute).toBe(15);
  });

  it('parses pressure falling rapidly', () => {
    const result = parseMetar(
      'METAR KBWI 041854Z 18018G28KT 4SM -TSRA BR BKN020CB OVC045 22/20 A2978 RMK AO2 TSB22 PRESFR SLP082 LTGICCG OHD TS OHD MOV NE P0018 T02220200',
    );
    assert(result.remarks);
    expect(result.remarks.pressureFallingRapidly).toBe(true);
  });

  it('parses pressure rising rapidly', () => {
    const result = parseMetar(
      'METAR KGRK 041855Z 22055G105KT 1/4SM +TSRA FEW005CB BKN015 OVC030 20/18 A2938 RMK AO2 PK WND 22115/1842 TORNADO B40 2 W MOV E PRESRR SLP918 P0088 T02000178',
    );
    assert(result.remarks);
    expect(result.remarks.pressureRisingRapidly).toBe(true);
  });

  it('parses pressure tendency', () => {
    const result = parseMetar(
      'METAR KSTL 041856Z 21010KT 10SM FEW040 SCT120 22/14 A3002 RMK AO2 SLP162 52032 T02220139',
    );
    assert(result.remarks);
    assert(result.remarks.pressureTendency);
    expect(result.remarks.pressureTendency.character).toBe(2);
    expect(result.remarks.pressureTendency.changeHpa).toBe(3.2);
  });

  it('parses maintenance indicator', () => {
    const result = parseMetar(
      'METAR PANC 042253Z 04007KT 10SM BKN100 02/M09 A3012 RMK AO2 SLP202 T00221089 $',
    );
    assert(result.remarks);
    expect(result.remarks.maintenanceIndicator).toBe(true);
  });

  it('parses variable visibility', () => {
    const result = parseMetar(
      'METAR KEWR 041854Z 03008KT 1SM BR OVC005 10/09 A2998 RMK AO2 VIS 1/2V2 CIG 003V008 SLP154 T01000089',
    );
    assert(result.remarks);
    assert(result.remarks.variableVisibility);
    expect(result.remarks.variableVisibility.minVisibilitySm).toBe(0.5);
    expect(result.remarks.variableVisibility.maxVisibilitySm).toBe(2);
  });

  it('parses variable ceiling', () => {
    const result = parseMetar(
      'METAR KEWR 041854Z 03008KT 1SM BR OVC005 10/09 A2998 RMK AO2 VIS 1/2V2 CIG 003V008 SLP154 T01000089',
    );
    assert(result.remarks);
    assert(result.remarks.variableCeiling);
    expect(result.remarks.variableCeiling.minFtAgl).toBe(300);
    expect(result.remarks.variableCeiling.maxFtAgl).toBe(800);
  });

  it('parses sector visibility', () => {
    const result = parseMetar(
      'METAR KMSY 041856Z 17006KT 5SM BR FEW003 SCT010 OVC020 22/21 A3002 RMK AO2 VIS N2 VIS NE3 SLP168 T02220211',
    );
    assert(result.remarks);
    assert(result.remarks.sectorVisibility);
    assert(result.remarks.sectorVisibility.length >= 2);
    const north = result.remarks.sectorVisibility.find((s) => s.direction === 'N');
    assert(north);
    expect(north.visibilitySm).toBe(2);
  });

  it('parses sensor status codes', () => {
    const result = parseMetar(
      'METAR K2G9 041856Z AUTO 27005KT 10SM CLR 18/08 A3010 RMK AO2 TSNO PWINO FZRANO PNO SLP196 T01780078',
    );
    assert(result.remarks);
    assert(result.remarks.missingData);
    assert(result.remarks.missingData.includes('TSNO'));
    assert(result.remarks.missingData.includes('PWINO'));
    assert(result.remarks.missingData.includes('FZRANO'));
    assert(result.remarks.missingData.includes('PNO'));
  });

  it('parses VISNO and CHINO with locations', () => {
    const result = parseMetar(
      'METAR K2G9 041856Z AUTO 27005KT 10SM CLR 18/08 A3010 RMK AO2 VISNO RWY06 CHINO RWY24 SLP196 T01780078',
    );
    assert(result.remarks);
    assert(result.remarks.missingData);
    assert(result.remarks.missingData.includes('VISNO RWY06'));
    assert(result.remarks.missingData.includes('CHINO RWY24'));
  });

  it('parses RVRNO', () => {
    const result = parseMetar(
      'METAR KPIT 041856Z AUTO 28006KT 3SM BR OVC008 08/07 A2994 RMK AO2 RVRNO SLP144 T00830072',
    );
    assert(result.remarks);
    assert(result.remarks.missingData);
    assert(result.remarks.missingData.includes('RVRNO'));
  });

  it('parses wind shift with FROPA', () => {
    const result = parseMetar(
      'SPECI KDFW 041942Z 35022G40KT 5SM TSRA FEW015CB BKN030 OVC060 19/17 A2986 RMK AO2 PK WND 35045/1938 WSHFT 1935 FROPA TSB30 SLP108 T01940172',
    );
    assert(result.remarks);
    assert(result.remarks.windShift);
    expect(result.remarks.windShift.frontalPassage).toBe(true);
    expect(result.remarks.windShift.time.minute).toBe(35);
    expect(result.remarks.windShift.time.hour).toBe(19);
  });

  it('parses hail size (whole + fraction)', () => {
    const result = parseMetar(
      'METAR KICT 041853Z 22025G45KT 1SM +TSRAGR BKN020CB OVC040 18/16 A2968 RMK AO2 PK WND 23052/1840 TSB28 GR 1 3/4 SLP052 P0042 T01830161',
    );
    assert(result.remarks);
    expect(result.remarks.hailSizeIn).toBe(1.75);
  });

  it('parses hail size (fraction only)', () => {
    const result = parseMetar(
      'METAR KAMA 041853Z 24022G35KT 2SM SHGR FEW015CB BKN030 OVC050 16/12 A2978 RMK AO2 GR 3/4 SLP078 P0015 T01610122',
    );
    assert(result.remarks);
    expect(result.remarks.hailSizeIn).toBe(0.75);
  });

  it('parses hail size (GR LESS THAN fraction)', () => {
    const result = parseMetar(
      'METAR KMSP 041853Z 24015KT 5SM TSRAGR BKN030CB 18/16 A2992 RMK AO2 GR LESS THAN 1/4 SLP132 T01830161',
    );
    assert(result.remarks);
    expect(result.remarks.hailSizeIn).toBe(0.25);
  });

  it('parses hail size (GR whole inches without fraction)', () => {
    const result = parseMetar(
      'METAR KOMA 041853Z 24022G35KT 2SM SHGR FEW015CB BKN030 OVC050 16/12 A2978 RMK AO2 GR 2 SLP078 T01610122',
    );
    assert(result.remarks);
    expect(result.remarks.hailSizeIn).toBe(2);
  });

  it('parses VIRGA without a direction qualifier', () => {
    const result = parseMetar(
      'METAR KSFO 041853Z 24015KT 10SM SCT060 BKN200 22/14 A3015 RMK AO2 VIRGA',
    );
    assert(result.remarks);
    assert(result.remarks.virga);
    expect(result.remarks.virga[0]!.direction).toBeUndefined();
  });

  it('parses pressure falling rapidly (PRESFR) and rising rapidly (PRESRR)', () => {
    const fallResult = parseMetar('METAR KSFO 041853Z 24015KT 10SM CLR 22/14 A3015 RMK AO2 PRESFR');
    assert(fallResult.remarks);
    expect(fallResult.remarks.pressureFallingRapidly).toBe(true);

    const riseResult = parseMetar('METAR KSFO 041853Z 24015KT 10SM CLR 22/14 A3015 RMK AO2 PRESRR');
    assert(riseResult.remarks);
    expect(riseResult.remarks.pressureRisingRapidly).toBe(true);
  });

  it('parses maintenance indicator ($) in remarks', () => {
    const result = parseMetar('METAR KSFO 041853Z 24015KT 10SM CLR 22/14 A3015 RMK AO2 $');
    assert(result.remarks);
    expect(result.remarks.maintenanceIndicator).toBe(true);
  });

  it('parses snow increasing rapidly (SNINCR last/total)', () => {
    const result = parseMetar(
      'METAR KMSP 041853Z 36018KT 1SM SN BKN015 OVC025 M02/M04 A2998 RMK AO2 SNINCR 2/8',
    );
    assert(result.remarks);
    expect(result.remarks.snowIncreasing).toEqual({ lastHourIn: 2, totalDepthIn: 8 });
  });

  it('parses tower visibility (TWR VIS) in remarks', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 1/2SM FG OVC003 12/11 A2998 RMK AO2 TWR VIS 1/4',
    );
    assert(result.remarks);
    assert(result.remarks.towerSurfaceVisibility);
    expect(result.remarks.towerSurfaceVisibility[0]!.source).toBe('TWR');
    expect(result.remarks.towerSurfaceVisibility[0]!.visibilitySm).toBe(0.25);
  });

  it('parses surface visibility (SFC VIS) in remarks', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 1/2SM FG OVC003 12/11 A2998 RMK AO2 SFC VIS 1/2',
    );
    assert(result.remarks);
    assert(result.remarks.towerSurfaceVisibility);
    expect(result.remarks.towerSurfaceVisibility[0]!.source).toBe('SFC');
  });

  it('parses variable visibility (VIS minVmax) in remarks', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 1SM BR OVC008 12/11 A2998 RMK AO2 VIS 1/2V2',
    );
    assert(result.remarks);
    assert(result.remarks.variableVisibility);
    expect(result.remarks.variableVisibility.minVisibilitySm).toBe(0.5);
    expect(result.remarks.variableVisibility.maxVisibilitySm).toBe(2);
  });

  it('parses sector visibility (VIS dir value) in remarks', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 1SM BR OVC008 12/11 A2998 RMK AO2 VIS NE2',
    );
    assert(result.remarks);
    assert(result.remarks.sectorVisibility);
    expect(result.remarks.sectorVisibility[0]!.direction).toBe('NE');
    expect(result.remarks.sectorVisibility[0]!.visibilitySm).toBe(2);
  });

  it('parses CIG variable ceiling in remarks', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 5SM BKN005 12/11 A2998 RMK AO2 CIG 003V008',
    );
    assert(result.remarks);
    assert(result.remarks.variableCeiling);
    expect(result.remarks.variableCeiling.minFtAgl).toBe(300);
    expect(result.remarks.variableCeiling.maxFtAgl).toBe(800);
  });

  it('parses CIG at second location (CIG hhh RWY##)', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 5SM BKN005 12/11 A2998 RMK AO2 CIG 017 RWY11',
    );
    assert(result.remarks);
    assert(result.remarks.secondLocationObservations);
    expect(result.remarks.secondLocationObservations[0]!.type).toBe('CIG');
  });

  it('parses obscuration phenomenon (FG SCT000)', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 1/2SM FG OVC005 12/11 A2998 RMK AO2 FG SCT000',
    );
    assert(result.remarks);
    assert(result.remarks.obscurations);
    expect(result.remarks.obscurations[0]!.phenomenon).toBe('FG');
    expect(result.remarks.obscurations[0]!.coverage).toBe('SCT');
  });

  it('parses precipitation begin/end events', () => {
    const result = parseMetar(
      'METAR KCLE 041856Z 24012KT 6SM -RA BR BKN018 OVC030 14/12 A2992 RMK AO2 RAB15E32B48 SNE10 SLP134 P0008 60012 70028 T01390117',
    );
    assert(result.remarks);
    assert(result.remarks.precipitationEvents);
    assert(result.remarks.precipitationEvents.length > 0);
  });

  it('parses ice accretion amounts', () => {
    const result = parseMetar(
      'METAR KBUF 041856Z 04010KT 2SM FZRA BR OVC012 M01/M03 A2996 RMK AO2 SLP148 I1005 I3012 I6025 T10111028',
    );
    assert(result.remarks);
    assert(result.remarks.iceAccretion);
    expect(result.remarks.iceAccretion.length).toBe(3);
    expect(result.remarks.iceAccretion[0]!.periodHours).toBe(1);
    expect(result.remarks.iceAccretion[0]!.amountIn).toBe(0.05);
    expect(result.remarks.iceAccretion[1]!.periodHours).toBe(3);
    expect(result.remarks.iceAccretion[1]!.amountIn).toBe(0.12);
    expect(result.remarks.iceAccretion[2]!.periodHours).toBe(6);
    expect(result.remarks.iceAccretion[2]!.amountIn).toBe(0.25);
  });

  it('parses snow increasing rapidly', () => {
    const result = parseMetar(
      'METAR KMSN 041856Z 01015G25KT 1SM SN BKN010 OVC018 M02/M04 A3028 RMK AO2 SNINCR 2/10 SLP268 P0005 T10221039',
    );
    assert(result.remarks);
    assert(result.remarks.snowIncreasing);
    expect(result.remarks.snowIncreasing.lastHourIn).toBe(2);
    expect(result.remarks.snowIncreasing.totalDepthIn).toBe(10);
  });

  it('parses water equivalent of snow', () => {
    const result = parseMetar(
      'METAR KBTV 041856Z 35008KT 3SM -SN BR OVC012 M03/M05 A3034 RMK AO2 SLP298 933036 4/012 T10281050',
    );
    assert(result.remarks);
    expect(result.remarks.waterEquivalentSnowIn).toBe(3.6);
  });

  it('parses tower and surface visibility', () => {
    const result = parseMetar(
      'METAR KJFK 041856Z 18006KT 2SM BR OVC008 12/11 A2998 RMK AO2 TWR VIS 3 SFC VIS 1 SLP152 T01220111',
    );
    assert(result.remarks);
    assert(result.remarks.towerSurfaceVisibility);
    expect(result.remarks.towerSurfaceVisibility.length).toBe(2);
    const twr = result.remarks.towerSurfaceVisibility.find((v) => v.source === 'TWR');
    assert(twr);
    expect(twr.visibilitySm).toBe(3);
    const sfc = result.remarks.towerSurfaceVisibility.find((v) => v.source === 'SFC');
    assert(sfc);
    expect(sfc.visibilitySm).toBe(1);
  });

  it('parses lightning', () => {
    const result = parseMetar(
      'METAR KTPA 041853Z 20015G25KT 5SM TSRA FEW018CB BKN035 OVC060 28/24 A3000 RMK AO2 FRQ LTGICCGCA OHD-NW TS OHD-NW MOV E SLP158 P0028 T02830239',
    );
    assert(result.remarks);
    assert(result.remarks.lightning);
    assert(result.remarks.lightning.length > 0);
    assert(result.remarks.lightning[0]!.types.length > 0);
  });

  it('parses thunderstorm location/movement', () => {
    const result = parseMetar(
      'METAR KTPA 041853Z 20015G25KT 5SM TSRA FEW018CB BKN035 OVC060 28/24 A3000 RMK AO2 FRQ LTGICCGCA OHD-NW TS OHD-NW MOV E SLP158 P0028 T02830239',
    );
    assert(result.remarks);
    assert(result.remarks.thunderstormInfo);
    assert(result.remarks.thunderstormInfo.length > 0);
  });

  it('parses virga with direction', () => {
    const result = parseMetar(
      'METAR KLAS 041856Z 24010KT 10SM FEW090 SCT150 38/06 A2974 RMK AO2 VIRGA SW-W SLP048 T03830061',
    );
    assert(result.remarks);
    assert(result.remarks.virga);
    assert(result.remarks.virga.length > 0);
    expect(result.remarks.virga[0]!.direction).toBe('SW-W');
  });

  it('parses variable sky condition', () => {
    const result = parseMetar(
      'METAR KIAD 041856Z 17008KT 10SM BKN015 OVC040 18/16 A2996 RMK AO2 BKN015 V OVC SLP144 T01830161',
    );
    assert(result.remarks);
    assert(result.remarks.variableSkyCondition);
    expect(result.remarks.variableSkyCondition.length).toBe(1);
    expect(result.remarks.variableSkyCondition[0]!.coverageLow).toBe('BKN');
    expect(result.remarks.variableSkyCondition[0]!.coverageHigh).toBe('OVC');
    expect(result.remarks.variableSkyCondition[0]!.altitudeFtAgl).toBe(1500);
  });

  it('parses significant cloud types in remarks', () => {
    const result = parseMetar(
      'METAR KJAX 041856Z 20010KT 10SM FEW025TCU SCT045 BKN080 30/23 A3004 RMK AO2 SLP174 TCU W-NW T03000228',
    );
    assert(result.remarks);
    assert(result.remarks.significantClouds);
    assert(result.remarks.significantClouds.length > 0);
    expect(result.remarks.significantClouds[0]!.type).toBe('TCU');
  });

  it('parses obscurations in remarks', () => {
    const result = parseMetar(
      'METAR KSFO 041856Z 28004KT 1SM BR OVC004 12/11 A2998 RMK AO2 FG SCT000 FU BKN010 SLP152 T01220111',
    );
    assert(result.remarks);
    assert(result.remarks.obscurations);
    assert(result.remarks.obscurations.length >= 1);
    const fg = result.remarks.obscurations.find((o) => o.phenomenon === 'FG');
    assert(fg);
    expect(fg.coverage).toBe('SCT');
    expect(fg.altitudeFtAgl).toBe(0);
  });

  it('parses visibility and ceiling at second location', () => {
    const result = parseMetar(
      'METAR KIAH 041856Z 18012KT 6SM HZ SCT025 BKN040 OVC080 29/23 A2988 RMK AO2 VIS 3/4 RWY15 CIG 013 RWY15 WS R15L SLP113 T02890228',
    );
    assert(result.remarks);
    assert(result.remarks.secondLocationObservations);
    expect(result.remarks.secondLocationObservations.length).toBe(2);
    const vis = result.remarks.secondLocationObservations.find((o) => o.type === 'VIS');
    assert(vis);
    expect(vis.visibilitySm).toBe(0.75);
    expect(vis.location).toBe('RWY15');
    const cig = result.remarks.secondLocationObservations.find((o) => o.type === 'CIG');
    assert(cig);
    expect(cig.ceilingFtAgl).toBe(1300);
    expect(cig.location).toBe('RWY15');
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
    expect(result.flightCategory).toBe('VFR');
  });

  it('derives LIFR for low ceiling and low visibility', () => {
    const result = parseMetar(
      'METAR KSFO 041856Z 28012KT 1SM BR OVC004 12/11 A2998 RMK AO2 SLP152 T01220111',
    );
    expect(result.flightCategory).toBe('LIFR');
  });

  it('derives LIFR for less-than visibility', () => {
    const result = parseMetar(
      'METAR KPHL 041856Z 00000KT M1/4SM FG VV002 08/08 A3005 RMK AO2 VIS 1/4V1 SLP178 T00830078',
    );
    expect(result.flightCategory).toBe('LIFR');
  });

  it('derives VFR for CAVOK', () => {
    const result = parseMetar('METAR EGLL 041850Z 24012KT CAVOK 19/08 Q1023 NOSIG');
    expect(result.flightCategory).toBe('VFR');
  });
});

describe('parseMetar - coverage edge cases', () => {
  it('parses a METAR with variable wind direction (200V270)', () => {
    // Exercises the variable-wind 200V270 token branch.
    const result = parseMetar('METAR KORD 041851Z 24015KT 200V270 10SM SCT250 22/14 A3015 RMK AO2');
    expect(result.wind?.variableFromDeg).toBe(200);
    expect(result.wind?.variableToDeg).toBe(270);
  });

  it('parses a METAR with NOSIG indicator after the body', () => {
    const result = parseMetar('METAR EGLL 041850Z 24012KT 9999 BKN030 19/08 Q1023 NOSIG');
    expect(result.isNoSignificantChange).toBe(true);
  });

  it('parses a METAR with vertical visibility (VV) when the sky is obscured', () => {
    const result = parseMetar(
      'METAR KPHL 041856Z 00000KT M1/4SM FG VV002 08/08 A3005 RMK AO2 SLP178 T00830078',
    );
    expect(result.sky.verticalVisibilityFtAgl).toBe(200);
  });

  it('parses a METAR with an SKC (sky clear) token', () => {
    const result = parseMetar('METAR KAUS 041856Z 18012KT 10SM SKC 28/12 A3005 RMK AO2');
    expect(result.sky.clear).toBe('SKC');
  });

  it('parses a METAR without temperature or altimeter (only mandatory fields)', () => {
    // Exercises the falsy branches of temperatureC, dewpointC, altimeter spreads.
    const result = parseMetar('METAR KSFO 041856Z 24012KT 10SM CLR');
    expect(result.temperatureC).toBeUndefined();
    expect(result.dewpointC).toBeUndefined();
    expect(result.altimeter).toBeUndefined();
  });

  it('parses an RVR group with rising trend indicator', () => {
    const result = parseMetar(
      'METAR KORD 041851Z 24012KT 1/2SM R10L/2400FTU FG OVC004 12/11 A2998 RMK AO2',
    );
    expect(result.rvr[0]?.trend).toBe('RISING');
  });

  it('parses multiple lightning observations in a single remarks block', () => {
    // Two lightning entries exercise the "lightning array already initialized" branch.
    const result = parseMetar(
      'METAR KORD 041851Z 24012KT 5SM TS BKN040CB 22/14 A3015 RMK AO2 LTGIC OHD LTGCG DSNT NW',
    );
    assert(result.remarks);
    assert(result.remarks.lightning);
    expect(result.remarks.lightning.length).toBeGreaterThanOrEqual(2);
  });

  it('parses multiple thunderstorm info reports in a single remarks block', () => {
    const result = parseMetar(
      'METAR KORD 041851Z 24012KT 5SM TS BKN040CB 22/14 A3015 RMK AO2 TS NE MOV E TS SW MOV E',
    );
    assert(result.remarks);
    assert(result.remarks.thunderstormInfo);
    expect(result.remarks.thunderstormInfo.length).toBeGreaterThanOrEqual(2);
  });

  it('parses multiple virga observations in a single remarks block', () => {
    const result = parseMetar(
      'METAR KSFO 041853Z 24015KT 10SM SCT060 22/14 A3015 RMK AO2 VIRGA NE VIRGA SW',
    );
    assert(result.remarks);
    assert(result.remarks.virga);
    expect(result.remarks.virga.length).toBeGreaterThanOrEqual(2);
  });

  it('parses multiple significant cloud reports in a single remarks block', () => {
    const result = parseMetar(
      'METAR KORD 041851Z 24012KT 5SM BKN040 22/14 A3015 RMK AO2 CB DSNT NE TCU OHD',
    );
    assert(result.remarks);
    assert(result.remarks.significantClouds);
    expect(result.remarks.significantClouds.length).toBeGreaterThanOrEqual(2);
  });

  it('parses multiple obscuration reports in a single remarks block', () => {
    const result = parseMetar(
      'METAR KORD 041851Z 24012KT 1/2SM FG BR OVC005 12/11 A2998 RMK AO2 FG SCT000 BR SCT001',
    );
    assert(result.remarks);
    assert(result.remarks.obscurations);
    expect(result.remarks.obscurations.length).toBeGreaterThanOrEqual(2);
  });

  it('parses multiple sector visibility reports', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 1SM BR OVC008 12/11 A2998 RMK AO2 VIS NE2 VIS SW1',
    );
    assert(result.remarks);
    assert(result.remarks.sectorVisibility);
    expect(result.remarks.sectorVisibility.length).toBeGreaterThanOrEqual(2);
  });

  it('parses both TWR VIS and SFC VIS in the same remarks block', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 1/2SM FG OVC003 12/11 A2998 RMK AO2 TWR VIS 1/4 SFC VIS 1/2',
    );
    assert(result.remarks);
    assert(result.remarks.towerSurfaceVisibility);
    expect(result.remarks.towerSurfaceVisibility.length).toBeGreaterThanOrEqual(2);
  });

  it('parses VISNO with location qualifier', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 10SM CLR 22/14 A3015 RMK AO2 VISNO RWY06',
    );
    assert(result.remarks);
    assert(result.remarks.missingData);
    expect(result.remarks.missingData).toContain('VISNO RWY06');
  });

  it('parses bare VISNO without a location qualifier', () => {
    const result = parseMetar('METAR KORD 041853Z 24012KT 10SM CLR 22/14 A3015 RMK AO2 VISNO');
    assert(result.remarks);
    assert(result.remarks.missingData);
    expect(result.remarks.missingData).toContain('VISNO');
  });

  it('parses CHINO with location qualifier', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 10SM CLR 22/14 A3015 RMK AO2 CHINO RWY06',
    );
    assert(result.remarks);
    assert(result.remarks.missingData);
    expect(result.remarks.missingData).toContain('CHINO RWY06');
  });

  it('parses bare CHINO without a location qualifier', () => {
    const result = parseMetar('METAR KORD 041853Z 24012KT 10SM CLR 22/14 A3015 RMK AO2 CHINO');
    assert(result.remarks);
    assert(result.remarks.missingData);
    expect(result.remarks.missingData).toContain('CHINO');
  });

  it('parses peak wind with HHMM time format', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24052G65KT 5SM TS BKN040CB 22/14 A3015 RMK AO2 PK WND 24065/1842',
    );
    assert(result.remarks);
    assert(result.remarks.peakWind);
    expect(result.remarks.peakWind.time.hour).toBe(18);
    expect(result.remarks.peakWind.time.minute).toBe(42);
  });

  it('parses peak wind with MM-only time using observation hour', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24052G65KT 5SM TS BKN040CB 22/14 A3015 RMK AO2 PK WND 24065/45',
    );
    assert(result.remarks);
    assert(result.remarks.peakWind);
    // observationHour is 18 (from 041853Z)
    expect(result.remarks.peakWind.time.hour).toBe(18);
    expect(result.remarks.peakWind.time.minute).toBe(45);
  });

  it('parses wind shift with HHMM and FROPA marker', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24015KT 10SM CLR 22/14 A3015 RMK AO2 WSHFT 1830 FROPA',
    );
    assert(result.remarks);
    assert(result.remarks.windShift);
    expect(result.remarks.windShift.frontalPassage).toBe(true);
  });

  it('parses wind shift with MM-only time (no hour)', () => {
    const result = parseMetar('METAR KORD 041853Z 24015KT 10SM CLR 22/14 A3015 RMK AO2 WSHFT 30');
    assert(result.remarks);
    assert(result.remarks.windShift);
    expect(result.remarks.windShift.time.minute).toBe(30);
  });

  it('parses precipitation events (RAB15E32 etc.)', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24015KT 5SM RA OVC020 12/11 A2998 RMK AO2 RAB15E32 SNB10',
    );
    assert(result.remarks);
    assert(result.remarks.precipitationEvents);
    expect(result.remarks.precipitationEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('parses VIS at second location (VIS 3/4 RWY11)', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 1SM BR OVC008 12/11 A2998 RMK AO2 VIS 3/4 RWY11',
    );
    assert(result.remarks);
    assert(result.remarks.secondLocationObservations);
    expect(result.remarks.secondLocationObservations[0]!.type).toBe('VIS');
  });

  it('parses VIRGA with a directional range qualifier (NE-E)', () => {
    const result = parseMetar(
      'METAR KSFO 041853Z 24015KT 10SM SCT060 22/14 A3015 RMK AO2 VIRGA NE-E',
    );
    assert(result.remarks);
    assert(result.remarks.virga);
    expect(result.remarks.virga[0]!.direction).toBe('NE-E');
  });

  it('parses variable sky condition (FEW020 V SCT)', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 5SM FEW020 22/14 A3015 RMK AO2 FEW020 V SCT',
    );
    assert(result.remarks);
    assert(result.remarks.variableSkyCondition);
    expect(result.remarks.variableSkyCondition[0]!.coverageLow).toBe('FEW');
    expect(result.remarks.variableSkyCondition[0]!.coverageHigh).toBe('SCT');
  });

  it('parses ice accretion in remarks (1nnn 6-hourly)', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 36015KT 3SM -FZRA OVC020 M02/M03 A2998 RMK AO2 I1010 I3025 I6050',
    );
    assert(result.remarks);
    expect(result.remarks.iceAccretion).toBeDefined();
  });

  it('parses snow water equivalent (933###)', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 36015KT 3SM SN OVC020 M02/M03 A2998 RMK AO2 933036',
    );
    assert(result.remarks);
    expect(result.remarks.waterEquivalentSnowIn).toBeCloseTo(3.6);
  });

  it('parses GS (small hail observed without size)', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24025KT 2SM TSRA SHGS BKN030CB 18/16 A2992 RMK AO2 GS',
    );
    // GS is recognized but produces no specific output; just ensure parsing
    // doesn't fail and other remarks are still captured.
    assert(result.remarks);
  });

  it('parses a METAR with RVR variable max and trend (e.g. R27L/2400V3000FTU)', () => {
    // Exercises RVR variable-max truthy and trend truthy branches.
    const result = parseMetar(
      'METAR KORD 041851Z 24012KT 1/2SM R27L/2400V3000FTU FG OVC004 12/11 A2998 RMK AO2',
    );
    expect(result.rvr.length).toBeGreaterThan(0);
    expect(result.rvr[0]?.variableMaxFt).toBe(3000);
    expect(result.rvr[0]?.trend).toBe('RISING');
  });

  it('parses a METAR with RVR P (greater-than) prefix', () => {
    const result = parseMetar(
      'METAR KORD 041851Z 24012KT 1/2SM R27L/P6000FT FG OVC004 12/11 A2998 RMK AO2',
    );
    expect(result.rvr[0]?.isMoreThan).toBe(true);
  });

  it('parses a METAR with RVR M (less-than) prefix', () => {
    const result = parseMetar(
      'METAR KORD 041851Z 24012KT 1/2SM R27L/M0200FT FG OVC004 12/11 A2998 RMK AO2',
    );
    expect(result.rvr[0]?.isLessThan).toBe(true);
  });

  it('parses a METAR with falling RVR trend', () => {
    const result = parseMetar(
      'METAR KORD 041851Z 24012KT 1/2SM R27L/2400FTD FG OVC004 12/11 A2998 RMK AO2',
    );
    expect(result.rvr[0]?.trend).toBe('FALLING');
  });

  it('parses a METAR with no-change RVR trend', () => {
    const result = parseMetar(
      'METAR KORD 041851Z 24012KT 1/2SM R27L/2400FTN FG OVC004 12/11 A2998 RMK AO2',
    );
    expect(result.rvr[0]?.trend).toBe('NO_CHANGE');
  });

  it('handles GR token at the end of remarks (no following hail size)', () => {
    // Exercises the "i + 1 < tokens.length" false branch in hail parsing.
    const result = parseMetar(
      'METAR KORD 041853Z 24025KT 2SM TSRA SHGR BKN030CB 18/16 A2992 RMK AO2 GR',
    );
    assert(result.remarks);
    expect(result.remarks.hailSizeIn).toBeUndefined();
  });

  it('handles WSHFT token at the end of remarks (no following time)', () => {
    const result = parseMetar('METAR KORD 041853Z 24015KT 10SM CLR 22/14 A3015 RMK AO2 WSHFT');
    assert(result.remarks);
    expect(result.remarks.windShift).toBeUndefined();
  });

  it('handles SNINCR token at the end of remarks (no following counter)', () => {
    const result = parseMetar(
      'METAR KMSP 041853Z 36018KT 1SM SN BKN015 OVC025 M02/M04 A2998 RMK AO2 SNINCR',
    );
    assert(result.remarks);
    expect(result.remarks.snowIncreasing).toBeUndefined();
  });

  it('handles PK at the end of remarks (no following WND token)', () => {
    const result = parseMetar('METAR KORD 041853Z 24052KT 5SM TS BKN040CB 22/14 A3015 RMK AO2 PK');
    assert(result.remarks);
    expect(result.remarks.peakWind).toBeUndefined();
  });

  it('handles a remarks block with no recognized tokens (just AO2)', () => {
    // Exercises the "fallthrough" loop end where i++ runs without matching
    // any pattern - keeps the remark intact with no specific extractions.
    const result = parseMetar(
      'METAR KORD 041853Z 24015KT 10SM CLR 22/14 A3015 RMK AO2 UNKNOWN_TOKEN ANOTHER_ONE',
    );
    assert(result.remarks);
    // The unrecognized tokens just get passed over; sea-level pressure / temp
    // groups won't be set because the regexes don't match.
  });

  it('parses obscuration phenomenon followed by a non-cloud token (no obscMatch)', () => {
    // Exercises the false branch of obscMatch in remarks parsing.
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 1/2SM FG OVC005 12/11 A2998 RMK AO2 FG NOTACLOUD',
    );
    assert(result.remarks);
    expect(result.remarks.obscurations).toBeUndefined();
  });

  it('parses CIG followed by a non-numeric / non-V token', () => {
    // Exercises the false branches of cigVarMatch and cigHgtMatch.
    const result = parseMetar('METAR KORD 041853Z 24012KT 5SM BKN005 12/11 A2998 RMK AO2 CIG XYZ');
    assert(result.remarks);
    expect(result.remarks.variableCeiling).toBeUndefined();
  });

  it('parses VIS followed by a token that matches neither variable nor sector format', () => {
    const result = parseMetar(
      'METAR KORD 041853Z 24012KT 5SM BR OVC008 12/11 A2998 RMK AO2 VIS XYZ',
    );
    assert(result.remarks);
    expect(result.remarks.variableVisibility).toBeUndefined();
    expect(result.remarks.sectorVisibility).toBeUndefined();
  });
});
