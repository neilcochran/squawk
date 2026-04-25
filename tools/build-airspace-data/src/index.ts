import { writeFile, unlink } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { parseNasrArgs } from '@squawk/build-shared';
import { loadAirportStates } from './load-airport-states.js';
import { parseArtcc } from './parse-artcc.js';
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

/** Name of the ARB_BASE.csv file inside the CSV data ZIP. */
const ARB_BASE_CSV = 'ARB_BASE.csv';

/** Name of the ARB_SEG.csv file inside the CSV data ZIP. */
const ARB_SEG_CSV = 'ARB_SEG.csv';

/**
 * Locates the inner CSV ZIP within the NASR subscription directory and
 * returns an `AdmZip` handle to it. The CSV directory contains a single
 * cycle-dated ZIP (e.g. `16_Apr_2026_CSV.zip`) holding all CSV files.
 */
function openCsvZip(subscriptionDir: string): AdmZip {
  const csvDataDir = join(subscriptionDir, CSV_DATA_DIR);
  const entries = readdirSync(csvDataDir).filter((f) => f.endsWith('.zip'));
  const firstEntry = entries[0];
  if (!firstEntry) {
    throw new Error(`No ZIP file found in ${csvDataDir}`);
  }
  return new AdmZip(join(csvDataDir, firstEntry));
}

/**
 * Extracts a single named CSV file from the inner NASR CSV ZIP and writes
 * it to a temp file. Returns the absolute path to the written temp file.
 * The caller is responsible for deleting the temp file when done.
 */
async function extractCsvToTemp(csvZip: AdmZip, csvName: string): Promise<string> {
  const csvBuffer = csvZip.readFile(csvName);
  if (!csvBuffer) {
    throw new Error(`Could not read ${csvName} from CSV ZIP`);
  }
  const tempPath = join(tmpdir(), `${basename(csvName, '.csv')}-${randomUUID()}.csv`);
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

    const csvZip = openCsvZip(subscriptionDir);
    const tempPaths: string[] = [];
    try {
      console.log(`[index] Extracting ${APT_BASE_CSV}, ${ARB_BASE_CSV}, ${ARB_SEG_CSV}...`);
      const aptBaseCsvPath = await extractCsvToTemp(csvZip, APT_BASE_CSV);
      tempPaths.push(aptBaseCsvPath);
      const arbBaseCsvPath = await extractCsvToTemp(csvZip, ARB_BASE_CSV);
      tempPaths.push(arbBaseCsvPath);
      const arbSegCsvPath = await extractCsvToTemp(csvZip, ARB_SEG_CSV);
      tempPaths.push(arbSegCsvPath);

      console.log('[index] Loading airport states...');
      const airportStates = await loadAirportStates(aptBaseCsvPath);
      console.log(`[index] Loaded ${airportStates.size} airport state entries.`);

      console.log('[index] Parsing Class B/C/D/E airspace...');
      const classFeatures = await parseClassAirspace(shpPath, airportStates);
      console.log(`[index] Parsed ${classFeatures.length} Class B/C/D/E features.`);

      console.log('[index] Parsing SUA airspace...');
      const suaFeatures = parseSua(saaZipPath);
      console.log(`[index] Parsed ${suaFeatures.length} SUA features.`);

      console.log('[index] Parsing ARTCC airspace...');
      const artccFeatures = await parseArtcc(arbBaseCsvPath, arbSegCsvPath);
      console.log(`[index] Parsed ${artccFeatures.length} ARTCC features.`);

      const allFeatures = [...classFeatures, ...suaFeatures, ...artccFeatures];
      console.log(`[index] Total features: ${allFeatures.length}`);

      await writeOutput(allFeatures, outputPath, nasrCycleDate);
    } finally {
      await Promise.all(tempPaths.map((p) => unlink(p).catch(() => undefined)));
    }
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
