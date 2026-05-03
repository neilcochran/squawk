import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';

/**
 * Result of resolving a `--local` input path.
 * If a ZIP was extracted, `cleanup` removes the temp directory.
 * If a directory was passed directly, `cleanup` is a no-op.
 */
export interface ResolvedInput {
  /** Path to the subscription directory (extracted or original). */
  subscriptionDir: string;
  /** Call when done to remove any temp directory created during extraction. */
  cleanup: () => void;
}

/**
 * Resolves a `--local` argument that may be either a `.zip` file or an
 * already-extracted directory. If a ZIP file is detected, it is extracted
 * to a temporary directory whose name preserves the original ZIP filename
 * (so the NASR cycle date can still be parsed from the directory name).
 *
 * @param inputPath - Absolute path to a `.zip` file or directory.
 * @returns The resolved subscription directory and a cleanup function.
 */
export function resolveInput(inputPath: string): ResolvedInput {
  const stats = statSync(inputPath);

  if (stats.isDirectory()) {
    return { subscriptionDir: inputPath, cleanup: () => undefined };
  }

  if (!inputPath.endsWith('.zip')) {
    throw new Error(`Expected a .zip file or directory, got: ${inputPath}`);
  }

  const zipName = basename(inputPath, '.zip');
  const tempBase = mkdtempSync(join(tmpdir(), 'nasr-'));
  const extractDir = join(tempBase, zipName);

  console.log(`[resolve-input] Extracting ${basename(inputPath)} to ${extractDir}...`);
  // Pass argv as an array so the shell is never involved: paths
  // containing quotes, spaces, or other metacharacters are forwarded
  // verbatim to `unzip` rather than being re-interpreted by sh.
  const result = spawnSync('unzip', ['-q', '-o', inputPath, '-d', extractDir], {
    stdio: 'inherit',
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `unzip exited with code ${result.status ?? 'null'} extracting ${inputPath} to ${extractDir}`,
    );
  }
  console.log('[resolve-input] Extraction complete.');

  return {
    subscriptionDir: extractDir,
    cleanup: () => {
      try {
        rmSync(tempBase, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup; temp dir will be reclaimed by OS eventually.
      }
    },
  };
}
