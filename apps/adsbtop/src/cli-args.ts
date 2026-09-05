import { parseArgs } from 'node:util';

import type { Coordinates } from '@squawk/types';

/** Which dump1090-fa output adsbtop connects to. */
export type FeedSource = 'json' | 'sbs' | 'beast';

/** Default TCP/HTTP port per {@link FeedSource}, matching dump1090-fa's own defaults. */
export const DEFAULT_PORT_BY_SOURCE: Record<FeedSource, number> = {
  json: 8080,
  sbs: 30003,
  beast: 30005,
};

/** Parsed and validated CLI options for the `adsbtop` command. */
export interface CliOptions {
  /** Whether `--help` was passed. When true, every other field is a placeholder and the caller should print usage and exit without starting a feed. */
  help: boolean;
  /** Which dump1090-fa output to connect to. */
  source: FeedSource;
  /** Hostname or IP address of the dump1090-fa station. */
  host: string;
  /** TCP/HTTP port to connect to. Defaults to {@link DEFAULT_PORT_BY_SOURCE} for the selected source. */
  port: number;
  /** Full override URL for the `json` source's `aircraft.json` endpoint. Undefined for `sbs`/`beast`, and undefined for `json` unless `--url` was passed explicitly. */
  url: string | undefined;
  /**
   * The receiving station's own position, from `--lat`/`--lon`. When set,
   * the table's Dist/Brg columns compute distance and bearing from this
   * point to each aircraft, and for `--source beast` the same value also
   * feeds `BeastFeedOptions.receiverPosition` for surface CPR decoding.
   * Undefined unless both `--lat` and `--lon` were passed.
   */
  location: Coordinates | undefined;
}

/** A `parseCliArgs` failure: the reason `argv` could not be turned into {@link CliOptions}. */
export interface CliArgsError {
  /** Human-readable message describing what was wrong with `argv`, suitable for printing directly to stderr. */
  message: string;
}

const DEFAULT_HOST = 'localhost';
const DEFAULT_SOURCE: FeedSource = 'sbs';
const NEGATIVE_NUMBER = /^-\d+(\.\d+)?$/;

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
export const USAGE = `Usage: adsbtop [options]

Options:
  --source <json|sbs|beast>  Feed to connect to (default: ${DEFAULT_SOURCE}) - detail-view field coverage differs by source, see README
  --host <host>              dump1090-fa station hostname/IP (default: ${DEFAULT_HOST})
  --port <port>              Port to connect to (default: 8080 json, 30003 sbs, 30005 beast)
  --url <url>                Full aircraft.json URL, overriding --host/--port (source=json only)
  --lat <lat>                Receiver latitude in decimal degrees - enables Dist/Brg columns (requires --lon)
  --lon <lon>                Receiver longitude in decimal degrees - enables Dist/Brg columns (requires --lat)
  -h, --help                 Show this help message
`;

/**
 * Parses and validates `--lat`/`--lon` into a {@link Coordinates}. Both must
 * be given together; either alone is an error. Returns `{ location:
 * undefined }` when neither was passed, since omitting location entirely is
 * valid and distinct from an invalid one.
 *
 * @param rawLat - Raw `--lat` value, if passed.
 * @param rawLon - Raw `--lon` value, if passed.
 * @returns The parsed location (possibly undefined), or a {@link CliArgsError}.
 */
function parseLocation(
  rawLat: string | undefined,
  rawLon: string | undefined,
): { location: Coordinates | undefined } | CliArgsError {
  if (rawLat === undefined && rawLon === undefined) {
    return { location: undefined };
  }
  if (rawLat === undefined || rawLon === undefined) {
    return { message: '--lat and --lon must be provided together.' };
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
 * Parses and validates `adsbtop`'s command-line arguments. Returns a result
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
      location: undefined,
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
    const parsedPort = Number(values.port);
    if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
      return {
        message: `Invalid --port "${values.port}" - expected an integer between 1 and 65535.`,
      };
    }
    port = parsedPort;
  }

  if (values.url !== undefined && rawSource !== 'json') {
    return { message: '--url is only valid with --source json.' };
  }

  return {
    help: false,
    source: rawSource,
    host: values.host ?? DEFAULT_HOST,
    port,
    url: values.url,
    location: parsedLocation.location,
  };
}
