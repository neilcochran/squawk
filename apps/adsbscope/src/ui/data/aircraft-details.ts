import { AIRCRAFT_PATH_PREFIX } from '../../shared/protocol.js';
import type { ScopeAircraftDetails } from '../../shared/protocol.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Validates a decoded aircraft details response. Only the two fields every
 * record has are required; an optional field of the wrong type is dropped
 * rather than failing the whole record.
 *
 * @param value - The decoded JSON body.
 * @returns The details, or undefined if the body is not a registry record.
 */
export function parseAircraftDetails(value: unknown): ScopeAircraftDetails | undefined {
  if (
    !isRecord(value) ||
    typeof value.icaoHex !== 'string' ||
    typeof value.registration !== 'string'
  ) {
    return undefined;
  }
  const make = optionalString(value.make);
  const model = optionalString(value.model);
  const operator = optionalString(value.operator);
  return {
    icaoHex: value.icaoHex,
    registration: value.registration,
    ...(make !== undefined && { make }),
    ...(model !== undefined && { model }),
    ...(operator !== undefined && { operator }),
    ...(typeof value.yearManufactured === 'number' && {
      yearManufactured: value.yearManufactured,
    }),
  };
}

/**
 * Builds the URL of one aircraft's details.
 *
 * @param icaoHex - The aircraft's ICAO hex.
 * @returns The URL, relative to the scope server.
 */
export function aircraftDetailsUrl(icaoHex: string): string {
  return `${AIRCRAFT_PATH_PREFIX}${encodeURIComponent(icaoHex)}`;
}

/**
 * Fetches what the registry records about an aircraft. Most aircraft are not
 * in it - it covers one country's register - and the scope may be running
 * without it, so finding nothing is the ordinary case, not a failure.
 *
 * @param icaoHex - The aircraft's ICAO hex.
 * @param fetchImpl - The `fetch` to use. Defaults to the global one; specs substitute a stub.
 * @returns The details, or undefined if the registry has none, the request failed, or the body was not a record.
 */
export async function fetchAircraftDetails(
  icaoHex: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ScopeAircraftDetails | undefined> {
  try {
    const response = await fetchImpl(aircraftDetailsUrl(icaoHex));
    if (!response.ok) {
      return undefined;
    }
    return parseAircraftDetails(await response.json());
  } catch {
    return undefined;
  }
}
