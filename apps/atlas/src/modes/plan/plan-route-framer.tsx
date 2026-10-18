import { useMap } from '@vis.gl/react-maplibre';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { readPublishedMapControlsInsetPx } from '../../shared/map/map-controls-inset.ts';
import { useIsDesktopLayout } from '../../shared/styles/use-is-desktop-layout.ts';
import { readPublishedSidePanelWidthPx } from '../../shared/ui/side-panel-width.ts';

import { routeBounds, routeFramePadding } from './plan-route-framing.ts';
import type { PlanRoute } from './plan-route.ts';

/** Animation duration for the framing ease, in milliseconds. */
const FRAME_ANIMATION_MS = 600;

/**
 * Upper bound on the zoom framing applies, matching chart mode's feature fit,
 * so a short route (or a single airport) keeps some surrounding context
 * instead of slamming to street level.
 */
const FRAME_MAX_ZOOM = 11;

/**
 * A request to frame a route once it resolves. A fresh object per commit, so
 * committing the same route string again (after clearing it, say) frames
 * again rather than being taken for the request already handled.
 */
export interface PlanFrameRequest {
  /** The trimmed route string to frame; framing waits until the resolved route matches it. */
  route: string;
}

/**
 * Props for {@link PlanRouteFramer}.
 */
export interface PlanRouteFramerProps {
  /** The resolved route, or `undefined` while the data loads or the route is blank. */
  route: PlanRoute | undefined;
  /** The latest framing request, or `undefined` when there has been none. */
  request: PlanFrameRequest | undefined;
  /** The route input bar, whose bottom edge the framing keeps the route below. */
  routeInputRef: RefObject<HTMLElement | null>;
  /** The summary panel, whose height the framing keeps the route above on a phone. */
  sheetRef: RefObject<HTMLElement | null>;
}

/**
 * Renders nothing; eases the camera so a newly committed route fills the part
 * of the map the chrome leaves visible. Plan mode raises a
 * {@link PlanFrameRequest} when the user commits a route, and when a share
 * link opens with a route but the default camera; a link that carries its
 * own camera keeps it. The request is handled once the resolved route
 * matches it, which may be a render or a data load later, and only once, so
 * a ground-speed edit or a theme switch never re-frames.
 *
 * The padding reads the chrome's live geometry at the moment of framing: the
 * route input's bottom edge, the zoom / tilt controls' published reach from
 * the left, on desktop the side panel's user-resizable width, and on a phone
 * the bottom sheet's height. The effect runs after the
 * DOM holds the resolved route's summary, so the sheet's layout height is
 * already the one it settles at - including on the first commit, where the
 * sheet appears in the same render - even before its own resize observer has
 * reported. The layout height ignores the slide transform, which is right
 * because a new route restores a minimized sheet. Must render inside the
 * mode's `<MapProvider>` so `useMap()` resolves.
 */
export function PlanRouteFramer({
  route,
  request,
  routeInputRef,
  sheetRef,
}: PlanRouteFramerProps): null {
  const map = useMap();
  const mapRef = map.current ?? map.default;
  const desktop = useIsDesktopLayout();
  const handledRef = useRef<PlanFrameRequest | undefined>(undefined);

  useEffect(() => {
    if (
      request === undefined ||
      request === handledRef.current ||
      route === undefined ||
      route.parsed.raw !== request.route ||
      mapRef === undefined
    ) {
      return;
    }
    handledRef.current = request;
    const bounds = routeBounds(route.points);
    if (bounds === undefined) {
      return;
    }
    const maplibreMap = mapRef.getMap();
    const containerTopPx = maplibreMap.getContainer().getBoundingClientRect().top;
    const inputBottomPx = routeInputRef.current?.getBoundingClientRect().bottom;
    maplibreMap.fitBounds(bounds, {
      padding: routeFramePadding({
        desktop,
        sidePanelWidthPx: readPublishedSidePanelWidthPx(),
        sheetHeightPx: sheetRef.current?.offsetHeight ?? 0,
        controlsInsetPx: readPublishedMapControlsInsetPx(),
        topInsetPx: inputBottomPx === undefined ? 0 : Math.max(inputBottomPx - containerTopPx, 0),
      }),
      maxZoom: FRAME_MAX_ZOOM,
      duration: FRAME_ANIMATION_MS,
    });
  }, [request, route, mapRef, desktop, routeInputRef, sheetRef]);

  return null;
}
