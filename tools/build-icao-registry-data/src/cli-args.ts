import { resolve } from 'node:path';

/**
 * A usable command line for the ICAO registry build script.
 */
export type CliArgs =
  | {
      /** Download the latest ReleasableAircraft.zip from the FAA. */
      mode: 'fetch';
      /** Absolute path to write the output .json.gz file. */
      outputPath: string;
    }
  | {
      /** Build from an already-downloaded zip. */
      mode: 'local';
      /** Absolute path to that zip. */
      localPath: string;
      /** Absolute path to write the output .json.gz file. */
      outputPath: string;
    };

/**
 * A command line {@link parseCliArgs} could not use.
 */
export interface CliArgsError {
  /** The complete text to write to stderr: what was wrong, then the usage instructions. */
  message: string;
}

/**
 * Builds the message for an unusable command line: the reason, then usage.
 *
 * @param reason - What was wrong with the arguments.
 * @param defaultOutputPath - Output path shown in the usage text.
 * @returns The error to return to the caller.
 */
function usageError(reason: string, defaultOutputPath: string): CliArgsError {
  return {
    message:
      `${reason}\n\n` +
      'Usage: node dist/index.js (--fetch | --local <path-to-zip>) [--output <output-path>]\n\n' +
      'Options:\n' +
      '  --fetch           Download the latest ReleasableAircraft.zip from the FAA.\n' +
      '  --local <path>    Path to an already-downloaded ReleasableAircraft.zip.\n' +
      '  --output <path>   Path to write the output .json.gz file.\n' +
      `                    Defaults to: ${defaultOutputPath}\n`,
  };
}

/**
 * Parses the build script's command line.
 *
 * Nothing here ends the process: an unusable command line comes back as a
 * {@link CliArgsError} for `main` to print and turn into an exit code.
 *
 * @param argv - Arguments to parse, without the node and script entries.
 * @param defaultOutputPath - Where to write output when `--output` is not given.
 * @returns The parsed arguments, or the error to report.
 */
export function parseCliArgs(
  argv: readonly string[],
  defaultOutputPath: string,
): CliArgs | CliArgsError {
  let selected: { mode: 'fetch' } | { mode: 'local'; localPath: string } | undefined;
  let outputPath: string = defaultOutputPath;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--fetch') {
      selected = { mode: 'fetch' };
    } else if (arg === '--local' && next) {
      selected = { mode: 'local', localPath: resolve(next) };
      i++;
    } else if (arg === '--output' && next) {
      outputPath = resolve(next);
      i++;
    } else {
      return usageError(`Unknown argument: ${arg}`, defaultOutputPath);
    }
  }

  if (selected === undefined) {
    return usageError('Error: either --fetch or --local <path> is required.', defaultOutputPath);
  }

  return { ...selected, outputPath };
}
