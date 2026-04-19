import type { Fix, FixCompulsory, FixNavaidAssociation, FixUseCode } from '@squawk/types';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Compact representation of a navaid association in the bundled JSON format.
 */
interface CompactNavaidAssoc {
  /** Navaid identifier. */
  nid: string;
  /** Navaid type. */
  ntp: string;
  /** Bearing in degrees. */
  brg: number;
  /** Distance in nautical miles. */
  dst: number;
}

/**
 * Compact representation of a Fix in the bundled JSON format.
 */
interface CompactFix {
  /** Identifier. */
  id: string;
  /** ICAO region code. */
  icao: string;
  /** State code (absent for non-US fixes). */
  st?: string;
  /** Country code. */
  ctry: string;
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lon: number;
  /** Use code. */
  uc: FixUseCode;
  /** High-altitude ARTCC ID. */
  hart?: string;
  /** Low-altitude ARTCC ID. */
  lart?: string;
  /** Pitch flag. */
  pit?: true;
  /** Catch flag. */
  cat?: true;
  /** SUA/ATCAA flag. */
  sua?: true;
  /** Minimum reception altitude. */
  mra?: number;
  /** Compulsory designation. */
  cmp?: FixCompulsory;
  /** Previous identifier. */
  pid?: string;
  /** Charting remark. */
  rmk?: string;
  /** Chart types. */
  cht?: string[];
  /** Navaid associations. */
  nav?: CompactNavaidAssoc[];
}

/**
 * Shape of the bundled JSON data file.
 */
interface BundledData {
  /** Dataset metadata. */
  meta: {
    /** ISO 8601 timestamp of when the dataset was generated. */
    generatedAt: string;
    /** NASR cycle effective date. */
    nasrCycleDate: string;
    /** Total number of fix records. */
    recordCount: number;
  };
  /** Fix records. */
  records: CompactFix[];
}

/**
 * Metadata properties attached to the fix dataset describing
 * the FAA NASR data vintage and build provenance.
 */
export interface FixDatasetProperties {
  /** ISO 8601 timestamp of when the dataset was generated. */
  generatedAt: string;
  /** NASR cycle effective date (e.g. "2026-01-22"). */
  nasrCycleDate: string;
  /** Total number of fix records in the dataset. */
  recordCount: number;
}

/**
 * A pre-processed array of Fix records with attached metadata
 * about the build provenance and NASR cycle.
 */
export interface FixDataset {
  /** Metadata about the dataset build. */
  properties: FixDatasetProperties;
  /** Fix records. */
  records: Fix[];
}

/**
 * Expands a compact navaid association into the full interface.
 */
function expandNavaidAssociation(c: CompactNavaidAssoc): FixNavaidAssociation {
  return {
    navaidId: c.nid,
    navaidType: c.ntp,
    bearingDeg: c.brg,
    distanceNm: c.dst,
  };
}

/**
 * Expands a compact fix record into the full Fix interface.
 */
function expandFix(c: CompactFix): Fix {
  const fix: Fix = {
    identifier: c.id,
    icaoRegionCode: c.icao,
    country: c.ctry,
    lat: c.lat,
    lon: c.lon,
    useCode: c.uc,
    pitch: c.pit === true,
    catch: c.cat === true,
    suaAtcaa: c.sua === true,
    chartTypes: c.cht ?? [],
    navaidAssociations: c.nav ? c.nav.map(expandNavaidAssociation) : [],
  };

  if (c.st !== undefined) {
    fix.state = c.st;
  }
  if (c.hart !== undefined) {
    fix.highArtccId = c.hart;
  }
  if (c.lart !== undefined) {
    fix.lowArtccId = c.lart;
  }
  if (c.mra !== undefined) {
    fix.minimumReceptionAltitudeFt = c.mra;
  }
  if (c.cmp !== undefined) {
    fix.compulsory = c.cmp;
  }
  if (c.pid !== undefined) {
    fix.previousIdentifier = c.pid;
  }
  if (c.rmk !== undefined) {
    fix.chartingRemark = c.rmk;
  }

  return fix;
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/fixes.json.gz');
const raw: BundledData = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf-8'));

const records: Fix[] = raw.records.map(expandFix);

/**
 * Pre-processed snapshot of fix/waypoint data derived from the FAA NASR
 * 28-day subscription cycle.
 *
 * Contains fix identification, location, usage category, ARTCC assignment,
 * chart associations, and navaid relationships for every non-CNF named fix
 * and waypoint published by the FAA. Includes selected Canadian, Mexican,
 * Caribbean, and Pacific fixes that participate in US operations; their
 * `state` field is undefined while `country` is populated with a two-letter
 * code and `icaoRegionCode` reflects the foreign region (e.g. `CY` for
 * Canada).
 *
 * Pass the `records` array directly to `createFixResolver()` from
 * `@squawk/fixes` for zero-config lookups:
 *
 * ```typescript
 * import { usBundledFixes } from '@squawk/fix-data';
 * import { createFixResolver } from '@squawk/fixes';
 *
 * const resolver = createFixResolver({ data: usBundledFixes.records });
 * ```
 */
export const usBundledFixes: FixDataset = {
  properties: {
    generatedAt: raw.meta.generatedAt,
    nasrCycleDate: raw.meta.nasrCycleDate,
    recordCount: raw.meta.recordCount,
  },
  records,
};
