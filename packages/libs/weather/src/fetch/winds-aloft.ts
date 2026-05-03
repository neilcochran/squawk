/**
 * Live fetch helper for the AWC winds-aloft (FD) text product.
 *
 * Wraps the `/api/data/windtemp` endpoint. The AWC URL takes three optional
 * query parameters (region, level, fcst) and returns a single forecast
 * bulletin as `text/plain`. This helper maps its inputs through
 * library-facing names (full-word region identifiers, `altitudeBand`,
 * `forecastHours`) to the AWC wire format and parses the response.
 */

import type { WindsAloftForecast } from '../types/winds-aloft.js';
import { parseWindsAloft } from '../winds-aloft-parser.js';

import { buildAwcUrl, requestAwcText, type FetchWeatherOptions } from './client.js';

/**
 * Geographic region covered by an AWC winds-aloft forecast.
 *
 * - `contiguousUs` - all contiguous US reporting sites (AWC: `us`)
 * - `northeast` - Northeast (AWC: `bos`)
 * - `southeast` - Southeast (AWC: `mia`)
 * - `northCentral` - North Central (AWC: `chi`)
 * - `southCentral` - South Central (AWC: `dfw`)
 * - `rockyMountain` - Rocky Mountain (AWC: `slc`)
 * - `pacificCoast` - Pacific Coast (AWC: `sfo`)
 * - `alaska` - Alaska (AWC: `alaska`)
 * - `hawaii` - Hawaii (AWC: `hawaii`)
 * - `westernPacific` - Western Pacific (AWC: `other_pac`)
 */
export type WindsAloftRegion =
  | 'contiguousUs'
  | 'northeast'
  | 'southeast'
  | 'northCentral'
  | 'southCentral'
  | 'rockyMountain'
  | 'pacificCoast'
  | 'alaska'
  | 'hawaii'
  | 'westernPacific';

/**
 * Altitude band covered by an AWC winds-aloft forecast.
 *
 * - `low` - 3000 ft through 39000 ft (9 altitude columns)
 * - `high` - FL450 and above (typically 2 altitude columns: 45000, 53000)
 */
export type WindsAloftAltitudeBand = 'low' | 'high';

/**
 * Forecast horizon (in hours) for an AWC winds-aloft forecast. AWC issues
 * FD bulletins for 6-, 12-, and 24-hour lead times; requests for other
 * values are rejected upstream.
 */
export type WindsAloftForecastHours = 6 | 12 | 24;

/** Options accepted by {@link fetchWindsAloft}. */
export interface FetchWindsAloftOptions extends FetchWeatherOptions {
  /** Geographic region. When omitted, the AWC API applies its own default. */
  region?: WindsAloftRegion;
  /** Altitude band. When omitted, the AWC API applies its own default. */
  altitudeBand?: WindsAloftAltitudeBand;
  /** Forecast horizon in hours from the issue time. When omitted, the AWC API applies its own default. */
  forecastHours?: WindsAloftForecastHours;
}

/** Result of calling {@link fetchWindsAloft}. */
export interface FetchWindsAloftResult {
  /** The parsed winds-aloft forecast bulletin. */
  forecast: WindsAloftForecast;
  /** The full raw response body from the AWC API. */
  raw: string;
}

/**
 * Maps the library-facing {@link WindsAloftRegion} enum to the raw AWC
 * `region` query-parameter value. Names on the left match our naming
 * conventions; values on the right are the literal strings AWC expects.
 */
const REGION_TO_WIRE: Record<WindsAloftRegion, string> = {
  contiguousUs: 'us',
  northeast: 'bos',
  southeast: 'mia',
  northCentral: 'chi',
  southCentral: 'dfw',
  rockyMountain: 'slc',
  pacificCoast: 'sfo',
  alaska: 'alaska',
  hawaii: 'hawaii',
  westernPacific: 'other_pac',
};

/**
 * Fetches a winds-aloft forecast (FD product) from the Aviation Weather
 * Center text API and parses the response. The AWC endpoint returns a
 * single bulletin per request; if the response body fails to parse,
 * the parser error is thrown as-is (there are no partial-failure
 * semantics as with multi-record endpoints).
 *
 * ```typescript
 * import { fetchWindsAloft } from '@squawk/weather/fetch';
 *
 * const { forecast } = await fetchWindsAloft({
 *   region: 'northeast',
 *   altitudeBand: 'low',
 *   forecastHours: 6,
 * });
 * console.log(forecast.altitudesFt); // [3000, 6000, 9000, 12000, ...]
 * ```
 *
 * @param options - Optional region, altitude band, forecast horizon, abort signal, and base URL override.
 * @returns The parsed forecast and the full raw response body.
 */
export async function fetchWindsAloft(
  options: FetchWindsAloftOptions = {},
): Promise<FetchWindsAloftResult> {
  const params: Record<string, string | undefined> = {
    region: options.region !== undefined ? REGION_TO_WIRE[options.region] : undefined,
    level: options.altitudeBand,
    fcst:
      options.forecastHours !== undefined
        ? String(options.forecastHours).padStart(2, '0')
        : undefined,
  };
  const url = buildAwcUrl('windtemp', params, options.baseUrl);
  const requestOptions: { signal?: AbortSignal } = {};
  if (options.signal !== undefined) {
    requestOptions.signal = options.signal;
  }
  const raw = await requestAwcText(url, requestOptions);
  const forecast = parseWindsAloft(raw);
  return { forecast, raw };
}
