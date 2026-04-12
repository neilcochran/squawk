import type { Navaid, NavaidStatus, NavaidType } from '@squawk/types';
import { NAVAID_STATUS_MAP, NAVAID_TYPE_MAP } from '@squawk/types';
import type { CsvRecord } from './parse-csv.js';

/** Navaid types whose frequency is expressed in MHz. */
const MHZ_TYPES: ReadonlySet<NavaidType> = new Set([
  'VOR',
  'VORTAC',
  'VOR/DME',
  'TACAN',
  'DME',
  'VOT',
]);

/**
 * Safely parses a string to a float, returning undefined if empty or NaN.
 */
function parseOptFloat(val: string | undefined): number | undefined {
  if (!val) {
    return undefined;
  }
  const n = parseFloat(val);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Safely parses a string to an integer, returning undefined if empty or NaN.
 */
function parseOptInt(val: string | undefined): number | undefined {
  if (!val) {
    return undefined;
  }
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Builds a Navaid object from a parsed NAV_BASE.csv record.
 *
 * @param rec - Parsed CSV record from NAV_BASE.csv.
 * @returns A Navaid object, or undefined if required fields are missing.
 */
export function buildNavaid(rec: CsvRecord): Navaid | undefined {
  const identifier = rec.NAV_ID;
  const name = rec.NAME;
  const state = rec.STATE_CODE;
  const country = rec.COUNTRY_CODE;
  const lat = parseOptFloat(rec.LAT_DECIMAL);
  const lon = parseOptFloat(rec.LONG_DECIMAL);

  if (!identifier || !name || !state || !country || lat === undefined || lon === undefined) {
    return undefined;
  }

  const typeCode = rec.NAV_TYPE;
  if (!typeCode) {
    return undefined;
  }
  const type: NavaidType | undefined = NAVAID_TYPE_MAP[typeCode];
  if (!type) {
    return undefined;
  }

  const statusCode = rec.NAV_STATUS;
  if (!statusCode) {
    return undefined;
  }
  const status: NavaidStatus | undefined = NAVAID_STATUS_MAP[statusCode];
  if (!status) {
    return undefined;
  }

  const navaid: Navaid = {
    identifier,
    name,
    type,
    status,
    lat,
    lon,
    state,
    country,
  };

  if (rec.CITY) {
    navaid.city = rec.CITY;
  }

  const elev = parseOptFloat(rec.ELEV);
  if (elev !== undefined) {
    navaid.elevationFt = elev;
  }

  const freq = parseOptFloat(rec.FREQ);
  if (freq !== undefined) {
    if (MHZ_TYPES.has(type)) {
      navaid.frequencyMhz = freq;
    } else {
      navaid.frequencyKhz = freq;
    }
  }

  if (rec.CHAN) {
    navaid.tacanChannel = rec.CHAN;
  }

  const magVar = parseOptFloat(rec.MAG_VARN);
  if (magVar !== undefined) {
    navaid.magneticVariationDeg = magVar;
  }
  if (rec.MAG_VARN_HEMIS) {
    navaid.magneticVariationDirection = rec.MAG_VARN_HEMIS;
  }
  const magYear = parseOptInt(rec.MAG_VARN_YEAR);
  if (magYear !== undefined) {
    navaid.magneticVariationYear = magYear;
  }

  if (rec.LOW_ALT_ARTCC_ID) {
    navaid.lowArtccId = rec.LOW_ALT_ARTCC_ID;
  }
  if (rec.HIGH_ALT_ARTCC_ID) {
    navaid.highArtccId = rec.HIGH_ALT_ARTCC_ID;
  }

  if (rec.ALT_CODE) {
    navaid.navaidClass = rec.ALT_CODE;
  }
  if (rec.DME_SSV) {
    navaid.dmeServiceVolume = rec.DME_SSV;
  }

  const pwr = parseOptInt(rec.PWR_OUTPUT);
  if (pwr !== undefined) {
    navaid.powerOutputWatts = pwr;
  }

  if (rec.SIMUL_VOICE_FLAG === 'Y') {
    navaid.simultaneousVoice = true;
  }

  if (rec.NDB_CLASS_CODE) {
    navaid.ndbClass = rec.NDB_CLASS_CODE;
  }

  if (rec.PUBLIC_USE_FLAG === 'Y') {
    navaid.publicUse = true;
  }

  if (rec.OPER_HOURS) {
    navaid.operatingHours = rec.OPER_HOURS;
  }

  if (rec.NOTAM_ID) {
    navaid.notamId = rec.NOTAM_ID;
  }

  if (rec.MKR_IDENT) {
    navaid.markerIdentifier = rec.MKR_IDENT;
  }
  if (rec.MKR_SHAPE) {
    navaid.markerShape = rec.MKR_SHAPE;
  }
  const mkrBrg = parseOptFloat(rec.MKR_BRG);
  if (mkrBrg !== undefined) {
    navaid.markerBearingDeg = mkrBrg;
  }

  const dmeLat = parseOptFloat(rec.TACAN_DME_LAT_DECIMAL);
  const dmeLon = parseOptFloat(rec.TACAN_DME_LONG_DECIMAL);
  if (dmeLat !== undefined && dmeLon !== undefined) {
    if (dmeLat !== lat || dmeLon !== lon) {
      navaid.dmeLat = dmeLat;
      navaid.dmeLon = dmeLon;
    }
  }

  return navaid;
}
