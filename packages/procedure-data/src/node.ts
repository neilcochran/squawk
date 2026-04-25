/**
 * @packageDocumentation
 * Node entry point. Synchronously reads, decompresses, and parses the
 * bundled `data/procedures.json.gz` snapshot at module load time, then
 * exposes the result as a single eager constant. Suitable for server-side
 * Node consumers.
 *
 * Browser and edge consumers should use the {@link "./browser"} entry point
 * instead, which performs the same work asynchronously via `fetch` and
 * `DecompressionStream`.
 */

import type { Procedure } from '@squawk/types';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Metadata properties attached to the procedure dataset describing the
 * FAA CIFP data vintage and build provenance.
 */
export interface ProcedureDatasetProperties {
  /** ISO 8601 timestamp of when the dataset was generated. */
  generatedAt: string;
  /** CIFP cycle effective date in `YYYY-MM-DD` (e.g. "2026-03-25"). */
  cifpCycleDate: string;
  /** Total number of procedure records in the dataset. */
  recordCount: number;
  /** Number of Standard Instrument Departure (SID) procedures. */
  sidCount: number;
  /** Number of Standard Terminal Arrival Route (STAR) procedures. */
  starCount: number;
  /** Number of Instrument Approach Procedure (IAP) procedures. */
  iapCount: number;
  /** Total leg count across all common routes, transitions, and missed approaches. */
  legCount: number;
}

/**
 * A pre-processed array of {@link Procedure} records together with
 * metadata about the build provenance and CIFP cycle.
 */
export interface ProcedureDataset {
  /** Metadata about the dataset build. */
  properties: ProcedureDatasetProperties;
  /** Procedure records. */
  records: Procedure[];
}

/**
 * Internal shape of the bundled JSON file: dataset metadata plus the
 * record array. Matches the wire format produced by the build pipeline.
 */
interface BundledData {
  /** Dataset metadata. */
  meta: ProcedureDatasetProperties;
  /** Procedure records. */
  records: Procedure[];
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/procedures.json.gz');
const raw: BundledData = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf-8'));

/**
 * Pre-processed snapshot of US instrument procedure data derived from
 * the FAA CIFP (Coded Instrument Flight Procedures) 28-day cycle.
 *
 * Contains Standard Instrument Departures (SIDs), Standard Terminal
 * Arrival Routes (STARs), and Instrument Approach Procedures (IAPs) in
 * the unified ARINC 424 leg model, including path terminators,
 * altitude and speed constraints, recommended navaids, RNP values, and
 * FAF / MAP / IAF / FACF flags.
 *
 * Pass the `records` array directly to `createProcedureResolver()` from
 * `@squawk/procedures` for zero-config lookups:
 *
 * ```typescript
 * import { usBundledProcedures } from '@squawk/procedure-data';
 * import { createProcedureResolver } from '@squawk/procedures';
 *
 * const resolver = createProcedureResolver({ data: usBundledProcedures.records });
 * ```
 */
export const usBundledProcedures: ProcedureDataset = {
  properties: raw.meta,
  records: raw.records,
};
