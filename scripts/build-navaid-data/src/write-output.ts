import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Navaid } from '@squawk/types';

/**
 * Compact representation of a Navaid record. Short keys reduce file size.
 */
interface CompactNavaid {
  /** Identifier. */
  id: string;
  /** Name. */
  nm: string;
  /** Type. */
  tp: string;
  /** Status. */
  st: string;
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lon: number;
  /** State code. */
  state: string;
  /** Country code. */
  ctry: string;
  /** City. */
  city?: string;
  /** Elevation in feet MSL. */
  elev?: number;
  /** Frequency in MHz (VOR-family). */
  fmhz?: number;
  /** Frequency in kHz (NDB-family). */
  fkhz?: number;
  /** TACAN channel. */
  ch?: string;
  /** Magnetic variation. */
  mv?: number;
  /** Magnetic variation direction. */
  mvd?: string;
  /** Magnetic variation year. */
  mvy?: number;
  /** Low-altitude ARTCC ID. */
  lart?: string;
  /** High-altitude ARTCC ID. */
  hart?: string;
  /** Navaid class. */
  cls?: string;
  /** DME service volume. */
  dssv?: string;
  /** Power output watts. */
  pwr?: number;
  /** Simultaneous voice. */
  sv?: true;
  /** NDB class. */
  ndb?: string;
  /** Public use. */
  pub?: true;
  /** Operating hours. */
  hrs?: string;
  /** NOTAM ID. */
  notam?: string;
  /** Fan marker identifier. */
  mkr?: string;
  /** Fan marker shape. */
  mkrs?: string;
  /** Fan marker bearing. */
  mkrb?: number;
  /** DME latitude. */
  dlat?: number;
  /** DME longitude. */
  dlon?: number;
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
    /** Total number of navaid records in the dataset. */
    recordCount: number;
  };
  /** Navaid records as an array. */
  records: CompactNavaid[];
}

/**
 * Compacts a Navaid into its short-key representation.
 */
function compactNavaid(nav: Navaid): CompactNavaid {
  const c: CompactNavaid = {
    id: nav.identifier,
    nm: nav.name,
    tp: nav.type,
    st: nav.status,
    lat: nav.lat,
    lon: nav.lon,
    state: nav.state,
    ctry: nav.country,
  };

  if (nav.city !== undefined) {
    c.city = nav.city;
  }
  if (nav.elevationFt !== undefined) {
    c.elev = nav.elevationFt;
  }
  if (nav.frequencyMhz !== undefined) {
    c.fmhz = nav.frequencyMhz;
  }
  if (nav.frequencyKhz !== undefined) {
    c.fkhz = nav.frequencyKhz;
  }
  if (nav.tacanChannel !== undefined) {
    c.ch = nav.tacanChannel;
  }
  if (nav.magneticVariationDeg !== undefined) {
    c.mv = nav.magneticVariationDeg;
  }
  if (nav.magneticVariationDirection !== undefined) {
    c.mvd = nav.magneticVariationDirection;
  }
  if (nav.magneticVariationYear !== undefined) {
    c.mvy = nav.magneticVariationYear;
  }
  if (nav.lowArtccId !== undefined) {
    c.lart = nav.lowArtccId;
  }
  if (nav.highArtccId !== undefined) {
    c.hart = nav.highArtccId;
  }
  if (nav.navaidClass !== undefined) {
    c.cls = nav.navaidClass;
  }
  if (nav.dmeServiceVolume !== undefined) {
    c.dssv = nav.dmeServiceVolume;
  }
  if (nav.powerOutputWatts !== undefined) {
    c.pwr = nav.powerOutputWatts;
  }
  if (nav.simultaneousVoice) {
    c.sv = true;
  }
  if (nav.ndbClass !== undefined) {
    c.ndb = nav.ndbClass;
  }
  if (nav.publicUse) {
    c.pub = true;
  }
  if (nav.operatingHours !== undefined) {
    c.hrs = nav.operatingHours;
  }
  if (nav.notamId !== undefined) {
    c.notam = nav.notamId;
  }
  if (nav.markerIdentifier !== undefined) {
    c.mkr = nav.markerIdentifier;
  }
  if (nav.markerShape !== undefined) {
    c.mkrs = nav.markerShape;
  }
  if (nav.markerBearingDeg !== undefined) {
    c.mkrb = nav.markerBearingDeg;
  }
  if (nav.dmeLat !== undefined) {
    c.dlat = nav.dmeLat;
  }
  if (nav.dmeLon !== undefined) {
    c.dlon = nav.dmeLon;
  }

  return c;
}

/**
 * Writes Navaid records to a gzipped compact JSON file at the given path.
 * Creates the output directory if it does not exist.
 *
 * @param navaids - Navaid records to serialize.
 * @param nasrCycleDate - NASR cycle effective date string.
 * @param outputPath - Absolute path to write the output .json.gz file.
 */
export async function writeOutput(
  navaids: Navaid[],
  nasrCycleDate: string,
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const output: BundledOutput = {
    meta: {
      generatedAt: new Date().toISOString(),
      nasrCycleDate,
      recordCount: navaids.length,
    },
    records: navaids.map(compactNavaid),
  };

  const json = JSON.stringify(output);
  const compressed = gzipSync(Buffer.from(json));
  await writeFile(outputPath, compressed);

  const sizeMb = (compressed.length / 1024 / 1024).toFixed(1);
  console.log(
    `[write-output] Wrote ${output.meta.recordCount} records to ${outputPath} (${sizeMb} MB gzipped)`,
  );

  const readmePath = resolve(dirname(outputPath), '..', 'README.md');
  await updateReadmeDate(readmePath, nasrCycleDate);
}

/**
 * Updates the bolded date in the "Data source" section of a README to match
 * the cycle date of the data that was just built.
 */
async function updateReadmeDate(readmePath: string, date: string): Promise<void> {
  const readme = await readFile(readmePath, 'utf-8');
  const updated = readme.replace(
    /The bundled snapshot is built from the \*\*\d{4}-\d{2}-\d{2}\*\*/,
    `The bundled snapshot is built from the **${date}**`,
  );
  if (updated !== readme) {
    await writeFile(readmePath, updated, 'utf-8');
    console.log(`[write-output] Updated README date to ${date}`);
  }
}
