import { basename } from 'node:path';

import { resolveInput } from './resolve-input.js';
import type { ResolvedInput } from './resolve-input.js';

/** Pattern used to extract the NASR cycle date from a subscription directory name. */
const CYCLE_DATE_PATTERN = /28DaySubscription_Effective_(\d{4}-\d{2}-\d{2})/;

/**
 * Result of parsing NASR build script CLI arguments.
 */
export interface NasrArgs {
  /** Resolved subscription directory path. */
  subscriptionDir: string;
  /** NASR 28-day cycle effective date in YYYY-MM-DD format. */
  nasrCycleDate: string;
  /** Absolute path to write the output file. */
  outputPath: string;
  /** Call when done to clean up any temp directory from zip extraction. */
  cleanup: () => void;
}

/**
 * Options for {@link parseNasrArgs}.
 */
export interface ParseNasrArgsOptions {
  /** Default output path resolved from the calling script's dirname. */
  defaultOutputPath: string;
}

/**
 * Parses the standard `--local` / `--output` CLI arguments used by all NASR
 * build scripts, resolves zip-or-directory input, and extracts the cycle date.
 *
 * Exits the process with usage instructions if arguments are invalid.
 *
 * @param options - Configuration for the calling script.
 * @returns Parsed arguments including the resolved subscription directory and cycle date.
 */
export function parseNasrArgs(options: ParseNasrArgsOptions): NasrArgs {
  const args = process.argv.slice(2);

  let inputPath: string | undefined;
  let outputPath: string = options.defaultOutputPath;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--local' && next) {
      inputPath = next;
      i++;
    } else if (arg === '--output' && next) {
      outputPath = next;
      i++;
    } else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      printUsageAndExit(options.defaultOutputPath);
    }
  }

  if (!inputPath) {
    process.stderr.write('Error: --local <path> is required.\n');
    printUsageAndExit(options.defaultOutputPath);
  }

  const resolved: ResolvedInput = resolveInput(inputPath);

  const dirName = basename(resolved.subscriptionDir);
  const cycleMatch = dirName.match(CYCLE_DATE_PATTERN);
  if (!cycleMatch) {
    resolved.cleanup();
    throw new Error(
      `Cannot determine NASR cycle date from directory name "${dirName}". ` +
        `Expected pattern: 28DaySubscription_Effective_YYYY-MM-DD`,
    );
  }

  const nasrCycleDate = cycleMatch[1] ?? '';
  console.log(`[args] NASR cycle date: ${nasrCycleDate}`);

  return {
    subscriptionDir: resolved.subscriptionDir,
    nasrCycleDate,
    outputPath,
    cleanup: resolved.cleanup,
  };
}

/**
 * Prints usage instructions to stderr and exits with code 1.
 */
function printUsageAndExit(defaultOutputPath: string): never {
  process.stderr.write(
    'Usage: node dist/index.js --local <nasr-zip-or-dir> [--output <output-path>]\n\n' +
      'Options:\n' +
      '  --local <path>   Path to a NASR subscription .zip file or extracted directory.\n' +
      '  --output <path>  Path to write the output file.\n' +
      `                   Defaults to: ${defaultOutputPath}\n`,
  );
  process.exit(1);
}
