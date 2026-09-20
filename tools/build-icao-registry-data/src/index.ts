import { readFileSync } from 'node:fs';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { parseFaaRegistryZip } from '@squawk/icao-registry';

import { parseCliArgs } from './cli-args.js';
import { writeOutput } from './write-output.js';

/** Direct download URL for the FAA ReleasableAircraft database. */
const FAA_DOWNLOAD_URL = 'https://registry.faa.gov/database/ReleasableAircraft.zip';

/**
 * User-Agent header sent on the FAA download request. The Akamai WAF
 * fronting `registry.faa.gov` rejects Node's default `node`/`undici`
 * UA (and curl, wget, and descriptive bot UAs) with HTTP 403. A
 * generic browser UA is the only thing that gets through.
 */
const FAA_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Relative path from the script root to the default output file. */
const DEFAULT_OUTPUT_PATH = '../../../packages/libs/icao-registry-data/data/icao-registry.json.gz';

/**
 * Downloads the FAA ReleasableAircraft.zip into a private temporary
 * directory. Returns the absolute path to the downloaded file along
 * with the parent temp directory. The caller is responsible for
 * removing the temp directory when done.
 */
async function downloadFaaZip(): Promise<{ zipPath: string; tempDir: string }> {
  console.log(`[index] Downloading ${FAA_DOWNLOAD_URL}...`);
  const response = await fetch(FAA_DOWNLOAD_URL, {
    headers: { 'User-Agent': FAA_USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`FAA download failed: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const tempDir = await mkdtemp(join(tmpdir(), 'releasable-aircraft-'));
  const zipPath = join(tempDir, 'ReleasableAircraft.zip');
  await writeFile(zipPath, buffer);
  console.log(`[index] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB to ${zipPath}`);
  return { zipPath, tempDir };
}

/**
 * Main entry point. Parses CLI arguments, resolves input, runs the
 * data pipeline, and writes the output.
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

  let zipPath: string;
  let tempDir: string | undefined;

  if (parsed.mode === 'fetch') {
    const downloaded = await downloadFaaZip();
    zipPath = downloaded.zipPath;
    tempDir = downloaded.tempDir;
  } else {
    zipPath = parsed.localPath;
  }

  try {
    console.log(`[index] Parsing ${zipPath}...`);
    const zipBuffer = readFileSync(zipPath);
    const records = parseFaaRegistryZip(Buffer.from(zipBuffer));
    console.log(`[index] Parsed ${records.length} records.`);

    await writeOutput(records, outputPath);
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  // eslint-disable-next-line n/no-process-exit -- last-resort fatal handler; exiting guarantees a non-zero status even when a pending download or file handle would otherwise hold the process open.
  process.exit(1);
});
