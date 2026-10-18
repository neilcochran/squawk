import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { MapProvider } from '@vis.gl/react-maplibre';
import type { ReactElement } from 'react';
import { useCallback, useRef, useState } from 'react';

import { MapCanvas } from '../../shared/map/map-canvas.tsx';
import { useViewStateWriteBack } from '../../shared/map/use-view-state-write-back.ts';
import { ViewResetListener } from '../../shared/map/view-reset-listener.tsx';
import { isDefaultMapView } from '../../shared/map/view-state-schema.ts';
import { ZoomControls } from '../../shared/map/zoom-controls.tsx';

import { PlanRouteLayer } from './layers/plan-route-layer.tsx';
import { PlanDataStatus } from './plan-data-status.tsx';
import { PlanRouteFramer } from './plan-route-framer.tsx';
import type { PlanFrameRequest } from './plan-route-framer.tsx';
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
 * and map view all round-trip through the URL so a plan is shareable. A
 * dataset that fails to load is named in a notice rather than blocking the
 * mode, since the route still resolves against the data that did load.
 *
 * Committing a route frames it, so a short route entered at the CONUS zoom
 * is not a speck. A share link that opens with a route but the default
 * camera frames it the same way; one that carries its own camera keeps it.
 */
export function PlanMode(): ReactElement {
  const { lat, lon, zoom, pitch, route: routeString, gs } = route.useSearch();
  const navigate = useNavigate({ from: PLAN_ROUTE_PATH });

  // Composed flightplan resolver, ready once every dataset fetch has settled.
  const resolverState = usePlanResolver();
  const resolver = resolverState.status === 'ready' ? resolverState.resolver : undefined;
  // Parsed route + geometry + distance, undefined while loading or blank.
  const planRoute = usePlanRoute(resolver, routeString, gs);
  // A route in the URL that cannot be resolved yet: a share link opened
  // before the data has arrived.
  const routeLoading = resolver === undefined && routeString.trim().length > 0;

  // The route the camera should frame once it resolves. Seeded from the URL
  // at mount for a share link with a route and no camera of its own.
  const [frameRequest, setFrameRequest] = useState<PlanFrameRequest | undefined>(() => {
    const initialRoute = routeString.trim();
    return initialRoute.length > 0 && isDefaultMapView({ lat, lon, zoom, pitch })
      ? { route: initialRoute }
      : undefined;
  });
  const routeInputRef = useRef<HTMLFormElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  const handleViewStateChange = useViewStateWriteBack();

  const handleRouteCommit = useCallback(
    (next: string): void => {
      if (next.length > 0) {
        setFrameRequest({ route: next });
      }
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
      <ViewResetListener />
      <PlanRouteFramer
        route={planRoute}
        request={frameRequest}
        routeInputRef={routeInputRef}
        sheetRef={sheetRef}
      />
      <PlanRouteInput ref={routeInputRef} value={routeString} onCommit={handleRouteCommit} />
      <PlanSummaryPanel
        route={planRoute}
        loading={routeLoading}
        groundSpeedKt={gs}
        onGroundSpeedChange={handleGroundSpeedChange}
        sheetRef={sheetRef}
      />
      <ZoomControls />
      <PlanDataStatus state={resolverState} />
    </MapProvider>
  );
}
