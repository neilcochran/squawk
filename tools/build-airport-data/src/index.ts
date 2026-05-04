import { readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

import AdmZip from 'adm-zip';

import { parseNasrArgs, parseCsv } from '@squawk/build-shared';
import type { CsvRecord } from '@squawk/build-shared';
import type { Airport } from '@squawk/types';

import { buildAirport } from './parse-airports.js';
import { writeOutput } from './write-output.js';

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
 * Groups records into buckets keyed by the value returned from `keyFn`.
 * Records whose key is missing or empty are skipped.
 *
 * @param records - The records to group.
 * @param keyFn - Returns the bucket key for a given record, or `undefined` to skip it.
 * @returns A map from key to the records that share that key, in input order.
 */
function groupBy<T>(records: T[], keyFn: (record: T) => string | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const record of records) {
    const key = keyFn(record);
    if (!key) {
      continue;
    }
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    arr.push(record);
  }
  return map;
}

/**
 * Main entry point. Parses CLI arguments, resolves input file paths,
 * runs the data pipeline, and writes the output.
 */
async function main(): Promise<void> {
  const { subscriptionDir, nasrCycleDate, outputPath, cleanup } = parseNasrArgs({
    defaultOutputPath: resolve(
      import.meta.dirname,
      '../../../packages/libs/airport-data/data/airports.json.gz',
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

    // Parse all CSV files from the ZIP.
    const baseRecords = readCsvFromZip(csvZip, APT_BASE_CSV);
    const rwyRecords = readCsvFromZip(csvZip, APT_RWY_CSV);
    const rwyEndRecords = readCsvFromZip(csvZip, APT_RWY_END_CSV);
    const freqRecords = readCsvFromZip(csvZip, FRQ_CSV);
    const ilsBaseRecords = readCsvFromZip(csvZip, ILS_BASE_CSV);
    const ilsGsRecords = readCsvFromZip(csvZip, ILS_GS_CSV);
    const ilsDmeRecords = readCsvFromZip(csvZip, ILS_DME_CSV);

    const rwyBySite = groupBy(rwyRecords, (r) => r.SITE_NO);
    const rwyEndBySite = groupBy(rwyEndRecords, (r) => r.SITE_NO);

    const freqByFacility = groupBy(freqRecords, (r) => r.SERVICED_FACILITY ?? r.FACILITY);

    const ilsBaseBySite = groupBy(ilsBaseRecords, (r) => r.SITE_NO);
    const ilsGsBySite = groupBy(ilsGsRecords, (r) => r.SITE_NO);
    const ilsDmeBySite = groupBy(ilsDmeRecords, (r) => r.SITE_NO);

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
