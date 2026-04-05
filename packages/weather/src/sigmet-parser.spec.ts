import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSigmet } from './sigmet-parser.js';

// ---------------------------------------------------------------------------
// Reference data - inlined from reference-data/weather/sigmet/
// ---------------------------------------------------------------------------

// Convective SIGMETs
const CONVECTIVE_SEVERE = `WST SIGMET CONVECTIVE SIGMET 45C
VALID UNTIL 042055Z
KS OK TX
FROM 30NW ICT-40S MCI-20W ADM-50SW ABI-30NW ICT
AREA SEV TS MOV FROM 26025KT. TOPS ABV FL450.
TORNADOES...HAIL TO 2 IN...WIND GUSTS TO 65KT POSSIBLE.`;

const CONVECTIVE_OUTLOOK_ONLY = `WST SIGMET CONVECTIVE SIGMET OUTLOOK
VALID 042055-050055Z
FROM 40N MCI-30SE STL-50S MEM-30W OKC-40N MCI
AREA OF TSTMS MOVING FROM 25020KT. TOPS ABV FL400.`;

const CONVECTIVE_ISOLATED = `WSUS33 KKCI 041855
SIGW
CONVECTIVE SIGMET 22W
VALID UNTIL 2055Z
MT WY
FROM 40NW BIL-60SE BIL-30NE SHR-40NW BIL
ISOL SEV TS MOV FROM 25015KT. TOPS TO FL420.
HAIL TO 1 IN POSSIBLE.

OUTLOOK VALID 042055-050055
FROM 60NW BIL-40SE BFF-40E CYS-60NW BIL
WST ISSUANCES POSS. REFER TO MOST RECENT ACUS01 KWNS FROM STORM
PREDICTION CENTER FOR SYNOPSIS AND METEOROLOGICAL DETAILS.`;

const CONVECTIVE_HAIL_WIND = `WSUS32 KKCI 041855
SIGC
CONVECTIVE SIGMET 52C
VALID UNTIL 2055Z
NE KS OK
FROM 30NW OMA-40SE OMA-30NE ICT-50W DDC-30NW OMA
AREA SEV TS MOV FROM 26035KT. TOPS ABV FL450.
TORNADOES...HAIL TO 2.75 IN...WIND GUSTS TO 70KT POSSIBLE.`;

const CONVECTIVE_NO_OUTLOOK = `WSUS33 KKCI 041655
SIGW
CONVECTIVE SIGMET 18W
VALID UNTIL 1855Z
AZ NM
FROM 40NW TUS-30NE TUS-50SE TUS-40NW TUS
AREA TS MOV FROM 28010KT. TOPS TO FL380.`;

const CONVECTIVE_74C = `WSUS32 KKCI 042255
SIGC
CONVECTIVE SIGMET 74C
VALID UNTIL 0055Z
TN MS LA AR TX AND LA TX CSTL WTRS
FROM 30ENE MEM-30SSE MEI-20N LEV-30NE PSX-20ENE SAT-30ENE MEM
AREA EMBD TS MOV FROM 24025KT. TOPS ABV FL450.

OUTLOOK VALID 050055-050455
FROM 40E PXV-CEW-30WNW LEV-LRD-60NW LRD-EIC-40E PXV
WST ISSUANCES POSS. REFER TO MOST RECENT ACUS01 KWNS FROM STORM
PREDICTION CENTER FOR SYNOPSIS AND METEOROLOGICAL DETAILS.`;

const CONVECTIVE_76C_SEVERE = `WSUS32 KKCI 042255
SIGC
CONVECTIVE SIGMET 76C
VALID UNTIL 0055Z
OH TN KY IN AL MS
FROM 10W CVG-40E CVG-50NNW GQO-40SSW MSL-40WNW MSL-10W CVG
AREA SEV TS MOV FROM 24045KT. TOPS ABV FL450.
WIND GUSTS TO 50KT POSS.

OUTLOOK VALID 050055-050455
FROM 40E PXV-CEW-30WNW LEV-LRD-60NW LRD-EIC-40E PXV
WST ISSUANCES POSS. REFER TO MOST RECENT ACUS01 KWNS FROM STORM
PREDICTION CENTER FOR SYNOPSIS AND METEOROLOGICAL DETAILS.`;

