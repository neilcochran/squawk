import { describe, it, expect, assert } from 'vitest';

import { parseAirmet } from './airmet-parser.js';

// ---------------------------------------------------------------------------
// Hand-crafted reference data
// ---------------------------------------------------------------------------

const SIERRA_IFR = `AIRMET SIERRA FOR IFR AND MTN OBSCN
VALID UNTIL 050400Z
AIRMET IFR...NY PA NJ CT MA RI
FROM 30SW ALB-20NW BDR-40E ACK-20NE BOS-30SW ALB
CIG BLW 010/VIS BLW 3SM BR. CONDS CONTG BYD 0400Z.`;

const SIERRA_MTN_OBSCN = `AIRMET SIERRA FOR IFR AND MTN OBSCN
VALID UNTIL 050400Z
AIRMET MTN OBSCN...WA OR CA
FROM 20S SEA-40E PDX-60SE MFR-30W RDD-20S SEA
MTNS OBSCD BY CLD/PCPN/BR. CONDS CONTG BYD 0400Z.`;

const TANGO_TURB = `AIRMET TANGO FOR TURB AND SFC WND AND LLWS
VALID UNTIL 050400Z
AIRMET TURB...MT WY CO NM
FROM 40NW BIL-30E SHR-20S PUB-40W ABQ-40NW BIL
MOD TURB BTN FL250 AND FL380. DUE TO JTST. CONDS CONTG BYD 0400Z.`;

const TANGO_SFC_WND = `AIRMET TANGO FOR TURB AND SFC WND AND LLWS
VALID UNTIL 050400Z
AIRMET SFC WND...KS OK TX
FROM 30NW ICT-40S MCI-20W OKC-50SW ABI-30NW ICT
SUSTAINED SFC WND GTR THAN 30KT. CONDS CONTG BYD 0400Z.`;

const TANGO_LLWS = `AIRMET TANGO FOR TURB AND SFC WND AND LLWS
VALID UNTIL 050400Z
AIRMET LLWS...TX LA AR MS
FROM 40W LIT-30S MEI-30SW LCH-40NW IAH-40W LIT
LLWS DUE TO LFNT. CONDS ENDG 0200-0400Z.`;

const ZULU_ICING = `AIRMET ZULU FOR ICE AND FRZLVL
VALID UNTIL 050400Z
AIRMET ICE...NH VT ME NY PA
FROM 30NW BGR-40E MPV-20NW ALB-30E SYR-30NW BGR
MOD ICE BTN 040 AND FL220. CONDS CONTG BYD 0400Z.
FRZLVL...040-060 ACRS AREA.`;

const ZULU_FRZLVL_ONLY = `AIRMET ZULU FOR ICE AND FRZLVL
VALID UNTIL 050400Z
NO SIGNIFICANT ICE EXPECTED.
FRZLVL...SFC-020 N OF 40N LINE. 040-080 S OF 40N LINE.
MULT FRZLVL BLW 080 BOUNDED BY 30W BUF-30NW PIT-20E CLE-30W BUF.`;

const UPDATE = `AIRMET SIERRA UPDT 2 FOR IFR AND MTN OBSCN
VALID UNTIL 050400Z
AIRMET IFR...OH IN MI WI
FROM 30E DTW-40SE CLE-30SW CVG-40NW IND-30E DTW
CIG BLW 010/VIS BLW 3SM FG. CONDS ENDG 0200-0400Z.`;

// ---------------------------------------------------------------------------
// NIL bulletins
// ---------------------------------------------------------------------------

const TANGO_NIL = `WAUS45 KKCI 271445
WA5T
SLCT WA 271445
AIRMET TANGO FOR TURB AND STG SFC WNDS AND LLWS VALID UNTIL 272100
.
NO SIGNIFICANT TURB EXP.
NO SIGNIFICANT STG SFC WNDS EXP.
NO SIGNIFICANT LLWS EXP.`;

const SIERRA_NIL = `WAUS45 KKCI 271445
WA5S
SLCS WA 271445
AIRMET SIERRA FOR IFR AND MTN OBSCN VALID UNTIL 272100
.
NO SIGNIFICANT IFR EXP.
NO SIGNIFICANT MTN OBSCN EXP.`;

// ---------------------------------------------------------------------------
// Real-world WMO-wrapped bulletins
// ---------------------------------------------------------------------------

const REAL_SIERRA_WA1S = `WAUS41 KKCI 271445
WA1S
BOSS WA 271445
AIRMET SIERRA UPDT 3 FOR IFR AND MTN OBSCN VALID UNTIL 272100
.
AIRMET IFR...ME
FROM 70NW PQI TO 40SW PQI TO 60WNW BGR TO 40SE YQB TO 70NW PQI
CIG BLW 010/VIS BLW 3SM PCPN/BR. CONDS DVLPG 18-21Z. CONDS CONTG
BYD 21Z THRU 03Z.
.
AIRMET IFR...ME NH VT
FROM 60NE MPV TO 70WSW BGR TO 20SE CON TO 30SW MPV TO 60NE MPV
CIG BLW 010/VIS BLW 3SM BR. CONDS ENDG 15-18Z.
.
AIRMET MTN OBSCN...WV VA NC SC GA
FROM 50S EKN TO 20SW LYH TO CLT TO ATL TO GQO TO HMV TO 40W BKW
TO 50S EKN
MTNS OBSC BY CLDS/PCPN. CONDS CONTG BYD 21Z THRU 03Z.
.
AIRMET MTN OBSCN...ME NH VT NY
FROM 70NW PQI TO MLT TO 40WSW BGR TO 50SW CON TO MSS TO 80S YQB
TO 70NW PQI
MTNS OBSC BY CLDS/PCPN/BR. CONDS CONTG BYD 21Z THRU 03Z.`;

const REAL_TANGO_WA6T = `WAUS46 KKCI 271445
WA6T
SFOT WA 271445
AIRMET TANGO UPDT 2 FOR TURB VALID UNTIL 272100
.
AIRMET TURB...CA NV UT CO AZ NM AND CSTL WTRS
FROM 40SSE JNC TO 30WSW ALS TO 40S INW TO 20E BZA TO 20S MZB TO
220SW MZB TO 140SSW SNS TO 40NNW HEC TO 40SSE JNC
MOD TURB BTN 150 AND FL300. CONDS CONTG BYD 21Z THRU 03Z.
.
AIRMET TURB...CA WY NV UT CO AZ NM AND CSTL WTRS
FROM 60SW REO TO 20SE BFF TO GLD TO 40ESE LAA TO 30NW HVE TO
150SW SNS TO 130WSW ENI TO 60SW REO
MOD TURB BTN FL240 AND FL380. CONDS CONTG BYD 21Z THRU 03Z.
.
AIRMET TURB...CA
FROM 60N RBL TO 90S LKV TO 50NNW FMG TO 50SSW BTY TO 60WNW HEC
TO 30NNE LAX TO 40ESE CZQ TO 20NNE MOD TO 40NNW SAC TO 20WNW RBL
TO 60N RBL
MOD TURB BLW 120. CONDS ENDG 18-21Z.`;

