import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';

import { updateReadmeDate } from '@squawk/build-shared';
import type { Procedure } from '@squawk/types';

/**
 * Shape of the bundled JSON output file: dataset metadata plus the array
 * of full Procedure records. Matches the wire format consumed by
 * `@squawk/procedure-data`.
 */
interface BundledOutput {
  /** Dataset metadata. */
  meta: {
    /** ISO 8601 timestamp of when the dataset was generated. */
    generatedAt: string;
    /** CIFP cycle effective date in `YYYY-MM-DD`. */
    cifpCycleDate: string;
    /** Total number of procedure records in the dataset. */
    recordCount: number;
    /** Number of SID procedures. */
    sidCount: number;
    /** Number of STAR procedures. */
    starCount: number;
    /** Number of IAP procedures. */
    iapCount: number;
    /** Total leg count across all routes, transitions, and missed approaches. */
    legCount: number;
  };
  /** Procedure records. */
  records: Procedure[];
}

/**
 * Counts the total number of legs across all common routes, transitions,
 * and the missed-approach sequence of a procedure.
 */
function countLegs(p: Procedure): number {
  let count = 0;
  for (const route of p.commonRoutes) {
    count += route.legs.length;
  }
  for (const transition of p.transitions) {
    count += transition.legs.length;
  }
  if (p.missedApproach !== undefined) {
    count += p.missedApproach.legs.length;
  }
  return count;
}

/**
 * Writes Procedure records to a gzipped JSON file at the given path.
 * Creates the output directory if it does not exist.
 *
 * @param procedures - Procedure records to serialize.
 * @param cifpCycleDate - CIFP cycle effective date string.
 * @param outputPath - Absolute path to write the output .json.gz file.
 */
export async function writeOutput(
  procedures: Procedure[],
  cifpCycleDate: string,
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const sidCount = procedures.filter((p) => p.type === 'SID').length;
  const starCount = procedures.filter((p) => p.type === 'STAR').length;
  const iapCount = procedures.filter((p) => p.type === 'IAP').length;
  const legCount = procedures.reduce((sum, p) => sum + countLegs(p), 0);

  const output: BundledOutput = {
    meta: {
      generatedAt: new Date().toISOString(),
      cifpCycleDate,
      recordCount: procedures.length,
      sidCount,
      starCount,
      iapCount,
      legCount,
    },
    records: procedures,
  };

  const json = JSON.stringify(output);
  const compressed = gzipSync(Buffer.from(json));
  await writeFile(outputPath, compressed);

  const sizeMb = (compressed.length / 1024 / 1024).toFixed(1);
  console.log(
    `[write-output] Wrote ${output.meta.recordCount} procedures (${sidCount} SIDs, ${starCount} STARs, ${iapCount} IAPs, ${legCount} legs) to ${outputPath} (${sizeMb} MB gzipped)`,
  );

  await updateReadmeDate(outputPath, cifpCycleDate);
}