const CONVECTIVE_LINE_TS = `WSUS31 KKCI 042255
SIGE
CONVECTIVE SIGMET 42E
VALID UNTIL 0055Z
FL AND CSTL WTRS
FROM 30ENE TRV-20NNW PBI-50E PBI
LINE TS 30 NM WIDE MOV FROM 10020KT. TOPS TO FL400.

OUTLOOK VALID 050055-050455
FROM BUF-30SW HNK-40WNW SIE-30N CTY-CEW-40E PXV-DXO-BUF
REF WW 87.
WST ISSUANCES EXPD. REFER TO MOST RECENT ACUS01 KWNS FROM STORM
PREDICTION CENTER FOR SYNOPSIS AND METEOROLOGICAL DETAILS.`;

// Non-Convective SIGMETs
const NONCONVECTIVE_TURBULENCE = `SIGMET NOVEMBER 3 VALID UNTIL 050200Z
FROM 40NW SLC-60SE BOI-30SW BIL-40NW SLC
SEV TURB BTN FL350 AND FL410. DUE TO JTST. CONDS CONTG BYD 0200Z.`;

const NONCONVECTIVE_ICING = `SIGMET OSCAR 1 VALID UNTIL 050400Z
FROM 30E BUF-40S ALB-20NW JFK-40NE ACK-30E BUF
SEV ICE BTN FL180 AND FL280. DUE TO FZRA. CONDS CONTG BYD 0400Z.`;

const NONCONVECTIVE_VOLCANIC_ASH = `SIGMET PAPA 2 VALID 041600/042200Z
VOLCANIC ASH FROM ERUPTION OF MT REDOUBT 6042N15610W
VA CLD OBS AT 1530Z FL250/FL350
FROM 60NW ANC-40NE ANC-80SE ANC-60SW ANC-60NW ANC
MOV NE 30KT. FCST AT 2200Z FL200/FL400.`;

const NONCONVECTIVE_DUST = `SIGMET QUEBEC 1 VALID UNTIL 050000Z
FROM 40W TUS-60S PHX-30NW ELP-40W TUS
SEV DUST/SANDSTORM OBS VIS BLW 3SM BTN SFC AND FL100.
MOV FROM 24030KT. INTSF.`;

const NONCONVECTIVE_TURB_WMO = `WSUS03 KKCI 070250
WS3U
CHIU WS 070250
SIGMET UNIFORM 4 VALID UNTIL 070650
KS OK TX UT CO AZ NM
FROM 30NW DVC TO 50SE GCK TO CDS TO 60ENE INW TO 30NW DVC
OCNL SEV TURB BTN FL280 AND FL380. DUE TO WNDSHR ASSOCD WITH
JTST. RPTD BY ACFT. CONDS CONTG BYD 0650Z.`;

const NONCONVECTIVE_CANCEL = `WSUS01 KKCI 190115
WS1N
BOSN WS 190115
CANCEL SIGMET NOVEMBER 4. CONDS MSTLY MOD.`;

const NONCONVECTIVE_CANCEL_ENDED = `WSUS02 KKCI 170653
WS2O
MIAO WS 170653
CANCEL SIGMET OSCAR 1. CONDS HV ENDED.`;

const NONCONVECTIVE_ICING_WMO = `WSUS01 KKCI 041510
WS1P
BOSP WS 041510
SIGMET PAPA 2 VALID UNTIL 041910
ME NH VT NY PA
FROM 70NW PQI TO 40NE MPV TO 30NW ALB TO 20E SYR TO 40N JHW TO 30NW ERI TO 50NE YOW TO 70NW PQI
OCNL SEV ICE BTN 040 AND FL220. DUE TO FZRA. CONDS CONTG BYD 1910Z.`;

const NONCONVECTIVE_STATIONARY = `WSUS03 KKCI 041615
WS3R
CHIR WS 041615
SIGMET ROMEO 3 VALID UNTIL 042015
WI MI IN OH
FROM 30NW GRB TO 40E MKE TO 30S FWA TO 30E IND TO 40NW DLH TO 30NW GRB
OCNL SEV TURB BTN FL310 AND FL410. DUE TO JTST. STNR. CONDS CONTG BYD 2015Z.`;

