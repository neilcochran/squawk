import { lookupCode } from '@squawk/build-shared';
import type { CsvRecord } from '@squawk/build-shared';
import type { Navaid, NavaidCheckpoint, NavaidStatus, NavaidType } from '@squawk/types';
import { NAVAID_CHECKPOINT_TYPE_MAP, NAVAID_STATUS_MAP, NAVAID_TYPE_MAP } from '@squawk/types';

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
 * Navaid types that have no magnetic variation. The NASR NAV record layout
 * states that any value published for a DME, VOT or fan marker is to be
 * ignored.
 */
const NO_MAGNETIC_VARIATION_TYPES: ReadonlySet<NavaidType> = new Set(['DME', 'VOT', 'FAN_MARKER']);

/**
 * NAV_RMK.csv reference columns whose remarks describe how the navaid's
 * position or elevation was surveyed (e.g. "3RD PARTY SURVEY."). They say
 * nothing about using the navaid and are not carried.
 */
const SURVEY_SOURCE_REMARK_COLUMNS: ReadonlySet<string> = new Set(['LAT_LONG_SOURCE_CODE', 'ELEV']);

/**
 * Parses a NASR Y/N flag.
 *
 * @param val - The flag column value.
 * @returns true for "Y", false for "N", or undefined when the column is blank or holds anything else.
 */
function parseYesNo(val: string | undefined): boolean | undefined {
  if (val === 'Y') {
    return true;
  }
  if (val === 'N') {
    return false;
  }
  return undefined;
}

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
 * Builds the key that identifies one navaid across NAV_BASE.csv, NAV_RMK.csv
 * and NAV_CKPT.csv. The identifier and type alone are not unique (several
 * NDBs share an identifier), so the associated city, state and country are
 * part of it.
 *
 * @param rec - Parsed CSV record from any of the NAV files.
 * @returns The key, or undefined if the record has no identifier or type.
 */
