import { readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import AdmZip from 'adm-zip';
import { parseNasrArgs, parseCsv } from '@squawk/build-shared';
import { buildNavaid } from './parse-navaids.js';
import { writeOutput } from './write-output.js';
import type { Navaid } from '@squawk/types';

/** Subdirectory within a NASR subscription directory containing the CSV data ZIP. */
const CSV_DATA_DIR = 'CSV_Data';

/** CSV file extracted from the NASR data ZIP. */
const NAV_BASE_CSV = 'NAV_BASE.csv';

/**
 * Main entry point. Parses CLI arguments, resolves input file paths,
 * runs the data pipeline, and writes the output.
 */
async function main(): Promise<void> {
  const { subscriptionDir, nasrCycleDate, outputPath, cleanup } = parseNasrArgs({
    defaultOutputPath: resolve(
      import.meta.dirname,
      '../../../packages/navaid-data/data/navaids.json.gz',
    ),
  });

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
    let skipped = 0;

    for (const rec of baseRecords) {
      if (rec.NAV_STATUS === 'SHUTDOWN') {
        skipped++;
        continue;
      }

      const navaid = buildNavaid(rec);
      if (navaid) {
        navaids.push(navaid);
      } else {
        skipped++;
      }
    }

    console.log(`[index] Built ${navaids.length} navaid records (skipped ${skipped}).`);

    await writeOutput(navaids, nasrCycleDate, outputPath);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
