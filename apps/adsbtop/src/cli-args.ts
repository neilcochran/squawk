import { parseArgs } from 'node:util';

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
}

/** A `parseCliArgs` failure: the reason `argv` could not be turned into {@link CliOptions}. */
export interface CliArgsError {
  /** Human-readable message describing what was wrong with `argv`, suitable for printing directly to stderr. */
  message: string;
}

const DEFAULT_HOST = 'localhost';
const DEFAULT_SOURCE: FeedSource = 'sbs';

function isFeedSource(value: string): value is FeedSource {
  return value === 'json' || value === 'sbs' || value === 'beast';
}

/** Usage text printed for `--help`/`-h`, and on an argument error. */
export const USAGE = `Usage: adsbtop [options]

Options:
  --source <json|sbs|beast>  Feed to connect to (default: ${DEFAULT_SOURCE})
  --host <host>              dump1090-fa station hostname/IP (default: ${DEFAULT_HOST})
  --port <port>              Port to connect to (default: 8080 json, 30003 sbs, 30005 beast)
  --url <url>                Full aircraft.json URL, overriding --host/--port (source=json only)
  -h, --help                 Show this help message
`;

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
      args: argv,
      options: {
        source: { type: 'string', default: DEFAULT_SOURCE },
        host: { type: 'string', default: DEFAULT_HOST },
        port: { type: 'string' },
        url: { type: 'string' },
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
    };
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
  };
}
