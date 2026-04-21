import { readFileSync, writeFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
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
 * The downloaded zip is saved to a temporary file that is removed by
 * the returned `cleanup` function.
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
  const tempPath = join(tmpdir(), `cifp-${randomUUID()}.zip`);
  writeFileSync(tempPath, buffer);
  console.log(`[fetch] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB to ${tempPath}`);
  const loaded = loadFromZip(tempPath);
  return {
    ...loaded,
    sourceName: zipFilename,
    cleanup: async () => {
      await unlink(tempPath).catch(() => undefined);
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
 * Extracts the cycle-effective date from the CIFP header record and
 * formats it as ISO `YYYY-MM-DD`.
 *
 * The header record is a fixed-width line starting with `HDR01` and
 * carries the cycle date in a `DD-MON-YYYY` format within the record
 * body. Example:
 *
 * ```text
 * HDR01FAACIFP18      001P013203974102604  25-MAR-202612:51:00  U.S.A. DOT FAA
 * ```
 *
 * Here `25-MAR-2026` is the effective date.
 *
 * Exported for unit testing; not part of the tool's public interface.
 */
export function extractCycleDate(contents: string): string {
  const firstLine = contents.slice(0, 200);
  const match = /(\d{2})-([A-Z]{3})-(\d{4})/.exec(firstLine);
  if (match === null) {
    throw new Error('Could not extract CIFP cycle date from FAACIFP18 header');
  }
  const day = match[1];
  const monthName = match[2];
  const year = match[3];
  if (day === undefined || monthName === undefined || year === undefined) {
    throw new Error('Could not extract CIFP cycle date from FAACIFP18 header');
  }
  const month = MONTH_TO_NUMBER[monthName];
  if (month === undefined) {
    throw new Error(`Unrecognized month abbreviation in CIFP header: ${monthName}`);
  }
  return `${year}-${month}-${day}`;
}

/**
 * Maps a 3-letter uppercase English month abbreviation to its
 * two-digit numeric month, suitable for ISO `YYYY-MM-DD` formatting.
 */
const MONTH_TO_NUMBER: Readonly<Record<string, string>> = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
};
