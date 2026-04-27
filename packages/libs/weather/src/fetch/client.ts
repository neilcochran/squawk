/**
 * Internal HTTP client for the Aviation Weather Center (AWC) text API.
 * Consumers should import the high-level fetch* functions, not this module.
 */

/** Default base URL for the AWC text API. */
export const DEFAULT_AWC_BASE_URL = 'https://aviationweather.gov/api/data';

/**
 * Options shared by every `fetch*` function in this module.
 */
export interface FetchWeatherOptions {
  /** AbortSignal used to cancel the underlying HTTP request. */
  signal?: AbortSignal;
  /**
   * Override the AWC base URL. Defaults to {@link DEFAULT_AWC_BASE_URL}.
   * Useful for pointing at a mirror or a proxy during development.
   */
  baseUrl?: string;
}

/**
 * Thrown when the AWC API responds with a non-2xx status code.
 * Network-level errors (DNS failure, abort, etc.) are rethrown as-is.
 */
export class AwcFetchError extends Error {
  /** HTTP status code returned by the AWC API. */
  public readonly status: number;
  /** HTTP status text returned by the AWC API. */
  public readonly statusText: string;
  /** The response body as text, if it could be read. */
  public readonly body: string;
  /** The URL that was requested. */
  public readonly url: string;

  /**
   * Creates a new {@link AwcFetchError}.
   *
   * @param params - Fields captured from the failed response.
   */
  public constructor(params: {
    /** HTTP status code returned by the AWC API. */
    status: number;
    /** HTTP status text returned by the AWC API. */
    statusText: string;
    /** The response body as text, if it could be read. */
    body: string;
    /** The URL that was requested. */
    url: string;
  }) {
    super(`AWC request to ${params.url} failed: ${params.status} ${params.statusText}`);
    this.name = 'AwcFetchError';
    this.status = params.status;
    this.statusText = params.statusText;
    this.body = params.body;
    this.url = params.url;
  }
}

/**
 * Builds a fully-qualified AWC API URL for a given endpoint path and query
 * parameter map. Undefined values are dropped, and array values are joined
 * with commas (the convention AWC uses for multi-station queries).
 *
 * @param endpoint - Endpoint path relative to the base URL (e.g. `metar`).
 * @param params - Query parameters to encode.
 * @param baseUrl - Optional base URL override; defaults to {@link DEFAULT_AWC_BASE_URL}.
 * @returns The fully-qualified request URL.
 */
export function buildAwcUrl(
  endpoint: string,
  params: Record<string, string | string[] | undefined>,
  baseUrl: string = DEFAULT_AWC_BASE_URL,
): string {
  const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const trimmedEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = new URL(`${trimmedBase}/${trimmedEndpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    const joined = Array.isArray(value) ? value.join(',') : value;
    url.searchParams.set(key, joined);
  }
  return url.toString();
}

/**
 * Issues a GET request to the AWC API and returns the response body as text.
 * Throws {@link AwcFetchError} on non-2xx responses. Network errors bubble up.
 *
 * @param url - Fully-qualified URL to request.
 * @param options - Optional abort signal for cancellation.
 * @returns The response body as a UTF-8 string.
 */
export async function requestAwcText(
  url: string,
  options: { signal?: AbortSignal } = {},
): Promise<string> {
  const init: RequestInit = {};
  if (options.signal !== undefined) {
    init.signal = options.signal;
  }
  const response = await fetch(url, init);
  const body = await response.text();
  if (!response.ok) {
    throw new AwcFetchError({
      status: response.status,
      statusText: response.statusText,
      body,
      url,
    });
  }
  return body;
}

/**
 * A single record that failed to parse, along with the thrown error.
 */
export interface ParseRecordError {
  /** The raw text that failed to parse. */
  raw: string;
  /** The error thrown by the parser. */
  error: unknown;
}

/**
 * Splits a response body into non-empty, trimmed lines.
 * Suitable for formats where each record is on its own line (METAR, PIREP).
 *
 * @param raw - The full response body.
 * @returns Non-empty lines in input order.
 */
export function splitLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Splits an AWC TAF response body into individual TAF records.
 *
 * The AWC TAF endpoint returns each record starting with a `TAF` token at
 * the beginning of a line, followed by indented continuation lines for the
 * base forecast and any change groups. Records may be separated by either a
 * blank line or a single newline (with the next `TAF` line immediately
 * following), so the splitter recognizes a `TAF` header at the start of a
 * line as a record boundary in addition to blank lines.
 *
 * @param raw - The full response body.
 * @returns Non-empty TAF records in input order, with internal whitespace preserved.
 */
export function splitTafs(raw: string): string[] {
  return raw
    .split(/(?:\r?\n){2,}|\r?\n(?=TAF\b)/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

/**
 * Splits an AWC SIGMET/ISIGMET raw response into the WMO-format bulletin
 * bodies it contains, stripping AWC's API-specific wire-format wrappers.
 *
 * AWC concatenates multiple SIGMETs into one response body using a line of
 * 10+ dashes as a record separator, and prepends each record with one or
 * more preamble lines such as `Type: SIGMET Hazard: CONVECTIVE` (domestic
 * `/airsigmet`) or `Hazard: TS` (international `/isigmet`). These wrappers
 * are specific to AWC's response format and are not part of the WMO SIGMET
 * bulletin specification, so this helper removes them before the body is
 * handed to the pure parser.
 *
 * @param raw - The full AWC response body.
 * @returns The WMO-format bulletin bodies in input order.
 */
export function splitAwcBulletins(raw: string): string[] {
  return raw
    .split(/^[ \t]*-{10,}[ \t]*$/m)
    .map(stripAwcPreamble)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

/**
 * Strips any contiguous leading `Type:` / `Hazard:` preamble lines that AWC
 * prepends to each bulletin in its raw response.
 */
function stripAwcPreamble(block: string): string {
  const lines = block.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const candidate = lines[i]!.trim();
    if (candidate.length === 0 || /^(Type|Hazard):/.test(candidate)) {
      i++;
      continue;
    }
    break;
  }
  return lines.slice(i).join('\n');
}

/**
 * Applies a parser to each record, partitioning successful results from errors.
 *
 * @param records - Raw record strings to parse.
 * @param parser - Parser function to invoke on each record.
 * @returns Successful results and any parse errors, preserving input order.
 */
export function parseRecords<T>(
  records: string[],
  parser: (raw: string) => T,
): { results: T[]; parseErrors: ParseRecordError[] } {
  const results: T[] = [];
  const parseErrors: ParseRecordError[] = [];
  for (const record of records) {
    try {
      results.push(parser(record));
    } catch (error) {
      parseErrors.push({ raw: record, error });
    }
  }
  return { results, parseErrors };
}
