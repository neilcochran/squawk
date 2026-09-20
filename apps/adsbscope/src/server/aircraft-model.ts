import type { AircraftRegistration } from '@squawk/types';

import type { ScopeAircraftDetails } from '../shared/protocol.js';

/** Looks up the model an aircraft is registered as, by its ICAO hex. Undefined when the aircraft is not in the registry, or while there is no registry to look in. */
export type AircraftModelLookup = (icaoHex: string) => string | undefined;

/** The part of an ICAO registry the model lookup reads. */
export interface RegistrationSource {
  /** Finds an aircraft's registration by its ICAO hex, in any letter case. */
  lookup(icaoHex: string): AircraftRegistration | undefined;
}

/** Options for {@link createAircraftModelProvider}. */
export interface AircraftModelProviderOptions {
  /** Loads the registry. Defaults to {@link loadBundledRegistry}; specs substitute a small one. */
  loadRegistry?: () => Promise<RegistrationSource>;
}

/** A source of aircraft models that starts empty and fills in once its registry has loaded. */
export interface AircraftModelProvider {
  /** Loads the registry. Until it resolves, and if it rejects, {@link AircraftModelProvider.lookup} finds nothing. */
  load(): Promise<void>;
  /** Looks up an aircraft's model. Safe to call at any time. */
  lookup: AircraftModelLookup;
  /** Looks up everything the registry records about an aircraft. Undefined when the aircraft is not in the registry, or while there is no registry to look in. */
  details(icaoHex: string): ScopeAircraftDetails | undefined;
}

function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/**
 * Reduces a registry record to what the scope shows of it, dropping fields
 * the registry left blank.
 *
 * @param registration - The registry record.
 * @returns The details, with only the fields that hold something.
 */
export function toAircraftDetails(registration: AircraftRegistration): ScopeAircraftDetails {
  const make = nonBlank(registration.make);
  const model = nonBlank(registration.model);
  const operator = nonBlank(registration.operator);
  return {
    icaoHex: registration.icaoHex,
    registration: registration.registration,
    ...(make !== undefined && { make }),
    ...(model !== undefined && { model }),
    ...(operator !== undefined && { operator }),
    ...(registration.yearManufactured !== undefined && {
      yearManufactured: registration.yearManufactured,
    }),
  };
}

/**
 * Loads the bundled FAA aircraft registry. The data package parses its
 * snapshot as it is imported - about a second, a spike of several hundred
 * megabytes while it parses, and over 300,000 records kept for as long as the
 * process runs - so it is imported here, on demand, and only when the
 * registry has not been turned off.
 *
 * @returns The registry, indexed by ICAO hex.
 */
export async function loadBundledRegistry(): Promise<RegistrationSource> {
  const [{ createIcaoRegistry }, { usBundledRegistry }] = await Promise.all([
    import('@squawk/icao-registry'),
    import('@squawk/icao-registry-data'),
  ]);
  return createIcaoRegistry({ data: usBundledRegistry.records });
}

/**
 * Creates the scope's source of aircraft models. Nothing is loaded until
 * {@link AircraftModelProvider.load} is called, so a scope started with the
 * registry turned off never pays for it; lookups simply find nothing.
 *
 * @param options - Injectable registry loading.
 * @returns The provider.
 */
export function createAircraftModelProvider(
  options: AircraftModelProviderOptions = {},
): AircraftModelProvider {
  const loadRegistry = options.loadRegistry ?? loadBundledRegistry;
  let registry: RegistrationSource | undefined;
  return {
    async load(): Promise<void> {
      registry = await loadRegistry();
    },
    lookup(icaoHex: string): string | undefined {
      return nonBlank(registry?.lookup(icaoHex)?.model);
    },
    details(icaoHex: string): ScopeAircraftDetails | undefined {
      const registration = registry?.lookup(icaoHex);
      return registration === undefined ? undefined : toAircraftDetails(registration);
    },
  };
}
