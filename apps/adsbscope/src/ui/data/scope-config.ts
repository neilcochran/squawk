import { CONFIG_PATH } from '../../shared/protocol.js';
import type { ScopeConfig } from '../../shared/protocol.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validates a decoded `/api/config` response.
 *
 * @param value - The decoded JSON body.
 * @returns The config, or undefined if the body is not a usable {@link ScopeConfig}.
 */
export function parseScopeConfig(value: unknown): ScopeConfig | undefined {
  if (!isRecord(value) || !isRecord(value.receiver)) {
    return undefined;
  }
  const { receiver, source, station, rangeNm } = value;
  if (
    typeof receiver.lat !== 'number' ||
    typeof receiver.lon !== 'number' ||
    (source !== 'json' && source !== 'sbs' && source !== 'beast' && source !== 'replay') ||
    typeof station !== 'string' ||
    typeof rangeNm !== 'number' ||
    !(rangeNm > 0)
  ) {
    return undefined;
  }
  return { receiver: { lat: receiver.lat, lon: receiver.lon }, source, station, rangeNm };
}

/**
 * Loads the session config from the scope server.
 *
 * @param fetchImpl - Override for the global `fetch`, for tests.
 * @returns The config, or undefined if the request failed or the body was not usable.
 */
export async function fetchScopeConfig(
  fetchImpl: typeof fetch = fetch,
): Promise<ScopeConfig | undefined> {
  try {
    const response = await fetchImpl(CONFIG_PATH);
    if (!response.ok) {
      return undefined;
    }
    return parseScopeConfig(await response.json());
  } catch {
    return undefined;
  }
}
