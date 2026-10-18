import type { RoutePoint } from '@squawk/flightplan/browser';

import { unwrapLongitude } from './layers/plan-route-features.ts';

/**
 * Pure geometry for framing a resolved route on the map: its bounding box and
 * the padding that keeps it clear of the chrome covering the map. Kept in a
 * `.ts` sibling of the framing component so it unit-tests without a map.
 */

/** Pixel margin between the framed route and every edge of the visible map area. */
export const ROUTE_FRAME_BASE_PADDING_PX = 40;

/**
 * Southwest and northeast corners of a route's bounding box as `[lon, lat]`
 * pairs, the shape MapLibre's `fitBounds` takes.
 */
export type RouteBounds = [southwest: [number, number], northeast: [number, number]];

/**
 * Pixel padding for each edge of a `fitBounds` call.
 */
export interface RouteFramePadding {
  /** Padding from the top edge, in pixels. */
  top: number;
  /** Padding from the right edge, in pixels. */
  right: number;
  /** Padding from the bottom edge, in pixels. */
  bottom: number;
  /** Padding from the left edge, in pixels. */
  left: number;
}

/**
 * Inputs for {@link routeFramePadding}.
 */
export interface RouteFramePaddingParams {
  /** Whether the layout is the desktop one (side panel on the right) rather than the phone one (bottom sheet). */
  desktop: boolean;
  /** The side panel's live desktop width, in pixels. */
  sidePanelWidthPx: number;
  /** The bottom sheet's height on a phone, expanded, in pixels. */
  sheetHeightPx: number;
  /** How far down the route input bar reaches from the top of the map, in pixels. */
  topInsetPx: number;
}

/**
 * The bounding box of a route's points, or `undefined` for a route with none.
 * Longitudes are unwrapped along the route, each taken within 180 degrees of
 * the one before, so a route crossing the antimeridian (an Aleutian leg, say)
 * yields a box a few degrees wide rather than one spanning the globe.
 *
 * @param points - The route's ordered points.
 * @returns The box's southwest and northeast corners, or `undefined`.
 */
export function routeBounds(points: readonly RoutePoint[]): RouteBounds | undefined {
  const [first, ...rest] = points;
  if (first === undefined) {
    return undefined;
  }
  let minLat = first.lat;
  let maxLat = first.lat;
  let minLon = first.lon;
  let maxLon = first.lon;
  let previousLon = first.lon;
  for (const point of rest) {
    const lon = unwrapLongitude(point.lon, previousLon);
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    previousLon = lon;
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

/**
 * Padding that fits a route into the part of the map left visible by the
 * chrome: below the route input bar, left of the side panel on desktop, and
 * above the bottom sheet on a phone, plus {@link ROUTE_FRAME_BASE_PADDING_PX}
 * on every side so the route never touches an edge.
 *
 * @param params - The layout, the side panel width, the sheet height, and the input bar's reach.
 * @returns The `fitBounds` padding for each edge, in pixels.
 */
export function routeFramePadding(params: RouteFramePaddingParams): RouteFramePadding {
  const { desktop, sidePanelWidthPx, sheetHeightPx, topInsetPx } = params;
  const base = ROUTE_FRAME_BASE_PADDING_PX;
  return {
    top: topInsetPx + base,
    right: desktop ? sidePanelWidthPx + base : base,
    bottom: desktop ? base : sheetHeightPx + base,
    left: base,
  };
}
