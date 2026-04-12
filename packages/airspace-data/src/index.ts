import type { FeatureCollection } from 'geojson';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Metadata properties attached to the top-level FeatureCollection describing
 * the NASR data vintage and build provenance.
 */
export interface AirspaceDatasetProperties {
  /** FAA NASR 28-day cycle date in YYYY-MM-DD format (e.g. "2026-01-22"). */
  nasrCycleDate: string;
  /** ISO 8601 timestamp of when the dataset was generated. */
  generatedAt: string;
  /** Total number of airspace features in the dataset. */
  featureCount: number;
}

/**
 * A GeoJSON FeatureCollection with top-level metadata properties describing
 * the NASR cycle and build provenance. Each feature's geometry is a Polygon
 * representing one airspace boundary, and its properties contain the airspace
 * type, name, identifier, floor/ceiling, state, controlling facility, and
 * schedule description.
 */
export interface AirspaceDataset extends FeatureCollection {
  /** Metadata about the NASR cycle and build. */
  properties: AirspaceDatasetProperties;
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/airspace.geojson.gz');

/**
 * Pre-processed GeoJSON snapshot of US airspace geometry derived from the
 * FAA NASR 28-day subscription cycle.
 *
 * Covers Class B, C, D, and E controlled airspace (E2 through E7 subtypes),
 * and Special Use Airspace (MOAs, restricted, prohibited, warning, alert,
 * and national security areas).
 *
 * Each feature's `geometry` is a GeoJSON Polygon representing one airspace
 * boundary. Each feature's `properties` object contains:
 * - `type` - AirspaceType (CLASS_B, CLASS_C, CLASS_D, MOA, RESTRICTED, etc.)
 * - `name` - human-readable name
 * - `identifier` - NASR designator or airport identifier
 * - `floor` / `ceiling` - AltitudeBound objects with valueFt and reference
 * - `state` - two-letter US state abbreviation or null
 * - `controllingFacility` - controlling ARTCC/facility or null
 * - `scheduleDescription` - operating schedule text or null
 *
 * Pass this directly to `createAirspaceResolver()` from `@squawk/airspace`
 * for zero-config airspace queries:
 *
 * ```typescript
 * import { usBundledAirspace } from '@squawk/airspace-data';
 * import { createAirspaceResolver } from '@squawk/airspace';
 *
 * const resolver = createAirspaceResolver({ data: usBundledAirspace });
 * ```
 */
export const usBundledAirspace: AirspaceDataset = JSON.parse(
  gunzipSync(readFileSync(dataPath)).toString('utf-8'),
);
