import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Fix, FixNavaidAssociation } from '@squawk/types';

/**
 * Compact representation of a FixNavaidAssociation. Short keys reduce file size.
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
 * Compact representation of a Fix record. Short keys reduce file size.
 */
interface CompactFix {
  /** Identifier. */
  id: string;
  /** ICAO region code. */
  icao: string;
  /** State code. */
  st: string;
  /** Country code. */
  ctry: string;
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lon: number;
  /** Use code. */
  uc: string;
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
  cmp?: string;
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
 * Shape of the bundled JSON output file.
 */
interface BundledOutput {
  /** Dataset metadata. */
  meta: {
    /** ISO 8601 timestamp of when the dataset was generated. */
    generatedAt: string;
    /** NASR cycle effective date. */
    nasrCycleDate: string;
    /** Total number of fix records in the dataset. */
    recordCount: number;
  };
  /** Fix records as an array. */
  records: CompactFix[];
}

/**
 * Compacts a FixNavaidAssociation into its short-key representation.
 */
function compactAssociation(a: FixNavaidAssociation): CompactNavaidAssoc {
  return {
    nid: a.navaidId,
    ntp: a.navaidType,
    brg: a.bearingDeg,
    dst: a.distanceNm,
  };
}

/**
 * Compacts a Fix into its short-key representation.
 */
function compactFix(fix: Fix): CompactFix {
  const c: CompactFix = {
    id: fix.identifier,
    icao: fix.icaoRegionCode,
    st: fix.state,
    ctry: fix.country,
    lat: fix.lat,
    lon: fix.lon,
    uc: fix.useCode,
  };

  if (fix.highArtccId !== undefined) {
    c.hart = fix.highArtccId;
  }
  if (fix.lowArtccId !== undefined) {
    c.lart = fix.lowArtccId;
  }
  if (fix.pitch) {
    c.pit = true;
  }
  if (fix.catch) {
    c.cat = true;
  }
  if (fix.suaAtcaa) {
    c.sua = true;
  }
  if (fix.minimumReceptionAltitudeFt !== undefined) {
    c.mra = fix.minimumReceptionAltitudeFt;
  }
  if (fix.compulsory !== undefined) {
    c.cmp = fix.compulsory;
  }
  if (fix.previousIdentifier !== undefined) {
    c.pid = fix.previousIdentifier;
  }
  if (fix.chartingRemark !== undefined) {
    c.rmk = fix.chartingRemark;
  }
  if (fix.chartTypes.length > 0) {
    c.cht = fix.chartTypes;
  }
  if (fix.navaidAssociations.length > 0) {
    c.nav = fix.navaidAssociations.map(compactAssociation);
  }

  return c;
}

/**
 * Writes Fix records to a gzipped compact JSON file at the given path.
 * Creates the output directory if it does not exist.
 *
 * @param fixes - Fix records to serialize.
 * @param nasrCycleDate - NASR cycle effective date string.
 * @param outputPath - Absolute path to write the output .json.gz file.
 */
export async function writeOutput(
  fixes: Fix[],
  nasrCycleDate: string,
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const output: BundledOutput = {
    meta: {
      generatedAt: new Date().toISOString(),
      nasrCycleDate,
      recordCount: fixes.length,
    },
    records: fixes.map(compactFix),
  };

  const json = JSON.stringify(output);
  const compressed = gzipSync(Buffer.from(json));
  await writeFile(outputPath, compressed);

  const sizeMb = (compressed.length / 1024 / 1024).toFixed(1);
  console.log(
    `[write-output] Wrote ${output.meta.recordCount} records to ${outputPath} (${sizeMb} MB gzipped)`,
  );
}
