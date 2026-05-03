import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';

import { updateReadmeDate } from '@squawk/build-shared';
import type { Airway } from '@squawk/types';

/**
 * Shape of the bundled JSON output file: dataset metadata plus the array
 * of full Airway records. Matches the wire format consumed by
 * `@squawk/airway-data`.
 */
interface BundledOutput {
  /** Dataset metadata. */
  meta: {
    /** ISO 8601 timestamp of when the dataset was generated. */
    generatedAt: string;
    /** NASR cycle effective date. */
    nasrCycleDate: string;
    /** Total number of airway records in the dataset. */
    recordCount: number;
    /** Total number of waypoint records across all airways. */
    waypointCount: number;
  };
  /** Airway records. */
  records: Airway[];
}

/**
 * Writes Airway records to a gzipped JSON file at the given path.
 * Creates the output directory if it does not exist.
 *
 * @param airways - Airway records to serialize.
 * @param nasrCycleDate - NASR cycle effective date string.
 * @param outputPath - Absolute path to write the output .json.gz file.
 */
export async function writeOutput(
  airways: Airway[],
  nasrCycleDate: string,
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const waypointCount = airways.reduce((sum, a) => sum + a.waypoints.length, 0);

  const output: BundledOutput = {
    meta: {
      generatedAt: new Date().toISOString(),
      nasrCycleDate,
      recordCount: airways.length,
      waypointCount,
    },
    records: airways,
  };

  const json = JSON.stringify(output);
  const compressed = gzipSync(Buffer.from(json));
  await writeFile(outputPath, compressed);

  const sizeMb = (compressed.length / 1024 / 1024).toFixed(1);
  console.log(
    `[write-output] Wrote ${output.meta.recordCount} airways and ${output.meta.waypointCount} waypoints to ${outputPath} (${sizeMb} MB gzipped)`,
  );

  await updateReadmeDate(outputPath, nasrCycleDate);
}
