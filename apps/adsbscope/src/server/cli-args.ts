import { parseArgs } from 'node:util';

import { DEFAULT_PORT_BY_SOURCE } from '@squawk/adsb-feed';
import type { FeedSource } from '@squawk/adsb-feed';
import type { Coordinates } from '@squawk/types';

import {
  APP_NAME,
  DEFAULT_LISTEN_PORT,
  DEFAULT_SCOPE_MODE_ID,
  isScopeModeId,
  SCOPE_MODE_IDS,
} from '../shared/protocol.js';
import type { ScopeModeId } from '../shared/protocol.js';

/**
 * Default for `--stale-after`: how long an aircraft may go without an
 * update before the feed drops it. Matches `@squawk/adsb-feed`'s own
 * default, and is passed to the feed explicitly so the two cannot drift.
 */
export const DEFAULT_STALE_AFTER_MS = 60_000;

/** Default for `--bind`: loopback only, so the scope is not reachable from other machines unless asked for. */
export const DEFAULT_BIND_ADDRESS = '127.0.0.1';

/** Default for `--range`: the scope range, in nautical miles, the UI starts at. */
export const DEFAULT_RANGE_NM = 60;

/** Parsed and validated CLI options for the `adsbscope` command. */
export interface CliOptions {
  /** Whether `--help` was passed. When true, every other field is a placeholder and the caller should print usage and exit without starting anything. */
  help: boolean;
  /** Which dump1090-fa output to connect to. Unused when `replayPath` is set. */
  source: FeedSource;
  /** Hostname or IP address of the dump1090-fa station. Unused when `replayPath` is set. */
  host: string;
  /** TCP/HTTP port to connect to. Defaults to `DEFAULT_PORT_BY_SOURCE` from `@squawk/adsb-feed` for the selected source. */
  port: number;
  /** Full override URL for the `json` source's `aircraft.json` endpoint. Undefined unless `--url` was passed. */
  url: string | undefined;
  /**
   * The receiving station's own position, from `--lat`/`--lon`: the center
   * of the scope, and for `--source beast` also the reference position for
   * surface CPR decoding.
   */
  location: Coordinates;
  /** The view style the UI starts in, from `--mode`. */
  mode: ScopeModeId;
  /** The scope range in nautical miles the UI starts at, from `--range`. */
  rangeNm: number;
  /** The port the scope UI is served on, from `--listen-port`. */
  listenPort: number;
  /** The local address the scope UI server binds to, from `--bind`. */
  bindAddress: string;
  /** A recorded session to play back instead of connecting to a station, from `--replay`. Undefined for a live feed. */
  replayPath: string | undefined;
  /** How long an aircraft may go without an update before the feed drops it, from `--stale-after`. */
  staleAfterMs: number;
}

/** A `parseCliArgs` failure: the reason `argv` could not be turned into {@link CliOptions}. */
export interface CliArgsError {
  /** Human-readable message describing what was wrong with `argv`, suitable for printing directly to stderr. */
  message: string;
}

const DEFAULT_HOST = 'localhost';
const DEFAULT_SOURCE: FeedSource = 'beast';
const NEGATIVE_NUMBER = /^-\d+(\.\d+)?$/;
const MAX_RANGE_NM = 500;

function isFeedSource(value: string): value is FeedSource {
  return value === 'json' || value === 'sbs' || value === 'beast';
}

/**
 * Node's `parseArgs` rejects `--lon -73.7781` as an ambiguous option value
 * (a bare token starting with `-` looks like another flag), requiring the
 * awkward `--lon=-73.7781` form instead - a real problem here since most
 * real-world longitudes (and some latitudes) are negative. Rewrites a
 * `--lat`/`--lon` immediately followed by a bare negative number into the
 * `=` form before parsing, so the natural `--lon -73.7781` spelling works.
 *
 * @param argv - Raw argument list, as passed to {@link parseCliArgs}.
 * @returns `argv` with negative `--lat`/`--lon` values rewritten to `--flag=value` form.
 */