const REAL_TANGO_WA1T = `WAUS41 KKCI 271445
WA1T
BOST WA 271445
AIRMET TANGO UPDT 2 FOR TURB STG WNDS AND LLWS VALID UNTIL 272100
.
AIRMET TURB...OH WV VA NC SC GA
FROM HNN TO 50ESE EKN TO 40WSW RIC TO 40W SPA TO GQO TO HMV TO
HNN
MOD TURB BTN FL240 AND FL380. CONDS DVLPG AFT 18Z. CONDS CONTG
BYD 21Z THRU 03Z.
.
AIRMET TURB...ME NH VT MA CT NY LO NJ PA LE WV MD VA AND CSTL
WTRS
FROM 80NW PQI TO 30NE PQI TO 40SE HUL TO 40ENE ENE TO 20SSW ENE
TO 30WSW BOS TO 30NE HAR TO 30WNW LYH TO BKW TO 30WSW JHW TO
20ENE YYZ TO 30ESE YOW TO 90SW YQB TO 70NNE MPV TO 80NW PQI
MOD TURB BLW 060. CONDS CONTG BYD 21Z THRU 03Z.
.
AIRMET STG SFC WNDS...ME NH MA RI NY AND CSTL WTRS
FROM 50WSW YSJ TO 180SE ACK TO 70ESE ACK TO 80SE HTO TO 20SSE
HTO TO 30ENE ENE TO 40SSE BGR TO 50WSW YSJ
SUSTAINED SURFACE WINDS GTR THAN 30KT EXP. CONDS CONTG BYD 21Z
THRU 03Z.
.
LLWS POTENTIAL...ME NH VT NY LO PA OH LE
BOUNDED BY 70SE YQB-70W BGR-40SSE MPV-60SSW MPV-20SE ALB-20SSE
HNK-50E SLT-20SSW SLT-40S ERI-30NW ERI-20E YYZ-30ESE YOW-50NE
MSS-70SSW YQB-70SE YQB
LLWS EXP. CONDS CONTG BYD 21Z THRU 03Z.`;

const REAL_TANGO_WA3T = `WAUS43 KKCI 271445
WA3T
CHIT WA 271445
AIRMET TANGO UPDT 2 FOR TURB STG WNDS AND LLWS VALID UNTIL 272100
.
AIRMET TURB...NE KS IA MO IL IN KY OK TX AR TN MS AL
FROM 20SE BFF TO 20WNW PWE TO 50E IND TO CVG TO HNN TO HMV TO
GQO TO 20S MSL TO 20NNE TUL TO 40ESE LAA TO GLD TO 20SE BFF
MOD TURB BTN FL240 AND FL380. CONDS CONTG BYD 21Z THRU 03Z.
.
AIRMET STG SFC WNDS...MI LH
FROM SSM TO 60NW YVV TO 40ENE ECK TO 20S ASP TO 40SSW SSM TO SSM
SUSTAINED SURFACE WINDS GTR THAN 30KT EXP. CONDS CONTG BYD 21Z
ENDG BY 03Z.
.
AIRMET STG SFC WNDS...MN LS MI
FROM 20ESE YQT TO 30NW SSM TO 30E SAW TO 70N RHI TO 50NE DLH TO
20ESE YQT
SUSTAINED SURFACE WINDS GTR THAN 30KT EXP. CONDS CONTG BYD 21Z
ENDG 00-03Z.
.
AIRMET STG SFC WNDS...WI LM MI LH
FROM 40ESE SAW TO 20S SSM TO 30SSW PMM TO 20NE ORD TO 50SSE GRB
TO 30ENE GRB TO 40ESE SAW
SUSTAINED SURFACE WINDS GTR THAN 30KT EXP. CONDS ENDG BY 21Z.
.
LLWS POTENTIAL...MN IA MO WI LM LS MI LH IL IN
BOUNDED BY 70WNW INL-20SSE YQT-70NW SSM-SSM-70NW YVV-40ENE ECK-
30ENE DXO-40ENE FWA-20N IND-30SW IRK-40WSW DSM-70WNW INL
LLWS EXP. CONDS CONTG BYD 21Z THRU 03Z.
.
LLWS POTENTIAL...ND SD NE MN IA
BOUNDED BY 70NNW ISN-50ENE MOT-70WNW INL-40WSW DSM-40SSE ONL-
50SSE RAP-50WSW RAP-70NNW ISN
LLWS EXP. CONDS CONTG BYD 21Z THRU 03Z.`;

const REAL_SIERRA_WA2S = `WAUS42 KKCI 271445
WA2S
MIAS WA 271445
AIRMET SIERRA UPDT 2 FOR IFR AND MTN OBSCN VALID UNTIL 272100
.
AIRMET IFR...NC SC GA FL AND CSTL WTRS
FROM 30E BKW TO 40SSE PSK TO 50E ORF TO 100ESE ECG TO 70SE ILM
TO 30NW TLH TO 80SSE SJI TO 40W CEW TO 50SW PZD TO GQO TO HMV TO
40W BKW TO 30E BKW
CIG BLW 010/VIS BLW 3SM PCPN/BR. CONDS CONTG BYD 21Z THRU 03Z.
.
AIRMET MTN OBSCN...NC SC GA WV VA
FROM 50S EKN TO 20SW LYH TO CLT TO ATL TO GQO TO HMV TO 40W BKW
TO 50S EKN
MTNS OBSC BY CLDS/PCPN. CONDS CONTG BYD 21Z THRU 03Z.`;

const REAL_SIERRA_WA4S = `WAUS44 KKCI 271445
WA4S
DFWS WA 271445
AIRMET SIERRA UPDT 2 FOR IFR AND MTN OBSCN VALID UNTIL 272100
.
AIRMET IFR...OK TX AR TN LA MS AL KY AND CSTL WTRS
FROM 40W BKW TO HMV TO GQO TO 50SW PZD TO 40W CEW TO 80SSE SJI
TO 50S LEV TO 120SSW LCH TO 120ENE BRO TO 20E BRO TO 90W BRO TO
DLF TO CWK TO 70SSE MLC TO 40NNW SQS TO 50WSW LOZ TO 40W BKW
CIG BLW 010/VIS BLW 3SM PCPN/BR. CONDS CONTG BYD 21Z THRU 03Z.
.
AIRMET MTN OBSCN...TN KY
FROM 40W BKW TO HMV TO GQO TO 50WSW LOZ TO 50ENE LOZ TO 40W BKW
MTNS OBSC BY CLDS/PCPN. CONDS CONTG BYD 21Z ENDG BY 00Z.`;

const REAL_SIERRA_WA6S = `WAUS46 KKCI 271445
WA6S
SFOS WA 271445
AIRMET SIERRA UPDT 2 FOR IFR AND MTN OBSCN VALID UNTIL 272100
.
AIRMET IFR...CA NV AZ AND CSTL WTRS
FROM 30E MOD TO 60S BTY TO 50WNW TBC TO 30SSE TBC TO 20N PHX TO
30SSE EED TO 60SSW EED TO 50W BZA TO MZB TO LAX TO 30W RZS TO
30E MOD
CIG BLW 010/VIS BLW 3SM PCPN/BR. CONDS CONTG BYD 21Z THRU 03Z.
.
AIRMET MTN OBSCN...CA NV UT AZ
FROM 20ENE MOD TO 60S BCE TO 40SSE TBC TO PHX TO EED TO 30E HEC
TO 30S HEC TO 60SSE TRM TO MZB TO LAX TO 40W RZS TO 60SSE SNS TO
40E SNS TO 40W EHF TO 30SSE EHF TO 20ENE MOD
MTNS OBSC BY CLDS/PCPN/BR. CONDS CONTG BYD 21Z THRU 03Z.`;

const REAL_ZULU_WA2Z = `WAUS42 KKCI 271445
WA2Z
MIAZ WA 271445
AIRMET ZULU UPDT 2 FOR ICE AND FRZLVL VALID UNTIL 272100
.
AIRMET ICE...NC SC GA FL AND CSTL WTRS
FROM 40ESE VXV TO 30SSW GSO TO 190SE CHS TO 40SE CRG TO 80SSE CEW
TO 40SW CEW TO 50SW PZD TO 30W ATL TO 20SSE ODF TO 40ESE VXV
MOD ICE BTN FRZLVL AND FL240. FRZLVL 060-110. CONDS CONTG BYD 21Z
THRU 03Z.
.
AIRMET ICE...NC MA RI NY NJ WV MD DE VA AND CSTL WTRS
FROM 150ESE ACK TO 200SE ACK TO 160SE SIE TO 190ESE ECG TO 30S
GSO TO 40ESE VXV TO 50SE LOZ TO 150ESE ACK
MOD ICE BTN FRZLVL AND FL190. FRZLVL 020-060. CONDS ENDG 18-21Z.
.
AIRMET ICE...NC SC GA AND CSTL WTRS
FROM 30SSW GSO TO 190ESE ECG TO 130SSE ILM TO 190SSE ILM TO 190SE
CHS TO 30SSW GSO
MOD ICE BTN FRZLVL AND FL240. FRZLVL 060-110. CONDS CONTG BYD 21Z
THRU 03Z.
.
FRZLVL...RANGING FROM 035-150 ACRS AREA
   040 ALG 20S ORF-80E ECG-160SE SIE
   080 ALG 40WNW ATL-20NNE CAE-160ESE ILM
   120 ALG 120SSE SJI-130SSE SJI-30W OMN-220SE CHS`;

