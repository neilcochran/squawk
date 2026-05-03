import { parsePirep } from '../pirep-parser.js';
import type { Pirep } from '../types/index.js';

import {
  buildAwcUrl,
  parseRecords,
  requestAwcText,
  splitLines,
  type FetchWeatherOptions,
  type ParseRecordError,
} from './client.js';

/**
 * Minimum PIREP intensity accepted by the AWC `inten` filter.
 */
export type PirepMinimumIntensity = 'lgt' | 'mod' | 'sev';

/**
 * Options accepted by {@link fetchPirep}. Extends {@link FetchWeatherOptions}
 * with the optional filter parameters supported by the AWC `pirep` endpoint.
 */
export interface FetchPirepOptions extends FetchWeatherOptions {
  /** Radial distance in nautical miles to search from the center station. */
  distance?: number;
  /** Hours back to search for reports. */
  age?: number;
  /** Altitude in hundreds of feet; AWC widens +/-3000 ft around this value. */
  level?: number;
  /** Minimum report intensity to include. */
  inten?: PirepMinimumIntensity;
}

/**
 * Result returned by {@link fetchPirep}.
 */
export interface FetchPirepResult {
  /** Successfully parsed PIREPs, in the order returned by the AWC API. */
  pireps: Pirep[];
  /** Records the parser threw on, preserving the raw input and the error. */
  parseErrors: ParseRecordError[];
  /** The full raw response body from the AWC API. */
  raw: string;
}

/**
 * Fetches PIREPs from the Aviation Weather Center text API and parses each
 * record. AWC returns one PIREP per line for the `pirep` endpoint.
 *
 * The PIREP endpoint is station-centric: results are filtered to reports
 * near the given center-point airport. The AWC API accepts a single `id`
 * only (no comma-separated list), so this function takes a single station
 * identifier. The identifier must be a 4-letter ICAO code (e.g. `KDEN`,
 * not `DEN`); AWC returns a 400 `Invalid location specified` for shorter
 * forms.
 *
 * ```typescript
 * import { fetchPirep } from '@squawk/weather/fetch';
 *
 * const { pireps } = await fetchPirep('KDEN', { distance: 100, age: 6 });
 * console.log(pireps[0]?.aircraftType);
 * ```
 *
 * @param id - A 4-letter ICAO station identifier used as the search center.
 * @param options - Optional filter parameters, abort signal, and base URL override.
 * @returns The parsed PIREPs, any per-record parse errors, and the raw body.
 */
export async function fetchPirep(
  id: string,
  options: FetchPirepOptions = {},
): Promise<FetchPirepResult> {
  const url = buildAwcUrl(
    'pirep',
    {
      id,
      format: 'raw',
      distance: options.distance !== undefined ? String(options.distance) : undefined,
      age: options.age !== undefined ? String(options.age) : undefined,
      level: options.level !== undefined ? String(options.level) : undefined,
      inten: options.inten,
    },
    options.baseUrl,
  );
  const requestOptions: { signal?: AbortSignal } = {};
  if (options.signal !== undefined) {
    requestOptions.signal = options.signal;
  }
  const raw = await requestAwcText(url, requestOptions);
  const { results, parseErrors } = parseRecords(splitLines(raw), parsePirep);
  return { pireps: results, parseErrors, raw };
}