const NONCONVECTIVE_WEAKENING = `WSUS02 KKCI 041420
WS2Q
MIAQ WS 041420
SIGMET QUEBEC 2 VALID UNTIL 041820
FL GA SC AND CSTL WTRS
FROM 30NW TLH TO 40E SAV TO 80SE CHS TO 60SW PIE TO 30NW TLH
OCNL SEV TURB BTN FL280 AND FL370. DUE TO WNDSHR ASSOCD WITH
JTST. WKN. CONDS ENDG BY 1820Z.`;

const NONCONVECTIVE_MULTI_HAZARD = `WSUS01 KKCI 041730
WS1V
BOSV WS 041730
SIGMET VICTOR 1 VALID UNTIL 042130
NY PA NJ CT MA VT NH ME
FROM 80NW PQI TO 40S BGR TO 30W BOS TO 40NW JFK TO 30E PSB TO 50NW ERI TO 40E YOW TO 80NW PQI
OCNL SEV ICE BTN 030 AND FL200. DUE TO FZRA/FZPN.
OCNL SEV TURB BTN FL250 AND FL390. DUE TO JTST.
CONDS CONTG BYD 2130Z.`;

const NONCONVECTIVE_INTENSIFYING = `WSUS03 KKCI 041845
WS3O
CHIO WS 041845
SIGMET OSCAR 2 VALID UNTIL 042245
MN WI IA IL
FROM 50NW DLH TO 40E GRB TO 30SE RFD TO 40W DSM TO 50NW DLH
OCNL SEV TURB BTN FL300 AND FL400. DUE TO WNDSHR ASSOCD WITH
JTST. INTSF. CONDS CONTG BYD 2245Z.`;

// International SIGMETs
const INTERNATIONAL_ALASKA_TURB = `WSAK05 PAWU 291614
SIGAK5
ANCM WS 291615
PAZA SIGMET MIKE 1 VALID 291615/292015 PANC-
PAZA ANCHORAGE FIR SEV TURB OBS AT 1615Z AREA WI 40 NM E BGQ - 40 NM E
ENA - 30 NM NW ENA - 20 NM SW TKA - 40 NM E BGQ SFC/FL100 STNR NC=

INCLUDES +/- 35KTS LLWS.`;

const INTERNATIONAL_ALASKA_CANCEL = `WSAK01 PAWU 270514
SIGAK1
ANCI WS 270517
PAZA SIGMET INDIA 3 VALID 270517/270532 PANC-
PAZA ANCHORAGE FIR CNL SIGMET INDIA 2 262310/270310=`;

