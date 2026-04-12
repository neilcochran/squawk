import type { Fix, FixCompulsory, FixNavaidAssociation, FixUseCode } from '@squawk/types';
import { FIX_COMPULSORY_MAP, FIX_USE_CODE_MAP } from '@squawk/types';
import type { CsvRecord } from './parse-csv.js';

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
 * Builds a Fix object from a parsed FIX_BASE.csv record.
 *
 * @param rec - Parsed CSV record from FIX_BASE.csv.
 * @returns A Fix object, or undefined if required fields are missing.
 */
export function buildFix(rec: CsvRecord): Fix | undefined {
  const identifier = rec.FIX_ID;
  const icaoRegionCode = rec.ICAO_REGION_CODE;
  const state = rec.STATE_CODE;
  const country = rec.COUNTRY_CODE;
  const lat = parseOptFloat(rec.LAT_DECIMAL);
  const lon = parseOptFloat(rec.LONG_DECIMAL);

  if (
    !identifier ||
    !icaoRegionCode ||
    !state ||
    !country ||
    lat === undefined ||
    lon === undefined
  ) {
    return undefined;
  }

  const useCodeRaw = rec.FIX_USE_CODE?.trim();
  if (!useCodeRaw) {
    return undefined;
  }
  const useCode: FixUseCode | undefined = FIX_USE_CODE_MAP[useCodeRaw];
  if (!useCode) {
    return undefined;
  }

  const fix: Fix = {
    identifier,
    icaoRegionCode,
    state,
    country,
    lat,
    lon,
    useCode,
    pitch: rec.PITCH_FLAG === 'Y',
    catch: rec.CATCH_FLAG === 'Y',
    suaAtcaa: rec.SUA_ATCAA_FLAG === 'Y',
    chartTypes: [],
    navaidAssociations: [],
  };

  if (rec.ARTCC_ID_HIGH) {
    fix.highArtccId = rec.ARTCC_ID_HIGH;
  }
  if (rec.ARTCC_ID_LOW) {
    fix.lowArtccId = rec.ARTCC_ID_LOW;
  }

  const mra = parseOptInt(rec.MIN_RECEP_ALT);
  if (mra !== undefined) {
    fix.minimumReceptionAltitudeFt = mra;
  }

  const compulsoryRaw = rec.COMPULSORY?.trim();
  if (compulsoryRaw) {
    const compulsory: FixCompulsory | undefined = FIX_COMPULSORY_MAP[compulsoryRaw];
    if (compulsory) {
      fix.compulsory = compulsory;
    }
  }

  if (rec.FIX_ID_OLD) {
    fix.previousIdentifier = rec.FIX_ID_OLD;
  }

  if (rec.CHARTING_REMARK) {
    fix.chartingRemark = rec.CHARTING_REMARK;
  }

  // The CHARTS field in FIX_BASE contains a comma-separated summary.
  // We parse full chart types from FIX_CHRT separately, but use this as a fallback.
  if (rec.CHARTS) {
    fix.chartTypes = rec.CHARTS.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  return fix;
}

/**
 * Builds a FixNavaidAssociation from a parsed FIX_NAV.csv record.
 *
 * @param rec - Parsed CSV record from FIX_NAV.csv.
 * @returns A FixNavaidAssociation object, or undefined if required fields are missing.
 */
export function buildNavaidAssociation(rec: CsvRecord): FixNavaidAssociation | undefined {
  const navaidId = rec.NAV_ID;
  const navaidType = rec.NAV_TYPE;
  const bearing = parseOptFloat(rec.BEARING);
  const dist = parseOptFloat(rec.DISTANCE);

  if (!navaidId || !navaidType || bearing === undefined || dist === undefined) {
    return undefined;
  }

  return {
    navaidId,
    navaidType,
    bearingDeg: bearing,
    distanceNm: dist,
  };
}
