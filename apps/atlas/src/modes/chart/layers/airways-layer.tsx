import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import { getRouteApi } from '@tanstack/react-router';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
  Point,
} from 'geojson';
import type { ReactElement } from 'react';
import { useMemo } from 'react';

import type { Airway, AirwayType } from '@squawk/types';

import { getAirwayResolver, useAirwayDataset } from '../../../shared/data/airway-dataset.ts';
import { useChartColors } from '../../../shared/styles/chart-colors.ts';
import { useActiveHighlightRef, useHoveredAirwayWaypointIndex } from '../highlight-context.ts';
import { AIRWAY_CATEGORY_TYPES, CHART_ROUTE_PATH } from '../url-state.ts';

import { buildSegments } from './airway-segments.ts';

const route = getRouteApi(CHART_ROUTE_PATH);

/**
 * Per-feature zoom threshold below which non-major airways stop
 * rendering. The high-altitude `JET` / `RNAV_Q` backbone (the long
 * cross-country routes) is exempt and stays visible at every zoom so
 * users can read end-to-end on the CONUS view; everything else
 * (V-routes, T-routes, oceanic, Alaska colored) only paints once the
 * camera has zoomed in far enough that the dense web is legible.
 *
 * Implemented as a per-feature filter (not a layer-level `minzoom`)
 * because the layer is no longer all-or-nothing - the major subset
 * always paints.
 */
const MINOR_AIRWAY_MIN_ZOOM = 5;

/**
 * Filter sub-expression that resolves to `true` for any airway feature
 * that should render at the current camera zoom. A feature passes if
 * either it belongs to the major (HIGH-altitude) bucket, or the camera
 * is already at or past {@link MINOR_AIRWAY_MIN_ZOOM}. Composed into
 * both the base layer's category filter and the selection-highlight
 * filter so the yellow halo inherits the same gating - no stray
 * highlight floats over a hidden V-route at low zoom.
 *
 * MapLibre re-evaluates the `["zoom"]` expression as the camera
 * moves, so features fade in / out smoothly without a re-render of
 * the GeoJSON source.
 */
const ZOOM_AWARE_VISIBILITY: ExpressionSpecification = [
  'any',
  ['in', ['get', 'type'], ['literal', [...AIRWAY_CATEGORY_TYPES.HIGH]]],
  ['>=', ['zoom'], MINOR_AIRWAY_MIN_ZOOM],
];

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
export const AIRWAYS_HIGHLIGHT_LAYER_ID = 'atlas-airways-highlight';

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
 * Chart-mode overlay that renders airways from `@squawk/airway-data` as
 * MapLibre line features. Reads the active `airwayCategories` from URL
 * state and applies a MapLibre `filter` expression so toggling categories
 * shows or hides only the matching airways without rebuilding the GeoJSON
 * source. Returns `null` while the dataset is still being fetched or if
 * the load failed; callers needing fetch-state UI should read the same
 * hook directly.
 *
 * Lines are thin and semi-transparent so the airway web reads as a
 * structural underlay rather than dominant symbology. Color is tiered
 * by airway type: low-altitude V-routes and RNAV T-routes use the
 * `low` token, high-altitude J-routes and RNAV Q-routes use `high`,
 * regional and oceanic routes use `regional`. The visibility filter is
 * built per-render from the active `airwayCategories` URL state plus
 * {@link ZOOM_AWARE_VISIBILITY} so non-major airways are zoom-gated at
 * the feature level rather than hiding the entire layer.
 */
