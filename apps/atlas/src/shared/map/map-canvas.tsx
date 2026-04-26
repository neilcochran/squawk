import { useCallback } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Map } from '@vis.gl/react-maplibre';
import type { ViewStateChangeEvent } from '@vis.gl/react-maplibre';
import maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import 'maplibre-gl/dist/maplibre-gl.css';

maplibregl.addProtocol('pmtiles', new Protocol().tile);

/** Protomaps' public dev demo PMTiles bucket - no API key required. */
const PROTOMAPS_DEMO_PMTILES = 'pmtiles://https://demo-bucket.protomaps.com/v4.pmtiles';
const PROTOMAPS_GLYPHS =
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
const PROTOMAPS_SPRITES = 'https://protomaps.github.io/basemaps-assets/sprites/v4/light';

/**
 * Maximum pitch (in degrees) the map will accept. Raised above MapLibre's
 * default of 60 so the chart-mode tilt stepper in
 * `src/shared/map/zoom-controls.tsx` can climb one extra 15-degree step
 * past the default cap. Exported so the chrome can use the same value as
 * its upper bound and the two cannot drift.
 */
export const MAP_MAX_PITCH = 75;

const MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: PROTOMAPS_GLYPHS,
  sprite: PROTOMAPS_SPRITES,
  sources: {
    protomaps: {
      type: 'vector',
      url: PROTOMAPS_DEMO_PMTILES,
      attribution:
        '<a href="https://openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>',
    },
  },
  layers: layers('protomaps', namedFlavor('light'), { lang: 'en' }),
};

/**
 * A simplified view-state snapshot suitable for URL serialization. Only the
 * fields the shell rounds-trips through the URL are exposed; bearing and pitch
 * are intentionally omitted.
 */
export interface ViewStateChange {
  /** Map center latitude in decimal degrees, positive north. */
  lat: number;
  /** Map center longitude in decimal degrees, positive east. */
  lon: number;
  /** Map zoom level. */
  zoom: number;
}

/**
 * Props for {@link MapCanvas}.
 */
export interface MapCanvasProps {
  /** Initial map center latitude in decimal degrees, positive north. */
  lat: number;
  /** Initial map center longitude in decimal degrees, positive east. */
  lon: number;
  /** Initial map zoom level. */
  zoom: number;
  /** Called when the user finishes interacting with the map (fires on `moveend`). */
  onViewStateChange?: (view: ViewStateChange) => void;
  /**
   * Map overlays. Pass `<Source>` and `<Layer>` elements from
   * `@vis.gl/react-maplibre` to render mode-specific data on top of the
   * basemap.
   */
  children?: ReactNode;
}

/**
 * Shared map primitive used by every mode that needs a basemap. Renders a
 * full-bleed MapLibre map with the Protomaps basemap and emits the view state
 * on `moveend` so callers can persist it to the URL. Mode-specific overlays
 * are rendered by passing `<Source>` and `<Layer>` elements as children.
 */
export function MapCanvas({
  lat,
  lon,
  zoom,
  onViewStateChange,
  children,
}: MapCanvasProps): ReactElement {
  const handleMoveEnd = useCallback(
    (event: ViewStateChangeEvent): void => {
      if (onViewStateChange === undefined) {
        return;
      }
      onViewStateChange({
        lat: event.viewState.latitude,
        lon: event.viewState.longitude,
        zoom: event.viewState.zoom,
      });
    },
    [onViewStateChange],
  );

  return (
    <Map
      initialViewState={{ longitude: lon, latitude: lat, zoom }}
      style={{ position: 'absolute', inset: 0 }}
      mapStyle={MAP_STYLE}
      maxPitch={MAP_MAX_PITCH}
      onMoveEnd={handleMoveEnd}
    >
      {children}
    </Map>
  );
}