const INTERNATIONAL_TROPICAL_CYCLONE = `WSNT02 KNHC 041500
SIGMET TANGO 3 VALID 041500/042100 KNHC-
KZMA MIAMI OCEANIC FIR TC FRANCINE OBS AT 1500Z N2540 W08830
CB TOP FL500 WI 180NM OF CENTER MOV NW 12KT INTSF
FCST AT 2100Z TC CENTER N2640 W08930`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseSigmet', () => {
  describe('format detection', () => {
    it('throws on empty input', () => {
      assert.throws(() => parseSigmet(''), /Empty SIGMET string/);
    });

    it('throws on invalid input', () => {
      assert.throws(() => parseSigmet('THIS IS NOT A SIGMET'));
    });

    it('detects convective format', () => {
      const result = parseSigmet(CONVECTIVE_SEVERE);
      assert.equal(result.format, 'CONVECTIVE');
    });

    it('detects non-convective format', () => {
      const result = parseSigmet(NONCONVECTIVE_TURBULENCE);
      assert.equal(result.format, 'NONCONVECTIVE');
    });

    it('detects international format', () => {
      const result = parseSigmet(INTERNATIONAL_ALASKA_TURB);
      assert.equal(result.format, 'INTERNATIONAL');
    });
  });

  describe('convective SIGMET', () => {
    it('parses severe TS with tornadoes, hail, and wind', () => {
      const result = parseSigmet(CONVECTIVE_SEVERE);
      assert.equal(result.format, 'CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      assert.equal(result.region, 'C');
      assert.equal(result.number, 45);
      assert.equal(result.isNone, false);
      assert.equal(result.isOutlookOnly, false);
      assert.equal(result.validUntil?.hour, 20);
      assert.equal(result.validUntil?.minute, 55);
      assert.deepEqual(result.states, ['KS', 'OK', 'TX']);
      assert.deepEqual(result.areaPoints, [
        '30NW ICT',
        '40S MCI',
        '20W ADM',
        '50SW ABI',
        '30NW ICT',
      ]);
      assert.equal(result.thunderstormType, 'AREA');
      assert.equal(result.isSevere, true);
      assert.equal(result.movement?.directionDeg, 260);
      assert.equal(result.movement?.speedKt, 25);
      assert.equal(result.tops?.altitudeFt, 45000);
      assert.equal(result.tops?.isAbove, true);
      assert.equal(result.hasTornadoes, true);
      assert.equal(result.hailSizeIn, 2);
      assert.equal(result.windGustsKt, 65);
    });

    it('parses standalone outlook', () => {
      const result = parseSigmet(CONVECTIVE_OUTLOOK_ONLY);
      assert.equal(result.format, 'CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      assert.equal(result.isOutlookOnly, true);
      assert.equal(result.number, 0);
      assert.ok(result.outlook);
      assert.equal(result.outlook.validFromDay, 4);
      assert.equal(result.outlook.validFromHour, 20);
      assert.equal(result.outlook.validFromMinute, 55);
      assert.equal(result.outlook.validToDay, 5);
      assert.equal(result.outlook.validToHour, 0);
      assert.equal(result.outlook.validToMinute, 55);
      assert.deepEqual(result.outlook.areaPoints, [
        '40N MCI',
        '30SE STL',
        '50S MEM',
        '30W OKC',
        '40N MCI',
      ]);
    });

    it('parses isolated severe TS with hail and outlook (WMO wrapped)', () => {
      const result = parseSigmet(CONVECTIVE_ISOLATED);
      assert.equal(result.format, 'CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      assert.equal(result.region, 'W');
      assert.equal(result.number, 22);
      assert.equal(result.thunderstormType, 'ISOLATED');
      assert.equal(result.isSevere, true);
      assert.deepEqual(result.states, ['MT', 'WY']);
      assert.equal(result.movement?.directionDeg, 250);
      assert.equal(result.movement?.speedKt, 15);
      assert.equal(result.tops?.altitudeFt, 42000);
      assert.equal(result.tops?.isAbove, false);
      assert.equal(result.hailSizeIn, 1);
      assert.ok(result.outlook);
      assert.equal(result.outlook.validFromDay, 4);
    });

    it('parses severe TS with large hail and high wind gusts (WMO wrapped)', () => {
      const result = parseSigmet(CONVECTIVE_HAIL_WIND);
      assert.equal(result.format, 'CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      assert.equal(result.region, 'C');
      assert.equal(result.number, 52);
      assert.equal(result.thunderstormType, 'AREA');
      assert.equal(result.isSevere, true);
      assert.equal(result.hasTornadoes, true);
      assert.equal(result.hailSizeIn, 2.75);
      assert.equal(result.windGustsKt, 70);
      assert.equal(result.tops?.isAbove, true);
      assert.equal(result.tops?.altitudeFt, 45000);
    });

    it('parses area TS without outlook (WMO wrapped)', () => {
      const result = parseSigmet(CONVECTIVE_NO_OUTLOOK);
      assert.equal(result.format, 'CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      assert.equal(result.region, 'W');
      assert.equal(result.number, 18);
      assert.equal(result.thunderstormType, 'AREA');
      assert.equal(result.isSevere, undefined);
      assert.deepEqual(result.states, ['AZ', 'NM']);
      assert.equal(result.movement?.directionDeg, 280);
      assert.equal(result.movement?.speedKt, 10);
      assert.equal(result.tops?.altitudeFt, 38000);
      assert.equal(result.tops?.isAbove, false);
      assert.equal(result.outlook, undefined);
    });

    it('parses embedded TS with coastal waters and outlook (WMO wrapped)', () => {
      const result = parseSigmet(CONVECTIVE_74C);
      assert.equal(result.format, 'CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      assert.equal(result.region, 'C');
      assert.equal(result.number, 74);
      assert.equal(result.thunderstormType, 'AREA');
      assert.equal(result.isEmbedded, true);
      assert.equal(result.coastalWaters, true);
      assert.ok(result.states);
      assert.ok(result.states.includes('TN'));
      assert.ok(result.states.includes('TX'));
      assert.ok(result.outlook);
    });

    it('parses severe TS with wind gusts only (WMO wrapped)', () => {
      const result = parseSigmet(CONVECTIVE_76C_SEVERE);
      assert.equal(result.format, 'CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      assert.equal(result.region, 'C');
      assert.equal(result.number, 76);
      assert.equal(result.thunderstormType, 'AREA');
      assert.equal(result.isSevere, true);
      assert.equal(result.windGustsKt, 50);
      assert.equal(result.movement?.directionDeg, 240);
      assert.equal(result.movement?.speedKt, 45);
      assert.ok(result.outlook);
    });

    it('parses line TS with width and outlook (WMO wrapped)', () => {
      const result = parseSigmet(CONVECTIVE_LINE_TS);
      assert.equal(result.format, 'CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      assert.equal(result.region, 'E');
      assert.equal(result.number, 42);
      assert.equal(result.thunderstormType, 'LINE');
      assert.equal(result.lineWidthNm, 30);
      assert.equal(result.coastalWaters, true);
      assert.deepEqual(result.states, ['FL']);
      assert.equal(result.movement?.directionDeg, 100);
      assert.equal(result.movement?.speedKt, 20);
      assert.equal(result.tops?.altitudeFt, 40000);
      assert.equal(result.tops?.isAbove, false);
      assert.ok(result.outlook);
    });
  });

  describe('non-convective SIGMET', () => {
    it('parses severe turbulence', () => {
      const result = parseSigmet(NONCONVECTIVE_TURBULENCE);
      assert.equal(result.format, 'NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      assert.equal(result.seriesName, 'NOVEMBER');
      assert.equal(result.seriesNumber, 3);
      assert.equal(result.isCancellation, false);
      assert.equal(result.validUntil?.day, 5);
      assert.equal(result.validUntil?.hour, 2);
      assert.equal(result.validUntil?.minute, 0);
      assert.equal(result.hazards.length, 1);
      assert.equal(result.hazards[0]!.hazardType, 'TURBULENCE');
      assert.equal(result.hazards[0]!.isOccasional, false);
      assert.equal(result.hazards[0]!.altitudeRange?.baseFt, 35000);
      assert.equal(result.hazards[0]!.altitudeRange?.topFt, 41000);
      assert.equal(result.hazards[0]!.cause, 'JTST');
      assert.equal(result.conditionsContinuingBeyond?.hour, 2);
      assert.equal(result.conditionsContinuingBeyond?.minute, 0);
    });

    it('parses severe icing', () => {
      const result = parseSigmet(NONCONVECTIVE_ICING);
      assert.equal(result.format, 'NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      assert.equal(result.seriesName, 'OSCAR');
      assert.equal(result.seriesNumber, 1);
      assert.equal(result.hazards.length, 1);
      assert.equal(result.hazards[0]!.hazardType, 'ICING');
      assert.equal(result.hazards[0]!.altitudeRange?.baseFt, 18000);
      assert.equal(result.hazards[0]!.altitudeRange?.topFt, 28000);
      assert.equal(result.hazards[0]!.cause, 'FZRA');
      assert.equal(result.conditionsContinuingBeyond?.hour, 4);
      assert.equal(result.conditionsContinuingBeyond?.minute, 0);
    });

    it('parses volcanic ash with eruption details', () => {
      const result = parseSigmet(NONCONVECTIVE_VOLCANIC_ASH);
      assert.equal(result.format, 'NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      assert.equal(result.seriesName, 'PAPA');
      assert.equal(result.seriesNumber, 2);
      assert.equal(result.validUntil?.day, 4);
      assert.equal(result.validUntil?.hour, 22);
      assert.equal(result.validUntil?.minute, 0);
      assert.equal(result.hazards.length, 1);
      assert.equal(result.hazards[0]!.hazardType, 'VOLCANIC_ASH');
      assert.equal(result.volcanoName, 'MT REDOUBT');
      assert.ok(result.volcanoPosition);
      assert.equal(result.volcanoPosition.lat, 60 + 42 / 60);
      assert.equal(result.volcanoPosition.lon, -(156 + 10 / 60));
      assert.ok(result.ashCloudAltitudeRange);
      assert.equal(result.ashCloudAltitudeRange.baseFt, 25000);
      assert.equal(result.ashCloudAltitudeRange.topFt, 35000);
      assert.equal(result.forecastTime?.hour, 22);
      assert.equal(result.forecastTime?.minute, 0);
      assert.ok(result.forecastAltitudeRange);
      assert.equal(result.forecastAltitudeRange.baseFt, 20000);
      assert.equal(result.forecastAltitudeRange.topFt, 40000);
    });

    it('parses dust/sandstorm with visibility and intensity change', () => {
      const result = parseSigmet(NONCONVECTIVE_DUST);
      assert.equal(result.format, 'NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      assert.equal(result.seriesName, 'QUEBEC');
      assert.equal(result.seriesNumber, 1);
      assert.equal(result.hazards.length, 1);
      assert.equal(result.hazards[0]!.hazardType, 'DUST_SANDSTORM');
      assert.equal(result.hazards[0]!.visibilityBelow, 3);
      assert.equal(result.hazards[0]!.altitudeRange?.baseFt, undefined);
      assert.equal(result.hazards[0]!.altitudeRange?.topFt, 10000);
      assert.equal(result.movement?.directionDeg, 240);
      assert.equal(result.movement?.speedKt, 30);
      assert.equal(result.intensityChange, 'INTENSIFYING');
    });

    it('parses occasional severe turbulence with WMO headers', () => {
      const result = parseSigmet(NONCONVECTIVE_TURB_WMO);
      assert.equal(result.format, 'NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      assert.equal(result.seriesName, 'UNIFORM');
      assert.equal(result.seriesNumber, 4);
      assert.ok(result.states);
      assert.ok(result.states.includes('KS'));
      assert.ok(result.states.includes('NM'));
      assert.equal(result.hazards.length, 1);
      assert.equal(result.hazards[0]!.hazardType, 'TURBULENCE');
      assert.equal(result.hazards[0]!.isOccasional, true);
      assert.equal(result.hazards[0]!.altitudeRange?.baseFt, 28000);
      assert.equal(result.hazards[0]!.altitudeRange?.topFt, 38000);
      assert.equal(result.conditionsContinuingBeyond?.hour, 6);
      assert.equal(result.conditionsContinuingBeyond?.minute, 50);
    });

    it('parses cancellation with conditions mostly moderate', () => {
      const result = parseSigmet(NONCONVECTIVE_CANCEL);
      assert.equal(result.format, 'NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      assert.equal(result.isCancellation, true);
      assert.equal(result.seriesName, 'NOVEMBER');
      assert.equal(result.seriesNumber, 4);
      assert.equal(result.cancellationReason, 'CONDS MSTLY MOD');
      assert.equal(result.hazards.length, 0);
    });

    it('parses cancellation with conditions ended', () => {
      const result = parseSigmet(NONCONVECTIVE_CANCEL_ENDED);
      assert.equal(result.format, 'NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      assert.equal(result.isCancellation, true);
      assert.equal(result.seriesName, 'OSCAR');
      assert.equal(result.seriesNumber, 1);
      assert.equal(result.cancellationReason, 'CONDS HV ENDED');
    });

    it('parses occasional severe icing with low altitude base (WMO wrapped)', () => {
      const result = parseSigmet(NONCONVECTIVE_ICING_WMO);
      assert.equal(result.format, 'NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      assert.equal(result.seriesName, 'PAPA');
      assert.equal(result.seriesNumber, 2);
      assert.deepEqual(result.states, ['ME', 'NH', 'VT', 'NY', 'PA']);
      assert.equal(result.hazards.length, 1);
      assert.equal(result.hazards[0]!.hazardType, 'ICING');
      assert.equal(result.hazards[0]!.isOccasional, true);
      assert.equal(result.hazards[0]!.altitudeRange?.baseFt, 4000);
      assert.equal(result.hazards[0]!.altitudeRange?.topFt, 22000);
      assert.equal(result.hazards[0]!.cause, 'FZRA');
      assert.equal(result.conditionsContinuingBeyond?.hour, 19);
      assert.equal(result.conditionsContinuingBeyond?.minute, 10);
    });

    it('parses stationary turbulence (WMO wrapped)', () => {
      const result = parseSigmet(NONCONVECTIVE_STATIONARY);
      assert.equal(result.format, 'NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      assert.equal(result.seriesName, 'ROMEO');
      assert.equal(result.seriesNumber, 3);
      assert.deepEqual(result.states, ['WI', 'MI', 'IN', 'OH']);
      assert.equal(result.hazards.length, 1);
      assert.equal(result.hazards[0]!.hazardType, 'TURBULENCE');
      assert.equal(result.hazards[0]!.isOccasional, true);
      assert.equal(result.hazards[0]!.altitudeRange?.baseFt, 31000);
      assert.equal(result.hazards[0]!.altitudeRange?.topFt, 41000);
      assert.equal(result.conditionsContinuingBeyond?.hour, 20);
      assert.equal(result.conditionsContinuingBeyond?.minute, 15);
    });

    it('parses weakening turbulence with conditions ending by (WMO wrapped)', () => {
      const result = parseSigmet(NONCONVECTIVE_WEAKENING);
      assert.equal(result.format, 'NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      assert.equal(result.seriesName, 'QUEBEC');
      assert.equal(result.seriesNumber, 2);
      assert.equal(result.hazards.length, 1);
      assert.equal(result.hazards[0]!.hazardType, 'TURBULENCE');
      assert.equal(result.intensityChange, 'WEAKENING');
      assert.equal(result.conditionsEndingBy?.hour, 18);
      assert.equal(result.conditionsEndingBy?.minute, 20);
    });

    it('parses multiple hazards (icing + turbulence) in a single SIGMET', () => {
      const result = parseSigmet(NONCONVECTIVE_MULTI_HAZARD);
      assert.equal(result.format, 'NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      assert.equal(result.seriesName, 'VICTOR');
      assert.equal(result.seriesNumber, 1);
      assert.deepEqual(result.states, ['NY', 'PA', 'NJ', 'CT', 'MA', 'VT', 'NH', 'ME']);
      assert.equal(result.hazards.length, 2);

      assert.equal(result.hazards[0]!.hazardType, 'ICING');
      assert.equal(result.hazards[0]!.isOccasional, true);
      assert.equal(result.hazards[0]!.altitudeRange?.baseFt, 3000);
      assert.equal(result.hazards[0]!.altitudeRange?.topFt, 20000);
      assert.equal(result.hazards[0]!.cause, 'FZRA/FZPN');

      assert.equal(result.hazards[1]!.hazardType, 'TURBULENCE');
      assert.equal(result.hazards[1]!.isOccasional, true);
      assert.equal(result.hazards[1]!.altitudeRange?.baseFt, 25000);
      assert.equal(result.hazards[1]!.altitudeRange?.topFt, 39000);
      assert.equal(result.hazards[1]!.cause, 'JTST');

      assert.equal(result.conditionsContinuingBeyond?.hour, 21);
      assert.equal(result.conditionsContinuingBeyond?.minute, 30);
    });

    it('parses intensifying turbulence (WMO wrapped)', () => {
      const result = parseSigmet(NONCONVECTIVE_INTENSIFYING);
      assert.equal(result.format, 'NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      assert.equal(result.seriesName, 'OSCAR');
      assert.equal(result.seriesNumber, 2);
      assert.equal(result.hazards.length, 1);
      assert.equal(result.hazards[0]!.hazardType, 'TURBULENCE');
      assert.equal(result.hazards[0]!.isOccasional, true);
      assert.equal(result.intensityChange, 'INTENSIFYING');
      assert.equal(result.conditionsContinuingBeyond?.hour, 22);
      assert.equal(result.conditionsContinuingBeyond?.minute, 45);
    });
  });

  describe('international SIGMET', () => {
    it('parses Alaska turbulence SIGMET with area and LLWS', () => {
      const result = parseSigmet(INTERNATIONAL_ALASKA_TURB);
      assert.equal(result.format, 'INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }

      assert.equal(result.firCode, 'PAZA');
      assert.equal(result.firName, 'ANCHORAGE FIR');
      assert.equal(result.seriesName, 'MIKE');
      assert.equal(result.seriesNumber, 1);
      assert.equal(result.issuingStation, 'PANC');
      assert.equal(result.validFrom.day, 29);
      assert.equal(result.validFrom.hour, 16);
      assert.equal(result.validFrom.minute, 15);
      assert.equal(result.validTo.day, 29);
      assert.equal(result.validTo.hour, 20);
      assert.equal(result.validTo.minute, 15);
      assert.equal(result.isCancellation, false);
      assert.equal(result.phenomena, 'SEV TURB');
      assert.equal(result.observationStatus, 'OBSERVED');
      assert.equal(result.observedAt?.hour, 16);
      assert.equal(result.observedAt?.minute, 15);
      assert.ok(result.areaDescription);
      assert.ok(result.altitudeRange);
      assert.equal(result.altitudeRange.baseFt, undefined);
      assert.equal(result.altitudeRange.topFt, 10000);
      assert.equal(result.isStationary, true);
      assert.equal(result.intensityChange, 'NO_CHANGE');
      assert.ok(result.additionalInfo);
      assert.ok(result.additionalInfo.includes('LLWS'));
    });

    it('parses Alaska cancellation SIGMET', () => {
      const result = parseSigmet(INTERNATIONAL_ALASKA_CANCEL);
      assert.equal(result.format, 'INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }

      assert.equal(result.firCode, 'PAZA');
      assert.equal(result.firName, 'ANCHORAGE FIR');
      assert.equal(result.seriesName, 'INDIA');
      assert.equal(result.seriesNumber, 3);
      assert.equal(result.issuingStation, 'PANC');
      assert.equal(result.isCancellation, true);
      assert.equal(result.cancelledSeriesName, 'INDIA');
      assert.equal(result.cancelledSeriesNumber, 2);
      assert.equal(result.cancelledValidStart?.day, 26);
      assert.equal(result.cancelledValidStart?.hour, 23);
      assert.equal(result.cancelledValidStart?.minute, 10);
      assert.equal(result.cancelledValidEnd?.day, 27);
      assert.equal(result.cancelledValidEnd?.hour, 3);
      assert.equal(result.cancelledValidEnd?.minute, 10);
    });

    it('parses tropical cyclone SIGMET with position and forecast', () => {
      const result = parseSigmet(INTERNATIONAL_TROPICAL_CYCLONE);
      assert.equal(result.format, 'INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }

      assert.equal(result.firCode, 'KZMA');
      assert.equal(result.firName, 'MIAMI OCEANIC FIR');
      assert.equal(result.seriesName, 'TANGO');
      assert.equal(result.seriesNumber, 3);
      assert.equal(result.issuingStation, 'KNHC');
      assert.equal(result.validFrom.day, 4);
      assert.equal(result.validFrom.hour, 15);
      assert.equal(result.validTo.day, 4);
      assert.equal(result.validTo.hour, 21);
      assert.equal(result.isCancellation, false);
      assert.equal(result.cycloneName, 'FRANCINE');
      assert.equal(result.phenomena, 'TC FRANCINE');
      assert.equal(result.observationStatus, 'OBSERVED');
      assert.equal(result.observedAt?.hour, 15);
      assert.equal(result.observedAt?.minute, 0);
      assert.ok(result.cyclonePosition);
      assert.equal(result.cyclonePosition.lat, 25 + 40 / 60);
      assert.equal(result.cyclonePosition.lon, -(88 + 30 / 60));
      assert.equal(result.cbTopFl, 500);
      assert.equal(result.withinNm, 180);
      assert.equal(result.movement?.directionCompass, 'NW');
      assert.equal(result.movement?.speedKt, 12);
      assert.equal(result.intensityChange, 'INTENSIFYING');
      assert.equal(result.forecastTime?.hour, 21);
      assert.equal(result.forecastTime?.minute, 0);
      assert.ok(result.forecastPosition);
      assert.equal(result.forecastPosition.lat, 26 + 40 / 60);
      assert.equal(result.forecastPosition.lon, -(89 + 30 / 60));
    });
  });
});