export function navaidKey(rec: CsvRecord): string | undefined {
  if (!rec.NAV_ID || !rec.NAV_TYPE) {
    return undefined;
  }
  return [
    rec.NAV_ID,
    rec.NAV_TYPE,
    rec.STATE_CODE ?? '',
    rec.CITY ?? '',
    rec.COUNTRY_CODE ?? '',
  ].join('|');
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

  if (!identifier || !name || !country || lat === undefined || lon === undefined) {
    return undefined;
  }

  const typeCode = rec.NAV_TYPE;
  if (!typeCode) {
    return undefined;
  }
  const type: NavaidType | undefined = lookupCode(
    NAVAID_TYPE_MAP,
    typeCode,
    'NAV_TYPE',
    'parse-navaids',
  );
  if (!type) {
    return undefined;
  }

  const statusCode = rec.NAV_STATUS;
  if (!statusCode) {
    return undefined;
  }
  const status: NavaidStatus | undefined = lookupCode(
    NAVAID_STATUS_MAP,
    statusCode,
    'NAV_STATUS',
    'parse-navaids',
  );
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
    country,
  };

  if (state) {
    navaid.state = state;
  }

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

  if (!NO_MAGNETIC_VARIATION_TYPES.has(type)) {
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

  const simultaneousVoice = parseYesNo(rec.SIMUL_VOICE_FLAG);
  if (simultaneousVoice !== undefined) {
    navaid.simultaneousVoice = simultaneousVoice;
  }

  if (rec.NDB_CLASS_CODE) {
    navaid.ndbClass = rec.NDB_CLASS_CODE;
  }

  const publicUse = parseYesNo(rec.PUBLIC_USE_FLAG);
  if (publicUse !== undefined) {
    navaid.publicUse = publicUse;
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

  if (rec.TACAN_DME_STATUS) {
    const dmeStatus: NavaidStatus | undefined = lookupCode(
      NAVAID_STATUS_MAP,
      rec.TACAN_DME_STATUS,
      'TACAN_DME_STATUS',
      'parse-navaids',
    );
    if (dmeStatus) {
      navaid.dmeStatus = dmeStatus;
    }
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

/**
 * Extracts the remark text from a parsed NAV_RMK.csv record.
 *
 * @param rec - Parsed CSV record from NAV_RMK.csv.
 * @returns The trimmed remark, or undefined if it is empty or only describes how the position or elevation was surveyed.
 */
export function buildNavaidRemark(rec: CsvRecord): string | undefined {
  if (rec.REF_COL_NAME !== undefined && SURVEY_SOURCE_REMARK_COLUMNS.has(rec.REF_COL_NAME)) {
    return undefined;
  }
  const remark = rec.REMARK?.trim();
  return remark ? remark : undefined;
}

/**
 * Builds a NavaidCheckpoint from a parsed NAV_CKPT.csv record.
 *
 * @param rec - Parsed CSV record from NAV_CKPT.csv.
 * @returns A NavaidCheckpoint, or undefined if the type code, bearing or description is missing or unknown.
 */
export function buildNavaidCheckpoint(rec: CsvRecord): NavaidCheckpoint | undefined {
  const typeCode = rec.AIR_GND_CODE;
  const bearing = parseOptFloat(rec.BRG);
  const description = rec.CHK_DESC?.trim();
  if (!typeCode || bearing === undefined || !description) {
    return undefined;
  }
  const type = lookupCode(NAVAID_CHECKPOINT_TYPE_MAP, typeCode, 'AIR_GND_CODE', 'parse-navaids');
  if (!type) {
    return undefined;
  }

  const checkpoint: NavaidCheckpoint = {
    type,
    magneticBearingDeg: bearing,
    description,
  };

  const altitude = parseOptInt(rec.ALTITUDE);
  if (altitude !== undefined) {
    checkpoint.altitudeFt = altitude;
  }
  if (rec.ARPT_ID) {
    checkpoint.airportId = rec.ARPT_ID;
  }

  return checkpoint;
}

/**
 * Attaches the remarks in NAV_RMK.csv to their navaids, in file order. Rows
 * for a navaid that is not in the map (a shutdown facility) are skipped.
 *
 * @param navaidsByKey - Navaids keyed by {@link navaidKey}.
 * @param records - Parsed CSV records from NAV_RMK.csv.
 * @returns The number of remarks attached.
 */
export function attachNavaidRemarks(
  navaidsByKey: ReadonlyMap<string, Navaid>,
  records: readonly CsvRecord[],
): number {
  let attached = 0;
  for (const rec of records) {
    const key = navaidKey(rec);
    const navaid = key === undefined ? undefined : navaidsByKey.get(key);
    const remark = buildNavaidRemark(rec);
    if (!navaid || remark === undefined) {
      continue;
    }
    navaid.remarks ??= [];
    navaid.remarks.push(remark);
    attached++;
  }
  return attached;
}

/**
 * Attaches the VOR receiver checkpoints in NAV_CKPT.csv to their navaids, in
 * file order. Rows for a navaid that is not in the map are skipped.
 *
 * @param navaidsByKey - Navaids keyed by {@link navaidKey}.
 * @param records - Parsed CSV records from NAV_CKPT.csv.
 * @returns The number of checkpoints attached.
 */
export function attachNavaidCheckpoints(
  navaidsByKey: ReadonlyMap<string, Navaid>,
  records: readonly CsvRecord[],
): number {
  let attached = 0;
  for (const rec of records) {
    const key = navaidKey(rec);
    const navaid = key === undefined ? undefined : navaidsByKey.get(key);
    const checkpoint = buildNavaidCheckpoint(rec);
    if (!navaid || !checkpoint) {
      continue;
    }
    navaid.checkpoints ??= [];
    navaid.checkpoints.push(checkpoint);
    attached++;
  }
  return attached;
}
