import { useCallback } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Map } from '@vis.gl/react-maplibre';
import type { MapLayerMouseEvent, ViewStateChangeEvent } from '@vis.gl/react-maplibre';
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
 * A simplified view-state snapshot suitable for URL serialization. Bearing
 * is intentionally omitted - the chart has no rotate-the-map control yet,
 * so persisting bearing in the URL would only encode accidental gestures.
 */
export interface ViewStateChange {
  /** Map center latitude in decimal degrees, positive north. */
  lat: number;
  /** Map center longitude in decimal degrees, positive east. */
  lon: number;
  /** Map zoom level. */
  zoom: number;
  /** Map pitch in degrees, in the range `[0, MAP_MAX_PITCH]`. */
  pitch: number;
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
  /**
   * Initial map pitch in degrees, clamped to `[0, MAP_MAX_PITCH]`. Consumed
   * once at mount via `initialViewState`; subsequent URL changes do not
   * auto-move the camera (chart-mode's view-reset bus handles the explicit
   * "snap to defaults" path that needs URL-to-map sync).
   */
  pitch: number;
  /** Called when the user finishes interacting with the map (fires on `moveend`). */
  onViewStateChange?: (view: ViewStateChange) => void;
  /**
   * Called when the user clicks the map. When `interactiveLayerIds` is set,
   * the event carries `features` populated with any features from those
   * layers at the click point (topmost first). Drag/pan does not fire
   * this event.
   */
  onMapClick?: (event: MapLayerMouseEvent) => void;
  /**
   * MapLibre layer ids whose features should be returned in `event.features`
   * on click and hover events. Without this set, MapLibre treats the map
   * as a single non-interactive surface and `event.features` is empty
   * regardless of which layer the cursor is over.
   */
  interactiveLayerIds?: readonly string[];
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
  pitch,
  onViewStateChange,
  onMapClick,
  interactiveLayerIds,
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
        pitch: event.viewState.pitch,
      });
    },
    [onViewStateChange],
  );

  const handleClick = useCallback(
    (event: MapLayerMouseEvent): void => {
      if (onMapClick === undefined) {
        return;
      }
      onMapClick(event);
    },
    [onMapClick],
  );

  return (
    <Map
      initialViewState={{ longitude: lon, latitude: lat, zoom, pitch }}
      style={{ position: 'absolute', inset: 0 }}
      mapStyle={MAP_STYLE}
      maxPitch={MAP_MAX_PITCH}
      onMoveEnd={handleMoveEnd}
      onClick={handleClick}
      interactiveLayerIds={interactiveLayerIds === undefined ? [] : [...interactiveLayerIds]}
    >
      {children}
    </Map>
  );
}
