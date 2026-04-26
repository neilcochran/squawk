import { useCallback } from 'react';
import type { ReactElement } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { MapProvider } from '@vis.gl/react-maplibre';
import type { MapLayerMouseEvent } from '@vis.gl/react-maplibre';
import { MapCanvas } from '../../shared/map/map-canvas.tsx';
import type { ViewStateChange } from '../../shared/map/map-canvas.tsx';
import { ZoomControls } from '../../shared/map/zoom-controls.tsx';
import { EntityInspector } from '../../shared/inspector/inspector.tsx';
import { ChartLoadingIndicator } from './chart-loading-indicator.tsx';
import { INSPECTABLE_LAYER_IDS, selectedFromFeature } from './click-to-select.ts';
import { InspectableHoverCursor } from './inspectable-cursor.tsx';
import { ChartViewResetListener } from './view-reset-listener.tsx';
import { LayerToggle } from './layer-toggle.tsx';
import { AirportsLayer } from './layers/airports-layer.tsx';
import { AirspaceLayer } from './layers/airspace-layer.tsx';
import { AirwaysLayer } from './layers/airways-layer.tsx';
import { FixesLayer } from './layers/fixes-layer.tsx';
import { NavaidsLayer } from './layers/navaids-layer.tsx';
import { CHART_ROUTE_PATH } from './url-state.ts';

const route = getRouteApi(CHART_ROUTE_PATH);

/**
 * Chart mode: an interactive aeronautical map. Renders the shared map
 * primitive with chart-specific overlays - airports, navaids, fixes,
 * airways, and airspace - each gated on the URL's active layer set, plus
 * the layer-toggle dropdown. Round-trips the view state and active layers
 * through the URL.
 */
export function ChartMode(): ReactElement {
  const { lat, lon, zoom, pitch, layers } = route.useSearch();
  const navigate = useNavigate({ from: CHART_ROUTE_PATH });

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

  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent): void => {
      const top = event.features?.[0];
      const next = top === undefined ? undefined : selectedFromFeature(top);
      void navigate({
        search: (prev) => ({ ...prev, selected: next }),
        replace: true,
      });
    },
    [navigate],
  );

  // `<MapProvider>` lets the loading indicator (a sibling of MapCanvas)
  // reach the underlying MapLibre instance via `useMap()`, so it can
  // subscribe to the map's `idle` event and dismiss only after the
  // basemap and freshly-added layer sources have actually painted.
  // The loading indicator stays last in the JSX so its z-10 wash paints
  // on top of the layer-toggle button while data is still streaming.
  return (
    <MapProvider>
      <MapCanvas
        lat={lat}
        lon={lon}
        zoom={zoom}
        pitch={pitch}
        onViewStateChange={handleViewStateChange}
        onMapClick={handleMapClick}
        interactiveLayerIds={INSPECTABLE_LAYER_IDS}
      >
        {layers.includes('airspace') ? <AirspaceLayer /> : null}
        {layers.includes('airways') ? <AirwaysLayer /> : null}
        {layers.includes('fixes') ? <FixesLayer /> : null}
        {layers.includes('navaids') ? <NavaidsLayer /> : null}
        {layers.includes('airports') ? <AirportsLayer /> : null}
      </MapCanvas>
      <InspectableHoverCursor />
      <ChartViewResetListener />
      <LayerToggle />
      <ZoomControls />
      <EntityInspector />
      <ChartLoadingIndicator />
    </MapProvider>
  );
}
