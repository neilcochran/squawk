import { createRequire } from 'node:module';
import type { Polygon, MultiPolygon, Feature } from 'geojson';
import type { AirspaceFeature, AirspaceType } from '@squawk/types';
import { normalizeShapefileAltitude } from './normalize-altitude.js';
import { simplifyPolygon } from './simplify-polygon.js';

// The shapefile package is CommonJS-only. createRequire lets us load it from
// an ESM module without converting the whole script to CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);

/** Minimal typing for the parts of the shapefile package used here. */
interface ShapefileSource {
  /** Reads the next feature from the shapefile. */
  read(): Promise<{ done: true } | { done: false; value: Feature<Polygon | MultiPolygon> }>;
}

interface ShapefileModule {
  /** Opens a .shp + .dbf pair and returns an async source of GeoJSON features. */
  open(shpPath: string, dbfPath?: string): Promise<ShapefileSource>;
}

const shapefile = require('shapefile') as ShapefileModule;

/** LOCAL_TYPE values from the Class_Airspace shapefile that we include. */
const INCLUDED_LOCAL_TYPES = new Set([
  'CLASS_B',
  'CLASS_C',
  'CLASS_D',
  'CLASS_E2',
  'CLASS_E3',
  'CLASS_E4',
  'CLASS_E5',
  'CLASS_E6',
  'CLASS_E7',
]);

/**
 * Douglas-Peucker tolerance in degrees applied to Class B/C/D shapefile
 * polygons. A tolerance of 0.0001 degrees is roughly 11 meters, well within
 * the precision of the legal boundary definitions (to the nearest arcsecond,
 * ~30m).
 */
const SIMPLIFICATION_TOLERANCE = 0.0001;

/**
 * Douglas-Peucker tolerance in degrees applied to Class E shapefile polygons.
 * Class E boundaries are predominantly circular arcs encoded with extremely
 * dense vertex counts that resist simplification at the standard tolerance.
 * A tolerance of 0.001 degrees (~111m) produces visually smooth polygons while
 * reducing vertex counts to levels comparable to Class C/D features.
 */
const CLASS_E_SIMPLIFICATION_TOLERANCE = 0.001;

/** Raw attribute fields from the Class_Airspace.dbf record. */
interface ClassAirspaceRecord {
  IDENT: string | null;
  NAME: string | null;
  LOCAL_TYPE: string | null;
  UPPER_VAL: string | null;
  UPPER_UOM: string | null;
  UPPER_CODE: string | null;
  LOWER_VAL: string | null;
  LOWER_UOM: string | null;
  LOWER_CODE: string | null;
  COMM_NAME: string | null;
  WKHR_RMK: string | null;
}

/**
 * Reads the Class_Airspace shapefile and returns one AirspaceFeature for each
 * Class B, C, D, or E polygon. Features whose LOCAL_TYPE is not in the
 * included set are silently skipped.
 *
 * The state field cannot be populated from the shapefile alone; pass the
 * airportStates lookup built by loadAirportStates to enrich it via the
 * feature's IDENT (associated airport identifier).
 */
export async function parseClassAirspace(
  /** Absolute path to the Class_Airspace.shp file. */
  shpPath: string,
  /** Map from airport identifier to two-letter state code. */
  airportStates: Map<string, string>,
): Promise<AirspaceFeature[]> {
  const source = await shapefile.open(shpPath);
  const features: AirspaceFeature[] = [];

  while (true) {
    const result = await source.read();
    if (result.done) {
      break;
    }

    const { geometry, properties } = result.value;
    const attrs = properties as unknown as ClassAirspaceRecord;

    const localType = attrs.LOCAL_TYPE;
    if (!localType || !INCLUDED_LOCAL_TYPES.has(localType)) {
      continue;
    }

    const rawBoundary = extractPolygon(geometry, attrs.NAME ?? localType);
    if (!rawBoundary) {
      continue;
    }

    const tolerance = localType.startsWith('CLASS_E')
      ? CLASS_E_SIMPLIFICATION_TOLERANCE
      : SIMPLIFICATION_TOLERANCE;
    const boundary = simplifyPolygon(rawBoundary, tolerance);

    const ident = attrs.IDENT ?? null;

    features.push({
      type: localType as AirspaceType,
      name: attrs.NAME ?? '',
      identifier: ident ?? '',
      floor: normalizeShapefileAltitude(attrs.LOWER_VAL, attrs.LOWER_UOM, attrs.LOWER_CODE),
      ceiling: normalizeShapefileAltitude(attrs.UPPER_VAL, attrs.UPPER_UOM, attrs.UPPER_CODE),
      boundary,
      state: ident ? (airportStates.get(ident) ?? null) : null,
      controllingFacility: attrs.COMM_NAME ?? null,
      scheduleDescription: attrs.WKHR_RMK ?? null,
    });
  }

  return features;
}

/**
 * Extracts a single Polygon from a shapefile geometry. For MultiPolygon
 * geometries only the largest ring by coordinate count is used, which is
 * correct for all known Class B/C/D/E records. Logs a warning and returns null
 * for any geometry type that cannot be handled.
 */
function extractPolygon(geometry: Polygon | MultiPolygon, label: string): Polygon | null {
  if (geometry.type === 'Polygon') {
    return geometry;
  }

  if (geometry.type === 'MultiPolygon') {
    // Pick the polygon with the most exterior ring coordinates as a proxy for
    // the largest/most significant polygon.
    const largest = geometry.coordinates.reduce((best, current) =>
      (current[0]?.length ?? 0) > (best[0]?.length ?? 0) ? current : best,
    );
    console.warn(`[parse-class-airspace] MultiPolygon for "${label}" - using largest ring only.`);
    return { type: 'Polygon', coordinates: largest };
  }

  console.warn(`[parse-class-airspace] Unexpected geometry type for "${label}" - skipping.`);
  return null;
}
