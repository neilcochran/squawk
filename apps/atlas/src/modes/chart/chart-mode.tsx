import { useCallback } from 'react';
import type { ReactElement } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { MapCanvas } from '../../shared/map/map-canvas.tsx';
import type { ViewStateChange } from '../../shared/map/map-canvas.tsx';
import { AirportsLayer } from './layers/airports-layer.tsx';
import { AirspaceLayer } from './layers/airspace-layer.tsx';
import { AirwaysLayer } from './layers/airways-layer.tsx';
import { FixesLayer } from './layers/fixes-layer.tsx';
import { NavaidsLayer } from './layers/navaids-layer.tsx';
import { CHART_ROUTE_PATH } from './url-state.ts';

const route = getRouteApi(CHART_ROUTE_PATH);

/**
 * Chart mode: an interactive aeronautical map. Renders the shared map
 * primitive with chart-specific overlays (airports today; navaids, fixes,
 * airways, and airspace land in subsequent steps of Phase 5) and round-trips
 * the view state through the URL.
 */
export function ChartMode(): ReactElement {
  const { lat, lon, zoom } = route.useSearch();
  const navigate = useNavigate({ from: CHART_ROUTE_PATH });

  const handleViewStateChange = useCallback(
    (view: ViewStateChange): void => {
      void navigate({
        search: (prev) => ({ ...prev, lat: view.lat, lon: view.lon, zoom: view.zoom }),
        replace: true,
      });
    },
    [navigate],
  );

  return (
    <MapCanvas lat={lat} lon={lon} zoom={zoom} onViewStateChange={handleViewStateChange}>
      <AirspaceLayer />
      <AirwaysLayer />
      <FixesLayer />
      <NavaidsLayer />
      <AirportsLayer />
    </MapCanvas>
  );
}