function normalizeNegativeLocationArgs(argv: string[]): string[] {
  const normalized: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }
    const next = argv[i + 1];
    if ((arg === '--lat' || arg === '--lon') && next !== undefined && NEGATIVE_NUMBER.test(next)) {
      normalized.push(`${arg}=${next}`);
      i++;
    } else {
      normalized.push(arg);
    }
  }
  return normalized;
}

/** Usage text printed for `--help`/`-h`, and on an argument error. */
export const USAGE = `Usage: ${APP_NAME} --lat <lat> --lon <lon> [options]

Options:
  --lat <lat>                Receiver latitude in decimal degrees - the center of the scope (required)
  --lon <lon>                Receiver longitude in decimal degrees - the center of the scope (required)
  --source <json|sbs|beast>  Feed to connect to (default: ${DEFAULT_SOURCE})
  --host <host>              dump1090-fa station hostname/IP (default: ${DEFAULT_HOST})
  --port <port>              Station port to connect to (default: 8080 json, 30003 sbs, 30005 beast)
  --url <url>                Full aircraft.json URL, overriding --host/--port (source=json only)
  --replay <file>            Play back an "adsbtop --record" file instead of connecting to a station
  --mode <${SCOPE_MODE_IDS.join('|')}>    View style to start in (default: ${DEFAULT_SCOPE_MODE_ID}) - switchable while running
  --range <nm>               Scope range to start at, in nautical miles (default: ${DEFAULT_RANGE_NM})
  --listen-port <port>       Port to serve the scope UI on (default: ${DEFAULT_LISTEN_PORT})
  --bind <address>           Local address to serve the scope UI on (default: ${DEFAULT_BIND_ADDRESS}) - use 0.0.0.0 to allow other devices on the network
  --stale-after <ms>         Drop an aircraft after this long without an update (default: ${DEFAULT_STALE_AFTER_MS})
  -h, --help                 Show this help message
`;

/**
 * Parses and validates `--lat`/`--lon` into a {@link Coordinates}. Both are
 * required: the scope is centered on the receiver, so there is nothing to
 * draw without them.
 *
 * @param rawLat - Raw `--lat` value, if passed.
 * @param rawLon - Raw `--lon` value, if passed.
 * @returns The parsed location, or a {@link CliArgsError}.
 */
function parseLocation(
  rawLat: string | undefined,
  rawLon: string | undefined,
): { location: Coordinates } | CliArgsError {
  if (rawLat === undefined || rawLon === undefined) {
    return {
      message: '--lat and --lon are required: the scope is centered on the receiver position.',
    };
  }
  const lat = Number(rawLat);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { message: `Invalid --lat "${rawLat}" - expected a number between -90 and 90.` };
  }
  const lon = Number(rawLon);
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return { message: `Invalid --lon "${rawLon}" - expected a number between -180 and 180.` };
  }
  return { location: { lat, lon } };
}

/**
 * Parses a TCP port flag.
 *
 * @param flag - The flag name, for the error message.
 * @param raw - Raw flag value.
 * @returns The port, or a {@link CliArgsError}.
 */
function parsePort(flag: string, raw: string): { port: number } | CliArgsError {
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return { message: `Invalid ${flag} "${raw}" - expected an integer between 1 and 65535.` };
  }
  return { port };
}

/**
 * Parses and validates `adsbscope`'s command-line arguments. Returns a result
 * type rather than throwing, so callers (and tests) can handle a bad
 * argument the same way as any other expected outcome.
 *
 * @param argv - Argument list, excluding the `node`/script entries (i.e. `process.argv.slice(2)`).
 * @returns The parsed options, or a {@link CliArgsError} describing the first problem found.
 */
