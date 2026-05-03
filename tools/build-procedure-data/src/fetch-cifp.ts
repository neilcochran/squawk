import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';

/**
 * Canonical URL pattern for the FAA's public CIFP zip release. The
 * FAA publishes one release per 28-day cycle; the filename carries
 * a 6-digit `YYMMDD` cycle-effective date. Inside the zip, the main
 * ARINC 424 file is always named `FAACIFP18`.
 *
 * The download page at
 * `https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/cifp/download/`
 * lists the current cycle's filename; the URL is therefore
 * computed from that filename.
 */
const FAA_BASE_URL = 'https://aeronav.faa.gov/Upload_313-d/cifp/';

/**
 * Name of the ARINC 424 data file that lives inside the FAA CIFP zip.
 */
const FAACIFP_FILENAME = 'FAACIFP18';

/**
 * Result of loading the CIFP dataset from a zip or raw ARINC 424 file.
 */
export interface LoadedCifp {
  /** Contents of `FAACIFP18` as a string. */
  contents: string;
  /** Cycle-effective date in ISO `YYYY-MM-DD` format. */
  cycleDate: string;
  /** Basename of the source file (for logging). */
  sourceName: string;
  /** Cleans up any temporary files created during loading. */
  cleanup: () => Promise<void>;
}

/**
 * Downloads the latest CIFP zip from the FAA by filename (for example
 * `CIFP_260416.zip`). The caller resolves the filename separately; this
 * helper downloads and extracts `FAACIFP18` in one step.
 *
 * The downloaded zip is saved into a private temporary directory that
 * is removed by the returned `cleanup` function.
 *
 * @param zipFilename - Filename from the FAA's CIFP download page (e.g. `CIFP_260416.zip`).
 */
