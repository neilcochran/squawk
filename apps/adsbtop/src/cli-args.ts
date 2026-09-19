import { parseArgs } from 'node:util';

import { DEFAULT_PORT_BY_SOURCE } from '@squawk/adsb-feed';
import type { FeedSource } from '@squawk/adsb-feed';
import type { Coordinates } from '@squawk/types';

import { parseColumnList, unavailableReason, COLUMNS } from './columns.js';
import type { ColumnAvailability, ColumnKey } from './columns.js';
import { parseFilter } from './filter.js';
import type { AircraftFilter } from './filter.js';
import { DEFAULT_UNIT_SYSTEM, isUnitSystem } from './units.js';
import type { UnitSystem } from './units.js';
import { parseWatchlist } from './watchlist.js';

/**
 * Default for `--stale-after`: how long an aircraft may go without an
 * update before the feed drops it. Matches `@squawk/adsb-feed`'s own
 * default, and is passed to the feed explicitly so the two cannot drift.
 */
export const DEFAULT_STALE_AFTER_MS = 60_000;

/** Parsed and validated CLI options for the `adsbtop` command. */
export interface CliOptions {
  /** Whether `--help` was passed. When true, every other field is a placeholder and the caller should print usage and exit without starting a feed. */
  help: boolean;
  /** Which dump1090-fa output to connect to. */
  source: FeedSource;
  /** Hostname or IP address of the dump1090-fa station. */
  host: string;
  /** TCP/HTTP port to connect to. Defaults to `DEFAULT_PORT_BY_SOURCE` from `@squawk/adsb-feed` for the selected source. */
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
  /**
   * The columns to show, from `--columns`, as column keys in the order
   * given. Undefined when the flag was not passed, meaning the table
   * auto-fits the available columns to the terminal width instead.
   */
  columnKeys: readonly ColumnKey[] | undefined;
  /** The filter to start with, from `-f`/`--filter`, already parsed and validated. Undefined when the flag was not passed. */
  filter: AircraftFilter | undefined;
  /** How long an aircraft may go without an update before the feed drops it, from `--stale-after`. Defaults to {@link DEFAULT_STALE_AFTER_MS}. Rows dim at half this. */
  staleAfterMs: number;
  /** Normalized `--watch` terms (ICAO hexes, N-numbers, callsign prefixes). Empty when the flag was not passed. */
  watchlist: readonly string[];
  /** Whether `--alert-emergency` was passed: ring the bell when an aircraft first becomes an emergency. */
  alertEmergency: boolean;
  /** Whether the terminal bell may ring at all. False under `--no-bell`. */
  bell: boolean;
  /** File to append every feed event to as JSON lines, from `--record`. Undefined when not recording. */
  recordPath: string | undefined;
  /** The unit system to start in, from `--units`. Defaults to aviation units. */
  units: UnitSystem;
}

/** A `parseCliArgs` failure: the reason `argv` could not be turned into {@link CliOptions}. */
export interface CliArgsError {
  /** Human-readable message describing what was wrong with `argv`, suitable for printing directly to stderr. */
  message: string;
}

const DEFAULT_HOST = 'localhost';
const DEFAULT_SOURCE: FeedSource = 'beast';
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
  --lat <lat>                Receiver latitude in decimal degrees - enables Dist/Brg/CPA columns (requires --lon)
  --lon <lon>                Receiver longitude in decimal degrees - enables Dist/Brg/CPA columns (requires --lat)
  --columns <list>           Comma-separated columns to show, by header name (e.g. icao,callsign,alt,dist) - default: auto-fit to the terminal width
  -f, --filter <text>        Start with this filter applied, same syntax as the [F] prompt (e.g. "is:air within:25")
  --watch <list>             Comma-separated ICAO hexes, N-numbers, or callsign prefixes to highlight and ring the bell for
  --alert-emergency          Ring the bell when an aircraft first squawks or declares an emergency
  --no-bell                  Never ring the terminal bell (watchlist and emergency highlighting still apply)
  --stale-after <ms>         Drop an aircraft after this long without an update (default: ${DEFAULT_STALE_AFTER_MS}) - rows dim at half this
  --record <file>            Append every new/update/lost feed event to <file> as one JSON object per line
  --units <aviation|metric>  Unit system to start in (default: ${DEFAULT_UNIT_SYSTEM}) - [U] toggles while running
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
 * Parses and validates `--columns` against what the session can supply:
 * every name must be a known column, and a column the session cannot
 * populate - the location-gated ones without `--lat`/`--lon`, or one the
 * chosen source never sends - is an error, since it would have nothing to
 * show. Returns `{ columnKeys: undefined }` when the flag was not passed,
 * which means auto-fit.
 *
 * @param raw - Raw `--columns` value, if passed.
 * @param availability - The parsed source and location.
 * @returns The column keys (possibly undefined), or a {@link CliArgsError}.
 */
