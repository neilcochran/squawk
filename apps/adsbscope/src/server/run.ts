import { access } from 'node:fs/promises';
import { hostname } from 'node:os';
import { fileURLToPath } from 'node:url';

import { APP_NAME } from '../shared/protocol.js';

import { parseCliArgs, USAGE } from './cli-args.js';
import type { CliOptions } from './cli-args.js';
import { buildFeed, describeStation } from './create-feed.js';
import { buildAllowedHostnames } from './host-check.js';
import { createScopeServer } from './http-server.js';

/** Exit code for a run that ended normally, including `--help`. */
export const EXIT_OK = 0;

/** Exit code for a run that could not start: bad arguments, an unreadable recording, or a port that could not be bound. */
export const EXIT_FAILURE = 1;

/** Bind addresses that keep the scope on this machine, for which no exposure reminder is printed. */
const LOOPBACK_BIND_ADDRESSES: readonly string[] = ['127.0.0.1', '::1', 'localhost'];

/** Bind addresses meaning "every interface", which are not themselves browsable and are shown as `localhost`. */
const WILDCARD_BIND_ADDRESSES: readonly string[] = ['0.0.0.0', '::'];

/** Where {@link run} writes what the user should see. */
export interface CliIo {
  /** Writes normal output, such as usage for `--help` and the startup line. */
  stdout(text: string): void;
  /** Writes error output, such as an argument error. */
  stderr(text: string): void;
}

/** The collaborators {@link run} wires together, injectable so specs can substitute fakes for sockets, files, and the network. */
export interface RunDependencies {
  /** Builds the aircraft feed for the parsed options. */
  buildFeed: typeof buildFeed;
  /** Creates the scope's HTTP server. */
  createScopeServer: typeof createScopeServer;
  /** Resolves whether a file exists and can be read. */
  canRead(path: string): Promise<boolean>;
  /** Returns this machine's hostname. */
  machineHostname(): string;
  /** Absolute path of the directory the UI was built into. */
  publicDir: string;
}

/** A scope that started successfully and is now serving. */
export interface RunningScope {
  /** The address to open in a browser. */
  url: string;
  /** Stops the feed and the server. Resolves once both have shut down. */
  stop(): Promise<void>;
}

/**
 * The outcome of {@link run}: either the process should end with `exitCode`,
 * or a scope is `running` and the process should stay alive until it is
 * stopped.
 */
export type RunResult =
  | {
      /** The code the process should exit with. */
      exitCode: number;
    }
  | {
      /** The scope that is now serving. */
      running: RunningScope;
    };

async function canReadFile(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** The real collaborators, used outside of specs. The UI directory is resolved relative to this compiled module. */
export const DEFAULT_RUN_DEPENDENCIES: RunDependencies = {
  buildFeed,
  createScopeServer,
  canRead: canReadFile,
  machineHostname: hostname,
  publicDir: fileURLToPath(new URL('../public/', import.meta.url)),
};

/**
 * Builds the address to open in a browser. A wildcard bind address is not
 * itself browsable, so it is shown as `localhost`, and an IPv6 literal is
 * bracketed.
 *
 * @param bindAddress - The address the server is bound to.
 * @param port - The port the server is listening on.
 * @returns The scope's URL.
 */
export function formatScopeUrl(bindAddress: string, port: number): string {
  let host = bindAddress;
  if (WILDCARD_BIND_ADDRESSES.includes(bindAddress)) {
    host = 'localhost';
  } else if (bindAddress.includes(':')) {
    host = `[${bindAddress}]`;
  }
  return `http://${host}:${port}`;
}

async function start(
  cli: CliOptions,
  io: CliIo,
  dependencies: RunDependencies,
): Promise<RunResult> {
  if (cli.replayPath !== undefined && !(await dependencies.canRead(cli.replayPath))) {
    io.stderr(`Cannot read --replay file "${cli.replayPath}".\n`);
    return { exitCode: EXIT_FAILURE };
  }

  const station = describeStation(cli);
  const feed = dependencies.buildFeed(cli);
  const server = dependencies.createScopeServer({
    feed,
    config: {
      receiver: cli.location,
      source: cli.replayPath !== undefined ? 'replay' : cli.source,
      station,
      mode: cli.mode,
      rangeNm: cli.rangeNm,
    },
    publicDir: dependencies.publicDir,
    allowedHostnames: buildAllowedHostnames(dependencies.machineHostname()),
  });

  let port: number;
  try {
    port = await server.listen(cli.listenPort, cli.bindAddress);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    io.stderr(`Could not serve the scope on ${cli.bindAddress}:${cli.listenPort} - ${reason}\n`);
    return { exitCode: EXIT_FAILURE };
  }

  feed.start();

  const url = formatScopeUrl(cli.bindAddress, port);
  io.stdout(`${APP_NAME}: ${station} -> ${url}\n`);
  if (!LOOPBACK_BIND_ADDRESSES.includes(cli.bindAddress)) {
    io.stdout(
      'Serving beyond loopback: anyone who can reach this address can see the traffic and the receiver position.\n',
    );
  }

  return {
    running: {
      url,
      async stop(): Promise<void> {
        feed.stop();
        await server.close();
      },
    },
  };
}

/**
 * Runs the `adsbscope` command: parses arguments, then either reports why it
 * cannot start or starts the feed and the scope server.
 *
 * It never calls `process.exit()`. Ending the process is left to the caller,
 * which sets `process.exitCode` from the result and lets the process end on
 * its own, so everything written here is flushed first - a hard exit can
 * truncate usage text written to a pipe. That also makes every path here
 * testable in-process.
 *
 * @param argv - Argument list, excluding the `node`/script entries.
 * @param io - Where to write output.
 * @param dependencies - Collaborators to use; defaults to the real ones.
 * @returns The exit code to end with, or the running scope.
 */
export async function run(
  argv: string[],
  io: CliIo,
  dependencies: RunDependencies = DEFAULT_RUN_DEPENDENCIES,
): Promise<RunResult> {
  const parsed = parseCliArgs(argv);
  if ('message' in parsed) {
    io.stderr(`${parsed.message}\n\n${USAGE}`);
    return { exitCode: EXIT_FAILURE };
  }
  if (parsed.help) {
    io.stdout(USAGE);
    return { exitCode: EXIT_OK };
  }
  return start(parsed, io, dependencies);
}
