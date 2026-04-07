import type { NotamDateTime } from './notam.js';

/**
 * FAA domestic (legacy) NOTAM types.
 */

/**
 * Classification of a legacy FAA domestic NOTAM.
 *
 * - `NOTAM_D` - Facility-issued NOTAM (NOTAM D) containing information about
 *   aeronautical facilities, navaids, services, procedures, or hazards.
 *   Numbered by accountability per month (MM/NNN).
 * - `FDC` - Flight Data Center NOTAM containing regulatory information such as
 *   instrument flight procedure changes, flight restrictions, and airspace usage
 *   changes. Numbered by year and serial (D/NNNN).
 */
export type FaaNotamClassification = 'NOTAM_D' | 'FDC';

/**
 * Maps FAA NOTAM classification codes to human-readable descriptions.
 */
export const FAA_NOTAM_CLASSIFICATION_MAP: Record<FaaNotamClassification, string> = {
  NOTAM_D: 'NOTAM D (Facility)',
  FDC: 'FDC (Flight Data Center)',
};

/**
 * Keyword identifying the subject matter of a legacy FAA domestic NOTAM.
 * Each NOTAM contains exactly one keyword after the location identifier.
 *
 * - `RWY` - Runway
 * - `TWY` - Taxiway
 * - `APRON` - Apron/ramp area
 * - `AD` - Aerodrome
 * - `OBST` - Obstruction
 * - `NAV` - Navigation aid
 * - `COM` - Communication
 * - `SVC` - Services
 * - `AIRSPACE` - Airspace
 * - `ODP` - Obstacle Departure Procedure
 * - `SID` - Standard Instrument Departure
 * - `STAR` - Standard Terminal Arrival
 * - `IAP` - Instrument Approach Procedure
 * - `VFP` - Visual Flight Procedure
 * - `DVA` - Diverse Vector Area
 * - `ROUTE` - Route
 * - `CHART` - Chart
 * - `DATA` - Data
 * - `SPECIAL` - Special notice
 * - `SECURITY` - Security
 */
export type FaaNotamKeyword =
  | 'RWY'
  | 'TWY'
  | 'APRON'
  | 'AD'
  | 'OBST'
  | 'NAV'
  | 'COM'
  | 'SVC'
  | 'AIRSPACE'
  | 'ODP'
  | 'SID'
  | 'STAR'
  | 'IAP'
  | 'VFP'
  | 'DVA'
  | 'ROUTE'
  | 'CHART'
  | 'DATA'
  | 'SPECIAL'
  | 'SECURITY';

/**
 * Maps FAA NOTAM keywords to human-readable descriptions.
 */
export const FAA_NOTAM_KEYWORD_MAP: Record<FaaNotamKeyword, string> = {
  RWY: 'Runway',
  TWY: 'Taxiway',
  APRON: 'Apron',
  AD: 'Aerodrome',
  OBST: 'Obstruction',
  NAV: 'Navigation',
  COM: 'Communication',
  SVC: 'Services',
  AIRSPACE: 'Airspace',
  ODP: 'Obstacle Departure Procedure',
  SID: 'Standard Instrument Departure',
  STAR: 'Standard Terminal Arrival',
  IAP: 'Instrument Approach Procedure',
  VFP: 'Visual Flight Procedure',
  DVA: 'Diverse Vector Area',
  ROUTE: 'Route',
  CHART: 'Chart',
  DATA: 'Data',
  SPECIAL: 'Special',
  SECURITY: 'Security',
};

/**
 * A parsed FAA domestic (legacy) format NOTAM.
 *
 * The FAA domestic format is a flat, positional text structure used within
 * the US National Airspace System. It differs from the ICAO format in that
 * it has no Q-line or item delimiters (A-G). Instead, it uses a standardized
 * component order: accountability, NOTAM number, location, keyword, body text,
 * and effective period.
 *
 * There are two sub-formats:
 * - **NOTAM D** (facility-issued): `!ATL 03/296 ATL NAV ILS RWY 08L IM U/S 2603181657-2711082111EST`
 * - **FDC** (Flight Data Center): `!FDC 5/3374 ATL IAP HARTSFIELD/JACKSON ATLANTA INTL, ATLANTA, GA. [body] 2512021812-2712021809EST`
 *
 * ```typescript
 * import { parseFaaNotam } from '@squawk/notams';
 *
 * const notam = parseFaaNotam('!ATL 03/296 ATL NAV ILS RWY 08L IM U/S 2603181657-2711082111EST');
 * console.log(notam.accountability);    // "ATL"
 * console.log(notam.classification);    // "NOTAM_D"
 * console.log(notam.keyword);           // "NAV"
 * console.log(notam.text);              // "ILS RWY 08L IM U/S"
 * ```
 */
export interface FaaNotam {
  /** The original raw NOTAM string as provided to the parser. */
  raw: string;
  /** The accountability location identifier (e.g. "ATL", "BOS", "FDC"). */
  accountability: string;
  /** Classification of the NOTAM (facility-issued NOTAM D or Flight Data Center). */
  classification: FaaNotamClassification;
  /** The NOTAM number as it appears in the source (e.g. "03/296" for NOTAM D, "5/3374" for FDC). */
  notamNumber: string;
  /** The affected location identifier (e.g. "ATL", "BOS", "ANC"). */
  locationCode: string;
  /** The keyword identifying the subject matter of the NOTAM. */
  keyword: FaaNotamKeyword;
  /**
   * Full airport/facility name for FDC NOTAMs (e.g. "HARTSFIELD/JACKSON ATLANTA INTL").
   * Not present on NOTAM D (facility-issued) NOTAMs.
   */
  airportName?: string;
  /**
   * City and state location string for FDC NOTAMs (e.g. "ATLANTA, GA").
   * Not present on NOTAM D (facility-issued) NOTAMs.
   */
  airportLocation?: string;
  /** Free-text body describing the condition, hazard, or change. */
  text: string;
  /** Start of the effective period (UTC). */
  effectiveFrom: NotamDateTime;
  /** End of the effective period (UTC). Undefined when the NOTAM is permanent (PERM). */
  effectiveUntil?: NotamDateTime;
  /** True when the end time is estimated rather than definite (EST suffix). */
  isEstimatedEnd: boolean;
  /** True when the NOTAM is permanent with no expiration (PERM). */
  isPermanent: boolean;
}
