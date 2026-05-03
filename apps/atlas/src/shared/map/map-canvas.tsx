import { layers, namedFlavor } from '@protomaps/basemaps';
import { Map, useMap } from '@vis.gl/react-maplibre';
import type { MapLayerMouseEvent, ViewStateChangeEvent } from '@vis.gl/react-maplibre';
import maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import type { ReactElement, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useResolvedTheme } from '../styles/theme-context.ts';
import type { ResolvedTheme } from '../styles/theme-context.ts';

/**
 * Prefix every atlas-owned MapLibre source and layer id starts with.
 * Used by {@link ThemeStyleSync} to identify which entries to carry
 * over from the previous style across a basemap swap, so chart
 * features stay visible while the basemap flips themes.
 */
const ATLAS_LAYER_ID_PREFIX = 'atlas-';

maplibregl.addProtocol('pmtiles', new Protocol().tile);

/**
 * Protomaps' public dev demo PMTiles bucket - no API key required, but
 * rate-limited and intended for development only. Used as a fallback
 * when {@link PMTILES_URL} is not set, so local `npm run dev` works
 * without any env configuration.
 */
const PROTOMAPS_DEMO_PMTILES = 'pmtiles://https://demo-bucket.protomaps.com/v4.pmtiles';

/**
 * Resolved PMTiles URL for the basemap source. Reads from the
 * `VITE_PMTILES_URL` build-time env var (set in the production deploy
 * to point at a self-hosted PMTiles file or Protomaps' commercial CDN)
 * and falls back to {@link PROTOMAPS_DEMO_PMTILES} when unset.
 */
const PMTILES_URL = import.meta.env.VITE_PMTILES_URL ?? PROTOMAPS_DEMO_PMTILES;

const PROTOMAPS_GLYPHS =
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';

/**
 * Returns the Protomaps sprite URL matching the resolved theme. Light
 * and dark sprites differ in the icon-fill colors used by the
 * Protomaps style layers, so the sprite URL must flip in lockstep with
 * the basemap flavor; otherwise dark-flavored layers reference icons
 * the light sprite carries with light-mode tints (and vice versa).
 */
function protomapsSpriteUrl(theme: ResolvedTheme): string {
  return `https://protomaps.github.io/basemaps-assets/sprites/v4/${theme}`;
}

/**
 * Maximum pitch (in degrees) the map will accept. Raised above
 * MapLibre's default of 60 so the chart-mode tilt stepper in
 * `src/shared/map/zoom-controls.tsx` can drive the camera close to a
 * horizontal view, which is the natural endpoint when inspecting
 * tall 3D airspace structures (Class B inverted wedding-cake, MOA
 * stacks, restricted areas). MapLibre allows up to 180 in
 * {@link MapOptions.maxPitch}, but 90 (camera parallel to ground)
 * produces visual artifacts - the basemap stretches into the
 * horizon, fill-extrusion side walls render unevenly, and the
 * camera-distance-aware exaggeration breaks down. 85 is the
 * sweet-spot near-horizontal view that keeps the projection clean.
 * Exported so the chrome can use the same value as its upper bound
 * and the two cannot drift.
 */
export const MAP_MAX_PITCH = 85;

/**
 * Builds the MapLibre `StyleSpecification` for the basemap matching
 * the resolved theme. Both the layer set (via Protomaps'
 * `namedFlavor()`) and the sprite URL flip in lockstep so a theme
 * switch produces a coherent dark-or-light basemap. `@vis.gl/react-maplibre`
 * passes the new value to `map.setStyle()` when the prop changes, so
 * this is fully declarative on the React side.
 */
function buildMapStyle(theme: ResolvedTheme): StyleSpecification {
  return {
    version: 8,
    glyphs: PROTOMAPS_GLYPHS,
    sprite: protomapsSpriteUrl(theme),
    sources: {
      protomaps: {
        type: 'vector',
        url: PMTILES_URL,
        attribution:
          '<a href="https://openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>',
      },
    },
    layers: layers('protomaps', namedFlavor(theme), { lang: 'en' }),
  };
}

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
  const resolvedTheme = useResolvedTheme();
  // Mount-only style. `<Map>` calls `setStyle` whenever its `mapStyle`
  // prop reference changes, and that swap diffs out atlas-* sources
  // and layers (because they were added imperatively via `<Source>` /
  // `<Layer>` and aren't part of the basemap spec) - so chart features
  // would briefly disappear while the basemap re-paints, then snap
  // back when the React tree's effects re-add them. Instead, capture
  // the initial theme into a stable state value (lazy `useState`
  // initializer so it's read once at mount), and let
  // {@link ThemeStyleSync} handle subsequent theme changes
  // imperatively with a transformStyle that preserves the atlas-*
  // layers across the swap.
  const [initialMapStyle] = useState<StyleSpecification>(() => buildMapStyle(resolvedTheme));

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
      mapStyle={initialMapStyle}
      maxPitch={MAP_MAX_PITCH}
      onMoveEnd={handleMoveEnd}
      onClick={handleClick}
      interactiveLayerIds={interactiveLayerIds === undefined ? [] : [...interactiveLayerIds]}
    >
      <ThemeStyleSync resolvedTheme={resolvedTheme} />
      {children}
    </Map>
  );
}

/**
 * Imperatively swaps the basemap style when the resolved theme changes,
 * preserving every atlas-owned source and layer across the swap so
 * chart features remain visible during the transition. Renders
 * nothing.
 *
 * MapLibre's `setStyle` with `diff: true` removes any source / layer
 * present in the current style but absent from the next - which would
 * include all of our chart overlays (added imperatively by `<Source>`
 * / `<Layer>` children, never present in the basemap spec). The
 * `transformStyle` callback merges those entries back into the next
 * style before MapLibre computes the diff, so the diff sees them in
 * both and leaves them alone.
 *
 * The chart layer components also re-run their `useChartColors()`
 * memos on the same theme change and call `setPaintProperty` on each
 * paint value that differs between palettes, so feature colors update
 * to the new palette in the same React commit. Net effect: features
 * stay on screen, basemap flips, feature colors flip, all in one
 * frame.
 */
function ThemeStyleSync({ resolvedTheme }: { resolvedTheme: ResolvedTheme }): null {
  const map = useMap();
  const mapRef = map.current ?? map.default;
  const lastAppliedRef = useRef<ResolvedTheme>(resolvedTheme);

  useEffect((): void => {
    if (mapRef === undefined) {
      return;
    }
    if (lastAppliedRef.current === resolvedTheme) {
      return;
    }
    lastAppliedRef.current = resolvedTheme;
    const m = mapRef.getMap();
    m.setStyle(buildMapStyle(resolvedTheme), {
      diff: true,
      transformStyle: (previous, next) => {
        if (previous === undefined) {
          return next;
        }
        const preservedSources: typeof next.sources = { ...next.sources };
        for (const [id, source] of Object.entries(previous.sources ?? {})) {
          if (id.startsWith(ATLAS_LAYER_ID_PREFIX)) {
            preservedSources[id] = source;
          }
        }
        const preservedLayers = (previous.layers ?? []).filter((layer) =>
          layer.id.startsWith(ATLAS_LAYER_ID_PREFIX),
        );
        return {
          ...next,
          sources: preservedSources,
          layers: [...(next.layers ?? []), ...preservedLayers],
        };
      },
    });
  }, [mapRef, resolvedTheme]);

  return null;
}
