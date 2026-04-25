/**
 * @packageDocumentation
 * Node entry point. Synchronously reads, decompresses, and parses the
 * bundled `data/icao-registry.json.gz` snapshot at module load time, then
 * exposes the result as a single eager constant. Suitable for server-side
 * Node consumers.
 *
 * Browser and edge consumers should use the {@link "./browser"} entry point
 * instead, which performs the same work asynchronously via `fetch` and
 * `DecompressionStream`.
 */

import type { AircraftRegistration } from '@squawk/types';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Metadata properties attached to the registry dataset describing
 * the FAA data vintage and build provenance.
 */
export interface RegistryDatasetProperties {
  /** ISO 8601 timestamp of when the dataset was generated. */
  generatedAt: string;
  /** Total number of aircraft registration records in the dataset. */
  recordCount: number;
}

/**
 * A pre-processed array of AircraftRegistration records with attached
 * metadata about the build provenance.
 */
export interface RegistryDataset {
  /** Metadata about the dataset build. */
  properties: RegistryDatasetProperties;
  /** Aircraft registration records. */
  records: AircraftRegistration[];
}

/**
 * Internal shape of the bundled JSON file: dataset metadata plus the
 * record array. Matches the wire format produced by the build pipeline.
 */
interface BundledData {
  /** Dataset metadata. */
  meta: RegistryDatasetProperties;
  /** Aircraft registration records. */
  records: AircraftRegistration[];
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/icao-registry.json.gz');
const raw: BundledData = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf-8'));

/**
 * Pre-processed snapshot of US aircraft registrations derived from the
 * FAA ReleasableAircraft database.
 *
 * Contains registration, make, model, operator, aircraft type, engine type,
 * and year of manufacture for all US-registered aircraft with an assigned
 * ICAO hex address.
 *
 * Pass the `records` array directly to `createIcaoRegistry()` from
 * `@squawk/icao-registry` for zero-config lookups:
 *
 * ```typescript
 * import { usBundledRegistry } from '@squawk/icao-registry-data';
 * import { createIcaoRegistry } from '@squawk/icao-registry';
 *
 * const registry = createIcaoRegistry({ data: usBundledRegistry.records });
 * ```
 */
export const usBundledRegistry: RegistryDataset = {
  properties: raw.meta,
  records: raw.records,
};
