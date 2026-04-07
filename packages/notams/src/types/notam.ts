import type { Coordinates } from '@squawk/types';

/**
 * NOTAM action type indicating whether this NOTAM creates, replaces,
 * or cancels a notice.
 *
 * - `NEW` - A new NOTAM (NOTAMN)
 * - `REPLACE` - Replaces a previously issued NOTAM (NOTAMR)
 * - `CANCEL` - Cancels a previously issued NOTAM (NOTAMC)
 */
export type NotamAction = 'NEW' | 'REPLACE' | 'CANCEL';

/**
 * Maps NOTAM action codes to human-readable descriptions.
 */
export const NOTAM_ACTION_MAP: Record<NotamAction, string> = {
  NEW: 'New',
  REPLACE: 'Replacement',
  CANCEL: 'Cancellation',
};

/**
 * Traffic type qualifier from the NOTAM Q-line indicating which
 * flight rules the NOTAM applies to.
 *
 * - `IFR` - Applies to IFR traffic only
 * - `VFR` - Applies to VFR traffic only
 * - `IFR_VFR` - Applies to both IFR and VFR traffic
 * - `CHECKLIST` - Checklist NOTAM
 */
export type NotamTrafficType = 'IFR' | 'VFR' | 'IFR_VFR' | 'CHECKLIST';

/**
 * Maps NOTAM traffic type codes to human-readable descriptions.
 */
export const NOTAM_TRAFFIC_TYPE_MAP: Record<NotamTrafficType, string> = {
  IFR: 'IFR',
  VFR: 'VFR',
  IFR_VFR: 'IFR and VFR',
  CHECKLIST: 'Checklist',
};

/**
 * Scope qualifier from the NOTAM Q-line indicating the geographic
 * scope of the notice.
 *
 * - `AERODROME` - Applies to a specific aerodrome (A)
 * - `ENROUTE` - Applies to en route airspace or FIR-level (E)
 * - `NAV_WARNING` - Navigation warning (W)
 * - `AERODROME_ENROUTE` - Applies to both aerodrome and en route (AE)
 * - `AERODROME_WARNING` - Applies to both aerodrome and navigation warning (AW)
 * - `ENROUTE_WARNING` - Applies to both en route and navigation warning (EW)
 * - `AERODROME_ENROUTE_WARNING` - Applies to aerodrome, en route, and navigation warning (AEW)
 */
export type NotamScope =
  | 'AERODROME'
  | 'ENROUTE'
  | 'NAV_WARNING'
  | 'AERODROME_ENROUTE'
  | 'AERODROME_WARNING'
  | 'ENROUTE_WARNING'
  | 'AERODROME_ENROUTE_WARNING';

/**
 * Maps NOTAM scope codes to human-readable descriptions.
 */
export const NOTAM_SCOPE_MAP: Record<NotamScope, string> = {
  AERODROME: 'Aerodrome',
  ENROUTE: 'En Route',
  NAV_WARNING: 'Navigation Warning',
  AERODROME_ENROUTE: 'Aerodrome and En Route',
  AERODROME_WARNING: 'Aerodrome and Navigation Warning',
  ENROUTE_WARNING: 'En Route and Navigation Warning',
  AERODROME_ENROUTE_WARNING: 'Aerodrome, En Route, and Navigation Warning',
};

/**
 * ICAO NOTAM subject code from the Q-code (2nd and 3rd letters).
 * Identifies what the NOTAM is about. Defined in ICAO Doc 8400.
 *
 * Codes are grouped by category prefix:
 * - `L` - Lighting facilities
 * - `M` - Movement and landing area
 * - `F` - Facilities and services
 * - `A` - Airspace organization
 * - `S` - Air traffic and VOLMET services
 * - `P` - Air traffic procedures
 * - `C` - Communication and surveillance
 * - `I` - Instrument and microwave landing systems
 * - `G` - GNSS services
 * - `N` - Terminal and en-route navigation
 * - `R` - Airspace restrictions
 * - `W` - Navigation warnings
 * - `O` - Other information
 * - `KK` - Checklist NOTAM
 * - `TT` - Trigger NOTAM
 * - `XX` - Plain language (subject not listed)
 */
