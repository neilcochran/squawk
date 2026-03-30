import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { loadAirportStates } from './load-airport-states.js';
import { parseClassAirspace } from './parse-class-airspace.js';
import { parseSua } from './parse-sua.js';
import { writeOutput } from './write-output.js';

/** Relative path from the script root to the default output file. */
const DEFAULT_OUTPUT_PATH = '../../../packages/airspace-data/data/airspace.geojson';

/** Pattern used to extract the NASR cycle date from a subscription directory name. */
const CYCLE_DATE_PATTERN = /28DaySubscription_Effective_(\d{4}-\d{2}-\d{2})/;

/** Relative path within a NASR subscription directory to the Class_Airspace shapefile. */
const CLASS_AIRSPACE_SHP = 'Additional_Data/Shape_Files/Class_Airspace.shp';

/** Relative path within a NASR subscription directory to the SAA AIXM ZIP. */
const SAA_ZIP_PATH = 'Additional_Data/AIXM/SAA-AIXM_5_Schema/SaaSubscriberFile.zip';

/** Subdirectory within a NASR subscription directory containing the CSV data ZIP. */
const CSV_DATA_DIR = 'CSV_Data';

/** Name of the APT_BASE.csv file inside the CSV data ZIP. */
const APT_BASE_CSV = 'APT_BASE.csv';

/**
 * Prints usage instructions to stderr and exits with code 1.
 */
function printUsageAndExit(): never {
  process.stderr.write(
    'Usage: node dist/index.js --local <nasr-subscription-dir> [--output <output-path>]\n\n' +
      'Options:\n' +
      '  --local <path>   Path to an extracted NASR subscription directory.\n' +
      '  --output <path>  Path to write the output GeoJSON file.\n' +
      `                   Defaults to: ${DEFAULT_OUTPUT_PATH}\n`,
  );
  process.exit(1);
}

/**
 * Extracts APT_BASE.csv from the NASR CSV data ZIP and writes it to a temp
 * file. The caller is responsible for deleting the temp file when done.
 * Returns the absolute path to the written temp file.
 */
async function extractAptBaseCsv(subscriptionDir: string): Promise<string> {
  const csvDataDir = join(subscriptionDir, CSV_DATA_DIR);

  // The CSV data ZIP is named after the cycle date (e.g. "22_Jan_2026_CSV.zip").
  // Use a glob-style search by listing the directory via adm-zip to avoid
  // hardcoding the filename.
  const { readdirSync } = await import('node:fs');
  const entries = readdirSync(csvDataDir).filter((f) => f.endsWith('.zip'));
  const firstEntry = entries[0];
  if (!firstEntry) {
    throw new Error(`No ZIP file found in ${csvDataDir}`);
  }

  const csvZipPath = join(csvDataDir, firstEntry);
  console.log(`[index] Extracting ${APT_BASE_CSV} from ${basename(csvZipPath)}`);

  const csvZip = new AdmZip(csvZipPath);
  const csvBuffer = csvZip.readFile(APT_BASE_CSV);
  if (!csvBuffer) {
    throw new Error(`Could not read ${APT_BASE_CSV} from ${csvZipPath}`);
  }

  const tempPath = join(tmpdir(), `apt-base-${randomUUID()}.csv`);
  await writeFile(tempPath, csvBuffer);
  return tempPath;
}

/**
 * Main entry point. Parses CLI arguments, resolves input file paths,
 * runs the data pipeline, and writes the output GeoJSON.
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

  const shpPath = join(subscriptionDir, CLASS_AIRSPACE_SHP);
  const saaZipPath = join(subscriptionDir, SAA_ZIP_PATH);

  // Extract APT_BASE.csv from the nested CSV ZIP to a temp file.
  let tempCsvPath: string | undefined;
  try {
    tempCsvPath = await extractAptBaseCsv(subscriptionDir);

    console.log('[index] Loading airport states...');
    const airportStates = await loadAirportStates(tempCsvPath);
    console.log(`[index] Loaded ${airportStates.size} airport state entries.`);

    console.log('[index] Parsing Class B/C/D airspace...');
    const classFeatures = await parseClassAirspace(shpPath, airportStates);
    console.log(`[index] Parsed ${classFeatures.length} Class B/C/D features.`);

    console.log('[index] Parsing SUA airspace...');
    const suaFeatures = parseSua(saaZipPath);
    console.log(`[index] Parsed ${suaFeatures.length} SUA features.`);

    const allFeatures = [...classFeatures, ...suaFeatures];
    console.log(`[index] Total features: ${allFeatures.length}`);

    await writeOutput(allFeatures, outputPath, nasrCycleDate);
  } finally {
    if (tempCsvPath) {
      await unlink(tempCsvPath).catch(() => undefined);
    }
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
