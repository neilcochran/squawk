import { VIDEO_MAP_PATH, VIDEO_MAP_RANGE_PARAM } from '../../shared/protocol.js';
import type { ScopeVideoMap } from '../../shared/protocol.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validates a decoded video map response. Only the envelope is checked - the
 * server is this app's own, so the features are trusted once the shape is
 * recognizably a map.
 *
 * @param value - The decoded JSON body.
 * @returns The map, or undefined if the body is not one.
 */
export function parseVideoMap(value: unknown): ScopeVideoMap | undefined {
  if (
    !isRecord(value) ||
    typeof value.rangeNm !== 'number' ||
    !Array.isArray(value.points) ||
    !Array.isArray(value.lines)
  ) {
    return undefined;
  }
  return { rangeNm: value.rangeNm, points: value.points, lines: value.lines };
}

/**
 * Builds the URL of the video map for a scope range.
 *
 * @param rangeNm - The scope range in nautical miles.
 * @returns The request URL, relative to the scope server.
 */
export function videoMapUrl(rangeNm: number): string {
  return `${VIDEO_MAP_PATH}?${new URLSearchParams({ [VIDEO_MAP_RANGE_PARAM]: String(rangeNm) })}`;
}

/**
 * Loads the video map for a scope range from the scope server.
 *
 * @param rangeNm - The scope range in nautical miles.
 * @param fetchImpl - Override for the global `fetch`, for tests.
 * @returns The map, or undefined if the request failed or the body was not usable.
 */
export async function fetchVideoMap(
  rangeNm: number,
  fetchImpl: typeof fetch = fetch,
): Promise<ScopeVideoMap | undefined> {
  try {
    const response = await fetchImpl(videoMapUrl(rangeNm));
    if (!response.ok) {
      return undefined;
    }
    return parseVideoMap(await response.json());
  } catch {
    return undefined;
  }
}