export type NotamSubjectCode =
  // L - Lighting facilities
  | 'LA'
  | 'LB'
  | 'LC'
  | 'LD'
  | 'LE'
  | 'LF'
  | 'LG'
  | 'LH'
  | 'LI'
  | 'LJ'
  | 'LK'
  | 'LL'
  | 'LM'
  | 'LP'
  | 'LR'
  | 'LS'
  | 'LT'
  | 'LU'
  | 'LV'
  | 'LW'
  | 'LX'
  | 'LY'
  | 'LZ'
  // M - Movement and landing area
  | 'MA'
  | 'MB'
  | 'MC'
  | 'MD'
  | 'MG'
  | 'MH'
  | 'MK'
  | 'MM'
  | 'MN'
  | 'MO'
  | 'MP'
  | 'MR'
  | 'MS'
  | 'MT'
  | 'MU'
  | 'MW'
  | 'MX'
  | 'MY'
  // F - Facilities and services
  | 'FA'
  | 'FB'
  | 'FC'
  | 'FD'
  | 'FE'
  | 'FF'
  | 'FG'
  | 'FH'
  | 'FI'
  | 'FJ'
  | 'FL'
  | 'FM'
  | 'FO'
  | 'FP'
  | 'FS'
  | 'FT'
  | 'FU'
  | 'FW'
  | 'FZ'
  // A - Airspace organization
  | 'AA'
  | 'AC'
  | 'AD'
  | 'AE'
  | 'AF'
  | 'AH'
  | 'AL'
  | 'AN'
  | 'AO'
  | 'AP'
  | 'AR'
  | 'AT'
  | 'AU'
  | 'AV'
  | 'AX'
  | 'AZ'
  // S - Air traffic and VOLMET services
  | 'SA'
  | 'SB'
  | 'SC'
  | 'SE'
  | 'SF'
  | 'SL'
  | 'SO'
  | 'SP'
  | 'SS'
  | 'ST'
  | 'SU'
  | 'SV'
  | 'SY'
  // P - Air traffic procedures
  | 'PA'
  | 'PB'
  | 'PC'
  | 'PD'
  | 'PE'
  | 'PF'
  | 'PH'
  | 'PI'
  | 'PK'
  | 'PL'
  | 'PM'
  | 'PN'
  | 'PO'
  | 'PR'
  | 'PT'
  | 'PU'
  | 'PX'
  | 'PZ'
  // C - Communication and surveillance
  | 'CA'
  | 'CB'
  | 'CC'
  | 'CD'
  | 'CE'
  | 'CG'
  | 'CL'
  | 'CM'
  | 'CP'
  | 'CR'
  | 'CS'
  | 'CT'
  // I - Instrument and microwave landing systems
  | 'IC'
  | 'ID'
  | 'IG'
  | 'II'
  | 'IL'
  | 'IM'
  | 'IN'
  | 'IO'
  | 'IS'
  | 'IT'
  | 'IU'
  | 'IW'
  | 'IX'
  | 'IY'
  // G - GNSS services
  | 'GA'
  | 'GW'
  // N - Terminal and en-route navigation
  | 'NA'
  | 'NB'
  | 'NC'
  | 'ND'
  | 'NF'
  | 'NL'
  | 'NM'
  | 'NN'
  | 'NO'
  | 'NT'
  | 'NV'
  | 'NX'
  // R - Airspace restrictions
  | 'RA'
  | 'RD'
  | 'RM'
  | 'RO'
  | 'RP'
  | 'RR'
  | 'RT'
  // W - Navigation warnings
  | 'WA'
  | 'WB'
  | 'WC'
  | 'WD'
  | 'WE'
  | 'WF'
  | 'WG'
  | 'WH'
  | 'WJ'
  | 'WL'
  | 'WM'
  | 'WP'
  | 'WR'
  | 'WS'
  | 'WT'
  | 'WU'
  | 'WV'
  | 'WW'
  | 'WY'
  | 'WZ'
  // O - Other information
  | 'OA'
  | 'OB'
  | 'OE'
  | 'OL'
  | 'OR'
  // Special codes
  | 'KK'
  | 'TT'
  | 'XX';

