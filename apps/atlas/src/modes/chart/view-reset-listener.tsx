import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import { CHART_DEFAULTS } from './url-state.ts';
import { subscribeChartViewReset } from './view-reset-bus.ts';

/** Animation duration for the reset-view ease, in milliseconds. */
const RESET_ANIMATION_MS = 600;

/**
 * Renders nothing; subscribes to the chart-view reset bus and, on each
 * dispatch, eases the underlying MapLibre instance back to the default
 * CONUS view (center, zoom, pitch). The map's `moveend` event fires when
 * the animation finishes, which routes through the existing
 * `MapCanvas.onViewStateChange` callback in `chart-mode.tsx` and keeps the
 * URL `lat` / `lon` / `zoom` fields in sync without an explicit `navigate`.
 *
 * Pitch is reset directly on the map (it is not URL-persisted yet, per
 * step 17d's deliberate omission of `pitch` from the search schema). If
 * pitch is later promoted to URL state during 3D-A, the reset call here
 * stays correct - the map ease is the authoritative move; URL just
 * mirrors it.
 *
 * Lives inside `<MapProvider>` so `useMap()` resolves; falls back to the
 * `default` map registered with the provider when rendered as a sibling
 * of `<MapCanvas>` rather than a descendant of `<Map>`. The mode switcher
 * dispatches the reset (`dispatchChartViewReset`) from
 * `view-reset-bus.ts`; this component is the chart-mode side of that
 * decoupled handshake.
 */
export function ChartViewResetListener(): null {
  const map = useMap();
  const mapRef = map.current ?? map.default;

  useEffect((): (() => void) | undefined => {
    if (mapRef === undefined) {
      return undefined;
    }
    return subscribeChartViewReset((): void => {
      mapRef.getMap().easeTo({
        center: [CHART_DEFAULTS.lon, CHART_DEFAULTS.lat],
        zoom: CHART_DEFAULTS.zoom,
        pitch: 0,
        duration: RESET_ANIMATION_MS,
      });
    });
  }, [mapRef]);

  return null;
}
