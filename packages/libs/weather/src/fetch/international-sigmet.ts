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
 * Result returned by {@link fetchInternationalSigmets}.
 */
export interface FetchInternationalSigmetsResult {
  /** Successfully parsed international SIGMETs, in the order returned by the AWC API. */
  sigmets: Sigmet[];
  /** Bulletin blocks the parser threw on, preserving the WMO body and the error. */
  parseErrors: ParseRecordError[];
  /** The full raw response body from the AWC API. */
  raw: string;
}

/**
 * Fetches all currently active international (ICAO-format) SIGMETs from the
 * Aviation Weather Center and parses each bulletin.
 *
 * The AWC `isigmet` endpoint does not include SIGMETs issued by the United
 * States in domestic format; use {@link fetchSigmets} for those. Multiple
 * SIGMETs come back concatenated in one response body, each prefixed with
 * a `Hazard: X` line and separated by a line of dashes. These AWC-specific
 * wrappers are stripped before each bulletin is parsed, so the bodies
 * reaching {@link parseSigmet} are standard ICAO-format SIGMET bulletins.
 *
 * ```typescript
 * import { fetchInternationalSigmets } from '@squawk/weather/fetch';
 *
 * const { sigmets } = await fetchInternationalSigmets();
 * for (const sigmet of sigmets) {
 *   if (sigmet.format === 'INTERNATIONAL') {
 *     console.log(sigmet.firCode, sigmet.phenomena);
 *   }
 * }
 * ```
 *
 * @param options - Optional abort signal and base URL override.
 * @returns The parsed SIGMETs, any per-bulletin parse errors, and the raw body.
 */
export async function fetchInternationalSigmets(
  options: FetchWeatherOptions = {},
): Promise<FetchInternationalSigmetsResult> {
  const url = buildAwcUrl('isigmet', { format: 'raw' }, options.baseUrl);
  const requestOptions: { signal?: AbortSignal } = {};
  if (options.signal !== undefined) {
    requestOptions.signal = options.signal;
  }
  const raw = await requestAwcText(url, requestOptions);
  const { results, parseErrors } = parseRecords(splitAwcBulletins(raw), parseSigmet);
  return { sigmets: results, parseErrors, raw };
}
