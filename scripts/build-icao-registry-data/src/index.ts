import { writeFile, unlink } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseFaaRegistryZip } from '@squawk/icao-registry';
import { writeOutput } from './write-output.js';

/** Direct download URL for the FAA ReleasableAircraft database. */
const FAA_DOWNLOAD_URL = 'https://registry.faa.gov/database/ReleasableAircraft.zip';

/** Relative path from the script root to the default output file. */
const DEFAULT_OUTPUT_PATH = '../../../packages/icao-registry-data/data/icao-registry.json.gz';

/**
 * Prints usage instructions to stderr and exits with code 1.
 */
function printUsageAndExit(): never {
  process.stderr.write(
    'Usage: node dist/index.js (--fetch | --local <path-to-zip>) [--output <output-path>]\n\n' +
      'Options:\n' +
      '  --fetch           Download the latest ReleasableAircraft.zip from the FAA.\n' +
      '  --local <path>    Path to an already-downloaded ReleasableAircraft.zip.\n' +
      '  --output <path>   Path to write the output .json.gz file.\n' +
      `                    Defaults to: ${DEFAULT_OUTPUT_PATH}\n`,
  );
  process.exit(1);
}

/**
 * Downloads the FAA ReleasableAircraft.zip to a temporary file.
 * Returns the absolute path to the downloaded file. The caller is
 * responsible for deleting the temp file when done.
 */
async function downloadFaaZip(): Promise<string> {
  console.log(`[index] Downloading ${FAA_DOWNLOAD_URL}...`);
  const response = await fetch(FAA_DOWNLOAD_URL);
  if (!response.ok) {
    throw new Error(`FAA download failed: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const tempPath = join(tmpdir(), `releasable-aircraft-${randomUUID()}.zip`);
  await writeFile(tempPath, buffer);
  console.log(`[index] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB to ${tempPath}`);
  return tempPath;
}

/**
 * Main entry point. Parses CLI arguments, resolves input, runs the
 * data pipeline, and writes the output.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let mode: 'fetch' | 'local' | undefined;
  let localPath: string | undefined;
  let outputPath: string = resolve(import.meta.dirname, DEFAULT_OUTPUT_PATH);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--fetch') {
      mode = 'fetch';
    } else if (arg === '--local' && next) {
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

  if (!mode) {
    process.stderr.write('Error: either --fetch or --local <path> is required.\n');
    printUsageAndExit();
  }

  let zipPath: string;
  let tempZipPath: string | undefined;

  if (mode === 'fetch') {
    zipPath = await downloadFaaZip();
    tempZipPath = zipPath;
  } else {
    if (!localPath) {
      process.stderr.write('Error: --local requires a path argument.\n');
      printUsageAndExit();
    }
    zipPath = localPath;
  }

  try {
    console.log(`[index] Parsing ${zipPath}...`);
    const zipBuffer = readFileSync(zipPath);
    const records = parseFaaRegistryZip(Buffer.from(zipBuffer));
    console.log(`[index] Parsed ${records.length} records.`);

    await writeOutput(records, outputPath);
  } finally {
    if (tempZipPath) {
      await unlink(tempZipPath).catch(() => undefined);
    }
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
