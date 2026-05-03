import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';

import { updateReadmeDate } from '@squawk/build-shared';
import type { Navaid } from '@squawk/types';

/**
 * Shape of the bundled JSON output file: dataset metadata plus the array
 * of full Navaid records. Matches the wire format consumed by
 * `@squawk/navaid-data`.
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
  /** Navaid records. */
  records: Navaid[];
}

/**
 * Writes Navaid records to a gzipped JSON file at the given path.
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
    records: navaids,
  };

  const json = JSON.stringify(output);
  const compressed = gzipSync(Buffer.from(json));
  await writeFile(outputPath, compressed);

  const sizeMb = (compressed.length / 1024 / 1024).toFixed(1);
  console.log(
    `[write-output] Wrote ${output.meta.recordCount} records to ${outputPath} (${sizeMb} MB gzipped)`,
  );

  await updateReadmeDate(outputPath, nasrCycleDate);
}