function parseColumns(
  raw: string | undefined,
  availability: ColumnAvailability,
): { columnKeys: readonly ColumnKey[] | undefined } | CliArgsError {
  if (raw === undefined) {
    return { columnKeys: undefined };
  }
  const parsed = parseColumnList(raw);
  if ('message' in parsed) {
    return parsed;
  }
  for (const column of COLUMNS) {
    if (!parsed.keys.includes(column.key)) {
      continue;
    }
    const reason = unavailableReason(column, availability);
    if (reason !== undefined) {
      return { message: `--columns includes ${column.header}, which ${reason}.` };
    }
  }
  return { columnKeys: parsed.keys };
}

/**
 * Parses and validates `-f`/`--filter` with the same rules as the in-app
 * `[F]` prompt, so a bad term fails at startup with the message the prompt
 * would have shown. Returns `{ filter: undefined }` when the flag was not
 * passed.
 *
 * @param raw - Raw `--filter` value, if passed.
 * @param hasLocation - Whether a receiver location is configured, which `within:` needs.
 * @param units - The `--units` system, which decides how a bare `within:` value is read.
 * @returns The parsed filter (possibly undefined), or a {@link CliArgsError}.
 */
function parseStartupFilter(
  raw: string | undefined,
  hasLocation: boolean,
  units: UnitSystem,
): { filter: AircraftFilter | undefined } | CliArgsError {
  if (raw === undefined) {
    return { filter: undefined };
  }
  if (raw.trim() === '') {
    return { message: '--filter needs at least one term.' };
  }
  const parsed = parseFilter(raw, hasLocation, units);
  if ('message' in parsed) {
    return { message: `Invalid --filter: ${parsed.message}` };
  }
  return { filter: parsed };
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
        columns: { type: 'string' },
        filter: { type: 'string', short: 'f' },
        watch: { type: 'string' },
        'alert-emergency': { type: 'boolean', default: false },
        'no-bell': { type: 'boolean', default: false },
        'stale-after': { type: 'string' },
        record: { type: 'string' },
        units: { type: 'string', default: DEFAULT_UNIT_SYSTEM },
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
      columnKeys: undefined,
      filter: undefined,
      staleAfterMs: DEFAULT_STALE_AFTER_MS,
      watchlist: [],
      alertEmergency: false,
      bell: true,
      recordPath: undefined,
      units: DEFAULT_UNIT_SYSTEM,
    };
  }

  const parsedLocation = parseLocation(values.lat, values.lon);
  if ('message' in parsedLocation) {
    return parsedLocation;
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

  const rawUnits = values.units ?? DEFAULT_UNIT_SYSTEM;
  if (!isUnitSystem(rawUnits)) {
    return { message: `Invalid --units "${rawUnits}" - expected aviation or metric.` };
  }

  const parsedFilter = parseStartupFilter(
    values.filter,
    parsedLocation.location !== undefined,
    rawUnits,
  );
  if ('message' in parsedFilter) {
    return parsedFilter;
  }

  if (values.record !== undefined && values.record.trim() === '') {
    return { message: '--record needs a file path.' };
  }

  let watchlist: readonly string[] = [];
  if (values.watch !== undefined) {
    const parsedWatchlist = parseWatchlist(values.watch);
    if ('message' in parsedWatchlist) {
      return parsedWatchlist;
    }
    watchlist = parsedWatchlist.terms;
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

  const parsedColumns = parseColumns(values.columns, {
    source: rawSource,
    location: parsedLocation.location,
  });
  if ('message' in parsedColumns) {
    return parsedColumns;
  }

  return {
    help: false,
    source: rawSource,
    host: values.host ?? DEFAULT_HOST,
    port,
    url: values.url,
    location: parsedLocation.location,
    columnKeys: parsedColumns.columnKeys,
    filter: parsedFilter.filter,
    staleAfterMs,
    watchlist,
    alertEmergency: values['alert-emergency'] === true,
    bell: values['no-bell'] !== true,
    recordPath: values.record,
    units: rawUnits,
  };
}
