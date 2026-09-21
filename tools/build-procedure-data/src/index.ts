import { resolve } from 'node:path';

import { parseCliArgs } from './cli-args.js';
import { fetchCifp, loadCifpFromPath, type LoadedCifp } from './fetch-cifp.js';
import { parseCifp } from './parse-cifp.js';
import { writeOutput } from './write-output.js';

/**
 * Relative path from the compiled script to the default output gzip
 * file consumed by `@squawk/procedure-data`.
 */
const DEFAULT_OUTPUT_PATH = '../../../packages/libs/procedure-data/data/procedures.json.gz';

/**
 * URL of the FAA's CIFP download landing page. The current cycle's
 * zip filename is embedded in the page body; {@link fetchLatestCifpFilename}
 * scrapes it to determine the `--cifp-fetch` download target.
 */
const CIFP_DOWNLOAD_PAGE_URL =
  'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/cifp/download/';

/**
 * Scrapes the FAA CIFP download page for the most recent release's zip
 * filename (for example `CIFP_260416.zip`). The page lists cycles in a
 * table; the current cycle is the first matching filename.
 */
async function fetchLatestCifpFilename(): Promise<string> {
  console.log(`[fetch] Resolving current CIFP cycle from ${CIFP_DOWNLOAD_PAGE_URL}...`);
  const response = await fetch(CIFP_DOWNLOAD_PAGE_URL);
  if (!response.ok) {
    throw new Error(`Failed to load CIFP download page: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const match = /CIFP_\d{6}\.zip/.exec(html);
  if (match === null) {
    throw new Error('Could not find a CIFP_YYMMDD.zip filename on the FAA download page');
  }
  const filename = match[0];
  console.log(`[fetch] Current CIFP cycle filename: ${filename}`);
  return filename;
}

/**
 * Main entry point. Parses CLI arguments, loads the CIFP dataset,
 * decodes every published procedure, and writes the gzipped output.
 */
async function main(): Promise<void> {
  const parsed = parseCliArgs(
    process.argv.slice(2),
    resolve(import.meta.dirname, DEFAULT_OUTPUT_PATH),
  );
  if ('message' in parsed) {
    process.stderr.write(parsed.message);
    process.exitCode = 1;
    return;
  }
  const { outputPath } = parsed;

  let loaded: LoadedCifp;
  if (parsed.mode === 'fetch') {
    const filename = await fetchLatestCifpFilename();
    loaded = await fetchCifp(filename);
  } else {
    console.log(`[parse] Reading CIFP from ${parsed.localPath}...`);
    loaded = loadCifpFromPath(parsed.localPath);
  }

  try {
    console.log(`[parse] CIFP cycle effective date: ${loaded.cycleDate}`);
    const procedures = parseCifp(loaded.contents);
    const sidCount = procedures.filter((p) => p.type === 'SID').length;
    const starCount = procedures.filter((p) => p.type === 'STAR').length;
    const iapCount = procedures.filter((p) => p.type === 'IAP').length;
    console.log(
      `[parse] Decoded ${procedures.length} procedures (${sidCount} SIDs, ${starCount} STARs, ${iapCount} IAPs).`,
    );
    await writeOutput(procedures, loaded.cycleDate, outputPath);
  } finally {
    await loaded.cleanup();
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  // eslint-disable-next-line n/no-process-exit -- last-resort fatal handler; exiting guarantees a non-zero status even when a pending download or file handle would otherwise hold the process open.
  process.exit(1);
});
