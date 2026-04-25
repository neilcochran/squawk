import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { updateReadmeDate } from '@squawk/build-shared';
import type { AircraftRegistration } from '@squawk/icao-registry';

/**
 * Shape of the bundled JSON output file: dataset metadata plus the array
 * of full AircraftRegistration records. Matches the wire format consumed
 * by `@squawk/icao-registry-data`.
 */
interface BundledOutput {
  /** Dataset metadata. */
  meta: {
    /** ISO 8601 timestamp of when the dataset was generated. */
    generatedAt: string;
    /** Total number of records in the dataset. */
    recordCount: number;
  };
  /** Aircraft registration records. */
  records: AircraftRegistration[];
}

/**
 * Today's date in `YYYY-MM-DD` format, used to stamp the `### snapshot` line
 * in the package README so consumers can see when the snapshot was generated.
 */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Writes AircraftRegistration records to a gzipped JSON file at the given
 * path. Creates the output directory if it does not exist.
 *
 * @param records - AircraftRegistration records to serialize.
 * @param outputPath - Absolute path to write the output .json.gz file.
 */
export async function writeOutput(
  records: AircraftRegistration[],
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  // Defensive dedup by icaoHex with last-write-wins semantics. The FAA
  // ReleasableAircraft data can contain multiple rows for the same hex
  // (e.g., a cancelled registration followed by a fresh reissue); collapse
  // them so consumers see exactly one record per hex.
  const byHex = new Map<string, AircraftRegistration>();
  for (const rec of records) {
    byHex.set(rec.icaoHex, rec);
  }
  const dedupedRecords = Array.from(byHex.values());

  const output: BundledOutput = {
    meta: {
      generatedAt: new Date().toISOString(),
      recordCount: dedupedRecords.length,
    },
    records: dedupedRecords,
  };

  const json = JSON.stringify(output);
  const compressed = gzipSync(Buffer.from(json));
  await writeFile(outputPath, compressed);

  const sizeMb = (compressed.length / 1024 / 1024).toFixed(1);
  console.log(
    `[write-output] Wrote ${output.meta.recordCount} records to ${outputPath} (${sizeMb} MB gzipped)`,
  );

  await updateReadmeDate(outputPath, todayIso());
}
