import { readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

import AdmZip from 'adm-zip';

import { parseNasrArgs, parseCsv } from '@squawk/build-shared';
import type { Fix } from '@squawk/types';

import { buildFix, buildNavaidAssociation } from './parse-fixes.js';
import { writeOutput } from './write-output.js';

/** Subdirectory within a NASR subscription directory containing the CSV data ZIP. */
const CSV_DATA_DIR = 'CSV_Data';

/** CSV files extracted from the NASR data ZIP. */
const FIX_BASE_CSV = 'FIX_BASE.csv';
const FIX_CHRT_CSV = 'FIX_CHRT.csv';
const FIX_NAV_CSV = 'FIX_NAV.csv';

/**
 * Builds a composite key for a fix record from its identifier and ICAO region code.
 */
function fixKey(fixId: string, icaoRegionCode: string): string {
  return `${fixId}|${icaoRegionCode}`;
}

/**
 * Main entry point. Parses CLI arguments, resolves input file paths,
 * runs the data pipeline, and writes the output.
 */
async function main(): Promise<void> {
  const { subscriptionDir, nasrCycleDate, outputPath, cleanup } = parseNasrArgs({
    defaultOutputPath: resolve(
      import.meta.dirname,
      '../../../packages/libs/fix-data/data/fixes.json.gz',
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

    // Parse FIX_BASE records.
    console.log(`[index] Reading ${FIX_BASE_CSV}...`);
    const baseBuffer = csvZip.readFile(FIX_BASE_CSV);
    if (!baseBuffer) {
      throw new Error(`Could not read ${FIX_BASE_CSV} from CSV data ZIP`);
    }
    const baseRecords = parseCsv(baseBuffer.toString('utf-8'));
    console.log(`[index] Parsed ${baseRecords.length} records from ${FIX_BASE_CSV}`);

    // Build Fix objects, excluding CNF (computer navigation fix) records.
    console.log('[index] Building fix records...');
    const fixMap = new Map<string, Fix>();
    let skippedCnf = 0;
    let skippedInvalid = 0;

    for (const rec of baseRecords) {
      const useCode = rec.FIX_USE_CODE?.trim();
      if (useCode === 'CN') {
        skippedCnf++;
        continue;
      }

      const fix = buildFix(rec);
      if (fix) {
        fixMap.set(fixKey(fix.identifier, fix.icaoRegionCode), fix);
      } else {
        skippedInvalid++;
      }
    }

    console.log(
      `[index] Built ${fixMap.size} fix records (skipped ${skippedCnf} CNF, ${skippedInvalid} invalid).`,
    );

    // Enrich with chart types from FIX_CHRT.
    console.log(`[index] Reading ${FIX_CHRT_CSV}...`);
    const chrtBuffer = csvZip.readFile(FIX_CHRT_CSV);
    if (chrtBuffer) {
      const chrtRecords = parseCsv(chrtBuffer.toString('utf-8'));
      console.log(`[index] Parsed ${chrtRecords.length} records from ${FIX_CHRT_CSV}`);

      let chrtMatched = 0;
      for (const rec of chrtRecords) {
        const id = rec.FIX_ID;
        const icao = rec.ICAO_REGION_CODE;
        const chartType = rec.CHARTING_TYPE_DESC?.trim();
        if (!id || !icao || !chartType) {
          continue;
        }

        const fix = fixMap.get(fixKey(id, icao));
        if (fix && !fix.chartTypes.includes(chartType)) {
          fix.chartTypes.push(chartType);
          chrtMatched++;
        }
      }
      console.log(`[index] Added ${chrtMatched} chart type associations.`);
    } else {
      console.log(`[index] Warning: ${FIX_CHRT_CSV} not found in ZIP, skipping chart enrichment.`);
    }

    // Enrich with navaid associations from FIX_NAV.
    console.log(`[index] Reading ${FIX_NAV_CSV}...`);
    const navBuffer = csvZip.readFile(FIX_NAV_CSV);
    if (navBuffer) {
      const navRecords = parseCsv(navBuffer.toString('utf-8'));
      console.log(`[index] Parsed ${navRecords.length} records from ${FIX_NAV_CSV}`);

      let navMatched = 0;
      for (const rec of navRecords) {
        const id = rec.FIX_ID;
        const icao = rec.ICAO_REGION_CODE;
        if (!id || !icao) {
          continue;
        }

        const fix = fixMap.get(fixKey(id, icao));
        if (!fix) {
          continue;
        }

        const assoc = buildNavaidAssociation(rec);
        if (assoc) {
          fix.navaidAssociations.push(assoc);
          navMatched++;
        }
      }
      console.log(`[index] Added ${navMatched} navaid associations.`);
    } else {
      console.log(`[index] Warning: ${FIX_NAV_CSV} not found in ZIP, skipping navaid enrichment.`);
    }

    const fixes = Array.from(fixMap.values());
    await writeOutput(fixes, nasrCycleDate, outputPath);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
