import { useCallback } from 'react';
import type { ReactElement } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { MapCanvas } from '../../shared/map/map-canvas.tsx';
import type { ViewStateChange } from '../../shared/map/map-canvas.tsx';
import { CHART_ROUTE_PATH } from './url-state.ts';

const route = getRouteApi(CHART_ROUTE_PATH);

/**
 * Chart mode: an interactive aeronautical map. v0 renders the shared map
 * primitive and round-trips the view state through the URL; data layers
 * (airports, navaids, fixes, airways, airspace) land in Phase 5.
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

  return <MapCanvas lat={lat} lon={lon} zoom={zoom} onViewStateChange={handleViewStateChange} />;
}
