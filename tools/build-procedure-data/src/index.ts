import { resolve } from 'node:path';
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
 * Prints usage instructions to stderr and exits with code 1.
 */
function printUsageAndExit(): never {
  process.stderr.write(
    'Usage: node dist/index.js (--cifp-fetch | --cifp-local <path>) [--output <path>]\n\n' +
      'Options:\n' +
      '  --cifp-fetch       Download and build from the latest FAA CIFP release.\n' +
      '  --cifp-local <p>   Path to a CIFP zip file or an extracted FAACIFP18 file.\n' +
      '  --output <path>    Path to write the output .json.gz file.\n' +
      `                     Defaults to: ${DEFAULT_OUTPUT_PATH}\n`,
  );
  process.exit(1);
}

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
  const args = process.argv.slice(2);

  let mode: 'fetch' | 'local' | undefined;
  let localPath: string | undefined;
  let outputPath: string = resolve(import.meta.dirname, DEFAULT_OUTPUT_PATH);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--cifp-fetch') {
      mode = 'fetch';
    } else if (arg === '--cifp-local' && next) {
      mode = 'local';
      localPath = resolve(next);
      i++;
    } else if (arg === '--output' && next) {
      outputPath = resolve(next);
      i++;
    } else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      printUsageAndExit();
    }
  }

  if (mode === undefined) {
    process.stderr.write('Error: either --cifp-fetch or --cifp-local <path> is required.\n');
    printUsageAndExit();
  }

  let loaded: LoadedCifp;
  if (mode === 'fetch') {
    const filename = await fetchLatestCifpFilename();
    loaded = await fetchCifp(filename);
  } else {
    if (localPath === undefined) {
      process.stderr.write('Error: --cifp-local requires a path argument.\n');
      printUsageAndExit();
    }
    console.log(`[parse] Reading CIFP from ${localPath}...`);
    loaded = loadCifpFromPath(localPath);
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
  process.exit(1);
});
