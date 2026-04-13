import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { updateReadmeDate } from '@squawk/build-shared';
import { gzipSync } from 'node:zlib';
import type { AircraftRegistration } from '@squawk/icao-registry';

/**
 * Shape of a single record in the compact bundled JSON format.
 * Short keys reduce file size across hundreds of thousands of records.
 */
interface CompactRecord {
  /** Registration (N-number). */
  r: string;
  /** Manufacturer name. */
  mk?: string;
  /** Model designation. */
  md?: string;
  /** Operator name. */
  op?: string;
  /** Aircraft type. */
  at?: string;
  /** Engine type. */
  et?: string;
  /** Year manufactured. */
  yr?: number;
}

/**
 * Shape of the bundled JSON output file.
 */
interface BundledOutput {
  /** Dataset metadata. */
  meta: {
    /** ISO 8601 timestamp of when the dataset was generated. */
    generatedAt: string;
    /** Total number of records in the dataset. */
    recordCount: number;
  };
  /** Records keyed by uppercase ICAO hex address. */
  records: Record<string, CompactRecord>;
}

/**
 * Writes AircraftRegistration records to a gzipped compact JSON file at
 * the given path. Creates the output directory if it does not exist.
 *
 * @param records - AircraftRegistration records to serialize.
 * @param outputPath - Absolute path to write the output .json.gz file.
 */
export async function writeOutput(
  records: AircraftRegistration[],
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const compactRecords: Record<string, CompactRecord> = {};

  for (const rec of records) {
    const compact: CompactRecord = { r: rec.registration };
    if (rec.make !== undefined) {
      compact.mk = rec.make;
    }
    if (rec.model !== undefined) {
      compact.md = rec.model;
    }
    if (rec.operator !== undefined) {
      compact.op = rec.operator;
    }
    if (rec.aircraftType !== undefined) {
      compact.at = rec.aircraftType;
    }
    if (rec.engineType !== undefined) {
      compact.et = rec.engineType;
    }
    if (rec.yearManufactured !== undefined) {
      compact.yr = rec.yearManufactured;
    }

    compactRecords[rec.icaoHex] = compact;
  }

  const output: BundledOutput = {
    meta: {
      generatedAt: new Date().toISOString(),
      recordCount: Object.keys(compactRecords).length,
    },
    records: compactRecords,
  };

  const json = JSON.stringify(output);
  const compressed = gzipSync(Buffer.from(json));
  await writeFile(outputPath, compressed);

  const sizeMb = (compressed.length / 1024 / 1024).toFixed(1);
  console.log(
    `[write-output] Wrote ${output.meta.recordCount} records to ${outputPath} (${sizeMb} MB gzipped)`,
  );

  const today = new Date().toISOString().slice(0, 10);
  await updateReadmeDate(outputPath, today);
}