const REAL_ZULU_WA5Z = `WAUS45 KKCI 271445
WA5Z
SLCZ WA 271445
AIRMET ZULU UPDT 2 FOR ICE AND FRZLVL VALID UNTIL 272100
.
AIRMET ICE...NV UT AZ CA AND CSTL WTRS
FROM 40NW OAL TO 50SSW BCE TO 20SE TBC TO 60SSW INW TO 70ESE BZA
TO BZA TO 30S MZB TO 80SW MZB TO 160SSW RZS TO 40S CZQ TO 70ESE
CZQ TO 40NW OAL
MOD ICE BTN 050 AND 160. CONDS CONTG BYD 21Z THRU 03Z.
.
FRZLVL...RANGING FROM SFC-110 ACRS AREA
   MULT FRZLVL BLW 090 BOUNDED BY 60WSW YXC-50NNW ISN-70SW RAP-
      20ESE DDY-30SW DDY-30NNW DLN-20WSW LKT-20W DNJ-60WSW YXC
   MULT FRZLVL BLW 110 BOUNDED BY 70SW RAP-BFF-GLD-50W LBL-30ESE
      TBE-INK-20W ELP-60E TCS-40WSW TCS-40SSW INW-30NW TBC-40SSE
      MTU-30NNE ALS-20ESE DDY-70SW RAP
   SFC ALG 40WSW LAS-20SE LAS-40NE PHX-40NE TUS-30W ELP`;

