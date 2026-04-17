/**
 * @packageDocumentation
 * Opt-in fetch layer for the Aviation Weather Center (AWC) text API.
 * Each `fetch*` function issues a single HTTP request, splits the response
 * into individual records, and runs the corresponding parser from the core
 * `@squawk/weather` package. Network usage is isolated to this subpath so
 * consumers who only need parsing can avoid pulling it in.
 */
export { fetchMetar } from './metar.js';
export type { FetchMetarResult } from './metar.js';
export { fetchTaf } from './taf.js';
export type { FetchTafResult } from './taf.js';
export { fetchPirep } from './pirep.js';
export type { FetchPirepOptions, FetchPirepResult, PirepMinimumIntensity } from './pirep.js';
export { fetchSigmets } from './sigmet.js';
export type { FetchSigmetsOptions, FetchSigmetsResult, SigmetHazardFilter } from './sigmet.js';
export { fetchInternationalSigmets } from './international-sigmet.js';
export type { FetchInternationalSigmetsResult } from './international-sigmet.js';
export { AwcFetchError, DEFAULT_AWC_BASE_URL } from './client.js';
export type { FetchWeatherOptions, ParseRecordError } from './client.js';
