import { readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import AdmZip from 'adm-zip';
import { parseCsv } from './parse-csv.js';
import type { CsvRecord } from './parse-csv.js';
import { buildAirport } from './parse-airports.js';
import { resolveInput } from './resolve-input.js';
import { writeOutput } from './write-output.js';
import type { Airport } from '@squawk/types';

/** Relative path from the script root to the default output file. */
const DEFAULT_OUTPUT_PATH = '../../../packages/airport-data/data/airports.json.gz';

/** Pattern used to extract the NASR cycle date from a subscription directory name. */
const CYCLE_DATE_PATTERN = /28DaySubscription_Effective_(\d{4}-\d{2}-\d{2})/;

/** Subdirectory within a NASR subscription directory containing the CSV data ZIP. */
const CSV_DATA_DIR = 'CSV_Data';

/** CSV files extracted from the NASR data ZIP. */
const APT_BASE_CSV = 'APT_BASE.csv';
const APT_RWY_CSV = 'APT_RWY.csv';
const APT_RWY_END_CSV = 'APT_RWY_END.csv';
const FRQ_CSV = 'FRQ.csv';
const ILS_BASE_CSV = 'ILS_BASE.csv';
const ILS_GS_CSV = 'ILS_GS.csv';
const ILS_DME_CSV = 'ILS_DME.csv';

/**
 * Prints usage instructions to stderr and exits with code 1.
 */
function printUsageAndExit(): never {
  process.stderr.write(
    'Usage: node dist/index.js --local <nasr-subscription-dir> [--output <output-path>]\n\n' +
      'Options:\n' +
      '  --local <path>   Path to a NASR subscription .zip file or extracted directory.\n' +
      '  --output <path>  Path to write the output .json.gz file.\n' +
      `                   Defaults to: ${DEFAULT_OUTPUT_PATH}\n`,
  );
  process.exit(1);
}

/**
 * Reads a CSV file from inside the NASR CSV data ZIP and parses it into records.
 *
 * @param zip - The opened AdmZip instance for the CSV data ZIP.
 * @param filename - Name of the CSV file to extract and parse.
 * @returns Array of parsed CSV records.
 */
function readCsvFromZip(zip: AdmZip, filename: string): CsvRecord[] {
  console.log(`[index] Reading ${filename}...`);
  const buffer = zip.readFile(filename);
  if (!buffer) {
    throw new Error(`Could not read ${filename} from CSV data ZIP`);
  }
  const records = parseCsv(buffer.toString('utf-8'));
  console.log(`[index] Parsed ${records.length} records from ${filename}`);
  return records;
}

/**
 * Main entry point. Parses CLI arguments, resolves input file paths,
 * runs the data pipeline, and writes the output.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let inputPath: string | undefined;
  let outputPath: string = resolve(import.meta.dirname, DEFAULT_OUTPUT_PATH);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--local' && next) {
      inputPath = resolve(next);
      i++;
    } else if (arg === '--output' && next) {
      outputPath = resolve(next);
      i++;
    } else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      printUsageAndExit();
    }
  }

  if (!inputPath) {
    process.stderr.write('Error: --local <path> is required.\n');
    printUsageAndExit();
  }

  const { subscriptionDir, cleanup } = resolveInput(inputPath);

  try {
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

    // Parse all CSV files from the ZIP.
    const baseRecords = readCsvFromZip(csvZip, APT_BASE_CSV);
    const rwyRecords = readCsvFromZip(csvZip, APT_RWY_CSV);
    const rwyEndRecords = readCsvFromZip(csvZip, APT_RWY_END_CSV);
    const freqRecords = readCsvFromZip(csvZip, FRQ_CSV);
    const ilsBaseRecords = readCsvFromZip(csvZip, ILS_BASE_CSV);
    const ilsGsRecords = readCsvFromZip(csvZip, ILS_GS_CSV);
    const ilsDmeRecords = readCsvFromZip(csvZip, ILS_DME_CSV);

    // Index runway and runway-end records by SITE_NO for efficient lookup.
    const rwyBySite = new Map<string, CsvRecord[]>();
    for (const rec of rwyRecords) {
      const siteNo = rec.SITE_NO;
      if (siteNo) {
        let arr = rwyBySite.get(siteNo);
        if (!arr) {
          arr = [];
          rwyBySite.set(siteNo, arr);
        }
        arr.push(rec);
      }
    }

    const rwyEndBySite = new Map<string, CsvRecord[]>();
    for (const rec of rwyEndRecords) {
      const siteNo = rec.SITE_NO;
      if (siteNo) {
        let arr = rwyEndBySite.get(siteNo);
        if (!arr) {
          arr = [];
          rwyEndBySite.set(siteNo, arr);
        }
        arr.push(rec);
      }
    }

    // Index frequency records by SERVICED_FACILITY (falls back to FACILITY).
    const freqByFacility = new Map<string, CsvRecord[]>();
    for (const rec of freqRecords) {
      const key = rec.SERVICED_FACILITY ?? rec.FACILITY;
      if (key) {
        let arr = freqByFacility.get(key);
        if (!arr) {
          arr = [];
          freqByFacility.set(key, arr);
        }
        arr.push(rec);
      }
    }

    // Index ILS records by SITE_NO for efficient lookup.
    const ilsBaseBySite = new Map<string, CsvRecord[]>();
    for (const rec of ilsBaseRecords) {
      const siteNo = rec.SITE_NO;
      if (siteNo) {
        let arr = ilsBaseBySite.get(siteNo);
        if (!arr) {
          arr = [];
          ilsBaseBySite.set(siteNo, arr);
        }
        arr.push(rec);
      }
    }

    const ilsGsBySite = new Map<string, CsvRecord[]>();
    for (const rec of ilsGsRecords) {
      const siteNo = rec.SITE_NO;
      if (siteNo) {
        let arr = ilsGsBySite.get(siteNo);
        if (!arr) {
          arr = [];
          ilsGsBySite.set(siteNo, arr);
        }
        arr.push(rec);
      }
    }

    const ilsDmeBySite = new Map<string, CsvRecord[]>();
    for (const rec of ilsDmeRecords) {
      const siteNo = rec.SITE_NO;
      if (siteNo) {
        let arr = ilsDmeBySite.get(siteNo);
        if (!arr) {
          arr = [];
          ilsDmeBySite.set(siteNo, arr);
        }
        arr.push(rec);
      }
    }

    // Build Airport objects from the indexed data.
    console.log('[index] Building airport records...');
    const airports: Airport[] = [];
    let skipped = 0;

    for (const base of baseRecords) {
      // Only include open facilities.
      if ((base.ARPT_STATUS ?? '') !== 'O') {
        skipped++;
        continue;
      }

      const siteNo = base.SITE_NO ?? '';
      const faaId = base.ARPT_ID ?? '';
      const siteRwys = rwyBySite.get(siteNo) ?? [];
      const siteRwyEnds = rwyEndBySite.get(siteNo) ?? [];
      const siteFreqs = freqByFacility.get(faaId) ?? [];
      const siteIlsBase = ilsBaseBySite.get(siteNo) ?? [];
      const siteIlsGs = ilsGsBySite.get(siteNo) ?? [];
      const siteIlsDme = ilsDmeBySite.get(siteNo) ?? [];

      const airport = buildAirport(
        base,
        siteRwys,
        siteRwyEnds,
        siteFreqs,
        siteIlsBase,
        siteIlsGs,
        siteIlsDme,
      );
      if (airport) {
        airports.push(airport);
      } else {
        skipped++;
      }
    }

    console.log(`[index] Built ${airports.length} airport records (skipped ${skipped}).`);

    await writeOutput(airports, nasrCycleDate, outputPath);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
