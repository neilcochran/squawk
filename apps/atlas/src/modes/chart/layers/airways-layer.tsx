import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type { Feature, FeatureCollection, MultiLineString, Position } from 'geojson';
import type { Airway, AirwayType, AirwayWaypoint } from '@squawk/types';
import { useAirwayDataset } from '../../../shared/data/airway-dataset.ts';

/**
 * Properties carried on each airway line feature in the GeoJSON source.
 * Kept narrow so the source payload stays small; richer fields are read
 * straight from the originating `Airway` record once entity inspection
 * lands.
 */
interface AirwayFeatureProperties {
  /** Airway designation (e.g. "V16", "J60"). */
  designation: string;
  /** Airway classification (`'VICTOR'`, `'JET'`, `'RNAV_Q'`, etc.). */
  type: AirwayType;
}

/** MapLibre source id for the airways overlay. */
const AIRWAYS_SOURCE_ID = 'atlas-airways';

/** MapLibre layer id for the airways line symbology. */
const AIRWAYS_LAYER_ID = 'atlas-airways-line';

/**
 * Builds the per-airway segment list, splitting at the antimeridian when
 * consecutive waypoints lie on opposite sides of lon=180. The split uses
 * linear interpolation of the latitude at the crossing, which is good
 * enough for visual rendering on a Mercator-style projection.
 *
 * Returns one or more `Position[]` segments. With no antimeridian
 * crossings the result is a single segment containing every waypoint.
 */
function buildSegments(waypoints: AirwayWaypoint[]): Position[][] {
  const segments: Position[][] = [];
  let current: Position[] = [];
  let prev: AirwayWaypoint | undefined;

  for (const wp of waypoints) {
    if (prev === undefined) {
      current.push([wp.lon, wp.lat]);
      prev = wp;
      continue;
    }

    const lonDiff = wp.lon - prev.lon;
    if (Math.abs(lonDiff) > 180) {
      // The two waypoints are on opposite sides of the antimeridian and the
      // shorter physical path crosses it. Close the current segment at the
      // crossing point, then start a new segment from the wrap on the other
      // side.
      const prevSideCrossingLon = lonDiff > 0 ? -180 : 180;
      const wpSideCrossingLon = lonDiff > 0 ? 180 : -180;
      const wpAdjustedLon = lonDiff > 0 ? wp.lon - 360 : wp.lon + 360;
      const t = (prevSideCrossingLon - prev.lon) / (wpAdjustedLon - prev.lon);
      const crossingLat = prev.lat + t * (wp.lat - prev.lat);

      current.push([prevSideCrossingLon, crossingLat]);
      segments.push(current);
      current = [
        [wpSideCrossingLon, crossingLat],
        [wp.lon, wp.lat],
      ];
    } else {
      current.push([wp.lon, wp.lat]);
    }
    prev = wp;
  }

  segments.push(current);
  return segments;
}

/**
 * Projects the bundled airway records into a GeoJSON `FeatureCollection`
 * suitable for a MapLibre `geojson` source. One `MultiLineString` feature
 * per airway, drawn through the embedded waypoint coordinates in
 * publication order. Each feature's `coordinates` is one or more line
 * segments, split at the antimeridian for Pacific-spanning routes so
 * MapLibre does not draw the long way around the globe. Skips airways
 * with fewer than two waypoints (degenerate).
 */
function toFeatureCollection(
  records: Airway[],
): FeatureCollection<MultiLineString, AirwayFeatureProperties> {
  const features: Feature<MultiLineString, AirwayFeatureProperties>[] = [];
  for (const airway of records) {
    if (airway.waypoints.length < 2) {
      continue;
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'MultiLineString', coordinates: buildSegments(airway.waypoints) },
      properties: {
        designation: airway.designation,
        type: airway.type,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * MapLibre layer styling. Lines are thin and semi-transparent so the
 * airway web reads as a structural underlay rather than dominant
 * symbology. Color is tiered by airway type: low-altitude V-routes and
 * RNAV T-routes in slate, high-altitude J-routes and RNAV Q-routes in
 * indigo, regional and oceanic routes in muted gray.
 */
const AIRWAYS_LAYER_PROPS: LayerProps = {
  id: AIRWAYS_LAYER_ID,
  source: AIRWAYS_SOURCE_ID,
  type: 'line',
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': [
      'match',
      ['get', 'type'],
      ['VICTOR', 'RNAV_T'],
      '#475569',
      ['JET', 'RNAV_Q'],
      '#4338ca',
      '#94a3b8',
    ],
    'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 7, 0.8, 10, 1.6],
    'line-opacity': 0.45,
  },
};

/**
 * Chart-mode overlay that renders airways from `@squawk/airway-data` as
 * MapLibre line features. Returns `null` while the dataset is still being
 * fetched or if the load failed; callers needing fetch-state UI should read
 * the same hook directly.
 */
export function AirwaysLayer(): ReactElement | null {
  const state = useAirwayDataset();

  const data = useMemo<
    FeatureCollection<MultiLineString, AirwayFeatureProperties> | undefined
  >(() => {
    if (state.status !== 'loaded') {
      return undefined;
    }
    return toFeatureCollection(state.dataset.records);
  }, [state]);

  if (data === undefined) {
    return null;
  }

  return (
    <Source id={AIRWAYS_SOURCE_ID} type="geojson" data={data}>
      <Layer {...AIRWAYS_LAYER_PROPS} />
    </Source>
  );
}
