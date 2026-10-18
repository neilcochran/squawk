import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { MapProvider } from '@vis.gl/react-maplibre';
import type { ReactElement } from 'react';
import { useCallback } from 'react';

import { MapCanvas } from '../../shared/map/map-canvas.tsx';
import type { ViewStateChange } from '../../shared/map/map-canvas.tsx';
import { ZoomControls } from '../../shared/map/zoom-controls.tsx';
import { FloatingPanel } from '../../shared/ui/floating-panel.tsx';

import { PlanRouteLayer } from './layers/plan-route-layer.tsx';
import { PlanRouteInput } from './plan-route-input.tsx';
import { PlanSummaryPanel } from './plan-summary-panel.tsx';
import { PLAN_ROUTE_PATH } from './url-state.ts';
import { usePlanResolver } from './use-plan-resolver.ts';
import { usePlanRoute } from './use-plan-route.ts';

const route = getRouteApi(PLAN_ROUTE_PATH);

/**
 * Plan mode: enter a flight-plan route string and see it resolved and drawn.
 * Composes the bundled airport / navaid / fix / airway / procedure resolvers
 * into a flightplan resolver, parses the URL `route` string, and renders the
 * resolved polyline + waypoints on the shared map with a summary panel
 * (distance, ETE, legs, unresolved tokens). The route string, ground speed,
 * and map view all round-trip through the URL so a plan is shareable.
 */
export function PlanMode(): ReactElement {
  const { lat, lon, zoom, pitch, route: routeString, gs } = route.useSearch();
  const navigate = useNavigate({ from: PLAN_ROUTE_PATH });

  // Composed flightplan resolver, undefined until every dataset has loaded.
  const resolver = usePlanResolver();
  // Parsed route + geometry + distance, undefined while loading or blank.
  const planRoute = usePlanRoute(resolver, routeString, gs);

  const handleViewStateChange = useCallback(
    (view: ViewStateChange): void => {
      void navigate({
        search: (prev) => ({
          ...prev,
          lat: view.lat,
          lon: view.lon,
          zoom: view.zoom,
          pitch: view.pitch,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleRouteCommit = useCallback(
    (next: string): void => {
      void navigate({
        search: (prev) => ({ ...prev, route: next }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleGroundSpeedChange = useCallback(
    (next: number | undefined): void => {
      void navigate({
        search: (prev) => ({ ...prev, gs: next }),
        replace: true,
      });
    },
    [navigate],
  );

  return (
    <MapProvider>
      <MapCanvas
        lat={lat}
        lon={lon}
        zoom={zoom}
        pitch={pitch}
        onViewStateChange={handleViewStateChange}
      >
        {planRoute !== undefined ? (
          <PlanRouteLayer points={planRoute.points} legs={planRoute.distance.legs} />
        ) : null}
      </MapCanvas>
      <PlanRouteInput value={routeString} onCommit={handleRouteCommit} />
      <PlanSummaryPanel
        route={planRoute}
        groundSpeedKt={gs}
        onGroundSpeedChange={handleGroundSpeedChange}
      />
      <ZoomControls />
      {resolver === undefined ? <PlanDataLoadingBadge /> : null}
    </MapProvider>
  );
}

/**
 * Small centered "loading" pill shown while the aeronautical datasets stream
 * in. Plan mode has nothing to draw until the resolver is ready, so this
 * communicates the wait without the full-screen wash chart mode uses (there
 * are no partially-painted layers to hide here). Positioned below the route
 * input bar so the two do not overlap.
 */
function PlanDataLoadingBadge(): ReactElement {
  return (
    <div
      className="absolute inset-x-0 top-16 z-10 flex justify-center"
      role="status"
      aria-live="polite"
    >
      <FloatingPanel className="flex items-center gap-2 rounded-full px-3 py-1.5 shadow-md">
        <span
          className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
          Loading aeronautical data...
        </span>
      </FloatingPanel>
    </div>
  );
}
