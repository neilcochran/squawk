import { readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import AdmZip from 'adm-zip';
import { parseCsv } from './parse-csv.js';
import { buildNavaid } from './parse-navaids.js';
import { writeOutput } from './write-output.js';
import type { Navaid } from '@squawk/types';

/** Relative path from the script root to the default output file. */
const DEFAULT_OUTPUT_PATH = '../../../packages/navaid-data/data/navaids.json.gz';

/** Pattern used to extract the NASR cycle date from a subscription directory name. */
const CYCLE_DATE_PATTERN = /28DaySubscription_Effective_(\d{4}-\d{2}-\d{2})/;

/** Subdirectory within a NASR subscription directory containing the CSV data ZIP. */
const CSV_DATA_DIR = 'CSV_Data';

/** CSV file extracted from the NASR data ZIP. */
const NAV_BASE_CSV = 'NAV_BASE.csv';

/**
 * Prints usage instructions to stderr and exits with code 1.
 */
function printUsageAndExit(): never {
  process.stderr.write(
    'Usage: node dist/index.js --local <nasr-subscription-dir> [--output <output-path>]\n\n' +
      'Options:\n' +
      '  --local <path>   Path to an extracted NASR subscription directory.\n' +
      '  --output <path>  Path to write the output .json.gz file.\n' +
      `                   Defaults to: ${DEFAULT_OUTPUT_PATH}\n`,
  );
  process.exit(1);
}

/**
 * Main entry point. Parses CLI arguments, resolves input file paths,
 * runs the data pipeline, and writes the output.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let subscriptionDir: string | undefined;
  let outputPath: string = resolve(import.meta.dirname, DEFAULT_OUTPUT_PATH);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--local' && next) {
      subscriptionDir = resolve(next);
      i++;
    } else if (arg === '--output' && next) {
      outputPath = resolve(next);
      i++;
    } else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      printUsageAndExit();
    }
  }

  if (!subscriptionDir) {
    process.stderr.write('Error: --local <path> is required.\n');
    printUsageAndExit();
  }

  // Extract NASR cycle date from the subscription directory name.
  const dirName = basename(subscriptionDir);
  const cycleMatch = dirName.match(CYCLE_DATE_PATTERN);
  if (!cycleMatch) {
    throw new Error(
      `Cannot determine NASR cycle date from directory name "${dirName}". ` +
        `Expected pattern: 28DaySubscription_Effective_YYYY-MM-DD`,
    );
  }
  const nasrCycleDate = cycleMatch[1] ?? '';
  console.log(`[index] NASR cycle date: ${nasrCycleDate}`);

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
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
