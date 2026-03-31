import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FeatureCollection, Feature, Polygon } from 'geojson';
import type { AirspaceFeature } from '@squawk/types';

/**
 * Number of decimal places to retain for all coordinate values in the output.
 * 5 decimal places gives roughly 1.1 meter precision, far exceeding the ~30m
 * precision of the FAA's legal airspace boundary definitions. This eliminates
 * floating-point noise from trig computations and trims excess shapefile
 * precision, significantly reducing output file size.
 */
const COORDINATE_PRECISION = 5;

/**
 * Top-level properties attached to the output GeoJSON FeatureCollection.
 * These metadata fields allow consumers to identify the data vintage and
 * validate the build without inspecting individual features.
 */
interface AirspaceCollectionProperties {
  /** FAA NASR 28-day cycle date in YYYY-MM-DD format (e.g. "2025-02-20"). */
  nasrCycleDate: string;
  /** ISO 8601 timestamp of when this file was generated. */
  generatedAt: string;
  /** Total number of airspace features included in this collection. */
  featureCount: number;
}

/**
 * GeoJSON FeatureCollection with top-level metadata properties describing
 * the NASR data vintage and build provenance.
 */
interface AirspaceFeatureCollection extends FeatureCollection {
  /** Metadata about the NASR cycle and build. */
  properties: AirspaceCollectionProperties;
}

/**
 * Serializes an array of AirspaceFeature objects to a GeoJSON FeatureCollection
 * file at the given output path. The output directory is created recursively if
 * it does not already exist.
 *
 * Each AirspaceFeature is mapped to a GeoJSON Feature where the boundary polygon
 * becomes the geometry and all other fields become the feature properties.
 */
export async function writeOutput(
  /** AirspaceFeature objects to serialize into the output file. */
  features: AirspaceFeature[],
  /** Absolute path to write the output GeoJSON file. */
  outputPath: string,
  /** FAA NASR 28-day cycle date in YYYY-MM-DD format (e.g. "2025-02-20"). */
  nasrCycleDate: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const geoFeatures: Feature[] = features.map((f) => ({
    type: 'Feature',
    geometry: roundPolygonCoords(f.boundary, COORDINATE_PRECISION),
    properties: {
      type: f.type,
      name: f.name,
      identifier: f.identifier,
      floor: f.floor,
      ceiling: f.ceiling,
      state: f.state,
      controllingFacility: f.controllingFacility,
      scheduleDescription: f.scheduleDescription,
    },
  }));

  const collection: AirspaceFeatureCollection = {
    type: 'FeatureCollection',
    properties: {
      nasrCycleDate,
      generatedAt: new Date().toISOString(),
      featureCount: geoFeatures.length,
    },
    features: geoFeatures,
  };

  await writeFile(outputPath, JSON.stringify(collection), 'utf-8');
  console.log(`[write-output] Wrote ${geoFeatures.length} features to ${outputPath}`);
}

/**
 * Returns a new Polygon with all coordinate values rounded to the given
 * number of decimal places.
 */
function roundPolygonCoords(polygon: Polygon, decimals: number): Polygon {
  const factor = 10 ** decimals;
  return {
    type: 'Polygon',
    coordinates: polygon.coordinates.map((ring) =>
      ring.map((coord) => coord.map((v) => Math.round(v * factor) / factor)),
    ),
  };
}
