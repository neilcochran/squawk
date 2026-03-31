import type { AircraftRegistration, AircraftType, EngineType } from '@squawk/types';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Shape of a single record in the compact bundled JSON format.
 * Short keys reduce file size across hundreds of thousands of records.
 */
interface CompactRecord {
  /** Registration (N-number). */
  r: string;
  /** Manufacturer name. */
  mk?: string;
  /** Model designation. */
  md?: string;
  /** Operator name. */
  op?: string;
  /** Aircraft type. */
  at?: AircraftType;
  /** Engine type. */
  et?: EngineType;
  /** Year manufactured. */
  yr?: number;
}

/**
 * Shape of the bundled JSON data file.
 */
interface BundledData {
  /** Dataset metadata. */
  meta: {
    /** ISO 8601 timestamp of when the dataset was generated. */
    generatedAt: string;
    /** Total number of records in the dataset. */
    recordCount: number;
  };
  /** Records keyed by uppercase ICAO hex address. */
  records: Record<string, CompactRecord>;
}

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
 * Expands a compact record into a full AircraftRegistration.
 *
 * @param icaoHex - The ICAO hex key from the compact records object.
 * @param compact - The compact record to expand.
 * @returns A full AircraftRegistration object.
 */
function expandRecord(icaoHex: string, compact: CompactRecord): AircraftRegistration {
  const record: AircraftRegistration = {
    icaoHex,
    registration: compact.r,
  };
  if (compact.mk !== undefined) {
    record.make = compact.mk;
  }
  if (compact.md !== undefined) {
    record.model = compact.md;
  }
  if (compact.op !== undefined) {
    record.operator = compact.op;
  }
  if (compact.at !== undefined) {
    record.aircraftType = compact.at;
  }
  if (compact.et !== undefined) {
    record.engineType = compact.et;
  }
  if (compact.yr !== undefined) {
    record.yearManufactured = compact.yr;
  }
  return record;
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/icao-registry.json.gz');
const raw: BundledData = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf-8'));

const records: AircraftRegistration[] = [];
for (const [icaoHex, compact] of Object.entries(raw.records)) {
  records.push(expandRecord(icaoHex, compact));
}

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
  properties: {
    generatedAt: raw.meta.generatedAt,
    recordCount: raw.meta.recordCount,
  },
  records,
};
