import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Feature, FeatureCollection, MultiLineString } from 'geojson';
import type { Airway, AirwayType } from '@squawk/types';
import { useAirwayDataset } from '../../../shared/data/airway-dataset.ts';
import { useActiveHighlightRef } from '../highlight-context.ts';
import { AIRWAY_CATEGORY_TYPES, CHART_ROUTE_PATH } from '../url-state.ts';
import { buildSegments } from './airway-segments.ts';

const route = getRouteApi(CHART_ROUTE_PATH);

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
export const AIRWAYS_LAYER_ID = 'atlas-airways-line';

/** MapLibre layer id for the airway selection-highlight overlay. */
const AIRWAYS_HIGHLIGHT_LAYER_ID = 'atlas-airways-highlight';

/**
 * Filter expression that matches no feature. Used as the default for the
 * highlight layer when no airway is currently active.
 */
const MATCH_NONE_FILTER: ExpressionSpecification = [
  '==',
  ['get', 'designation'],
  '__atlas-no-match__',
];

/**
 * Highlight overlay for the currently-selected (or chip-hovered) airway.
 * Thicker stroke in dark slate over a wider yellow halo so the airway
 * still reads as a line (not a band) at any zoom.
 */
const AIRWAYS_HIGHLIGHT_LAYER_BASE: LayerProps = {
  id: AIRWAYS_HIGHLIGHT_LAYER_ID,
  source: AIRWAYS_SOURCE_ID,
  type: 'line',
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#fde047',
    'line-width': 4,
    'line-opacity': 0.95,
  },
};

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
 * MapLibre layer styling, sans filter. Lines are thin and semi-transparent
 * so the airway web reads as a structural underlay rather than dominant
 * symbology. Color is tiered by airway type: low-altitude V-routes and
 * RNAV T-routes in slate, high-altitude J-routes and RNAV Q-routes in
 * indigo, regional and oceanic routes in muted gray. The visibility filter
 * is built per-render from the active `airwayCategories` URL state.
 */
const AIRWAYS_LAYER_BASE: LayerProps = {
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
 * MapLibre line features. Reads the active `airwayCategories` from URL
 * state and applies a MapLibre `filter` expression so toggling categories
 * shows or hides only the matching airways without rebuilding the GeoJSON
 * source. Returns `null` while the dataset is still being fetched or if
 * the load failed; callers needing fetch-state UI should read the same
 * hook directly.
 */
export function AirwaysLayer(): ReactElement | null {
  const { airwayCategories } = route.useSearch();
  const state = useAirwayDataset();
  const activeRef = useActiveHighlightRef();

  const enabledTypes = useMemo<readonly AirwayType[]>(
    () => airwayCategories.flatMap((category) => AIRWAY_CATEGORY_TYPES[category]),
    [airwayCategories],
  );

  const filter = useMemo<ExpressionSpecification>(
    () => ['in', ['get', 'type'], ['literal', [...enabledTypes]]],
    [enabledTypes],
  );

  const layerProps = useMemo<LayerProps>(() => ({ ...AIRWAYS_LAYER_BASE, filter }), [filter]);

  const highlightLayerProps = useMemo<LayerProps>(() => {
    const highlightFilter: ExpressionSpecification =
      activeRef?.type === 'airway'
        ? ['==', ['get', 'designation'], activeRef.id]
        : MATCH_NONE_FILTER;
    return { ...AIRWAYS_HIGHLIGHT_LAYER_BASE, filter: highlightFilter };
  }, [activeRef]);

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
      <Layer {...layerProps} />
      <Layer {...highlightLayerProps} />
    </Source>
  );
}
