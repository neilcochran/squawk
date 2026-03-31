import type { AircraftRegistration } from '@squawk/types';

/**
 * Configuration options for creating an ICAO registry instance.
 */
export interface IcaoRegistryOptions {
  /** Aircraft registration records to index for lookup. */
  data: AircraftRegistration[];
}

/**
 * An initialized ICAO registry that resolves hex addresses to aircraft
 * registration records.
 */
export interface IcaoRegistry {
  /** Look up an aircraft by its 24-bit ICAO hex address. Returns undefined if not found. */
  lookup(icaoHex: string): AircraftRegistration | undefined;
  /** Total number of records in the loaded dataset. */
  recordCount: number;
}

/**
 * Creates an ICAO registry instance that resolves 24-bit ICAO hex addresses
 * to aircraft registration records.
 *
 * For zero-config use with bundled FAA data, pair with `@squawk/icao-registry-data`:
 *
 * ```typescript
 * import { usBundledRegistry } from '@squawk/icao-registry-data';
 * import { createIcaoRegistry } from '@squawk/icao-registry';
 *
 * const registry = createIcaoRegistry({ data: usBundledRegistry });
 * ```
 *
 * For fresh FAA data, use `parseFaaRegistryZip` to parse a downloaded ZIP:
 *
 * ```typescript
 * import { createIcaoRegistry, parseFaaRegistryZip } from '@squawk/icao-registry';
 *
 * const zipBuffer = await fetch('https://registry.faa.gov/database/ReleasableAircraft.zip')
 *   .then(r => r.arrayBuffer());
 * const data = parseFaaRegistryZip(Buffer.from(zipBuffer));
 * const registry = createIcaoRegistry({ data });
 * ```
 *
 * @param options - Configuration options including the data to index.
 * @returns An initialized IcaoRegistry ready for lookups.
 */
export function createIcaoRegistry(options: IcaoRegistryOptions): IcaoRegistry {
  const index = new Map<string, AircraftRegistration>();
  for (const record of options.data) {
    index.set(record.icaoHex.toUpperCase(), record);
  }

  return {
    lookup(icaoHex: string): AircraftRegistration | undefined {
      return index.get(icaoHex.toUpperCase());
    },
    recordCount: index.size,
  };
}
