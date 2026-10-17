import { readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

import AdmZip from 'adm-zip';

import { parseNasrArgs, parseCsv } from '@squawk/build-shared';
import type { Navaid } from '@squawk/types';

import {
  attachNavaidCheckpoints,
  attachNavaidRemarks,
  buildNavaid,
  navaidKey,
} from './parse-navaids.js';
import { writeOutput } from './write-output.js';

/** Subdirectory within a NASR subscription directory containing the CSV data ZIP. */
const CSV_DATA_DIR = 'CSV_Data';

/** CSV files extracted from the NASR data ZIP. */
const NAV_BASE_CSV = 'NAV_BASE.csv';
const NAV_RMK_CSV = 'NAV_RMK.csv';
const NAV_CKPT_CSV = 'NAV_CKPT.csv';

/**
 * Main entry point. Parses CLI arguments, resolves input file paths,
 * runs the data pipeline, and writes the output.
 */
async function main(): Promise<void> {
  const parsed = parseNasrArgs({
    argv: process.argv.slice(2),
    defaultOutputPath: resolve(
      import.meta.dirname,
      '../../../packages/libs/navaid-data/data/navaids.json.gz',
    ),
  });
  if ('message' in parsed) {
    process.stderr.write(parsed.message);
    process.exitCode = 1;
    return;
  }
  const { subscriptionDir, nasrCycleDate, outputPath, cleanup } = parsed;

  try {
    // Locate and open the CSV data ZIP.
    const csvDataDir = join(subscriptionDir, CSV_DATA_DIR);
    const zipFiles = readdirSync(csvDataDir).filter((f) => f.endsWith('.zip'));
    const firstZip = zipFiles[0];
    if (!firstZip) {
      throw new Error(`No ZIP file found in ${csvDataDir}`);
    }
    const csvZipPath = join(csvDataDir, firstZip);
    console.log(`[index] Opening ${basename(csvZipPath)}`);
    const csvZip = new AdmZip(csvZipPath);

    // Parse the NAV_BASE CSV file from the ZIP.
    console.log(`[index] Reading ${NAV_BASE_CSV}...`);
    const buffer = csvZip.readFile(NAV_BASE_CSV);
    if (!buffer) {
      throw new Error(`Could not read ${NAV_BASE_CSV} from CSV data ZIP`);
    }
    const baseRecords = parseCsv(buffer.toString('utf-8'));
    console.log(`[index] Parsed ${baseRecords.length} records from ${NAV_BASE_CSV}`);

    // Build Navaid objects, excluding shutdown facilities.
    console.log('[index] Building navaid records...');
    const navaids: Navaid[] = [];
    const navaidsByKey = new Map<string, Navaid>();
    let skipped = 0;

    for (const rec of baseRecords) {
      if (rec.NAV_STATUS === 'SHUTDOWN') {
        skipped++;
        continue;
      }

      const navaid = buildNavaid(rec);
      const key = navaidKey(rec);
      if (navaid && key !== undefined) {
        navaids.push(navaid);
        navaidsByKey.set(key, navaid);
      } else {
        skipped++;
      }
    }

    console.log(`[index] Built ${navaids.length} navaid records (skipped ${skipped}).`);

    // Attach remarks from NAV_RMK.
    console.log(`[index] Reading ${NAV_RMK_CSV}...`);
    const rmkBuffer = csvZip.readFile(NAV_RMK_CSV);
    if (rmkBuffer) {
      const rmkRecords = parseCsv(rmkBuffer.toString('utf-8'));
      const attached = attachNavaidRemarks(navaidsByKey, rmkRecords);
      console.log(
        `[index] Parsed ${rmkRecords.length} records from ${NAV_RMK_CSV}; attached ${attached} remarks.`,
      );
    } else {
      console.log(`[index] Warning: ${NAV_RMK_CSV} not found in ZIP, skipping remarks.`);
    }

    // Attach VOR receiver checkpoints from NAV_CKPT.
    console.log(`[index] Reading ${NAV_CKPT_CSV}...`);
    const ckptBuffer = csvZip.readFile(NAV_CKPT_CSV);
    if (ckptBuffer) {
      const ckptRecords = parseCsv(ckptBuffer.toString('utf-8'));
      const attached = attachNavaidCheckpoints(navaidsByKey, ckptRecords);
      console.log(
        `[index] Parsed ${ckptRecords.length} records from ${NAV_CKPT_CSV}; attached ${attached} checkpoints.`,
      );
    } else {
      console.log(`[index] Warning: ${NAV_CKPT_CSV} not found in ZIP, skipping checkpoints.`);
    }

    await writeOutput(navaids, nasrCycleDate, outputPath);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  // eslint-disable-next-line n/no-process-exit -- last-resort fatal handler; exiting guarantees a non-zero status even when a pending download or file handle would otherwise hold the process open.
  process.exit(1);
});