export function parseCliArgs(argv: string[]): CliOptions | CliArgsError {
  let parsed;
  try {
    parsed = parseArgs({
      args: normalizeNegativeLocationArgs(argv),
      options: {
        source: { type: 'string', default: DEFAULT_SOURCE },
        host: { type: 'string', default: DEFAULT_HOST },
        port: { type: 'string' },
        url: { type: 'string' },
        lat: { type: 'string' },
        lon: { type: 'string' },
        replay: { type: 'string' },
        mode: { type: 'string', default: DEFAULT_SCOPE_MODE_ID },
        range: { type: 'string' },
        'listen-port': { type: 'string' },
        bind: { type: 'string', default: DEFAULT_BIND_ADDRESS },
        'stale-after': { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
    });
  } catch (error) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  const { values } = parsed;
  if (values.help === true) {
    return {
      help: true,
      source: DEFAULT_SOURCE,
      host: DEFAULT_HOST,
      port: DEFAULT_PORT_BY_SOURCE[DEFAULT_SOURCE],
      url: undefined,
      location: { lat: 0, lon: 0 },
      mode: DEFAULT_SCOPE_MODE_ID,
      rangeNm: DEFAULT_RANGE_NM,
      listenPort: DEFAULT_LISTEN_PORT,
      bindAddress: DEFAULT_BIND_ADDRESS,
      replayPath: undefined,
      staleAfterMs: DEFAULT_STALE_AFTER_MS,
    };
  }

  const parsedLocation = parseLocation(values.lat, values.lon);
  if ('message' in parsedLocation) {
    return parsedLocation;
  }

  const rawSource = values.source ?? DEFAULT_SOURCE;
  if (!isFeedSource(rawSource)) {
    return { message: `Invalid --source "${rawSource}" - expected json, sbs, or beast.` };
  }

  let port = DEFAULT_PORT_BY_SOURCE[rawSource];
  if (values.port !== undefined) {
    const parsedPort = parsePort('--port', values.port);
    if ('message' in parsedPort) {
      return parsedPort;
    }
    port = parsedPort.port;
  }

  if (values.url !== undefined && rawSource !== 'json') {
    return { message: '--url is only valid with --source json.' };
  }

  if (values.replay !== undefined && values.replay.trim() === '') {
    return { message: '--replay needs a file path.' };
  }

  const rawMode = values.mode ?? DEFAULT_SCOPE_MODE_ID;
  if (!isScopeModeId(rawMode)) {
    return {
      message: `Invalid --mode "${rawMode}" - expected ${SCOPE_MODE_IDS.join(' or ')}.`,
    };
  }

  let rangeNm = DEFAULT_RANGE_NM;
  if (values.range !== undefined) {
    const parsedRange = Number(values.range);
    if (!Number.isFinite(parsedRange) || parsedRange <= 0 || parsedRange > MAX_RANGE_NM) {
      return {
        message: `Invalid --range "${values.range}" - expected a number of nautical miles between 0 and ${MAX_RANGE_NM}.`,
      };
    }
    rangeNm = parsedRange;
  }

  let listenPort = DEFAULT_LISTEN_PORT;
  if (values['listen-port'] !== undefined) {
    const parsedListenPort = parsePort('--listen-port', values['listen-port']);
    if ('message' in parsedListenPort) {
      return parsedListenPort;
    }
    listenPort = parsedListenPort.port;
  }

  const bindAddress = values.bind ?? DEFAULT_BIND_ADDRESS;
  if (bindAddress.trim() === '') {
    return { message: '--bind needs an address.' };
  }

  let staleAfterMs = DEFAULT_STALE_AFTER_MS;
  if (values['stale-after'] !== undefined) {
    const parsedStaleAfter = Number(values['stale-after']);
    if (!Number.isInteger(parsedStaleAfter) || parsedStaleAfter <= 0) {
      return {
        message: `Invalid --stale-after "${values['stale-after']}" - expected a positive whole number of milliseconds.`,
      };
    }
    staleAfterMs = parsedStaleAfter;
  }

  return {
    help: false,
    source: rawSource,
    host: values.host ?? DEFAULT_HOST,
    port,
    url: values.url,
    location: parsedLocation.location,
    mode: rawMode,
    rangeNm,
    listenPort,
    bindAddress,
    replayPath: values.replay,
    staleAfterMs,
  };
}
