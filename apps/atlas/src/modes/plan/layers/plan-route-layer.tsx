import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import { useMemo } from 'react';
import type { ReactElement } from 'react';

import type { RouteLeg, RoutePoint } from '@squawk/flightplan/browser';

import { useChartColors } from '../../../shared/styles/chart-colors.ts';

import {
  PLAN_ROUTE_INVALID_LINE_LAYER_ID,
  PLAN_ROUTE_LINE_LAYER_ID,
  PLAN_ROUTE_SOURCE_ID,
  PLAN_WAYPOINTS_LABEL_LAYER_ID,
  PLAN_WAYPOINTS_LAYER_ID,
  PLAN_WAYPOINTS_SOURCE_ID,
  toLegCollection,
  toWaypointCollection,
} from './plan-route-features.ts';

/** Route stroke width in pixels by zoom, shared by the valid and invalid leg layers. */
const ROUTE_LINE_WIDTH: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  4,
  2,
  10,
  3.5,
];

/**
 * Props for {@link PlanRouteLayer}.
 */
export interface PlanRouteLayerProps {
  /** Ordered drawable route points, rendered as waypoint dots + labels. */
  points: readonly RoutePoint[];
  /** The route's legs, drawn one line each; empty when the route has fewer than two points. */
  legs: readonly RouteLeg[];
}

/**
 * Plan-mode overlay that draws the resolved route: a line per leg, a circle
 * at each waypoint, and an identifier label beside each. Mirrors the chart
 * layers' `Source` + `Layer` pattern and themes its paint via
 * {@link useChartColors}, rebuilding the `LayerProps` on a theme switch so the
 * new palette flows through MapLibre's declarative paint props.
 *
 * A leg that makes the route invalid as filed - one that spans a published
 * airway gap or an airway segment the FAA marks unusable - draws dashed in
 * the warning color on its own layer, since MapLibre cannot vary a line's
 * dash pattern per feature; the rest of the route draws solid.
 *
 * The leg layers mount before the waypoint layers, so the dots and labels
 * draw above the lines: MapLibre stacks by layer order, not by source. Labels
 * appear from zoom 6 so a CONUS-level overview of a long route is not buried
 * under overlapping identifiers.
 */
export function PlanRouteLayer({ points, legs }: PlanRouteLayerProps): ReactElement {
  const colors = useChartColors();

  const lineData = useMemo(() => toLegCollection(legs), [legs]);
  const waypointData = useMemo(() => toWaypointCollection(points), [points]);

  const lineLayerProps = useMemo<LayerProps>(
    () => ({
      id: PLAN_ROUTE_LINE_LAYER_ID,
      source: PLAN_ROUTE_SOURCE_ID,
      type: 'line',
      filter: ['==', ['get', 'status'], 'valid'],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': colors.route.line,
        'line-width': ROUTE_LINE_WIDTH,
        'line-opacity': 0.9,
      },
    }),
    [colors],
  );

  const invalidLineLayerProps = useMemo<LayerProps>(
    () => ({
      id: PLAN_ROUTE_INVALID_LINE_LAYER_ID,
      source: PLAN_ROUTE_SOURCE_ID,
      type: 'line',
      filter: ['!=', ['get', 'status'], 'valid'],
      layout: {
        'line-cap': 'butt',
        'line-join': 'round',
      },
      paint: {
        'line-color': colors.route.invalidLine,
        'line-width': ROUTE_LINE_WIDTH,
        'line-opacity': 0.95,
        'line-dasharray': [2, 1.5],
      },
    }),
    [colors],
  );

  const waypointLayerProps = useMemo<LayerProps>(
    () => ({
      id: PLAN_WAYPOINTS_LAYER_ID,
      source: PLAN_WAYPOINTS_SOURCE_ID,
      type: 'circle',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 5],
        'circle-color': colors.route.waypointFill,
        'circle-stroke-color': colors.route.waypointStroke,
        'circle-stroke-width': 1.5,
      },
    }),
    [colors],
  );

  const labelLayerProps = useMemo<LayerProps>(
    () => ({
      id: PLAN_WAYPOINTS_LABEL_LAYER_ID,
      source: PLAN_WAYPOINTS_SOURCE_ID,
      type: 'symbol',
      minzoom: 6,
      layout: {
        'text-field': ['get', 'label'],
        // The basemap's emphasized face. The Protomaps glyph server serves no
        // bold Noto Sans; requesting one 404s and falls back to local glyphs.
        'text-font': ['Noto Sans Medium'],
        'text-size': 11,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': colors.route.labelText,
        'text-halo-color': colors.route.labelHalo,
        'text-halo-width': 1.5,
      },
    }),
    [colors],
  );

  return (
    <>
      <Source id={PLAN_ROUTE_SOURCE_ID} type="geojson" data={lineData}>
        <Layer {...lineLayerProps} />
        <Layer {...invalidLineLayerProps} />
      </Source>
      <Source id={PLAN_WAYPOINTS_SOURCE_ID} type="geojson" data={waypointData}>
        <Layer {...waypointLayerProps} />
        <Layer {...labelLayerProps} />
      </Source>
    </>
  );
}