/**
 * Maps NOTAM subject codes to human-readable descriptions.
 */
export const NOTAM_SUBJECT_CODE_MAP: Record<NotamSubjectCode, string> = {
  // L - Lighting facilities
  LA: 'Approach lighting system',
  LB: 'Aerodrome beacon',
  LC: 'Runway centre line lights',
  LD: 'Landing direction indicator lights',
  LE: 'Runway edge lights',
  LF: 'Sequenced flashing lights',
  LG: 'Pilot-controlled lighting',
  LH: 'High intensity runway lights',
  LI: 'Runway end identifier lights',
  LJ: 'Runway alignment indicator lights',
  LK: 'Category II components of ALS',
  LL: 'Low intensity runway lights',
  LM: 'Medium intensity runway lights',
  LP: 'Precision approach path indicator',
  LR: 'All landing area lighting',
  LS: 'Stopway lights',
  LT: 'Threshold lights',
  LU: 'Helicopter approach path indicator',
  LV: 'Visual approach slope indicator',
  LW: 'Heliport lighting',
  LX: 'Taxiway centre line lights',
  LY: 'Taxiway edge lights',
  LZ: 'Runway touchdown zone lights',
  // M - Movement and landing area
  MA: 'Movement area',
  MB: 'Bearing strength',
  MC: 'Clearway',
  MD: 'Declared distances',
  MG: 'Taxiing guidance system',
  MH: 'Runway arresting gear',
  MK: 'Parking area',
  MM: 'Daylight markings',
  MN: 'Apron',
  MO: 'Stopbar',
  MP: 'Aircraft stands',
  MR: 'Runway',
  MS: 'Stopway',
  MT: 'Threshold',
  MU: 'Runway turning bay',
  MW: 'Strip/shoulder',
  MX: 'Taxiway',
  MY: 'Rapid exit taxiway',
  // F - Facilities and services
  FA: 'Aerodrome',
  FB: 'Friction measuring device',
  FC: 'Ceiling measurement equipment',
  FD: 'Docking system',
  FE: 'Oxygen',
  FF: 'Firefighting and rescue',
  FG: 'Ground movement control',
  FH: 'Helicopter alighting area',
  FI: 'Aircraft de-icing',
  FJ: 'Oils',
  FL: 'Landing direction indicator',
  FM: 'Meteorological service',
  FO: 'Fog dispersal system',
  FP: 'Heliport',
  FS: 'Snow removal equipment',
  FT: 'Transmissometer',
  FU: 'Fuel availability',
  FW: 'Wind direction indicator',
  FZ: 'Customs/immigration',
  // A - Airspace organization
  AA: 'Minimum altitude',
  AC: 'Control zone',
  AD: 'Air defence identification zone',
  AE: 'Control area',
  AF: 'Flight information region',
  AH: 'Upper control area',
  AL: 'Minimum usable flight level',
  AN: 'Area navigation route',
  AO: 'Oceanic control area',
  AP: 'Reporting point',
  AR: 'ATS route',
  AT: 'Terminal control area',
  AU: 'Upper flight information region',
  AV: 'Upper advisory area',
  AX: 'Significant point',
  AZ: 'Aerodrome traffic zone',
  // S - Air traffic and VOLMET services
  SA: 'ATIS',
  SB: 'ATS reporting office',
  SC: 'Area control centre',
  SE: 'Flight information service',
  SF: 'Aerodrome flight information service',
  SL: 'Flow control centre',
  SO: 'Oceanic area control centre',
  SP: 'Approach control service',
  SS: 'Flight service station',
  ST: 'Aerodrome control tower',
  SU: 'Upper area control centre',
  SV: 'VOLMET broadcast',
  SY: 'Upper advisory service',
  // P - Air traffic procedures
  PA: 'Standard instrument arrival',
  PB: 'Standard VFR arrival',
  PC: 'Contingency procedures',
  PD: 'Standard instrument departure',
  PE: 'Standard VFR departure',
  PF: 'Flow control procedure',
  PH: 'Holding procedure',
  PI: 'Instrument approach procedure',
  PK: 'VFR approach procedure',
  PL: 'Flight plan processing',
  PM: 'Aerodrome operating minima',
  PN: 'Noise operating restrictions',
  PO: 'Obstacle clearance altitude/height',
  PR: 'Radio failure procedure',
  PT: 'Transition altitude/level',
  PU: 'Missed approach procedure',
  PX: 'Minimum holding altitude',
  PZ: 'ADIZ procedure',
  // C - Communication and surveillance
  CA: 'Air/ground facility',
  CB: 'ADS-B',
  CC: 'ADS-C',
  CD: 'CPDLC',
  CE: 'En-route surveillance radar',
  CG: 'Ground controlled approach',
  CL: 'SELCAL',
  CM: 'Surface movement radar',
  CP: 'Precision approach radar',
  CR: 'Surveillance radar element of PAR',
  CS: 'Secondary surveillance radar',
  CT: 'Terminal area surveillance radar',
  // I - Instrument and microwave landing systems
  IC: 'Instrument landing system',
  ID: 'DME associated with ILS',
  IG: 'ILS glide path',
  II: 'ILS inner marker',
  IL: 'ILS localizer',
  IM: 'ILS middle marker',
  IN: 'Localizer (not associated with ILS)',
  IO: 'ILS outer marker',
  IS: 'ILS Category I',
  IT: 'ILS Category II',
  IU: 'ILS Category III',
  IW: 'Microwave landing system',
  IX: 'ILS locator, outer',
  IY: 'ILS locator, middle',
  // G - GNSS services
  GA: 'GNSS airfield-specific operations',
  GW: 'GNSS area-wide operations',
  // N - Terminal and en-route navigation
  NA: 'All radio navigation facilities',
  NB: 'Non-directional radio beacon',
  NC: 'DECCA',
  ND: 'Distance measuring equipment',
  NF: 'Fan marker',
  NL: 'Locator',
  NM: 'VOR/DME',
  NN: 'TACAN',
  NO: 'OMEGA',
  NT: 'VORTAC',
  NV: 'VOR',
  NX: 'Direction-finding station',
  // R - Airspace restrictions
  RA: 'Airspace reservation',
  RD: 'Danger area',
  RM: 'Military operating area',
  RO: 'Overflying restriction',
  RP: 'Prohibited area',
  RR: 'Restricted area',
  RT: 'Temporary restricted area',
  // W - Navigation warnings
  WA: 'Air display',
  WB: 'Aerobatics',
  WC: 'Captive balloon or kite',
  WD: 'Demolition of explosives',
  WE: 'Exercises',
  WF: 'Air refuelling',
  WG: 'Glider flying',
  WH: 'Blasting',
  WJ: 'Banner/target towing',
  WL: 'Ascent of free balloon',
  WM: 'Missile, gun or rocket firing',
  WP: 'Parachute jumping/paragliding',
  WR: 'Radioactive materials/toxic chemicals',
  WS: 'Burning or blowing gas',
  WT: 'Mass movement of aircraft',
  WU: 'Unmanned aircraft',
  WV: 'Formation flight',
  WW: 'Significant volcanic activity',
  WY: 'Aerial survey',
  WZ: 'Model flying',
  // O - Other information
  OA: 'Aeronautical information service',
  OB: 'Obstacle',
  OE: 'Aircraft entry requirements',
  OL: 'Obstacle lights',
  OR: 'Rescue coordination centre',
  // Special codes
  KK: 'Checklist',
  TT: 'Trigger NOTAM',
  XX: 'Other (plain language)',
};

