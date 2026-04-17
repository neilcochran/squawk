import type { Metar } from '../types/index.js';
import { parseMetar } from '../metar-parser.js';
import {
  buildAwcUrl,
  parseRecords,
  requestAwcText,
  splitLines,
  type FetchWeatherOptions,
  type ParseRecordError,
} from './client.js';

/**
 * Result returned by {@link fetchMetar}.
 */
export interface FetchMetarResult {
  /** Successfully parsed METARs, in the order returned by the AWC API. */
  metars: Metar[];
  /** Records the parser threw on, preserving the raw input and the error. */
  parseErrors: ParseRecordError[];
  /** The full raw response body from the AWC API. */
  raw: string;
}

/**
 * Fetches METARs from the Aviation Weather Center text API and parses each
 * record. Partial failures (a single malformed METAR) are surfaced via the
 * `parseErrors` field rather than thrown; network-level errors and non-2xx
 * HTTP responses throw.
 *
 * ```typescript
 * import { fetchMetar } from '@squawk/weather/fetch';
 *
 * const { metars } = await fetchMetar('KJFK');
 * console.log(metars[0]?.stationId); // "KJFK"
 * ```
 *
 * Multiple stations are comma-joined into a single request:
 *
 * ```typescript
 * const { metars } = await fetchMetar(['KJFK', 'KLAX', 'KORD']);
 * ```
 *
 * @param ids - A single ICAO station identifier or an array of identifiers.
 * @param options - Optional abort signal and base URL override.
 * @returns The parsed METARs, any per-record parse errors, and the raw body.
 */
export async function fetchMetar(
  ids: string | string[],
  options: FetchWeatherOptions = {},
): Promise<FetchMetarResult> {
  const url = buildAwcUrl('metar', { ids, format: 'raw' }, options.baseUrl);
  const requestOptions: { signal?: AbortSignal } = {};
  if (options.signal !== undefined) {
    requestOptions.signal = options.signal;
  }
  const raw = await requestAwcText(url, requestOptions);
  const { results, parseErrors } = parseRecords(splitLines(raw), parseMetar);
  return { metars: results, parseErrors, raw };
}
