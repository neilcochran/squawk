import type { IcaoRegistry } from '@squawk/icao-registry';
import type { Aircraft, AircraftRegistration } from '@squawk/types';

/**
 * Per-`icaoHex` memoization cache for {@link enrichAircraftList} lookups.
 * Stores `undefined` for a resolved miss too, so a hex with no registry
 * match isn't looked up again on every render - an aircraft's registration
 * never changes for the lifetime of a tracked session.
 */
export type RegistrationCache = Map<string, AircraftRegistration | undefined>;

/**
 * Returns a new array with each aircraft's `registration` field populated
 * from `registry`, memoizing lookups in `cache` by `icaoHex` so a given hex
 * is only resolved once regardless of how many times this runs. `adsb-feed`
 * never populates `Aircraft.registration` itself, so this is adsbtop's own
 * enrichment step, applied client-side after the feed's own normalization.
 *
 * @param aircraft - The aircraft to enrich, in any order.
 * @param registry - The loaded registry to query, or undefined while it's still loading - aircraft pass through unchanged in that case.
 * @param cache - Mutated in place with any newly-resolved lookups.
 * @returns A new array; aircraft with no registry match keep their original (unmodified) object reference.
 */
export function enrichAircraftList(
  aircraft: readonly Aircraft[],
  registry: IcaoRegistry | undefined,
  cache: RegistrationCache,
): Aircraft[] {
  if (registry === undefined) {
    return [...aircraft];
  }
  return aircraft.map((entry) => {
    if (!cache.has(entry.icaoHex)) {
      cache.set(entry.icaoHex, registry.lookup(entry.icaoHex));
    }
    const registration = cache.get(entry.icaoHex);
    return registration === undefined ? entry : { ...entry, registration };
  });
}