/**
 * ICAO NOTAM condition code from the Q-code (4th and 5th letters).
 * Describes the condition or status being reported. Defined in ICAO Doc 8400.
 *
 * Codes are grouped by category prefix:
 * - `A` - Availability
 * - `C` - Changes
 * - `H` - Hazard conditions
 * - `L` - Limitations
 * - `KK` - Checklist NOTAM
 * - `TT` - Trigger NOTAM
 * - `XX` - Plain language (condition not listed)
 */
export type NotamConditionCode =
  // A - Availability
  | 'AC'
  | 'AD'
  | 'AF'
  | 'AG'
  | 'AH'
  | 'AK'
  | 'AL'
  | 'AM'
  | 'AN'
  | 'AO'
  | 'AP'
  | 'AR'
  | 'AS'
  | 'AU'
  | 'AW'
  | 'AX'
  // C - Changes
  | 'CA'
  | 'CC'
  | 'CD'
  | 'CE'
  | 'CF'
  | 'CG'
  | 'CH'
  | 'CI'
  | 'CL'
  | 'CM'
  | 'CN'
  | 'CO'
  | 'CP'
  | 'CR'
  | 'CS'
  | 'CT'
  // H - Hazard conditions
  | 'HA'
  | 'HB'
  | 'HC'
  | 'HD'
  | 'HE'
  | 'HF'
  | 'HG'
  | 'HH'
  | 'HI'
  | 'HJ'
  | 'HK'
  | 'HL'
  | 'HM'
  | 'HN'
  | 'HO'
  | 'HP'
  | 'HQ'
  | 'HR'
  | 'HS'
  | 'HT'
  | 'HU'
  | 'HV'
  | 'HW'
  | 'HX'
  | 'HY'
  | 'HZ'
  // L - Limitations
  | 'LA'
  | 'LB'
  | 'LC'
  | 'LD'
  | 'LE'
  | 'LF'
  | 'LG'
  | 'LH'
  | 'LI'
  | 'LK'
  | 'LL'
  | 'LN'
  | 'LP'
  | 'LR'
  | 'LS'
  | 'LT'
  | 'LV'
  | 'LW'
  | 'LX'
  // Special codes
  | 'KK'
  | 'TT'
  | 'XX';