const REAL_ZULU_WA1Z = `WAUS41 KKCI 271445
WA1Z
BOSZ WA 271445
AIRMET ZULU UPDT 2 FOR ICE AND FRZLVL VALID UNTIL 272100
.
AIRMET ICE...ME NH VT NY LO
FROM 70NW PQI TO 40NE PQI TO 30SSE HUL TO BGR TO 30WNW ALB TO 50N
SYR TO 30SE YOW TO 70NNE MPV TO 70NW PQI
MOD ICE BTN 020 AND 100. CONDS CONTG BYD 21Z THRU 03Z.
.
AIRMET ICE...MA RI NY NJ WV MD DE VA NC AND CSTL WTRS
FROM 150ESE ACK TO 200SE ACK TO 160SE SIE TO 190ESE ECG TO 30S
GSO TO 40ESE VXV TO 50SE LOZ TO 150ESE ACK
MOD ICE BTN FRZLVL AND FL190. FRZLVL 020-060. CONDS ENDG 18-21Z.
.
OTLK VALID 2100-0300Z
AREA 1...ICE OH LE
BOUNDED BY 40S ECK-40W CLE-40E IND-FWA-40S ECK
MOD ICE BTN 040 AND 170. CONDS DVLPG AFT 00Z. CONDS CONTG THRU
03Z.
.
AREA 2...ICE VT NY LO PA OH LE
BOUNDED BY 20NNW MSS-50NNE MPV-50SW SYR-30NNW APE-50NNE ROD-40SE
DXO-30WSW BUF-20E YYZ-50NNW SYR-20NNW MSS
MOD ICE BTN 030 AND 160. CONDS DVLPG 00-03Z. CONDS CONTG THRU
03Z.
.
FRZLVL...RANGING FROM SFC-045 ACRS AREA
   SFC ALG 40S HNN-50SSE ETX-80SSE BGR-100SSW YSJ
   040 ALG HMV-30SW PSK-20S ORF`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseAirmet', () => {
  describe('error handling', () => {
    it('throws on empty input', () => {
      expect(() => parseAirmet('')).toThrow(/Empty AIRMET string/);
    });

    it('throws on whitespace-only input', () => {
      expect(() => parseAirmet('   \n  ')).toThrow(/Empty AIRMET string/);
    });

    it('throws on invalid header', () => {
      expect(() => parseAirmet('NOT AN AIRMET')).toThrow(/Unable to parse AIRMET header/);
    });
  });

  describe('Sierra - IFR', () => {
    it('parses a basic IFR hazard', () => {
      const result = parseAirmet(SIERRA_IFR);
      expect(result.series).toBe('SIERRA');
      expect(result.updateNumber).toBe(undefined);
      expect(result.purposes).toBe('IFR AND MTN OBSCN');
      expect(result.validUntil).toEqual({ day: 5, hour: 4, minute: 0 });
      expect(result.hazards.length).toBe(1);

      const h = result.hazards[0]!;
      expect(h.hazardType).toBe('IFR');
      expect(h.states).toEqual(['NY', 'PA', 'NJ', 'CT', 'MA', 'RI']);
      expect(h.coastalWaters).toBe(false);
      expect(h.areaPoints.length).toBe(5);
      expect(h.areaPoints[0]).toBe('30SW ALB');
      assert(h.conditionDescription?.includes('CIG BLW 010'));
      expect(h.conditions?.status).toBe('CONTINUING');
      expect(h.conditions?.startTime).toEqual({ hour: 4, minute: 0 });
    });
  });

  describe('Sierra - Mountain Obscuration', () => {
    it('parses a mountain obscuration hazard', () => {
      const result = parseAirmet(SIERRA_MTN_OBSCN);
      expect(result.series).toBe('SIERRA');
      expect(result.hazards.length).toBe(1);

      const h = result.hazards[0]!;
      expect(h.hazardType).toBe('MTN_OBSCN');
      expect(h.states).toEqual(['WA', 'OR', 'CA']);
      assert(h.conditionDescription?.includes('MTNS'));
      assert(h.conditionDescription?.includes('CLD/PCPN/BR'));
    });
  });

  describe('Tango - Turbulence', () => {
    it('parses a turbulence hazard with altitude range and cause', () => {
      const result = parseAirmet(TANGO_TURB);
      expect(result.series).toBe('TANGO');
      expect(result.purposes).toBe('TURB AND SFC WND AND LLWS');
      expect(result.hazards.length).toBe(1);

      const h = result.hazards[0]!;
      expect(h.hazardType).toBe('TURB');
      expect(h.states).toEqual(['MT', 'WY', 'CO', 'NM']);
      expect(h.altitudeRange).toEqual({ baseFt: 25000, topFt: 38000 });
      expect(h.cause).toBe('JTST');
      expect(h.conditions?.status).toBe('CONTINUING');
    });
  });

  describe('Tango - Surface Wind', () => {
    it('parses a surface wind hazard', () => {
      const result = parseAirmet(TANGO_SFC_WND);
      expect(result.hazards.length).toBe(1);

      const h = result.hazards[0]!;
      expect(h.hazardType).toBe('STG_SFC_WND');
      expect(h.states).toEqual(['KS', 'OK', 'TX']);
      assert(h.conditionDescription?.includes('SUSTAINED'));
      assert(h.conditionDescription?.includes('30KT'));
    });
  });

  describe('Tango - LLWS', () => {
    it('parses an LLWS hazard with cause and ending conditions', () => {
      const result = parseAirmet(TANGO_LLWS);
      expect(result.hazards.length).toBe(1);

      const h = result.hazards[0]!;
      expect(h.hazardType).toBe('LLWS');
      expect(h.states).toEqual(['TX', 'LA', 'AR', 'MS']);
      expect(h.conditions?.status).toBe('ENDING');
      expect(h.conditions?.startTime).toEqual({ hour: 2, minute: 0 });
      expect(h.conditions?.endTime).toEqual({ hour: 4, minute: 0 });
    });
  });

  describe('Zulu - Icing', () => {
    it('parses an icing hazard with freezing level', () => {
      const result = parseAirmet(ZULU_ICING);
      expect(result.series).toBe('ZULU');
      expect(result.hazards.length).toBe(1);

      const h = result.hazards[0]!;
      expect(h.hazardType).toBe('ICE');
      expect(h.states).toEqual(['NH', 'VT', 'ME', 'NY', 'PA']);
      assert(h.conditionDescription?.includes('MOD ICE BTN 040 AND FL220'));
      expect(h.altitudeRange).toEqual({ baseFt: 4000, topFt: 22000 });
      expect(h.conditions?.status).toBe('CONTINUING');

      // Freezing level range: 040-060 ACRS AREA
      const frzlvl = result.freezingLevel!;
      expect(frzlvl.range).toBe('040-060 ACRS AREA');
      expect(frzlvl.rangeLowFt).toBe(4000);
      expect(frzlvl.rangeHighFt).toBe(6000);
    });
  });

  describe('Zulu - Freezing Level Only', () => {
    it('parses a NIL icing bulletin with freezing level data', () => {
      const result = parseAirmet(ZULU_FRZLVL_ONLY);
      expect(result.series).toBe('ZULU');
      expect(result.hazards.length).toBe(0);
      expect(result.nilStatements.length).toBe(1);
      assert(result.nilStatements[0]!.includes('NO SIGNIFICANT ICE'));

      const frzlvl = result.freezingLevel!;
      assert(frzlvl);

      // Lat-line contours: SFC-020 N OF 40N LINE. 040-080 S OF 40N LINE.
      assert(frzlvl.contours.length >= 2);
      const nContour = frzlvl.contours.find((c) => c.location.includes('N OF 40N LINE'));
      assert(nContour);
      const sContour = frzlvl.contours.find((c) => c.location.includes('S OF 40N LINE'));
      assert(sContour);

      // MULT FRZLVL BLW 080 boundary
      expect(frzlvl.multiFrzlvl.length).toBe(1);
      expect(frzlvl.multiFrzlvl[0]!.belowFt).toBe(8000);
      assert(frzlvl.multiFrzlvl[0]!.boundedBy.length > 0);
      expect(frzlvl.multiFrzlvl[0]!.boundedBy[0]).toBe('30W BUF');
    });
  });

  describe('Update numbering', () => {
    it('parses an updated AIRMET with update number', () => {
      const result = parseAirmet(UPDATE);
      expect(result.series).toBe('SIERRA');
      expect(result.updateNumber).toBe(2);
      expect(result.hazards.length).toBe(1);
      expect(result.hazards[0]!.hazardType).toBe('IFR');
      expect(result.hazards[0]!.conditions?.status).toBe('ENDING');
    });
  });

  describe('NIL bulletins', () => {
    it('parses a Tango NIL bulletin with WMO headers', () => {
      const result = parseAirmet(TANGO_NIL);
      expect(result.series).toBe('TANGO');
      expect(result.issuingOffice).toBe('SLCT');
      expect(result.hazards.length).toBe(0);
      expect(result.nilStatements.length).toBe(3);
      assert(result.nilStatements[0]!.includes('TURB'));
      assert(result.nilStatements[1]!.includes('SFC WNDS'));
      assert(result.nilStatements[2]!.includes('LLWS'));
    });

    it('parses a Sierra NIL bulletin with WMO headers', () => {
      const result = parseAirmet(SIERRA_NIL);
      expect(result.series).toBe('SIERRA');
      expect(result.issuingOffice).toBe('SLCS');
      expect(result.hazards.length).toBe(0);
      expect(result.nilStatements.length).toBe(2);
    });
  });

  describe('Real-world Sierra WA1S', () => {
    it('parses multiple IFR and MTN OBSCN hazards', () => {
      const result = parseAirmet(REAL_SIERRA_WA1S);
      expect(result.series).toBe('SIERRA');
      expect(result.updateNumber).toBe(3);
      expect(result.issuingOffice).toBe('BOSS');
      assert(result.issuedAt);

      // Should have 4 hazards: 2 IFR + 2 MTN OBSCN
      expect(result.hazards.length).toBe(4);

      const ifrHazards = result.hazards.filter((h) => h.hazardType === 'IFR');
      const mtnHazards = result.hazards.filter((h) => h.hazardType === 'MTN_OBSCN');
      expect(ifrHazards.length).toBe(2);
      expect(mtnHazards.length).toBe(2);

      // First IFR: ME only, DVLPG 18-21Z
      expect(ifrHazards[0]!.states).toEqual(['ME']);

      // Second IFR: ME NH VT, ENDG 15-18Z
      expect(ifrHazards[1]!.states).toEqual(['ME', 'NH', 'VT']);
      expect(ifrHazards[1]!.conditions?.status).toBe('ENDING');
    });
  });

  describe('Real-world Tango WA6T', () => {
    it('parses multiple turbulence hazards with TO-separated area points', () => {
      const result = parseAirmet(REAL_TANGO_WA6T);
      expect(result.series).toBe('TANGO');
      expect(result.updateNumber).toBe(2);
      expect(result.issuingOffice).toBe('SFOT');

      expect(result.hazards.length).toBe(3);

      // All should be TURB
      for (const h of result.hazards) {
        expect(h.hazardType).toBe('TURB');
      }

      // First hazard has coastal waters
      expect(result.hazards[0]!.coastalWaters).toBe(true);

      // Third hazard uses BLW altitude format
      const h3 = result.hazards[2]!;
      assert(h3.altitudeRange);
      expect(h3.altitudeRange!.topFt).toBe(12000);
      expect(h3.conditions?.status).toBe('ENDING');
    });
  });

  describe('Real-world Tango WA1T', () => {
    it('parses mixed TURB, STG SFC WNDS, and LLWS POTENTIAL', () => {
      const result = parseAirmet(REAL_TANGO_WA1T);
      expect(result.series).toBe('TANGO');

      const turbHazards = result.hazards.filter((h) => h.hazardType === 'TURB');
      const sfcWindHazards = result.hazards.filter((h) => h.hazardType === 'STG_SFC_WND');
      const llwsHazards = result.hazards.filter((h) => h.hazardType === 'LLWS');

      expect(turbHazards.length).toBe(2);
      expect(sfcWindHazards.length).toBe(1);
      expect(llwsHazards.length).toBe(1);

      // STG SFC WNDS with coastal waters and full-word condition description
      expect(sfcWindHazards[0]!.coastalWaters).toBe(true);
      assert(
        sfcWindHazards[0]!.conditionDescription?.includes('SUSTAINED SURFACE WINDS GTR THAN 30KT'),
      );

      // LLWS POTENTIAL uses BOUNDED BY
      assert(llwsHazards[0]!.boundedBy.length > 0);
      expect(llwsHazards[0]!.areaPoints.length).toBe(0);
    });
  });

  describe('Real-world Tango WA3T', () => {
    it('parses bulletin with multiple STG SFC WNDS and LLWS areas', () => {
      const result = parseAirmet(REAL_TANGO_WA3T);

      const sfcWindHazards = result.hazards.filter((h) => h.hazardType === 'STG_SFC_WND');
      const llwsHazards = result.hazards.filter((h) => h.hazardType === 'LLWS');

      expect(sfcWindHazards.length).toBe(3);
      expect(llwsHazards.length).toBe(2);

      // All three SFC WND hazards use SUSTAINED SURFACE WINDS (full words)
      for (const h of sfcWindHazards) {
        assert(h.conditionDescription?.includes('SUSTAINED SURFACE WINDS GTR THAN 30KT'));
      }

      // Third SFC WND hazard: CONDS ENDG BY 21Z
      expect(sfcWindHazards[2]!.conditions?.status).toBe('ENDING');
    });
  });

  describe('Real-world Zulu WA1Z', () => {
    it('parses icing with outlook areas and freezing level', () => {
      const result = parseAirmet(REAL_ZULU_WA1Z);
      expect(result.series).toBe('ZULU');
      expect(result.updateNumber).toBe(2);
      expect(result.issuingOffice).toBe('BOSZ');

      // Should have 2 ICE hazards
      const iceHazards = result.hazards.filter((h) => h.hazardType === 'ICE');
      expect(iceHazards.length).toBe(2);

      // First ICE hazard: ME NH VT NY LO
      expect(iceHazards[0]!.states).toEqual(['ME', 'NH', 'VT', 'NY', 'LO']);
      expect(iceHazards[0]!.coastalWaters).toBe(false);
      expect(iceHazards[0]!.altitudeRange).toEqual({ baseFt: 2000, topFt: 10000 });
      expect(iceHazards[0]!.conditions?.status).toBe('CONTINUING');
      expect(iceHazards[0]!.conditions?.startTime).toEqual({ hour: 21, minute: 0 });
      expect(iceHazards[0]!.conditions?.endTime).toEqual({ hour: 3, minute: 0 });

      // Second ICE hazard has coastal waters
      expect(iceHazards[1]!.coastalWaters).toBe(true);
      expect(iceHazards[1]!.conditions?.status).toBe('ENDING');
      expect(iceHazards[1]!.conditions?.startTime).toEqual({ hour: 18, minute: 0 });
      expect(iceHazards[1]!.conditions?.endTime).toEqual({ hour: 21, minute: 0 });
    });

    it('parses outlook areas with full detail', () => {
      const result = parseAirmet(REAL_ZULU_WA1Z);
      expect(result.outlooks.length).toBe(2);

      // AREA 1: ICE OH LE
      const area1 = result.outlooks[0]!;
      expect(area1.areaNumber).toBe(1);
      expect(area1.hazardType).toBe('ICE');
      expect(area1.validFrom).toEqual({ hour: 21, minute: 0 });
      expect(area1.validTo).toEqual({ hour: 3, minute: 0 });
      expect(area1.states).toEqual(['OH', 'LE']);
      assert(area1.boundedBy.length > 0);
      expect(area1.boundedBy[0]).toBe('40S ECK');
      assert(area1.conditionDescription?.includes('MOD ICE BTN 040 AND 170'));
      expect(area1.altitudeRange).toEqual({ baseFt: 4000, topFt: 17000 });

      // AREA 2: ICE VT NY LO PA OH LE
      const area2 = result.outlooks[1]!;
      expect(area2.areaNumber).toBe(2);
      expect(area2.hazardType).toBe('ICE');
      expect(area2.states).toEqual(['VT', 'NY', 'LO', 'PA', 'OH', 'LE']);
      assert(area2.conditionDescription?.includes('MOD ICE BTN 030 AND 160'));
      expect(area2.altitudeRange).toEqual({ baseFt: 3000, topFt: 16000 });
    });

    it('parses freezing level with SFC ALG and altitude ALG contours', () => {
      const result = parseAirmet(REAL_ZULU_WA1Z);
      const frzlvl = result.freezingLevel!;

      expect(frzlvl.range).toBe('SFC-045 ACRS AREA');
      expect(frzlvl.rangeLowFt).toBe(undefined);
      expect(frzlvl.rangeHighFt).toBe(4500);

      // Should have SFC ALG and altitude ALG contours
      assert(frzlvl.contours.length >= 2);

      // SFC ALG contour
      const sfcContour = frzlvl.contours.find((c) => c.altitudeFt === undefined);
      assert(sfcContour);
      assert(sfcContour!.location.includes('ALG'));

      // 040 ALG contour
      const altContour = frzlvl.contours.find((c) => c.altitudeFt === 4000);
      assert(altContour);
      assert(altContour!.location.includes('ALG'));
    });
  });

  describe('Real-world Sierra WA2S', () => {
    it('parses IFR with coastal waters and MTN OBSCN', () => {
      const result = parseAirmet(REAL_SIERRA_WA2S);
      expect(result.series).toBe('SIERRA');
      expect(result.updateNumber).toBe(2);
      expect(result.issuingOffice).toBe('MIAS');

      expect(result.hazards.length).toBe(2);

      // IFR hazard with coastal waters and TO-separated area points
      const ifr = result.hazards[0]!;
      expect(ifr.hazardType).toBe('IFR');
      expect(ifr.states).toEqual(['NC', 'SC', 'GA', 'FL']);
      expect(ifr.coastalWaters).toBe(true);
      assert(ifr.areaPoints.length > 0);
      expect(ifr.areaPoints[0]).toBe('30E BKW');
      assert(ifr.conditionDescription?.includes('CIG BLW 010'));
      expect(ifr.conditions?.status).toBe('CONTINUING');

      // MTN OBSCN hazard
      const mtn = result.hazards[1]!;
      expect(mtn.hazardType).toBe('MTN_OBSCN');
      expect(mtn.states).toEqual(['NC', 'SC', 'GA', 'WV', 'VA']);
      expect(mtn.coastalWaters).toBe(false);
      assert(mtn.conditionDescription?.includes('OBSC'));
    });
  });

  describe('Real-world Sierra WA4S', () => {
    it('parses IFR and MTN OBSCN with CONTG BYD...ENDG BY conditions', () => {
      const result = parseAirmet(REAL_SIERRA_WA4S);
      expect(result.series).toBe('SIERRA');
      expect(result.issuingOffice).toBe('DFWS');

      expect(result.hazards.length).toBe(2);

      // IFR hazard with many states and coastal waters
      const ifr = result.hazards[0]!;
      expect(ifr.hazardType).toBe('IFR');
      expect(ifr.states).toEqual(['OK', 'TX', 'AR', 'TN', 'LA', 'MS', 'AL', 'KY']);
      expect(ifr.coastalWaters).toBe(true);

      // MTN OBSCN with CONTG BYD 21Z ENDG BY 00Z
      const mtn = result.hazards[1]!;
      expect(mtn.hazardType).toBe('MTN_OBSCN');
      expect(mtn.states).toEqual(['TN', 'KY']);
      expect(mtn.conditions?.status).toBe('CONTINUING');
      expect(mtn.conditions?.startTime).toEqual({ hour: 21, minute: 0 });
      expect(mtn.conditions?.endTime).toEqual({ hour: 0, minute: 0 });
    });
  });

  describe('Real-world Sierra WA6S', () => {
    it('parses IFR and MTN OBSCN for western states', () => {
      const result = parseAirmet(REAL_SIERRA_WA6S);
      expect(result.series).toBe('SIERRA');
      expect(result.issuingOffice).toBe('SFOS');

      expect(result.hazards.length).toBe(2);

      // IFR with coastal waters
      const ifr = result.hazards[0]!;
      expect(ifr.hazardType).toBe('IFR');
      expect(ifr.states).toEqual(['CA', 'NV', 'AZ']);
      expect(ifr.coastalWaters).toBe(true);
      expect(ifr.conditions?.status).toBe('CONTINUING');

      // MTN OBSCN without coastal waters
      const mtn = result.hazards[1]!;
      expect(mtn.hazardType).toBe('MTN_OBSCN');
      expect(mtn.states).toEqual(['CA', 'NV', 'UT', 'AZ']);
      expect(mtn.coastalWaters).toBe(false);
      assert(mtn.conditionDescription?.includes('CLDS/PCPN/BR'));
    });
  });

  describe('Real-world Zulu WA2Z', () => {
    it('parses multiple ICE hazards with FRZLVL base altitude', () => {
      const result = parseAirmet(REAL_ZULU_WA2Z);
      expect(result.series).toBe('ZULU');
      expect(result.issuingOffice).toBe('MIAZ');

      const iceHazards = result.hazards.filter((h) => h.hazardType === 'ICE');
      expect(iceHazards.length).toBe(3);

      // All three have coastal waters
      for (const h of iceHazards) {
        expect(h.coastalWaters).toBe(true);
      }

      // First ICE: NC SC GA FL, BTN FRZLVL AND FL240, CONTG BYD 21Z THRU 03Z
      expect(iceHazards[0]!.states).toEqual(['NC', 'SC', 'GA', 'FL']);
      assert(iceHazards[0]!.altitudeRange);
      expect(iceHazards[0]!.altitudeRange!.baseFt).toBe(undefined);
      expect(iceHazards[0]!.altitudeRange!.baseIsFreezingLevel).toBe(true);
      expect(iceHazards[0]!.altitudeRange!.topFt).toBe(24000);
      expect(iceHazards[0]!.conditions?.status).toBe('CONTINUING');

      // Second ICE: BTN FRZLVL AND FL190, ENDG 18-21Z
      assert(iceHazards[1]!.altitudeRange);
      expect(iceHazards[1]!.altitudeRange!.baseIsFreezingLevel).toBe(true);
      expect(iceHazards[1]!.altitudeRange!.topFt).toBe(19000);
      expect(iceHazards[1]!.conditions?.status).toBe('ENDING');
      expect(iceHazards[1]!.conditions?.startTime).toEqual({ hour: 18, minute: 0 });
      expect(iceHazards[1]!.conditions?.endTime).toEqual({ hour: 21, minute: 0 });

      // Third ICE: NC SC GA, BTN FRZLVL AND FL240, CONTG
      expect(iceHazards[2]!.states).toEqual(['NC', 'SC', 'GA']);
      expect(iceHazards[2]!.altitudeRange!.baseIsFreezingLevel).toBe(true);
      expect(iceHazards[2]!.altitudeRange!.topFt).toBe(24000);
    });

    it('parses freezing level with altitude ALG contours', () => {
      const result = parseAirmet(REAL_ZULU_WA2Z);
      const frzlvl = result.freezingLevel!;
      assert(frzlvl);

      expect(frzlvl.range).toBe('035-150 ACRS AREA');
      expect(frzlvl.rangeLowFt).toBe(3500);
      expect(frzlvl.rangeHighFt).toBe(15000);

      // Should have altitude ALG contours (040, 080, 120)
      assert(frzlvl.contours.length >= 3);
      const alt040 = frzlvl.contours.find((c) => c.altitudeFt === 4000);
      assert(alt040);
      const alt080 = frzlvl.contours.find((c) => c.altitudeFt === 8000);
      assert(alt080);
      const alt120 = frzlvl.contours.find((c) => c.altitudeFt === 12000);
      assert(alt120);
    });
  });

  describe('Real-world Zulu WA5Z', () => {
    it('parses icing with MULT FRZLVL boundaries and SFC ALG', () => {
      const result = parseAirmet(REAL_ZULU_WA5Z);
      expect(result.series).toBe('ZULU');
      expect(result.issuingOffice).toBe('SLCZ');

      // Single ICE hazard with coastal waters
      expect(result.hazards.length).toBe(1);
      const ice = result.hazards[0]!;
      expect(ice.hazardType).toBe('ICE');
      expect(ice.states).toEqual(['NV', 'UT', 'AZ', 'CA']);
      expect(ice.coastalWaters).toBe(true);
      expect(ice.altitudeRange).toEqual({ baseFt: 5000, topFt: 16000 });
      expect(ice.conditions?.status).toBe('CONTINUING');
    });

    it('parses RANGING FROM SFC-110 freezing level', () => {
      const result = parseAirmet(REAL_ZULU_WA5Z);
      const frzlvl = result.freezingLevel!;
      assert(frzlvl);

      expect(frzlvl.range).toBe('SFC-110 ACRS AREA');
      expect(frzlvl.rangeLowFt).toBe(undefined);
      expect(frzlvl.rangeHighFt).toBe(11000);
    });

    it('parses MULT FRZLVL boundaries', () => {
      const result = parseAirmet(REAL_ZULU_WA5Z);
      const frzlvl = result.freezingLevel!;

      assert(frzlvl.multiFrzlvl.length >= 2);

      // MULT FRZLVL BLW 090
      const mult090 = frzlvl.multiFrzlvl.find((m) => m.belowFt === 9000);
      assert(mult090);
      assert(mult090!.boundedBy.length > 0);

      // MULT FRZLVL BLW 110
      const mult110 = frzlvl.multiFrzlvl.find((m) => m.belowFt === 11000);
      assert(mult110);
      assert(mult110!.boundedBy.length > 0);
    });

    it('parses SFC ALG contour', () => {
      const result = parseAirmet(REAL_ZULU_WA5Z);
      const frzlvl = result.freezingLevel!;

      const sfcContour = frzlvl.contours.find(
        (c) => c.altitudeFt === undefined && c.location.includes('ALG'),
      );
      assert(sfcContour);
    });
  });

  describe('conditions status parsing', () => {
    it('parses DVLPG AFT time', () => {
      const result = parseAirmet(REAL_TANGO_WA1T);
      // First TURB hazard has DVLPG AFT 18Z
      const h = result.hazards[0]!;
      expect(h.conditions?.status).toBe('DEVELOPING');
      expect(h.conditions?.isAfter).toBe(true);
      expect(h.conditions?.startTime).toEqual({ hour: 18, minute: 0 });
    });

    it('parses CONTG BYD with THRU', () => {
      const result = parseAirmet(REAL_SIERRA_WA1S);
      // MTN OBSCN hazard has CONTG BYD 21Z THRU 03Z
      const mtnHazard = result.hazards.find((h) => h.hazardType === 'MTN_OBSCN');
      assert(mtnHazard);
      expect(mtnHazard!.conditions?.status).toBe('CONTINUING');
      expect(mtnHazard!.conditions?.startTime).toEqual({ hour: 21, minute: 0 });
      expect(mtnHazard!.conditions?.endTime).toEqual({ hour: 3, minute: 0 });
    });

    it('parses ENDG range', () => {
      const result = parseAirmet(TANGO_LLWS);
      const h = result.hazards[0]!;
      expect(h.conditions?.status).toBe('ENDING');
      expect(h.conditions?.startTime).toEqual({ hour: 2, minute: 0 });
      expect(h.conditions?.endTime).toEqual({ hour: 4, minute: 0 });
    });

    it('parses ENDG BY without range', () => {
      // WA3T third SFC WND hazard has CONDS ENDG BY 21Z
      const result = parseAirmet(REAL_TANGO_WA3T);
      const sfcWindHazards = result.hazards.filter((h) => h.hazardType === 'STG_SFC_WND');
      const h = sfcWindHazards[2]!;
      expect(h.conditions?.status).toBe('ENDING');
      expect(h.conditions?.startTime).toBe(undefined);
      expect(h.conditions?.endTime).toEqual({ hour: 21, minute: 0 });
    });

    it('parses CONTG BYD...ENDG BY as CONTINUING with end time', () => {
      // WA3T first SFC WND hazard: CONDS CONTG BYD 21Z ENDG BY 03Z
      const result = parseAirmet(REAL_TANGO_WA3T);
      const sfcWindHazards = result.hazards.filter((h) => h.hazardType === 'STG_SFC_WND');
      const h = sfcWindHazards[0]!;
      expect(h.conditions?.status).toBe('CONTINUING');
      expect(h.conditions?.startTime).toEqual({ hour: 21, minute: 0 });
      expect(h.conditions?.endTime).toEqual({ hour: 3, minute: 0 });
    });

    it('parses CONTG BYD...ENDG with range as CONTINUING with end time', () => {
      // WA3T second SFC WND hazard: CONDS CONTG BYD 21Z ENDG 00-03Z
      const result = parseAirmet(REAL_TANGO_WA3T);
      const sfcWindHazards = result.hazards.filter((h) => h.hazardType === 'STG_SFC_WND');
      const h = sfcWindHazards[1]!;
      expect(h.conditions?.status).toBe('CONTINUING');
      expect(h.conditions?.startTime).toEqual({ hour: 21, minute: 0 });
      expect(h.conditions?.endTime).toEqual({ hour: 3, minute: 0 });
    });

    it('parses DVLPG range', () => {
      // WA1S first IFR hazard: CONDS DVLPG 18-21Z
      const result = parseAirmet(REAL_SIERRA_WA1S);
      const ifrHazards = result.hazards.filter((h) => h.hazardType === 'IFR');
      const h = ifrHazards[0]!;
      expect(h.conditions?.status).toBe('DEVELOPING');
      expect(h.conditions?.startTime).toEqual({ hour: 18, minute: 0 });
      expect(h.conditions?.endTime).toEqual({ hour: 21, minute: 0 });
      expect(h.conditions?.isAfter).toBe(undefined);
    });

    it('parses DVLPG AFT with supplemental CONTG THRU', () => {
      // WA1Z outlook AREA 1: CONDS DVLPG AFT 00Z. CONDS CONTG THRU 03Z.
      // DVLPG is primary status; CONTG THRU provides the endTime
      const result = parseAirmet(REAL_ZULU_WA1Z);
      const area1 = result.outlooks[0]!;
      expect(area1.conditions?.status).toBe('DEVELOPING');
      expect(area1.conditions?.isAfter).toBe(true);
      expect(area1.conditions?.startTime).toEqual({ hour: 0, minute: 0 });
      expect(area1.conditions?.endTime).toEqual({ hour: 3, minute: 0 });
    });

    it('parses standalone CONTG THRU (no BYD, no DVLPG)', () => {
      const raw = `AIRMET TANGO FOR TURB AND SFC WND AND LLWS
VALID UNTIL 050400Z
AIRMET TURB...MT WY CO NM
FROM 40NW BIL-30E SHR-20S PUB-40W ABQ-40NW BIL
MOD TURB BTN FL250 AND FL380. CONDS CONTG THRU 06Z.`;
      const result = parseAirmet(raw);
      const h = result.hazards[0]!;
      expect(h.conditions?.status).toBe('CONTINUING');
      expect(h.conditions?.startTime).toBe(undefined);
      expect(h.conditions?.endTime).toEqual({ hour: 6, minute: 0 });
    });
  });

  describe('unrecognized hazard sections', () => {
    it('skips sections with unrecognized hazard types', () => {
      const bogus = `AIRMET SIERRA FOR IFR AND MTN OBSCN
VALID UNTIL 050400Z
AIRMET BOGUS...NY PA
FROM 30SW ALB-20NW BDR-40E ACK-20NE BOS-30SW ALB
CIG BLW 010/VIS BLW 3SM BR. CONDS CONTG BYD 0400Z.`;
      const result = parseAirmet(bogus);
      expect(result.hazards.length).toBe(0);
    });
  });

  describe('outlook hazard variants', () => {
    it('parses an outlook AREA with IFR conditions', () => {
      // Exercises the IFR branch in parseOutlookConditionDescription.
      const raw = `AIRMET SIERRA FOR IFR AND MTN OBSCN
VALID UNTIL 050400Z
AIRMET IFR...NY PA
FROM 30SW ALB-20NW BDR-40E ACK-20NE BOS-30SW ALB
CIG BLW 010/VIS BLW 3SM BR.
.
OTLK VALID 0400-1000Z
AREA 1...IFR NY PA BOUNDED BY 30SW ALB-20NW BDR-40E ACK-30SW ALB
CIG BLW 010/VIS BLW 3SM BR.`;
      const result = parseAirmet(raw);
      const ifrOutlook = result.outlooks.find((o) => o.hazardType === 'IFR');
      expect(ifrOutlook).toBeDefined();
    });

    it('parses an outlook AREA with MTN OBSCN conditions', () => {
      const raw = `AIRMET SIERRA FOR IFR AND MTN OBSCN
VALID UNTIL 050400Z
AIRMET MTN OBSCN...CO UT
FROM 30NW DEN-40SE DEN-50SW DEN-30NW DEN
MTNS OBSCD BY CLDS/PCPN.
.
OTLK VALID 0400-1000Z
AREA 1...MTN OBSCN CO UT BOUNDED BY 30NW DEN-40SE DEN-50SW DEN-30NW DEN
MTNS OBSCD BY CLDS/PCPN.`;
      const result = parseAirmet(raw);
      const mtnOutlook = result.outlooks.find((o) => o.hazardType === 'MTN_OBSCN');
      expect(mtnOutlook).toBeDefined();
    });

    it('parses an outlook AREA with strong surface winds', () => {
      const raw = `AIRMET TANGO FOR TURB AND SFC WND AND LLWS
VALID UNTIL 050400Z
AIRMET STG SFC WNDS...WY MT
FROM 30NW BIL-40SE BIL-50W SHR-30NW BIL
SUSTAINED SURFACE WINDS GTR THAN 30KT EXP.
.
OTLK VALID 0400-1000Z
AREA 1...STG SFC WNDS WY MT BOUNDED BY 30NW BIL-40SE BIL-50W SHR-30NW BIL
SUSTAINED SURFACE WINDS GTR THAN 30KT EXP.`;
      const result = parseAirmet(raw);
      const wndOutlook = result.outlooks.find((o) => o.hazardType === 'STG_SFC_WND');
      expect(wndOutlook).toBeDefined();
    });

    it('parses an outlook AREA with LLWS conditions', () => {
      const raw = `AIRMET TANGO FOR TURB AND SFC WND AND LLWS
VALID UNTIL 050400Z
AIRMET LLWS...TX OK
FROM 30NW DFW-40SE DFW-50SW DFW-30NW DFW
LLWS DUE TO JTSTR.
.
OTLK VALID 0400-1000Z
AREA 1...LLWS TX OK BOUNDED BY 30NW DFW-40SE DFW-50SW DFW-30NW DFW
LLWS DUE TO JTSTR.`;
      const result = parseAirmet(raw);
      const llwsOutlook = result.outlooks.find((o) => o.hazardType === 'LLWS');
      expect(llwsOutlook).toBeDefined();
    });

    it('parses a TURB hazard block whose body uses a BLW-only altitude (no BTN)', () => {
      // Exercises the BLW-fallback branch in parseHazardBlock when the
      // standard BTN ... AND ... pattern doesn't match.
      const raw = `AIRMET TANGO FOR TURB AND SFC WND AND LLWS
VALID UNTIL 050400Z
AIRMET TURB...WY MT
FROM 30NW BIL-40SE BIL-50W SHR-30NW BIL
MOD TURB BLW FL120.`;
      const result = parseAirmet(raw);
      const turb = result.hazards.find((h) => h.hazardType === 'TURB');
      expect(turb?.altitudeRange).toBeDefined();
    });

    it('parses an IFR hazard block with non-standard condition text (no CIG/VIS pattern)', () => {
      // Exercises the IFR conditionDescription "no match" branch.
      const raw = `AIRMET SIERRA FOR IFR AND MTN OBSCN
VALID UNTIL 050400Z
AIRMET IFR...NY PA
FROM 30SW ALB-20NW BDR-40E ACK-20NE BOS-30SW ALB
CONDITIONS POSSIBLE.`;
      const result = parseAirmet(raw);
      const ifr = result.hazards.find((h) => h.hazardType === 'IFR');
      expect(ifr?.conditionDescription).toBeUndefined();
    });

    it('parses a TURB hazard block with non-standard condition text', () => {
      const raw = `AIRMET TANGO FOR TURB AND SFC WND AND LLWS
VALID UNTIL 050400Z
AIRMET TURB...WY MT
FROM 30NW BIL-40SE BIL-50W SHR-30NW BIL
TURBULENCE POSSIBLE.`;
      const result = parseAirmet(raw);
      const turb = result.hazards.find((h) => h.hazardType === 'TURB');
      expect(turb?.conditionDescription).toBeUndefined();
    });

    it('parses a STG SFC WND hazard block with non-standard condition text', () => {
      const raw = `AIRMET TANGO FOR TURB AND SFC WND AND LLWS
VALID UNTIL 050400Z
AIRMET STG SFC WNDS...WY MT
FROM 30NW BIL-40SE BIL-50W SHR-30NW BIL
STRONG WINDS POSSIBLE.`;
      const result = parseAirmet(raw);
      const wnd = result.hazards.find((h) => h.hazardType === 'STG_SFC_WND');
      expect(wnd?.conditionDescription).toBeUndefined();
    });

    it('parses a LLWS hazard block with non-standard condition text', () => {
      const raw = `AIRMET TANGO FOR TURB AND SFC WND AND LLWS
VALID UNTIL 050400Z
AIRMET LLWS...TX OK
FROM 30NW DFW-40SE DFW-50SW DFW-30NW DFW
LOW LEVEL WIND SHEAR POSSIBLE.`;
      const result = parseAirmet(raw);
      const llws = result.hazards.find((h) => h.hazardType === 'LLWS');
      expect(llws?.conditionDescription).toBeUndefined();
    });

    it('parses an ICE hazard block with non-standard condition text', () => {
      const raw = `AIRMET ZULU FOR ICE AND FRZLVL
VALID UNTIL 050400Z
AIRMET ICE...WA OR
FROM 30NW SEA-40SE SEA-50W EUG-30NW SEA
ICING POSSIBLE.`;
      const result = parseAirmet(raw);
      const ice = result.hazards.find((h) => h.hazardType === 'ICE');
      expect(ice?.conditionDescription).toBeUndefined();
    });

    it('parses a Zulu AIRMET with FRZLVL using lat-line format (SFC-020 N OF 40N LINE)', () => {
      // Exercises the latLineMatch branch in parseFreezingLevel.
      const raw = `AIRMET ZULU FOR ICE AND FRZLVL
VALID UNTIL 050400Z
AIRMET ICE...WA OR
FROM 30NW SEA-40SE SEA-50W EUG-30NW SEA
MOD ICE BTN FRZLVL AND FL180.
.
FRZLVL...SFC-020 N OF 40N LINE. 040-080 S OF 40N LINE.`;
      const result = parseAirmet(raw);
      expect(result.freezingLevel).toBeDefined();
      expect(result.freezingLevel?.contours.length).toBeGreaterThan(0);
    });

    it('parses an outlook AREA with MTN_OBSCN where the condition text does not match', () => {
      const raw = `AIRMET SIERRA FOR IFR AND MTN OBSCN
VALID UNTIL 050400Z
AIRMET MTN OBSCN...CO UT
FROM 30NW DEN-40SE DEN-50SW DEN-30NW DEN
MTNS OBSCD BY CLDS/PCPN.
.
OTLK VALID 0400-1000Z
AREA 1...MTN OBSCN CO UT BOUNDED BY 30NW DEN-40SE DEN-50SW DEN-30NW DEN
LOW LEVEL WIND SHEAR EXPECTED.`;
      const result = parseAirmet(raw);
      const mtnOutlook = result.outlooks.find((o) => o.hazardType === 'MTN_OBSCN');
      expect(mtnOutlook?.conditionDescription).toBeUndefined();
    });

    it('parses an outlook AREA with TURB where the condition text does not match', () => {
      const raw = `AIRMET ZULU FOR ICE AND FRZLVL
VALID UNTIL 050400Z
AIRMET ICE...WA OR
FROM 30NW SEA-40SE SEA-50W EUG-30NW SEA
MOD ICE BTN FRZLVL AND FL180.
.
OTLK VALID 0400-1000Z
AREA 1...TURB WA OR BOUNDED BY 30NW SEA-40SE SEA-50W EUG-30NW SEA
SUSTAINED SURFACE WINDS GTR THAN 30KT EXP.`;
      const result = parseAirmet(raw);
      const turbOutlook = result.outlooks.find((o) => o.hazardType === 'TURB');
      expect(turbOutlook?.conditionDescription).toBeUndefined();
    });

    it('parses an outlook AREA with STG SFC WND where the condition text does not match', () => {
      const raw = `AIRMET TANGO FOR TURB AND SFC WND AND LLWS
VALID UNTIL 050400Z
AIRMET STG SFC WNDS...WY MT
FROM 30NW BIL-40SE BIL-50W SHR-30NW BIL
SUSTAINED SURFACE WINDS GTR THAN 30KT EXP.
.
OTLK VALID 0400-1000Z
AREA 1...STG SFC WNDS WY MT BOUNDED BY 30NW BIL-40SE BIL-50W SHR-30NW BIL
MOD TURB BTN FL250 AND FL380.`;
      const result = parseAirmet(raw);
      const wndOutlook = result.outlooks.find((o) => o.hazardType === 'STG_SFC_WND');
      expect(wndOutlook?.conditionDescription).toBeUndefined();
    });

    it('parses an outlook AREA with LLWS where the condition text does not match', () => {
      const raw = `AIRMET TANGO FOR TURB AND SFC WND AND LLWS
VALID UNTIL 050400Z
AIRMET LLWS...TX OK
FROM 30NW DFW-40SE DFW-50SW DFW-30NW DFW
LLWS DUE TO JTSTR.
.
OTLK VALID 0400-1000Z
AREA 1...LLWS TX OK BOUNDED BY 30NW DFW-40SE DFW-50SW DFW-30NW DFW
SUSTAINED SURFACE WINDS GTR THAN 30KT EXP.`;
      const result = parseAirmet(raw);
      const llwsOutlook = result.outlooks.find((o) => o.hazardType === 'LLWS');
      expect(llwsOutlook?.conditionDescription).toBeUndefined();
    });

    it('parses an outlook AREA where the condition text does not match the hazard regex', () => {
      // Exercises the false branch of parseOutlookConditionDescription
      // (no regex match → returns undefined) AND the false branches of the
      // conditionDescription / altitudeRange spreads in parseAreaBlocks.
      const raw = `AIRMET ZULU FOR ICE AND FRZLVL
VALID UNTIL 050400Z
AIRMET ICE...WA OR
FROM 30NW SEA-40SE SEA-50W EUG-30NW SEA
MOD ICE BTN FRZLVL AND FL180.
.
OTLK VALID 0400-1000Z
AREA 1...IFR WA OR BOUNDED BY 30NW SEA-40SE SEA-50W EUG-30NW SEA
SUSTAINED SURFACE WINDS GTR THAN 30KT EXP.`;
      const result = parseAirmet(raw);
      const ifrOutlook = result.outlooks.find((o) => o.hazardType === 'IFR');
      expect(ifrOutlook).toBeDefined();
      // The condition description regex for IFR requires the CIG/VIS pattern;
      // the AREA's actual text describes wind, so no description matches.
      expect(ifrOutlook?.conditionDescription).toBeUndefined();
    });

    it('parses an outlook AREA with TURB conditions distinct from the ICE outlook variant', () => {
      const raw = `AIRMET ZULU FOR ICE AND FRZLVL
VALID UNTIL 050400Z
AIRMET ICE...WA OR
FROM 30NW SEA-40SE SEA-50W EUG-30NW SEA
MOD ICE BTN FRZLVL AND FL180.
.
OTLK VALID 0400-1000Z
AREA 1...TURB WA OR BOUNDED BY 30NW SEA-40SE SEA-50W EUG-30NW SEA
MOD TURB BTN FL250 AND FL380.`;
      const result = parseAirmet(raw);
      const turbOutlook = result.outlooks.find((o) => o.hazardType === 'TURB');
      expect(turbOutlook).toBeDefined();
    });
  });

  // Regression for CodeQL js/polynomial-redos on the section splitter.
  // The previous regex /\n\s*\.\s*\n|\n\s*\.\s*$/ allowed two ambiguous \s*
  // quantifiers to overlap on newline runs, producing O(n^2) backtracking.
  // With the original pattern, 80k newlines took ~23 seconds; the linear
  // replacement completes in well under a millisecond. The 100ms threshold
  // leaves ~50x headroom over slow CI noise and still fails the original
  // regex by ~230x.
  describe('section-splitter ReDoS regression', () => {
    it('parses pathological newline-heavy input in well under 100ms', () => {
      const raw = `AIRMET SIERRA FOR IFR\nVALID UNTIL 050400Z\n${'\n'.repeat(80_000)}`;
      const start = performance.now();
      try {
        parseAirmet(raw);
      } catch {
        // Header-only input is allowed to throw; we only care about runtime.
      }
      const elapsedMs = performance.now() - start;
      expect(elapsedMs).toBeLessThan(100);
    });
  });
});
