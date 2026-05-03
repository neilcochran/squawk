import { parseTaf } from '../taf-parser.js';
import type { Taf } from '../types/index.js';

import {
  buildAwcUrl,
  parseRecords,
  requestAwcText,
  splitTafs,
  type FetchWeatherOptions,
  type ParseRecordError,
} from './client.js';

/**
 * Result returned by {@link fetchTaf}.
 */
export interface FetchTafResult {
  /** Successfully parsed TAFs, in the order returned by the AWC API. */
  tafs: Taf[];
  /** Records the parser threw on, preserving the raw input and the error. */
  parseErrors: ParseRecordError[];
  /** The full raw response body from the AWC API. */
  raw: string;
}

/**
 * Fetches TAFs from the Aviation Weather Center text API and parses each
 * record. Each TAF in the AWC response begins with a `TAF` token at the
 * start of a line, followed by indented continuation lines for the base
 * forecast and any change groups; records may be separated by either a
 * blank line or a single newline.
 *
 * ```typescript
 * import { fetchTaf } from '@squawk/weather/fetch';
 *
 * const { tafs } = await fetchTaf(['KJFK', 'KLAX']);
 * console.log(tafs[0]?.stationId); // "KJFK"
 * ```
 *
 * @param ids - A single ICAO station identifier or an array of identifiers.
 * @param options - Optional abort signal and base URL override.
 * @returns The parsed TAFs, any per-record parse errors, and the raw body.
 */
export async function fetchTaf(
  ids: string | string[],
  options: FetchWeatherOptions = {},
): Promise<FetchTafResult> {
  const url = buildAwcUrl('taf', { ids, format: 'raw' }, options.baseUrl);
  const requestOptions: { signal?: AbortSignal } = {};
  if (options.signal !== undefined) {
    requestOptions.signal = options.signal;
  }
  const raw = await requestAwcText(url, requestOptions);
  const { results, parseErrors } = parseRecords(splitTafs(raw), parseTaf);
  return { tafs: results, parseErrors, raw };
}
