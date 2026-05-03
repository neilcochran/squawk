import { parseSigmet } from '../sigmet-parser.js';
import type { Sigmet } from '../types/index.js';

import {
  buildAwcUrl,
  parseRecords,
  requestAwcText,
  splitAwcBulletins,
  type FetchWeatherOptions,
  type ParseRecordError,
} from './client.js';

/**
 * Hazard type accepted by the AWC `hazard` filter on the SIGMET endpoint.
 */
export type SigmetHazardFilter = 'conv' | 'turb' | 'ice' | 'ifr';

/**
 * Options accepted by {@link fetchSigmets}. Extends {@link FetchWeatherOptions}
 * with the optional `hazard` filter supported by the AWC `airsigmet` endpoint.
 */
export interface FetchSigmetsOptions extends FetchWeatherOptions {
  /** Restrict the response to SIGMETs of the given hazard type. */
  hazard?: SigmetHazardFilter;
}

/**
 * Result returned by {@link fetchSigmets}.
 */
export interface FetchSigmetsResult {
  /** Successfully parsed SIGMETs, in the order returned by the AWC API. */
  sigmets: Sigmet[];
  /** Bulletin blocks the parser threw on, preserving the WMO body and the error. */
  parseErrors: ParseRecordError[];
  /** The full raw response body from the AWC API. */
  raw: string;
}

/**
 * Fetches all currently active domestic (CONUS) SIGMETs from the Aviation
 * Weather Center and parses each bulletin.
 *
 * The AWC `airsigmet` endpoint is not station-filtered; it returns the full
 * current set. Multiple SIGMETs come back concatenated in one response body,
 * wrapped in AWC-specific `Type: X Hazard: Y` preamble lines and separated
 * by a line of dashes. These wrappers are stripped before each bulletin is
 * parsed, so the bodies reaching {@link parseSigmet} are standard WMO-format
 * SIGMET bulletins.
 *
 * ```typescript
 * import { fetchSigmets } from '@squawk/weather/fetch';
 *
 * const { sigmets } = await fetchSigmets({ hazard: 'turb' });
 * for (const sigmet of sigmets) {
 *   console.log(sigmet.format);
 * }
 * ```
 *
 * @param options - Optional hazard filter, abort signal, and base URL override.
 * @returns The parsed SIGMETs, any per-bulletin parse errors, and the raw body.
 */
export async function fetchSigmets(options: FetchSigmetsOptions = {}): Promise<FetchSigmetsResult> {
  const url = buildAwcUrl('airsigmet', { format: 'raw', hazard: options.hazard }, options.baseUrl);
  const requestOptions: { signal?: AbortSignal } = {};
  if (options.signal !== undefined) {
    requestOptions.signal = options.signal;
  }
  const raw = await requestAwcText(url, requestOptions);
  const { results, parseErrors } = parseRecords(splitAwcBulletins(raw), parseSigmet);
  return { sigmets: results, parseErrors, raw };
}