export function AirwaysLayer(): ReactElement | null {
  const { airwayCategories } = route.useSearch();
  const state = useAirwayDataset();
  const activeRef = useActiveHighlightRef();
  const colors = useChartColors();

  const enabledTypes = useMemo<readonly AirwayType[]>(
    () => airwayCategories.flatMap((category) => AIRWAY_CATEGORY_TYPES[category]),
    [airwayCategories],
  );

  const filter = useMemo<ExpressionSpecification>(
    () => ['all', ['in', ['get', 'type'], ['literal', [...enabledTypes]]], ZOOM_AWARE_VISIBILITY],
    [enabledTypes],
  );

  const layerProps = useMemo<LayerProps>(
    () => ({
      id: AIRWAYS_LAYER_ID,
      source: AIRWAYS_SOURCE_ID,
      type: 'line',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      filter,
      paint: {
        'line-color': [
          'match',
          ['get', 'type'],
          ['VICTOR', 'RNAV_T'],
          colors.airway.low,
          ['JET', 'RNAV_Q'],
          colors.airway.high,
          colors.airway.regional,
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 7, 1.6, 10, 2.6],
        'line-opacity': 0.45,
      },
    }),
    [filter, colors],
  );

  // Highlight overlay for the currently-selected (or chip-hovered) airway.
  // Thicker yellow stroke that still reads as a line (not a band) at any
  // zoom. The filter combines the entity-match clause with
  // {@link ZOOM_AWARE_VISIBILITY} so the halo follows the same fade-in
  // rules as the base layer - selecting a hidden V-route at low zoom
  // does not leave a yellow ring floating over nothing.
  const highlightLayerProps = useMemo<LayerProps>(() => {
    const highlightFilter: ExpressionSpecification =
      activeRef?.type === 'airway'
        ? ['all', ['==', ['get', 'designation'], activeRef.id], ZOOM_AWARE_VISIBILITY]
        : MATCH_NONE_FILTER;
    return {
      id: AIRWAYS_HIGHLIGHT_LAYER_ID,
      source: AIRWAYS_SOURCE_ID,
      type: 'line',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      filter: highlightFilter,
      paint: {
        'line-color': colors.highlight.primary,
        'line-width': 4,
        'line-opacity': 0.95,
      },
    };
  }, [activeRef, colors]);

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

/** MapLibre source id for the airway-row focus overlay. */
const AIRWAY_FOCUS_SOURCE_ID = 'atlas-airway-focus';

/** MapLibre layer id for the focused waypoint dot. */
const AIRWAY_WAYPOINT_FOCUS_LAYER_ID = 'atlas-airway-focus-waypoint';

/** MapLibre layer id for the focused incoming-leg stroke. */
const AIRWAY_LEG_FOCUS_LAYER_ID = 'atlas-airway-focus-leg';

/**
 * Discriminator string distinguishing leg LineString features from
 * waypoint Point features in the same focus source. The single mixed
 * source keeps the airway-focus geojson local to one component; each
 * MapLibre layer's filter selects the right shape via this property.
 */
type AirwayFocusFeatureKind = 'leg' | 'waypoint';

/**
 * Properties carried on every focus feature. Both legs and waypoints
 * share the source schema; the `kind` discriminator routes each
 * feature to the matching MapLibre layer (line vs. circle), and
 * `waypointIndex` is the canonical hover-target identifier:
 *
 * - For a `kind: 'waypoint'` feature, the index is its own position
 *   in the active airway's `waypoints` array.
 * - For a `kind: 'leg'` feature, the index is the END waypoint of the
 *   leg (so leg index 1 connects waypoint 0 to waypoint 1, and is
 *   tagged with `waypointIndex: 1`). This way both layers filter on
 *   the same index value the inspector hover writes - no separate
 *   `legIndex` arithmetic at the consumer.
 */
interface AirwayFocusProperties {
  /** Discriminator: leg LineString vs. waypoint Point. */
  kind: AirwayFocusFeatureKind;
  /** Waypoint index this feature is keyed on (see interface docs). */
  waypointIndex: number;
}

/**
 * Filter expression that matches nothing. Used as the focus filter
 * when no inspector row is hovered, so each layer renders empty
 * without unmounting / re-mounting.
 */
const FOCUS_MATCH_NONE_FILTER: ExpressionSpecification = ['==', ['get', 'waypointIndex'], -1];

/**
 * Top-of-stack overlay that brightens the hovered waypoint and (when
 * the row has an incoming leg) the leg ending at that waypoint. The
 * inspector airway panel writes a context-stored waypoint index; this
 * layer reads it and filters two layers off a shared geojson source -
 * a circle layer for the waypoint dot, a line layer for the incoming
 * leg.
 *
 * Hovering the first waypoint row (`waypointIndex === 0`) lights up
 * just the dot - there is no incoming leg, and the line filter
 * naturally excludes leg index 0 since legs are tagged with the END
 * waypoint's index (which starts at 1). Hovering any other row lights
 * up both the dot and the leg.
 *
 * The source rebuilds whenever the active airway changes - one Point
 * per waypoint plus one LineString per consecutive waypoint pair -
 * and is empty (returns null) for any non-airway selection. Mounted
 * as a sibling of {@link AirwaysLayer} because the focus shapes need
 * their own source so the data lifecycle is decoupled from the
 * always-on airway dataset.
 */
export function AirwayLegFocusLayer(): ReactElement | null {
  const activeRef = useActiveHighlightRef();
  const hoveredWaypointIndex = useHoveredAirwayWaypointIndex();
  const state = useAirwayDataset();
  const colors = useChartColors();

  // Build the mixed waypoint + leg feature collection only when the
  // active selection is an airway; otherwise keep the source absent
  // so MapLibre does not hold a stale geojson around for a non-airway
  // selection.
  const data = useMemo<FeatureCollection<Geometry, AirwayFocusProperties> | undefined>(() => {
    if (activeRef?.type !== 'airway' || activeRef.id.length === 0) {
      return undefined;
    }
    if (state.status !== 'loaded') {
      return undefined;
    }
    const airway = getAirwayResolver(state.dataset).byDesignation(activeRef.id)[0];
    if (airway === undefined || airway.waypoints.length === 0) {
      return undefined;
    }
    const features: Feature<Geometry, AirwayFocusProperties>[] = [];
    // Waypoint Points (one per waypoint, keyed on the waypoint index).
    airway.waypoints.forEach((waypoint, idx) => {
      const point: Feature<Point, AirwayFocusProperties> = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [waypoint.lon, waypoint.lat] },
        properties: { kind: 'waypoint', waypointIndex: idx },
      };
      features.push(point);
    });
    // Leg LineStrings (one per consecutive pair, keyed on the END
    // waypoint's index so the line filter matches the same index the
    // inspector hover writes).
    for (let i = 0; i < airway.waypoints.length - 1; i += 1) {
      const start = airway.waypoints[i];
      const end = airway.waypoints[i + 1];
      if (start === undefined || end === undefined) {
        continue;
      }
      const line: Feature<LineString, AirwayFocusProperties> = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [start.lon, start.lat],
            [end.lon, end.lat],
          ],
        },
        properties: { kind: 'leg', waypointIndex: i + 1 },
      };
      features.push(line);
    }
    return { type: 'FeatureCollection', features };
  }, [activeRef, state]);

  const indexFilter = useMemo<ExpressionSpecification>(() => {
    if (hoveredWaypointIndex === undefined) {
      return FOCUS_MATCH_NONE_FILTER;
    }
    return ['==', ['get', 'waypointIndex'], hoveredWaypointIndex];
  }, [hoveredWaypointIndex]);

  const waypointLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRWAY_WAYPOINT_FOCUS_LAYER_ID,
      source: AIRWAY_FOCUS_SOURCE_ID,
      type: 'circle',
      filter: ['all', ['==', ['get', 'kind'], 'waypoint'], indexFilter],
      paint: {
        // Lighter yellow so the focused waypoint pops against the
        // regular highlight on whichever underlying point layer the
        // waypoint sits on (fix / navaid / airport).
        'circle-radius': 8,
        'circle-color': colors.highlight.focusOutline,
        'circle-stroke-color': colors.highlight.stroke,
        'circle-stroke-width': 2,
        'circle-opacity': 0.85,
      },
    }),
    [indexFilter, colors],
  );

  const legLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRWAY_LEG_FOCUS_LAYER_ID,
      source: AIRWAY_FOCUS_SOURCE_ID,
      type: 'line',
      filter: ['all', ['==', ['get', 'kind'], 'leg'], indexFilter],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        // Lighter yellow so the focused leg pops against the regular
        // airway highlight. Wider than the highlight stroke so the
        // focused leg is visible even when an airport / navaid circle
        // sits on top of one of its waypoints.
        'line-color': colors.highlight.focusOutline,
        'line-width': 6,
        'line-opacity': 1,
      },
    }),
    [indexFilter, colors],
  );

  if (data === undefined) {
    return null;
  }

  return (
    <Source id={AIRWAY_FOCUS_SOURCE_ID} type="geojson" data={data}>
      {/*
        Leg first, waypoint second so the dot draws on top of the leg
        terminus - otherwise the wider line would mask the dot when
        the user hovers the leg's destination row.
      */}
      <Layer {...legLayerProps} />
      <Layer {...waypointLayerProps} />
    </Source>
  );
}