/**
 * Maps NOTAM condition codes to human-readable descriptions.
 */
export const NOTAM_CONDITION_CODE_MAP: Record<NotamConditionCode, string> = {
  // A - Availability
  AC: 'Withdrawn for maintenance',
  AD: 'Available for daylight operation',
  AF: 'Flight checked and found reliable',
  AG: 'Operating, ground checked only',
  AH: 'Hours of service changed',
  AK: 'Resumed normal operation',
  AL: 'Operative, subject to prior conditions',
  AM: 'Military operations only',
  AN: 'Available for night operation',
  AO: 'Operational',
  AP: 'Available, prior permission required',
  AR: 'Available on request',
  AS: 'Unserviceable',
  AU: 'Not available',
  AW: 'Completely withdrawn',
  AX: 'Previously promulgated shutdown cancelled',
  // C - Changes
  CA: 'Activated',
  CC: 'Completed',
  CD: 'Deactivated',
  CE: 'Erected',
  CF: 'Operating frequency changed',
  CG: 'Downgraded to',
  CH: 'Changed',
  CI: 'Identification/call sign changed',
  CL: 'Realigned',
  CM: 'Displaced',
  CN: 'Cancelled',
  CO: 'Operating',
  CP: 'Operating on reduced power',
  CR: 'Temporarily replaced by',
  CS: 'Installed',
  CT: 'On test, do not use',
  // H - Hazard conditions
  HA: 'Braking action is',
  HB: 'Friction coefficient is',
  HC: 'Covered by compacted snow',
  HD: 'Covered by dry snow',
  HE: 'Covered by water',
  HF: 'Free of snow and ice',
  HG: 'Grass cutting in progress',
  HH: 'Hazard due to',
  HI: 'Covered by ice',
  HJ: 'Balloon launch planned',
  HK: 'Bird migration in progress',
  HL: 'Snow clearance completed',
  HM: 'Marked by',
  HN: 'Covered by wet snow or slush',
  HO: 'Obscured by snow',
  HP: 'Snow clearance in progress',
  HQ: 'Balloon operation cancelled',
  HR: 'Standing water',
  HS: 'Sanding in progress',
  HT: 'Approach according to signal area',
  HU: 'Balloon launch in progress',
  HV: 'Work completed',
  HW: 'Work in progress',
  HX: 'Concentration of birds',
  HY: 'Snow banks exist',
  HZ: 'Covered by frozen ruts and ridges',
  // L - Limitations
  LA: 'Operating on auxiliary power',
  LB: 'Reserved for aircraft based therein',
  LC: 'Closed',
  LD: 'Unsafe',
  LE: 'Operating without auxiliary power',
  LF: 'Interference from',
  LG: 'Operating without identification',
  LH: 'Unserviceable for heavier aircraft',
  LI: 'Closed to IFR operations',
  LK: 'Operating as a fixed light',
  LL: 'Usable for length/width of',
  LN: 'Closed to all night operations',
  LP: 'Prohibited to',
  LR: 'Aircraft restricted to runway and taxiway',
  LS: 'Subject to interruption',
  LT: 'Limited to',
  LV: 'Closed to VFR operations',
  LW: 'Will take place',
  LX: 'Operating but caution advised',
  // Special codes
  KK: 'Checklist',
  TT: 'Trigger NOTAM',
  XX: 'Other (plain language)',
};

