import type { Coordinates } from '@squawk/types';

import type { VideoMapAirspace, VideoMapSourceData } from './build.js';

/** The slice of a GeoJSON feature the airspace adapter reads. Structural, so it needs no GeoJSON typings. */
interface AirspaceFeatureLike {
  /** The feature's properties, of which only `type` is read. */
  properties: Readonly<Record<string, unknown>> | null;
  /** The feature's geometry; only polygons are used. */
  geometry: {
    /** The GeoJSON geometry type. */
    type: string;
    /** For a polygon, its rings of `[lon, lat]` positions. Absent on a geometry collection. */
    coordinates?: unknown;
  };
}

function toRing(ring: unknown): Coordinates[] {
  if (!Array.isArray(ring)) {
    return [];
  }
  const positions: Coordinates[] = [];
  for (const vertex of ring) {
    if (Array.isArray(vertex) && typeof vertex[0] === 'number' && typeof vertex[1] === 'number') {
      positions.push({ lat: vertex[1], lon: vertex[0] });
    }
  }
  return positions;
}

/**
 * Reduces GeoJSON airspace features to the type and rings the video map
 * needs, skipping anything that is not a polygon with a string `type`
 * property. GeoJSON positions are `[lon, lat]`; the result is `{ lat, lon }`.
 *
 * @param features - The features of an airspace `FeatureCollection`.
 * @returns One entry per usable feature.
 */
export function adaptAirspaceFeatures(
  features: readonly AirspaceFeatureLike[],
): VideoMapAirspace[] {
  const airspace: VideoMapAirspace[] = [];
  for (const feature of features) {
    const type = feature.properties?.type;
    const rings = feature.geometry.coordinates;
    if (feature.geometry.type !== 'Polygon' || typeof type !== 'string' || !Array.isArray(rings)) {
      continue;
    }
    airspace.push({ type, rings: rings.map(toRing) });
  }
  return airspace;
}

/**
 * Loads the bundled FAA snapshots the video map is built from. The data
 * packages parse their snapshots as they are imported, which takes several
 * hundred milliseconds, so they are imported here, on demand, rather than at
 * the top of a module the CLI loads at startup - `--help` should not pay for
 * them.
 *
 * @returns The source records.
 */
export async function loadBundledVideoMapData(): Promise<VideoMapSourceData> {
  const [airports, navaids, fixes, airspace] = await Promise.all([
    import('@squawk/airport-data'),
    import('@squawk/navaid-data'),
    import('@squawk/fix-data'),
    import('@squawk/airspace-data'),
  ]);
  return {
    airports: airports.usBundledAirports.records,
    navaids: navaids.usBundledNavaids.records,
    fixes: fixes.usBundledFixes.records,
    airspace: adaptAirspaceFeatures(airspace.usBundledAirspace.features),
  };
}
