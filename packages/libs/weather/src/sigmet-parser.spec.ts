import { describe, it, expect, assert } from 'vitest';
import { parseSigmet, parseSigmetBulletin } from './sigmet-parser.js';

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

// Real-world data from NWS/AWC/AAWU feeds
const CONVECTIVE_NONE = `WSUS33 KKCI 051655
SIGW
MKCW WST 051655
CONVECTIVE SIGMET...NONE

OUTLOOK VALID 051855-052255
TS ARE NOT EXPD TO REQUIRE WST ISSUANCES.`;

const INTERNATIONAL_EMBD_TS = `WSPA03 PHFO 051309
SIGPAP
KZAK SIGMET PAPA 5 VALID 051305/051705 PHFO-
OAKLAND OCEANIC FIR EMBD TS OBS AT 1305Z WI N0815 E15230 - N0600
E15800 - N0445 E15730 - N0645 E15315 - N0615 E15045 - N0400 E15015 -
N0545 E14515 - N0715 E14800 - N0815 E15230. TOP FL560. MOV W 5KT.
NC.`;

const INTERNATIONAL_VA_ERUPTION = `WVAK01 PAWU 190708
PAZA SIGMET INDIA 5 VALID 190702/191302 PANC-
ANCHORAGE FIR VA ERUPTION MT KATMAI PSN N5817 W15458
VA CLD OBS AT 0702Z WI N5822 W15443 - N5731 W15338 - N5723 W15426 -
N5818 W15458 - N5822 W15443 SFC/FL060 MOV STNR WKN
FCST 1302Z VA CLD WI N5822 W15442 - N5723 W15343 - N5717 W15426 -
N5817 W15457 - N5822 W15442 SFC/FL060`;

const INTERNATIONAL_OBSC_TS = `WSTU31 UTAT 051525
UTAT SIGMET N 5 VALID 051525/051925 UTAT-
DASHOGUZ FIR OBSC TS FCST ENTIRE FIR TOP FL370 MOV NE 20KT NC=`;

// Fused letter+digit identifier (Pattern C): common in South American FIRs.
const INTERNATIONAL_FUSED_SINGLE = `WSCH31 SCCI 162347
SCCZ SIGMET A6 VALID 162347/170347 SCCI-
SCCZ PUNTA ARENAS FIR SEV TURB FCST E OF LINE S4700 W07800 - S6000
W07600 FL160/360 STNR NC=`;

// Fused identifier with zero-padded digits.
const INTERNATIONAL_FUSED_ZERO_PADDED = `WSPR31 SPIM 162230
SPIM SIGMET B02 VALID 162230/170045 SPJC-
SPIM LIMA FIR EMBD TS OBS AT 2210Z WI S1540 W07057 - S1458 W07431 -
S0649 W07932 - S0559 W07824 - S1328 W07408 - S1431 W07106 - S1540
W07057 TOP FL540 MOV WNW 05KT INTSF=`;

// Fused identifier with multi-digit number.
const INTERNATIONAL_FUSED_MULTI_DIGIT = `WSPR31 SPIM 162240
SPIM SIGMET D10 VALID 162240/170055 SPJC-
SPIM LIMA FIR EMBD TS OBS AT 2220Z WI S1056 W07547 - S0758 W07802 -
S0551 W07831 - S0407 W07629 - S0408 W07524 - S0658 W07247 - S0907
W07152 - S1056 W07547 TOP FL540 MOV WSW 10KT WKN=`;

// Fused identifier with multi-letter prefix. Not common in live data, but
// the regex handles letter prefixes of arbitrary length; this fixture
// locks that behavior in.
const INTERNATIONAL_FUSED_MULTI_LETTER = `WSFX31 FXXX 162300
FXXX SIGMET AB9 VALID 162300/170300 FXXX-
FXXX EXAMPLE FIR SEV TURB FCST FL300/FL400 STNR NC=`;

// Space before the issuing-station dash: `SBAZ -` instead of `SBAZ-`.
// Observed in South American feeds (e.g. SBAZ AMAZONICA FIR).
const INTERNATIONAL_SPACE_BEFORE_DASH = `WSBR31 SBAZ 162330
SBAZ SIGMET 140 VALID 162330/170330 SBAZ -
SBAZ AMAZONICA FIR EMBD TS FCST WI S0731 W07358 - S0925 W07313 -
S1000 W07210 - S1001 W07116 - S0731 W07358 TOP FL490 STNR NC=`;

// Multiple FIR codes before the SIGMET keyword. The FIR code immediately
// preceding SIGMET is captured as firCodeFromHeader; earlier FIR codes
// are picked up by parseFirInfo from the body content.
const INTERNATIONAL_MULTI_FIR = `WSNT01 KNHC 170145
KZMA TJZS SIGMET FOXTROT 3 VALID 170145/170545 KKCI-
KZMA MIAMI OCEANIC FIR TJZS SAN JUAN FIR EMBD TS OBS AT 0145Z WI
N2500 W07500 - N2500 W06500 - N2300 W06500 - N2300 W07500 - N2500
W07500 MOV NW 10KT INTSF=`;

