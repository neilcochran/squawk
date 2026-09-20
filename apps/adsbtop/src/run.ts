import type { AircraftFeed } from '@squawk/adsb-feed';

import type { CliOptions } from './cli-args.js';
import { parseCliArgs, USAGE } from './cli-args.js';
import { buildFeed } from './create-feed.js';

/** Exit code for a run that ended normally, including `--help`. */
export const EXIT_OK = 0;

/** Exit code for a run that could not start, such as an unusable command line. */
export const EXIT_FAILURE = 1;

/** Where {@link run} writes what the user should see. */
export interface CliIo {
  /** Writes normal output, such as usage for `--help`. */
  stdout(text: string): void;
  /** Writes error output, such as an argument error. */
  stderr(text: string): void;
}

/** The collaborators {@link run} wires together, injectable so specs can build a dashboard without a real feed. */
export interface RunDependencies {
  /** Constructs the aircraft feed for the parsed options. */
  buildFeed: typeof buildFeed;
}

/** The real collaborators, used outside of specs. */
export const DEFAULT_RUN_DEPENDENCIES: RunDependencies = { buildFeed };

/** The dashboard to render: the feed to subscribe to and the options that configure it. */
export interface Dashboard {
  /** Parsed, validated options for everything the dashboard displays. */
  options: CliOptions;
  /** The feed the dashboard subscribes to, constructed but not yet started. */
  feed: AircraftFeed;
}

/**
 * The outcome of {@link run}: either the process should end with `exitCode`
 * and render nothing, or a `dashboard` is ready to render.
 */
export type RunResult =
  | {
      /** The code the process should exit with. */
      exitCode: number;
    }
  | {
      /** The dashboard that should now be rendered. */
      dashboard: Dashboard;
    };

/**
 * Turns a command line into either an exit code or a dashboard to render.
 *
 * Nothing here ends the process. A caller sets `process.exitCode` and returns,
 * so output written on the way out is never cut short - `process.exit()` drops
 * pending writes, and writes to a pipe or a Windows terminal are asynchronous,
 * so `adsbtop --help | more` could lose its tail.
 *
 * @param argv - Command-line arguments, without the node and script entries.
 * @param io - Where usage and errors are written.
 * @param dependencies - Collaborators to use; defaults to {@link DEFAULT_RUN_DEPENDENCIES}.
 * @returns The exit code to end with, or the dashboard to render.
 */
export function run(
  argv: string[],
  io: CliIo,
  dependencies: RunDependencies = DEFAULT_RUN_DEPENDENCIES,
): RunResult {
  const parsed = parseCliArgs(argv);
  if ('message' in parsed) {
    io.stderr(`${parsed.message}\n\n${USAGE}`);
    return { exitCode: EXIT_FAILURE };
  }
  if (parsed.help) {
    io.stdout(USAGE);
    return { exitCode: EXIT_OK };
  }
  return { dashboard: { options: parsed, feed: dependencies.buildFeed(parsed) } };
}