/**
 * NOTAM purpose code from the Q-line indicating why the NOTAM was issued.
 * One or more codes are combined in the Q-line purpose field.
 *
 * - `N` - Immediate attention of aircraft operators
 * - `B` - Pre-flight information briefing
 * - `O` - Concerning flight operations
 * - `M` - Miscellaneous (available on request)
 * - `K` - Checklist NOTAM
 */
export type NotamPurpose = 'N' | 'B' | 'O' | 'M' | 'K';

/**
 * Maps NOTAM purpose codes to human-readable descriptions.
 */
export const NOTAM_PURPOSE_MAP: Record<NotamPurpose, string> = {
  N: 'Immediate attention',
  B: 'Pre-flight briefing',
  O: 'Flight operations',
  M: 'Miscellaneous',
  K: 'Checklist',
};

/**
 * The parsed Q-line (qualifier line) from an ICAO NOTAM.
 * Contains encoded metadata about the NOTAM in a structured 8-field format.
 */
export interface NotamQualifier {
  /** ICAO identifier of the Flight Information Region (e.g. "KZNY", "EGTT"). */
  fir: string;
  /** The full 5-letter NOTAM Q-code (e.g. "QMRLC", "QNALO"). */
  notamCode: string;
  /** Two-letter NOTAM subject code from the Q-code (2nd and 3rd letters, e.g. "MR" for runway, "NA" for navaids). */
  subjectCode: NotamSubjectCode;
  /** Two-letter NOTAM condition code from the Q-code (4th and 5th letters, e.g. "LC" for closed, "AS" for unserviceable). */
  conditionCode: NotamConditionCode;
  /** Traffic type qualifier indicating which flight rules are affected. */
  trafficType: NotamTrafficType;
  /** Purpose codes indicating why the NOTAM was issued (e.g. [N, B, O] for immediate attention + briefing + operations). */
  purposes: NotamPurpose[];
  /** Geographic scope of the NOTAM. */
  scope: NotamScope;
  /** Lower altitude limit in feet. Undefined when the lower limit is the surface. */
  lowerFt?: number;
  /** Upper altitude limit in feet. 99900 indicates unlimited. */
  upperFt: number;
  /** Center point coordinates of the NOTAM's area of applicability. */
  coordinates: Coordinates;
  /** Radius in nautical miles from the center point. */
  radiusNm: number;
}

