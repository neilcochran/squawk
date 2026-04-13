import { writeFile, unlink } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { parseNasrArgs } from '@squawk/build-shared';
import { loadAirportStates } from './load-airport-states.js';
import { parseClassAirspace } from './parse-class-airspace.js';
import { parseSua } from './parse-sua.js';
import { writeOutput } from './write-output.js';

/** Relative path within a NASR subscription directory to the Class_Airspace shapefile. */
const CLASS_AIRSPACE_SHP = 'Additional_Data/Shape_Files/Class_Airspace.shp';

/** Relative path within a NASR subscription directory to the SAA AIXM ZIP. */
const SAA_ZIP_PATH = 'Additional_Data/AIXM/SAA-AIXM_5_Schema/SaaSubscriberFile.zip';

/** Subdirectory within a NASR subscription directory containing the CSV data ZIP. */
const CSV_DATA_DIR = 'CSV_Data';

/** Name of the APT_BASE.csv file inside the CSV data ZIP. */
const APT_BASE_CSV = 'APT_BASE.csv';

/**
 * Extracts APT_BASE.csv from the NASR CSV data ZIP and writes it to a temp
 * file. The caller is responsible for deleting the temp file when done.
 * Returns the absolute path to the written temp file.
 */
async function extractAptBaseCsv(subscriptionDir: string): Promise<string> {
  const csvDataDir = join(subscriptionDir, CSV_DATA_DIR);
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
  const { subscriptionDir, nasrCycleDate, outputPath, cleanup } = parseNasrArgs({
    defaultOutputPath: resolve(
      import.meta.dirname,
      '../../../packages/airspace-data/data/airspace.geojson.gz',
    ),
  });

  try {
    const shpPath = join(subscriptionDir, CLASS_AIRSPACE_SHP);
    const saaZipPath = join(subscriptionDir, SAA_ZIP_PATH);

    // Extract APT_BASE.csv from the nested CSV ZIP to a temp file.
    let tempCsvPath: string | undefined;
    try {
      tempCsvPath = await extractAptBaseCsv(subscriptionDir);

      console.log('[index] Loading airport states...');
      const airportStates = await loadAirportStates(tempCsvPath);
      console.log(`[index] Loaded ${airportStates.size} airport state entries.`);

      console.log('[index] Parsing Class B/C/D/E airspace...');
      const classFeatures = await parseClassAirspace(shpPath, airportStates);
      console.log(`[index] Parsed ${classFeatures.length} Class B/C/D/E features.`);

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
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
