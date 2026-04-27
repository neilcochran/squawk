import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/**
 * Updates the bolded date in a data package's README description to match the
 * cycle date of the data that was just built. The date appears in the opening
 * paragraph as `from the **YYYY-MM-DD** FAA`.
 *
 * The README is located by navigating up one directory from the output data
 * file path (e.g. `packages/libs/navaid-data/data/navaids.json.gz` resolves to
 * `packages/libs/navaid-data/README.md`).
 *
 * This is best-effort and will not throw if the README is missing or does not
 * contain the expected date pattern (e.g. when the tool is used outside the
 * squawk repository).
 *
 * @param outputPath - Absolute path to the output data file that was just written.
 * @param date - Date string in YYYY-MM-DD format to write into the README.
 */
export async function updateReadmeDate(outputPath: string, date: string): Promise<void> {
  const readmePath = resolve(dirname(outputPath), '..', 'README.md');
  try {
    const readme = await readFile(readmePath, 'utf-8');
    const updated = readme.replace(
      /from the \*\*\d{4}-\d{2}-\d{2}\*\* FAA (NASR|CIFP|ReleasableAircraft)/,
      `from the **${date}** FAA $1`,
    );
    if (updated !== readme) {
      await writeFile(readmePath, updated, 'utf-8');
      console.log(`[write-output] Updated README date to ${date}`);
    }
  } catch {
    // README not found or not writable - skip silently.
  }
}