/**
 * A date-time reference in a NOTAM effective period.
 * Uses the NOTAM-specific 10-digit format (YYMMDDHHmm) which includes
 * year and month information not present in the standard {@link DayTime}.
 */
export interface NotamDateTime {
  /** Two-digit year (e.g. 24 for 2024, 26 for 2026). */
  year: number;
  /** Month (1-12). */
  month: number;
  /** Day of month (1-31). */
  day: number;
  /** Hour (UTC, 0-23). */
  hour: number;
  /** Minute (UTC, 0-59). */
  minute: number;
}

/**
 * A parsed ICAO-format NOTAM (Notice to Air Missions).
 *
 * NOTAMs provide advance notice of changes to any aeronautical facility,
 * service, procedure, or hazard. This interface represents the structured
 * fields parsed from the standard ICAO NOTAM format including the Q-line,
 * items A through G, and header metadata.
 *
 * ```typescript
 * import { parseNotam } from '@squawk/notams';
 *
 * const notam = parseNotam(rawNotamString);
 * console.log(notam.id);                     // "A1242/24"
 * console.log(notam.action);                 // "NEW"
 * console.log(notam.qualifier?.fir);          // "KZNY"
 * console.log(notam.locationCodes);          // ["KJFK"]
 * console.log(notam.text);                   // "RWY 09L/27R CLSD DUE TO RESURFACING"
 * ```
 */
export interface Notam {
  /** The original raw NOTAM string as provided to the parser. */
  raw: string;
  /** NOTAM series and number identifier (e.g. "A1242/24", "C0156/26"). */
  id: string;
  /** Action type indicating whether this is a new, replacement, or cancellation NOTAM. */
  action: NotamAction;
  /** The NOTAM ID being replaced or cancelled (present when action is REPLACE or CANCEL). */
  referencedId?: string;
  /** Parsed Q-line qualifier data. */
  qualifier?: NotamQualifier;
  /** Item A: Affected location ICAO code(s) (e.g. ["KJFK"] or ["KJFK", "KLGA"]). */
  locationCodes: string[];
  /** Item B: Start of the effective period (UTC). */
  effectiveFrom: NotamDateTime;
  /** Item C: End of the effective period (UTC). Undefined when the NOTAM is permanent (PERM) or until further notice (UFN). */
  effectiveUntil?: NotamDateTime;
  /** True when the end time is estimated rather than definite (EST suffix on Item C). */
  isEstimatedEnd: boolean;
  /** True when the NOTAM is permanent with no expiration (PERM in Item C). */
  isPermanent: boolean;
  /** True when the NOTAM is effective until further notice (UFN in Item C). */
  isUntilFurtherNotice: boolean;
  /** Item D: Schedule for intermittent or recurring activity (e.g. "MON-FRI 0700-1600", "H24", "SR-SS"). */
  schedule?: string;
  /** Item E: Free-text description of the NOTAM condition or hazard. */
  text: string;
  /** Item F: Lower altitude limit as a raw string (e.g. "SFC", "FL050", "3000FT"). */
  lowerLimit?: string;
  /** Item G: Upper altitude limit as a raw string (e.g. "UNL", "FL180", "450FT"). */
  upperLimit?: string;
}
