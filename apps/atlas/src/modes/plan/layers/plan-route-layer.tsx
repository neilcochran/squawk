import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type { LineString } from 'geojson';
import { useMemo } from 'react';
import type { ReactElement } from 'react';

import type { RoutePoint } from '@squawk/flightplan/browser';

import { useChartColors } from '../../../shared/styles/chart-colors.ts';

import {
  PLAN_ROUTE_LINE_LAYER_ID,
  PLAN_ROUTE_SOURCE_ID,
  PLAN_WAYPOINTS_LABEL_LAYER_ID,
  PLAN_WAYPOINTS_LAYER_ID,
  PLAN_WAYPOINTS_SOURCE_ID,
  toRouteLineCollection,
  toWaypointCollection,
} from './plan-route-features.ts';

/**
 * Props for {@link PlanRouteLayer}.
 */
export interface PlanRouteLayerProps {
  /** Ordered drawable route points, rendered as waypoint dots + labels. */
  points: readonly RoutePoint[];
  /** Route line geometry, or `undefined` when the route has fewer than two points. */
  line: LineString | undefined;
}

/**
 * Plan-mode overlay that draws the resolved route: a single line through the
 * ordered points, a circle at each waypoint, and an identifier label beside
 * each. Mirrors the chart layers' `Source` + `Layer` pattern and themes its
 * paint via {@link useChartColors}, rebuilding the `LayerProps` on a theme
 * switch so the new palette flows through MapLibre's declarative paint props.
 *
 * The line and waypoints use separate sources so the waypoint dots and labels
 * always stack above the line in MapLibre's draw order. Labels appear from
 * zoom 6 so a CONUS-level overview of a long route is not buried under
 * overlapping identifiers.
 */
export function PlanRouteLayer({ points, line }: PlanRouteLayerProps): ReactElement {
  const colors = useChartColors();

  const lineData = useMemo(() => toRouteLineCollection(line), [line]);
  const waypointData = useMemo(() => toWaypointCollection(points), [points]);

  const lineLayerProps = useMemo<LayerProps>(
    () => ({
      id: PLAN_ROUTE_LINE_LAYER_ID,
      source: PLAN_ROUTE_SOURCE_ID,
      type: 'line',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': colors.route.line,
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2, 10, 3.5],
        'line-opacity': 0.9,
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
      </Source>
      <Source id={PLAN_WAYPOINTS_SOURCE_ID} type="geojson" data={waypointData}>
        <Layer {...waypointLayerProps} />
        <Layer {...labelLayerProps} />
      </Source>
    </>
  );
}