// Cancellation referencing a fused-identifier SIGMET.
const INTERNATIONAL_CANCEL_FUSED = `WSCH31 SCCI 170500
SCCZ SIGMET A7 VALID 170500/170515 SCCI-
SCCZ PUNTA ARENAS FIR CNL SIGMET A6 162347/170347=`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseSigmet', () => {
  describe('format detection', () => {
    it('throws on empty input', () => {
      expect(() => parseSigmet('')).toThrow(/Empty SIGMET string/);
    });

    it('throws on invalid input', () => {
      expect(() => parseSigmet('THIS IS NOT A SIGMET')).toThrow();
    });

    it('throws on whitespace-only input', () => {
      expect(() => parseSigmet('   ')).toThrow(/Empty SIGMET string/);
    });

    it('throws on malformed convective SIGMET missing number and region', () => {
      expect(() => parseSigmet('CONVECTIVE SIGMET VALID UNTIL 042055Z')).toThrow(
        /Invalid convective SIGMET/,
      );
    });

    it('throws on malformed non-convective SIGMET missing series info', () => {
      expect(() => parseSigmet('SIGMET VALID UNTIL 050200Z')).toThrow(
        /Invalid non-convective SIGMET/,
      );
    });

    it('throws on malformed international SIGMET missing sequence number', () => {
      expect(() => parseSigmet('XXXX SIGMET MIKE VALID 291615/292015 PANC-')).toThrow(/Invalid/);
    });

    it('throws on truncated non-convective SIGMET', () => {
      expect(() => parseSigmet('SIGMET')).toThrow(/Invalid non-convective SIGMET/);
    });

    it('detects convective format', () => {
      const result = parseSigmet(CONVECTIVE_SEVERE);
      expect(result.format).toBe('CONVECTIVE');
    });

    it('detects non-convective format', () => {
      const result = parseSigmet(NONCONVECTIVE_TURBULENCE);
      expect(result.format).toBe('NONCONVECTIVE');
    });

    it('detects international format', () => {
      const result = parseSigmet(INTERNATIONAL_ALASKA_TURB);
      expect(result.format).toBe('INTERNATIONAL');
    });
  });

  describe('convective SIGMET', () => {
    it('parses severe TS with tornadoes, hail, and wind', () => {
      const result = parseSigmet(CONVECTIVE_SEVERE);
      expect(result.format).toBe('CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      expect(result.region).toBe('C');
      expect(result.number).toBe(45);
      expect(result.isNone).toBe(false);
      expect(result.isOutlookOnly).toBe(false);
      expect(result.validUntil?.hour).toBe(20);
      expect(result.validUntil?.minute).toBe(55);
      expect(result.states).toEqual(['KS', 'OK', 'TX']);
      expect(result.areaPoints).toEqual(['30NW ICT', '40S MCI', '20W ADM', '50SW ABI', '30NW ICT']);
      expect(result.thunderstormType).toBe('AREA');
      expect(result.isSevere).toBe(true);
      expect(result.movement?.directionDeg).toBe(260);
      expect(result.movement?.speedKt).toBe(25);
      expect(result.tops?.altitudeFt).toBe(45000);
      expect(result.tops?.isAbove).toBe(true);
      expect(result.hasTornadoes).toBe(true);
      expect(result.hailSizeIn).toBe(2);
      expect(result.windGustsKt).toBe(65);
    });

    it('parses standalone outlook', () => {
      const result = parseSigmet(CONVECTIVE_OUTLOOK_ONLY);
      expect(result.format).toBe('CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      expect(result.isOutlookOnly).toBe(true);
      expect(result.number).toBe(0);
      assert(result.outlook);
      expect(result.outlook.validFromDay).toBe(4);
      expect(result.outlook.validFromHour).toBe(20);
      expect(result.outlook.validFromMinute).toBe(55);
      expect(result.outlook.validToDay).toBe(5);
      expect(result.outlook.validToHour).toBe(0);
      expect(result.outlook.validToMinute).toBe(55);
      expect(result.outlook.areaPoints).toEqual([
        '40N MCI',
        '30SE STL',
        '50S MEM',
        '30W OKC',
        '40N MCI',
      ]);
    });

    it('parses isolated severe TS with hail and outlook (WMO wrapped)', () => {
      const result = parseSigmet(CONVECTIVE_ISOLATED);
      expect(result.format).toBe('CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      expect(result.region).toBe('W');
      expect(result.number).toBe(22);
      expect(result.thunderstormType).toBe('ISOLATED');
      expect(result.isSevere).toBe(true);
      expect(result.states).toEqual(['MT', 'WY']);
      expect(result.areaPoints).toEqual(['40NW BIL', '60SE BIL', '30NE SHR', '40NW BIL']);
      expect(result.movement?.directionDeg).toBe(250);
      expect(result.movement?.speedKt).toBe(15);
      expect(result.tops?.altitudeFt).toBe(42000);
      expect(result.tops?.isAbove).toBe(false);
      expect(result.hailSizeIn).toBe(1);
      assert(result.outlook);
      expect(result.outlook.validFromDay).toBe(4);
    });

    it('parses severe TS with large hail and high wind gusts (WMO wrapped)', () => {
      const result = parseSigmet(CONVECTIVE_HAIL_WIND);
      expect(result.format).toBe('CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      expect(result.region).toBe('C');
      expect(result.number).toBe(52);
      expect(result.states).toEqual(['NE', 'KS', 'OK']);
      expect(result.areaPoints).toEqual([
        '30NW OMA',
        '40SE OMA',
        '30NE ICT',
        '50W DDC',
        '30NW OMA',
      ]);
      expect(result.thunderstormType).toBe('AREA');
      expect(result.isSevere).toBe(true);
      expect(result.hasTornadoes).toBe(true);
      expect(result.hailSizeIn).toBe(2.75);
      expect(result.windGustsKt).toBe(70);
      expect(result.tops?.isAbove).toBe(true);
      expect(result.tops?.altitudeFt).toBe(45000);
    });

    it('parses area TS without outlook (WMO wrapped)', () => {
      const result = parseSigmet(CONVECTIVE_NO_OUTLOOK);
      expect(result.format).toBe('CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      expect(result.region).toBe('W');
      expect(result.number).toBe(18);
      expect(result.thunderstormType).toBe('AREA');
      expect(result.isSevere).toBe(undefined);
      expect(result.states).toEqual(['AZ', 'NM']);
      expect(result.movement?.directionDeg).toBe(280);
      expect(result.movement?.speedKt).toBe(10);
      expect(result.tops?.altitudeFt).toBe(38000);
      expect(result.tops?.isAbove).toBe(false);
      expect(result.outlook).toBe(undefined);
    });

    it('parses embedded TS with coastal waters and outlook (WMO wrapped)', () => {
      const result = parseSigmet(CONVECTIVE_74C);
      expect(result.format).toBe('CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      expect(result.region).toBe('C');
      expect(result.number).toBe(74);
      expect(result.thunderstormType).toBe('AREA');
      expect(result.isEmbedded).toBe(true);
      expect(result.coastalWaters).toBe(true);
      assert(result.states);
      assert(result.states.includes('TN'));
      assert(result.states.includes('TX'));
      assert(result.outlook);
    });

    it('parses severe TS with wind gusts only (WMO wrapped)', () => {
      const result = parseSigmet(CONVECTIVE_76C_SEVERE);
      expect(result.format).toBe('CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      expect(result.region).toBe('C');
      expect(result.number).toBe(76);
      expect(result.states).toEqual(['OH', 'TN', 'KY', 'IN', 'AL', 'MS']);
      expect(result.areaPoints).toEqual([
        '10W CVG',
        '40E CVG',
        '50NNW GQO',
        '40SSW MSL',
        '40WNW MSL',
        '10W CVG',
      ]);
      expect(result.thunderstormType).toBe('AREA');
      expect(result.isSevere).toBe(true);
      expect(result.windGustsKt).toBe(50);
      expect(result.movement?.directionDeg).toBe(240);
      expect(result.movement?.speedKt).toBe(45);
      assert(result.outlook);
    });

    it('parses line TS with width and outlook (WMO wrapped)', () => {
      const result = parseSigmet(CONVECTIVE_LINE_TS);
      expect(result.format).toBe('CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      expect(result.region).toBe('E');
      expect(result.number).toBe(42);
      expect(result.thunderstormType).toBe('LINE');
      expect(result.lineWidthNm).toBe(30);
      expect(result.coastalWaters).toBe(true);
      expect(result.states).toEqual(['FL']);
      expect(result.movement?.directionDeg).toBe(100);
      expect(result.movement?.speedKt).toBe(20);
      expect(result.tops?.altitudeFt).toBe(40000);
      expect(result.tops?.isAbove).toBe(false);
      assert(result.outlook);
    });

    it('parses CONVECTIVE SIGMET NONE with outlook (real NWS data)', () => {
      const result = parseSigmet(CONVECTIVE_NONE);
      expect(result.format).toBe('CONVECTIVE');
      if (result.format !== 'CONVECTIVE') {
        return;
      }

      expect(result.isNone).toBe(true);
      expect(result.region).toBe('W');
      expect(result.number).toBe(0);
      assert(result.outlook);
      expect(result.outlook.validFromDay).toBe(5);
      expect(result.outlook.validFromHour).toBe(18);
      expect(result.outlook.validFromMinute).toBe(55);
      expect(result.outlook.validToDay).toBe(5);
      expect(result.outlook.validToHour).toBe(22);
      expect(result.outlook.validToMinute).toBe(55);
    });
  });

  describe('non-convective SIGMET', () => {
    it('parses severe turbulence', () => {
      const result = parseSigmet(NONCONVECTIVE_TURBULENCE);
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.seriesName).toBe('NOVEMBER');
      expect(result.seriesNumber).toBe(3);
      expect(result.isCancellation).toBe(false);
      expect(result.validUntil?.day).toBe(5);
      expect(result.validUntil?.hour).toBe(2);
      expect(result.validUntil?.minute).toBe(0);
      expect(result.states).toBe(undefined);
      expect(result.areaPoints).toEqual(['40NW SLC', '60SE BOI', '30SW BIL', '40NW SLC']);
      expect(result.hazards.length).toBe(1);
      expect(result.hazards[0]!.hazardType).toBe('TURBULENCE');
      expect(result.hazards[0]!.isOccasional).toBe(false);
      expect(result.hazards[0]!.altitudeRange?.baseFt).toBe(35000);
      expect(result.hazards[0]!.altitudeRange?.topFt).toBe(41000);
      expect(result.hazards[0]!.cause).toBe('JTST');
      expect(result.conditionsContinuingBeyond?.hour).toBe(2);
      expect(result.conditionsContinuingBeyond?.minute).toBe(0);
    });

    it('parses severe icing', () => {
      const result = parseSigmet(NONCONVECTIVE_ICING);
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.seriesName).toBe('OSCAR');
      expect(result.seriesNumber).toBe(1);
      expect(result.states).toBe(undefined);
      expect(result.areaPoints).toEqual(['30E BUF', '40S ALB', '20NW JFK', '40NE ACK', '30E BUF']);
      expect(result.hazards.length).toBe(1);
      expect(result.hazards[0]!.hazardType).toBe('ICING');
      expect(result.hazards[0]!.altitudeRange?.baseFt).toBe(18000);
      expect(result.hazards[0]!.altitudeRange?.topFt).toBe(28000);
      expect(result.hazards[0]!.cause).toBe('FZRA');
      expect(result.conditionsContinuingBeyond?.hour).toBe(4);
      expect(result.conditionsContinuingBeyond?.minute).toBe(0);
    });

    it('parses volcanic ash with eruption details', () => {
      const result = parseSigmet(NONCONVECTIVE_VOLCANIC_ASH);
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.seriesName).toBe('PAPA');
      expect(result.seriesNumber).toBe(2);
      expect(result.validUntil?.day).toBe(4);
      expect(result.validUntil?.hour).toBe(22);
      expect(result.validUntil?.minute).toBe(0);
      expect(result.areaPoints).toEqual([
        '60NW ANC',
        '40NE ANC',
        '80SE ANC',
        '60SW ANC',
        '60NW ANC',
      ]);
      expect(result.hazards.length).toBe(1);
      expect(result.hazards[0]!.hazardType).toBe('VOLCANIC_ASH');
      expect(result.volcanoName).toBe('MT REDOUBT');
      assert(result.volcanoPosition);
      expect(result.volcanoPosition.lat).toBe(60 + 42 / 60);
      expect(result.volcanoPosition.lon).toBe(-(156 + 10 / 60));
      assert(result.ashCloudAltitudeRange);
      expect(result.ashCloudAltitudeRange.baseFt).toBe(25000);
      expect(result.ashCloudAltitudeRange.topFt).toBe(35000);
      expect(result.forecastTime?.hour).toBe(22);
      expect(result.forecastTime?.minute).toBe(0);
      assert(result.forecastAltitudeRange);
      expect(result.forecastAltitudeRange.baseFt).toBe(20000);
      expect(result.forecastAltitudeRange.topFt).toBe(40000);
    });

    it('parses dust/sandstorm with visibility and intensity change', () => {
      const result = parseSigmet(NONCONVECTIVE_DUST);
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.seriesName).toBe('QUEBEC');
      expect(result.seriesNumber).toBe(1);
      expect(result.states).toBe(undefined);
      expect(result.areaPoints).toEqual(['40W TUS', '60S PHX', '30NW ELP', '40W TUS']);
      expect(result.hazards.length).toBe(1);
      expect(result.hazards[0]!.hazardType).toBe('DUST_SANDSTORM');
      expect(result.hazards[0]!.visibilityBelowSm).toBe(3);
      expect(result.hazards[0]!.altitudeRange?.baseFt).toBe(undefined);
      expect(result.hazards[0]!.altitudeRange?.topFt).toBe(10000);
      expect(result.movement?.directionDeg).toBe(240);
      expect(result.movement?.speedKt).toBe(30);
      expect(result.intensityChange).toBe('INTENSIFYING');
    });

    it('parses occasional severe turbulence with WMO headers', () => {
      const result = parseSigmet(NONCONVECTIVE_TURB_WMO);
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.seriesName).toBe('UNIFORM');
      expect(result.seriesNumber).toBe(4);
      expect(result.states).toEqual(['KS', 'OK', 'TX', 'UT', 'CO', 'AZ', 'NM']);
      expect(result.areaPoints).toEqual(['30NW DVC', '50SE GCK', 'CDS', '60ENE INW', '30NW DVC']);
      expect(result.hazards.length).toBe(1);
      expect(result.hazards[0]!.hazardType).toBe('TURBULENCE');
      expect(result.hazards[0]!.isOccasional).toBe(true);
      expect(result.hazards[0]!.altitudeRange?.baseFt).toBe(28000);
      expect(result.hazards[0]!.altitudeRange?.topFt).toBe(38000);
      assert(result.hazards[0]!.cause?.includes('WNDSHR'));
      expect(result.conditionsContinuingBeyond?.hour).toBe(6);
      expect(result.conditionsContinuingBeyond?.minute).toBe(50);
    });

    it('parses cancellation with conditions mostly moderate', () => {
      const result = parseSigmet(NONCONVECTIVE_CANCEL);
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.isCancellation).toBe(true);
      expect(result.seriesName).toBe('NOVEMBER');
      expect(result.seriesNumber).toBe(4);
      expect(result.cancellationReason).toBe('CONDS MSTLY MOD');
      expect(result.hazards.length).toBe(0);
    });

    it('parses cancellation with conditions ended', () => {
      const result = parseSigmet(NONCONVECTIVE_CANCEL_ENDED);
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.isCancellation).toBe(true);
      expect(result.seriesName).toBe('OSCAR');
      expect(result.seriesNumber).toBe(1);
      expect(result.cancellationReason).toBe('CONDS HV ENDED');
    });

    it('parses occasional severe icing with low altitude base (WMO wrapped)', () => {
      const result = parseSigmet(NONCONVECTIVE_ICING_WMO);
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.seriesName).toBe('PAPA');
      expect(result.seriesNumber).toBe(2);
      expect(result.states).toEqual(['ME', 'NH', 'VT', 'NY', 'PA']);
      expect(result.areaPoints).toEqual([
        '70NW PQI',
        '40NE MPV',
        '30NW ALB',
        '20E SYR',
        '40N JHW',
        '30NW ERI',
        '50NE YOW',
        '70NW PQI',
      ]);
      expect(result.hazards.length).toBe(1);
      expect(result.hazards[0]!.hazardType).toBe('ICING');
      expect(result.hazards[0]!.isOccasional).toBe(true);
      expect(result.hazards[0]!.altitudeRange?.baseFt).toBe(4000);
      expect(result.hazards[0]!.altitudeRange?.topFt).toBe(22000);
      expect(result.hazards[0]!.cause).toBe('FZRA');
      expect(result.conditionsContinuingBeyond?.hour).toBe(19);
      expect(result.conditionsContinuingBeyond?.minute).toBe(10);
    });

    it('parses stationary turbulence (WMO wrapped)', () => {
      const result = parseSigmet(NONCONVECTIVE_STATIONARY);
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.seriesName).toBe('ROMEO');
      expect(result.seriesNumber).toBe(3);
      expect(result.states).toEqual(['WI', 'MI', 'IN', 'OH']);
      expect(result.areaPoints).toEqual([
        '30NW GRB',
        '40E MKE',
        '30S FWA',
        '30E IND',
        '40NW DLH',
        '30NW GRB',
      ]);
      expect(result.hazards.length).toBe(1);
      expect(result.hazards[0]!.hazardType).toBe('TURBULENCE');
      expect(result.hazards[0]!.isOccasional).toBe(true);
      expect(result.hazards[0]!.altitudeRange?.baseFt).toBe(31000);
      expect(result.hazards[0]!.altitudeRange?.topFt).toBe(41000);
      expect(result.hazards[0]!.cause).toBe('JTST');
      expect(result.movement).toBe(undefined);
      expect(result.conditionsContinuingBeyond?.hour).toBe(20);
      expect(result.conditionsContinuingBeyond?.minute).toBe(15);
    });

    it('parses weakening turbulence with conditions ending by (WMO wrapped)', () => {
      const result = parseSigmet(NONCONVECTIVE_WEAKENING);
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.seriesName).toBe('QUEBEC');
      expect(result.seriesNumber).toBe(2);
      expect(result.states).toEqual(['FL', 'GA', 'SC']);
      expect(result.areaPoints).toEqual([
        '30NW TLH',
        '40E SAV',
        '80SE CHS',
        '60SW PIE',
        '30NW TLH',
      ]);
      expect(result.hazards.length).toBe(1);
      expect(result.hazards[0]!.hazardType).toBe('TURBULENCE');
      expect(result.hazards[0]!.isOccasional).toBe(true);
      assert(result.hazards[0]!.cause?.includes('WNDSHR'));
      expect(result.intensityChange).toBe('WEAKENING');
      expect(result.conditionsEndingBy?.hour).toBe(18);
      expect(result.conditionsEndingBy?.minute).toBe(20);
    });

    it('parses multiple hazards (icing + turbulence) in a single SIGMET', () => {
      const result = parseSigmet(NONCONVECTIVE_MULTI_HAZARD);
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.seriesName).toBe('VICTOR');
      expect(result.seriesNumber).toBe(1);
      expect(result.states).toEqual(['NY', 'PA', 'NJ', 'CT', 'MA', 'VT', 'NH', 'ME']);
      expect(result.areaPoints).toEqual([
        '80NW PQI',
        '40S BGR',
        '30W BOS',
        '40NW JFK',
        '30E PSB',
        '50NW ERI',
        '40E YOW',
        '80NW PQI',
      ]);
      expect(result.hazards.length).toBe(2);

      expect(result.hazards[0]!.hazardType).toBe('ICING');
      expect(result.hazards[0]!.isOccasional).toBe(true);
      expect(result.hazards[0]!.altitudeRange?.baseFt).toBe(3000);
      expect(result.hazards[0]!.altitudeRange?.topFt).toBe(20000);
      expect(result.hazards[0]!.cause).toBe('FZRA/FZPN');

      expect(result.hazards[1]!.hazardType).toBe('TURBULENCE');
      expect(result.hazards[1]!.isOccasional).toBe(true);
      expect(result.hazards[1]!.altitudeRange?.baseFt).toBe(25000);
      expect(result.hazards[1]!.altitudeRange?.topFt).toBe(39000);
      expect(result.hazards[1]!.cause).toBe('JTST');

      expect(result.conditionsContinuingBeyond?.hour).toBe(21);
      expect(result.conditionsContinuingBeyond?.minute).toBe(30);
    });

    it('parses intensifying turbulence (WMO wrapped)', () => {
      const result = parseSigmet(NONCONVECTIVE_INTENSIFYING);
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.seriesName).toBe('OSCAR');
      expect(result.seriesNumber).toBe(2);
      expect(result.states).toEqual(['MN', 'WI', 'IA', 'IL']);
      expect(result.areaPoints).toEqual(['50NW DLH', '40E GRB', '30SE RFD', '40W DSM', '50NW DLH']);
      expect(result.hazards.length).toBe(1);
      expect(result.hazards[0]!.hazardType).toBe('TURBULENCE');
      expect(result.hazards[0]!.isOccasional).toBe(true);
      assert(result.hazards[0]!.cause?.includes('WNDSHR'));
      expect(result.intensityChange).toBe('INTENSIFYING');
      expect(result.conditionsContinuingBeyond?.hour).toBe(22);
      expect(result.conditionsContinuingBeyond?.minute).toBe(45);
    });
  });

  describe('international SIGMET', () => {
    it('parses Alaska turbulence SIGMET with area and LLWS', () => {
      const result = parseSigmet(INTERNATIONAL_ALASKA_TURB);
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }

      expect(result.firCode).toBe('PAZA');
      expect(result.firName).toBe('ANCHORAGE FIR');
      expect(result.seriesName).toBe('MIKE');
      expect(result.seriesNumber).toBe(1);
      expect(result.issuingStation).toBe('PANC');
      expect(result.validFrom.day).toBe(29);
      expect(result.validFrom.hour).toBe(16);
      expect(result.validFrom.minute).toBe(15);
      expect(result.validTo.day).toBe(29);
      expect(result.validTo.hour).toBe(20);
      expect(result.validTo.minute).toBe(15);
      expect(result.isCancellation).toBe(false);
      expect(result.phenomena).toBe('SEV TURB');
      expect(result.observationStatus).toBe('OBSERVED');
      expect(result.observedAt?.hour).toBe(16);
      expect(result.observedAt?.minute).toBe(15);
      assert(result.areaDescription);
      assert(result.altitudeRange);
      expect(result.altitudeRange.baseFt).toBe(undefined);
      expect(result.altitudeRange.topFt).toBe(10000);
      expect(result.isStationary).toBe(true);
      expect(result.intensityChange).toBe('NO_CHANGE');
      assert(result.additionalInfo);
      assert(result.additionalInfo.includes('LLWS'));
    });

    it('parses Alaska cancellation SIGMET', () => {
      const result = parseSigmet(INTERNATIONAL_ALASKA_CANCEL);
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }

      expect(result.firCode).toBe('PAZA');
      expect(result.firName).toBe('ANCHORAGE FIR');
      expect(result.seriesName).toBe('INDIA');
      expect(result.seriesNumber).toBe(3);
      expect(result.issuingStation).toBe('PANC');
      expect(result.isCancellation).toBe(true);
      expect(result.cancelledSeriesName).toBe('INDIA');
      expect(result.cancelledSeriesNumber).toBe(2);
      expect(result.cancelledValidStart?.day).toBe(26);
      expect(result.cancelledValidStart?.hour).toBe(23);
      expect(result.cancelledValidStart?.minute).toBe(10);
      expect(result.cancelledValidEnd?.day).toBe(27);
      expect(result.cancelledValidEnd?.hour).toBe(3);
      expect(result.cancelledValidEnd?.minute).toBe(10);
    });

    it('parses tropical cyclone SIGMET with position and forecast', () => {
      const result = parseSigmet(INTERNATIONAL_TROPICAL_CYCLONE);
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }

      expect(result.firCode).toBe('KZMA');
      expect(result.firName).toBe('MIAMI OCEANIC FIR');
      expect(result.seriesName).toBe('TANGO');
      expect(result.seriesNumber).toBe(3);
      expect(result.issuingStation).toBe('KNHC');
      expect(result.validFrom.day).toBe(4);
      expect(result.validFrom.hour).toBe(15);
      expect(result.validTo.day).toBe(4);
      expect(result.validTo.hour).toBe(21);
      expect(result.isCancellation).toBe(false);
      expect(result.cycloneName).toBe('FRANCINE');
      expect(result.phenomena).toBe('TC FRANCINE');
      expect(result.observationStatus).toBe('OBSERVED');
      expect(result.observedAt?.hour).toBe(15);
      expect(result.observedAt?.minute).toBe(0);
      assert(result.cyclonePosition);
      expect(result.cyclonePosition.lat).toBe(25 + 40 / 60);
      expect(result.cyclonePosition.lon).toBe(-(88 + 30 / 60));
      expect(result.cbTopFl).toBe(500);
      expect(result.withinNm).toBe(180);
      expect(result.movement?.directionCompass).toBe('NW');
      expect(result.movement?.speedKt).toBe(12);
      expect(result.intensityChange).toBe('INTENSIFYING');
      expect(result.forecastTime?.hour).toBe(21);
      expect(result.forecastTime?.minute).toBe(0);
      assert(result.forecastPosition);
      expect(result.forecastPosition.lat).toBe(26 + 40 / 60);
      expect(result.forecastPosition.lon).toBe(-(89 + 30 / 60));
    });
    it('parses EMBD TS from Oakland Oceanic FIR (real PHFO data)', () => {
      const result = parseSigmet(INTERNATIONAL_EMBD_TS);
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }

      expect(result.firCode).toBe('KZAK');
      assert(result.firName.includes('OAKLAND OCEANIC FIR'));
      expect(result.seriesName).toBe('PAPA');
      expect(result.seriesNumber).toBe(5);
      expect(result.issuingStation).toBe('PHFO');
      expect(result.validFrom.day).toBe(5);
      expect(result.validFrom.hour).toBe(13);
      expect(result.validTo.day).toBe(5);
      expect(result.validTo.hour).toBe(17);
      expect(result.isCancellation).toBe(false);
      expect(result.phenomena).toBe('EMBD TS');
      expect(result.observationStatus).toBe('OBSERVED');
      expect(result.observedAt?.hour).toBe(13);
      expect(result.observedAt?.minute).toBe(5);
      assert(result.areaDescription);
      assert(result.tops);
      expect(result.tops.altitudeFt).toBe(56000);
      expect(result.tops.isAbove).toBe(false);
      expect(result.movement?.directionCompass).toBe('W');
      expect(result.movement?.speedKt).toBe(5);
      expect(result.intensityChange).toBe('NO_CHANGE');
    });

    it('parses VA ERUPTION from AAWU without ICAO prefix on FIR name (real data)', () => {
      const result = parseSigmet(INTERNATIONAL_VA_ERUPTION);
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }

      expect(result.firCode).toBe('PAZA');
      assert(result.firName.includes('ANCHORAGE FIR'));
      expect(result.seriesName).toBe('INDIA');
      expect(result.seriesNumber).toBe(5);
      expect(result.issuingStation).toBe('PANC');
      expect(result.validFrom.day).toBe(19);
      expect(result.validTo.day).toBe(19);
      expect(result.isCancellation).toBe(false);
      expect(result.phenomena).toBe('VA ERUPTION');
      assert(result.altitudeRange);
      expect(result.altitudeRange.baseFt).toBe(undefined);
      expect(result.altitudeRange.topFt).toBe(6000);
      expect(result.isStationary).toBe(true);
      expect(result.intensityChange).toBe('WEAKENING');
    });

    it('parses OBSC TS with FCST from Dashoguz FIR (real data)', () => {
      const result = parseSigmet(INTERNATIONAL_OBSC_TS);
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }

      expect(result.firCode).toBe('UTAT');
      assert(result.firName.includes('DASHOGUZ FIR'));
      expect(result.seriesName).toBe('N');
      expect(result.seriesNumber).toBe(5);
      expect(result.issuingStation).toBe('UTAT');
      expect(result.isCancellation).toBe(false);
      expect(result.phenomena).toBe('OBSC TS');
      assert(result.tops);
      expect(result.tops.altitudeFt).toBe(37000);
      expect(result.movement?.directionCompass).toBe('NE');
      expect(result.movement?.speedKt).toBe(20);
      expect(result.intensityChange).toBe('NO_CHANGE');
    });
  });

  describe('robustness', () => {
    it('parses numeric series identifier (non-US MWO)', () => {
      const result = parseSigmet(
        'OEJD SIGMET 02 VALID 051300/051700 OEJN-\n' +
          'OEJD JEDDAH FIR EMBD TS OBS S OF LINE N2130 E04012 - N2143 E04243\n' +
          'TOP ABV FL390 MOV S NC=',
      );
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }

      expect(result.firCode).toBe('OEJD');
      assert(result.firName.includes('JEDDAH FIR'));
      expect(result.seriesName).toBe('02');
      expect(result.seriesNumber).toBe(2);
      expect(result.issuingStation).toBe('OEJN');
      expect(result.phenomena).toBe('EMBD TS');
      assert(result.areaDescription);
      assert(result.areaDescription.includes('N2130'));
      assert(result.tops);
      expect(result.tops.altitudeFt).toBe(39000);
      expect(result.tops.isAbove).toBe(true);
      expect(result.intensityChange).toBe('NO_CHANGE');
    });

    it('parses KMH speed in international SIGMET', () => {
      const result = parseSigmet(
        'LFFF SIGMET GOLF 1 VALID 051200/051600 LFPW-\n' +
          'LFFF PARIS FIR SEV TURB OBS AT 1200Z WI N4830 E00230 - N4700 E00400 - N4630 E00200\n' +
          'FL300/FL400 MOV NE 40KMH NC=',
      );
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }

      expect(result.movement?.directionCompass).toBe('NE');
      expect(result.movement?.speedKmPerHr).toBe(40);
      expect(result.movement?.speedKt).toBe(undefined);
    });

    it('handles carriage return line endings', () => {
      const result = parseSigmet(
        'SIGMET NOVEMBER 3 VALID UNTIL 050200Z\r\n' +
          'FROM 40NW SLC-60SE BOI-30SW BIL-40NW SLC\r\n' +
          'SEV TURB BTN FL350 AND FL410. DUE TO JTST. CONDS CONTG BYD 0200Z.',
      );
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.seriesName).toBe('NOVEMBER');
      expect(result.hazards[0]!.hazardType).toBe('TURBULENCE');
    });

    it('handles old Mac carriage returns without newlines', () => {
      const result = parseSigmet(
        'SIGMET OSCAR 1 VALID UNTIL 050400Z\r' +
          'FROM 30E BUF-40S ALB-20NW JFK-40NE ACK-30E BUF\r' +
          'SEV ICE BTN FL180 AND FL280. DUE TO FZRA. CONDS CONTG BYD 0400Z.',
      );
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.seriesName).toBe('OSCAR');
      expect(result.hazards[0]!.hazardType).toBe('ICING');
    });

    it('parses S OF LINE area format in international SIGMET', () => {
      const result = parseSigmet(
        'OEJD SIGMET 03 VALID 051300/051700 OEJN-\n' +
          'OEJD JEDDAH FIR EMBD TS FCST S OF LINE N2130 E04012 - N2143 E04243\n' +
          'TOP FL370 MOV S 10KT NC=',
      );
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }

      assert(result.areaDescription);
      assert(result.areaDescription.includes('N2130'));
      assert(result.areaDescription.includes('N2143'));
    });

    it('parses FCST without AT keyword in VA SIGMET', () => {
      const result = parseSigmet(
        'SIGMET PAPA 3 VALID 041600/042200Z\n' +
          'VOLCANIC ASH FROM ERUPTION OF MT REDOUBT 6042N15610W\n' +
          'VA CLD OBS AT 1530Z FL250/FL350\n' +
          'FROM 60NW ANC-40NE ANC-80SE ANC-60SW ANC-60NW ANC\n' +
          'MOV NE 30KT. FCST 2200Z FL200/FL400.',
      );
      expect(result.format).toBe('NONCONVECTIVE');
      if (result.format !== 'NONCONVECTIVE') {
        return;
      }

      expect(result.forecastTime?.hour).toBe(22);
      expect(result.forecastTime?.minute).toBe(0);
      assert(result.forecastAltitudeRange);
      expect(result.forecastAltitudeRange.baseFt).toBe(20000);
      expect(result.forecastAltitudeRange.topFt).toBe(40000);
    });
  });

  describe('international SIGMET - header variants', () => {
    it('parses a fused single-letter + single-digit identifier', () => {
      const result = parseSigmet(INTERNATIONAL_FUSED_SINGLE);
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }
      expect(result.seriesName).toBe('A');
      expect(result.seriesNumber).toBe(6);
      expect(result.firCode).toBe('SCCZ');
      expect(result.issuingStation).toBe('SCCI');
    });

    it('parses a fused identifier with zero-padded digits', () => {
      const result = parseSigmet(INTERNATIONAL_FUSED_ZERO_PADDED);
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }
      expect(result.seriesName).toBe('B');
      expect(result.seriesNumber).toBe(2);
      expect(result.firCode).toBe('SPIM');
      expect(result.issuingStation).toBe('SPJC');
    });

    it('parses a fused identifier with multi-digit number', () => {
      const result = parseSigmet(INTERNATIONAL_FUSED_MULTI_DIGIT);
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }
      expect(result.seriesName).toBe('D');
      expect(result.seriesNumber).toBe(10);
      expect(result.firCode).toBe('SPIM');
    });

    it('parses a fused identifier with multi-letter prefix', () => {
      const result = parseSigmet(INTERNATIONAL_FUSED_MULTI_LETTER);
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }
      expect(result.seriesName).toBe('AB');
      expect(result.seriesNumber).toBe(9);
      expect(result.firCode).toBe('FXXX');
    });

    it('parses a header with whitespace before the issuing-station dash', () => {
      const result = parseSigmet(INTERNATIONAL_SPACE_BEFORE_DASH);
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }
      expect(result.seriesName).toBe('140');
      expect(result.seriesNumber).toBe(140);
      expect(result.firCode).toBe('SBAZ');
      expect(result.issuingStation).toBe('SBAZ');
    });

    it('parses a header with multiple FIR codes preceding SIGMET', () => {
      const result = parseSigmet(INTERNATIONAL_MULTI_FIR);
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }
      expect(result.seriesName).toBe('FOXTROT');
      expect(result.seriesNumber).toBe(3);
      expect(result.issuingStation).toBe('KKCI');
      // The FIR code closest to SIGMET (TJZS) is captured from the header.
      // Earlier FIR codes (KZMA) are consumed by parseFirInfo from the body.
      assert(
        result.firCode === 'TJZS' || result.firCode === 'KZMA',
        `firCode should be one of the header FIRs, got ${result.firCode}`,
      );
    });

    it('parses a cancellation referencing a fused identifier', () => {
      const result = parseSigmet(INTERNATIONAL_CANCEL_FUSED);
      expect(result.format).toBe('INTERNATIONAL');
      if (result.format !== 'INTERNATIONAL') {
        return;
      }
      expect(result.isCancellation).toBe(true);
      expect(result.cancelledSeriesName).toBe('A');
      expect(result.cancelledSeriesNumber).toBe(6);
    });
  });

  describe('parseSigmetBulletin', () => {
    it('splits a multi-SIGMET convective bulletin', () => {
      const bulletin =
        'WSUS32 KKCI 051655\n' +
        'SIGC\n' +
        'MKCC WST 051655\n' +
        'CONVECTIVE SIGMET 50C\n' +
        'VALID UNTIL 1855Z\n' +
        'FL GA AL MS LA AND FL AL MS LA CSTL WTRS\n' +
        'FROM 20SSE ODF-10ENE PZD-50S LEV-80SSE LCH-20SSE ODF\n' +
        'AREA EMBD TS MOV FROM 28015KT. TOPS TO FL420.\n' +
        '\n' +
        'CONVECTIVE SIGMET 51C\n' +
        'VALID UNTIL 1855Z\n' +
        'TX AND CSTL WTRS\n' +
        'FROM 40SW ACT-90SE PSX-10E BRO-20SE DLF-40SW ACT\n' +
        'AREA TS MOV FROM 21015KT. TOPS TO FL330.\n' +
        '\n' +
        'OUTLOOK VALID 051855-052255\n' +
        'FROM ODF-PZD-50SSE LEV-110S LCH-LSU-ODF\n' +
        'WST ISSUANCES EXPD. REFER TO MOST RECENT ACUS01 KWNS FROM STORM\n' +
        'PREDICTION CENTER FOR SYNOPSIS AND METEOROLOGICAL DETAILS.';

      const results = parseSigmetBulletin(bulletin);
      expect(results.length).toBe(2);

      const first = results[0]!;
      expect(first.format).toBe('CONVECTIVE');
      if (first.format === 'CONVECTIVE') {
        expect(first.number).toBe(50);
        expect(first.region).toBe('C');
        expect(first.thunderstormType).toBe('AREA');
        expect(first.isEmbedded).toBe(true);
        assert(first.outlook);
      }

      const second = results[1]!;
      expect(second.format).toBe('CONVECTIVE');
      if (second.format === 'CONVECTIVE') {
        expect(second.number).toBe(51);
        expect(second.region).toBe('C');
        expect(second.thunderstormType).toBe('AREA');
        assert(second.outlook);
      }
    });

    it('handles NONE bulletin', () => {
      const results = parseSigmetBulletin(CONVECTIVE_NONE);
      expect(results.length).toBe(1);
      expect(results[0]!.format).toBe('CONVECTIVE');
      if (results[0]!.format === 'CONVECTIVE') {
        expect(results[0]!.isNone).toBe(true);
      }
    });

    it('handles single non-convective SIGMET as bulletin', () => {
      const results = parseSigmetBulletin(NONCONVECTIVE_TURBULENCE);
      expect(results.length).toBe(1);
      expect(results[0]!.format).toBe('NONCONVECTIVE');
    });

    it('throws on empty input', () => {
      expect(() => parseSigmetBulletin('')).toThrow(/Empty SIGMET bulletin/);
    });
  });
});
