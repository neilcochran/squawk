import { isIcaoHex, isScopeModeId, MAX_RANGE_NM } from '../../shared/protocol.js';
import type { ScopeModeId } from '../../shared/protocol.js';

/** The query parameters the scope keeps its view in, so that a view can be bookmarked or shared. */
export const URL_STATE_PARAMS = {
  /** The view style. */
  mode: 'mode',
  /** The scope range in nautical miles. */
  range: 'range',
  /** The ICAO hex of the selected aircraft. */
  selected: 'selected',
} as const;

/** The parts of the scope's view that a URL can carry. A part the URL does not give, or gives badly, is undefined. */
export interface UrlState {
  /** The view style. */
  modeId: ScopeModeId | undefined;
  /** The scope range in nautical miles. */
  rangeNm: number | undefined;
  /** The ICAO hex of the selected aircraft, lowercase. */
  selectedIcaoHex: string | undefined;
}

/** The view the scope would show with nothing in the URL: what the command line asked for. */
export interface UrlStateDefaults {
  /** The view style the scope starts in. */
  modeId: ScopeModeId;
  /** The scope range the scope starts at. */
  rangeNm: number;
}

/**
 * Reads the scope's view out of a URL's query string. Every parameter is
 * validated as strictly as the command line validates its flags, and one
 * that fails is ignored rather than trusted: the URL is whatever someone
 * typed or pasted.
 *
 * @param search - The URL's query string, with or without its leading `?`.
 * @returns What the URL asks for.
 */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const mode = params.get(URL_STATE_PARAMS.mode);
  const range = Number(params.get(URL_STATE_PARAMS.range) ?? Number.NaN);
  const selected = params.get(URL_STATE_PARAMS.selected);
  return {
    modeId: mode !== null && isScopeModeId(mode) ? mode : undefined,
    rangeNm: range > 0 && range <= MAX_RANGE_NM ? range : undefined,
    selectedIcaoHex: selected !== null && isIcaoHex(selected) ? selected.toLowerCase() : undefined,
  };
}

/**
 * Writes the scope's view as a URL query string. A part that matches what
 * the scope would show anyway is left out, so an untouched scope keeps a
 * clean URL and a bookmark only pins what was deliberately changed.
 *
 * @param state - The view to write.
 * @param defaults - The view the scope shows with nothing in the URL.
 * @returns The query string, with its leading `?`, or an empty string if there is nothing to write.
 */
export function formatUrlSearch(
  state: { modeId: ScopeModeId; rangeNm: number; selectedIcaoHex: string | undefined },
  defaults: UrlStateDefaults,
): string {
  const params = new URLSearchParams();
  if (state.modeId !== defaults.modeId) {
    params.set(URL_STATE_PARAMS.mode, state.modeId);
  }
  if (state.rangeNm !== defaults.rangeNm) {
    params.set(URL_STATE_PARAMS.range, String(state.rangeNm));
  }
  if (state.selectedIcaoHex !== undefined) {
    params.set(URL_STATE_PARAMS.selected, state.selectedIcaoHex);
  }
  const search = params.toString();
  return search === '' ? '' : `?${search}`;
}