export async function fetchCifp(zipFilename: string): Promise<LoadedCifp> {
  const url = `${FAA_BASE_URL}${zipFilename}`;
  console.log(`[fetch] Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FAA download failed: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const tempDir = mkdtempSync(join(tmpdir(), 'cifp-'));
  const tempPath = join(tempDir, zipFilename);
  writeFileSync(tempPath, buffer);
  console.log(`[fetch] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB to ${tempPath}`);
  const loaded = loadFromZip(tempPath);
  return {
    ...loaded,
    sourceName: zipFilename,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}

/**
 * Loads `FAACIFP18` contents from a user-provided path. The path may
 * point at either:
 *
 * 1. A CIFP zip file - the zip is opened in-place and `FAACIFP18` is extracted to memory.
 * 2. The extracted `FAACIFP18` file directly - read as UTF-8 text.
 *
 * In both cases the cycle date is derived from the CIFP header record
 * (first line of `FAACIFP18`) rather than from the filename.
 *
 * @param path - Path to either a CIFP zip or an extracted `FAACIFP18` file.
 */
export function loadCifpFromPath(path: string): LoadedCifp {
  const lower = path.toLowerCase();
  if (lower.endsWith('.zip')) {
    return loadFromZip(path);
  }
  const contents = readFileSync(path, 'utf-8');
  return {
    contents,
    cycleDate: extractCycleDate(contents),
    sourceName: path,
    cleanup: async () => undefined,
  };
}

/**
 * Opens a CIFP zip and extracts the `FAACIFP18` ARINC 424 data file
 * contents as a UTF-8 string. Throws when the zip does not contain a
 * `FAACIFP18` entry.
 */
function loadFromZip(zipPath: string): LoadedCifp {
  console.log(`[fetch] Extracting ${FAACIFP_FILENAME} from ${zipPath}...`);
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry(FAACIFP_FILENAME);
  if (entry === null) {
    throw new Error(`CIFP zip at ${zipPath} does not contain ${FAACIFP_FILENAME}`);
  }
  const contents = entry.getData().toString('utf-8');
  return {
    contents,
    cycleDate: extractCycleDate(contents),
    sourceName: zipPath,
    cleanup: async () => undefined,
  };
}

/**
 * Extracts the AIRAC cycle-effective date from the CIFP header record
 * and formats it as ISO `YYYY-MM-DD`.
 *
 * The header is a fixed-width record starting with `HDR01`. Two date-
 * relevant fields appear in it: a 5-digit AIRAC cycle code (`0YYNN`,
 * leading zero plus 2-digit year and 2-digit cycle-within-year) and a
 * `DD-MON-YYYY` FAA file-publish date. The publish date is typically
 * ~3 weeks before the AIRAC effective date and is NOT what consumers
 * mean by "cycle date". Example:
 *
 * ```text
 * HDR01FAACIFP18      001P013203974102604  25-MAR-202612:51:00  U.S.A. DOT FAA
 * ```
 *
 * Here `02604` (cycle 2604, i.e. 4th cycle of 2026) maps to effective
 * date `2026-04-16`; `25-MAR-2026` is the file publish date.
 *
 * Exported for unit testing; not part of the tool's public interface.
 */
export function extractCycleDate(contents: string): string {
  const firstLine = contents.slice(0, 200);
  const match = /(\d{5})\s+\d{2}-[A-Z]{3}-\d{4}/.exec(firstLine);
  if (match === null || match[1] === undefined) {
    throw new Error('Could not extract AIRAC cycle code from FAACIFP18 header');
  }
  const cycleCode = match[1];
  const yy = Number.parseInt(cycleCode.slice(1, 3), 10);
  const nn = Number.parseInt(cycleCode.slice(3, 5), 10);
  return airacCycleEffectiveDate(yy, nn);
}

/**
 * AIRAC anchor: cycle 2401 was effective 2024-01-25 (UTC midnight).
 * All other supported cycles are computed by adding 28-day multiples.
 */
const AIRAC_ANCHOR_MS = Date.UTC(2024, 0, 25);

/**
 * One AIRAC cycle in milliseconds (28 days).
 */
const AIRAC_CYCLE_MS = 28 * 24 * 60 * 60 * 1000;

/**
 * Lowest 2-digit year supported by the AIRAC formula. Year 2024 is the
 * fixed anchor.
 */
const AIRAC_MIN_YEAR_YY = 24;

/**
 * Highest 2-digit year supported by the AIRAC formula. Year 2058 has
 * 14 cycles instead of 13, breaking the simple `(yy - 24) * 13` math;
 * the upper bound is therefore the last all-13-cycle year before that.
 */
const AIRAC_MAX_YEAR_YY = 57;

/**
 * Maps an AIRAC cycle (year YY + cycle-within-year NN) to its effective
 * date in ISO `YYYY-MM-DD`. AIRAC cycles are 28 days; cycle 2401 was
 * effective 2024-01-25 and every year from 2024 through 2057 has
 * exactly 13 cycles, so the linear formula holds.
 *
 * @param yy - 2-digit year portion of the cycle code (e.g. `26` for 2026).
 * @param nn - 1-based cycle number within the year (1 through 13).
 */
function airacCycleEffectiveDate(yy: number, nn: number): string {
  if (yy < AIRAC_MIN_YEAR_YY || yy > AIRAC_MAX_YEAR_YY) {
    throw new Error(
      `AIRAC cycle year 20${String(yy).padStart(2, '0')} outside supported range 2024-2057`,
    );
  }
  if (nn < 1 || nn > 13) {
    throw new Error(`AIRAC cycle number ${nn} outside supported range 1-13`);
  }
  const cyclesSinceAnchor = (yy - AIRAC_MIN_YEAR_YY) * 13 + (nn - 1);
  const effective = new Date(AIRAC_ANCHOR_MS + cyclesSinceAnchor * AIRAC_CYCLE_MS);
  const year = effective.getUTCFullYear().toString();
  const month = (effective.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = effective.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
