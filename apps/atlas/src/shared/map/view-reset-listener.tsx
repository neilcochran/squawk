import { useMap } from '@vis.gl/react-maplibre';
import { useEffect } from 'react';

import { subscribeViewReset } from './view-reset-bus.ts';
import { MAP_VIEW_DEFAULTS } from './view-state-schema.ts';

/** Animation duration for the reset-view ease, in milliseconds. */
const RESET_ANIMATION_MS = 600;

/**
 * Renders nothing; subscribes to the view-reset bus and, on each dispatch,
 * eases the underlying MapLibre instance back to {@link MAP_VIEW_DEFAULTS}
 * (center, zoom, pitch). Only the camera moves: the mode's other URL state
 * (chart layers and selection, the plan route and ground speed) is left as
 * it is. The map's `moveend` event fires when the animation finishes, which
 * routes through the mode's `MapCanvas.onViewStateChange` callback and keeps
 * the URL view fields in sync without an explicit `navigate`.
 *
 * Every mode mounts one inside its `<MapProvider>` so `useMap()` resolves;
 * it falls back to the `default` map registered with the provider when
 * rendered as a sibling of `<MapCanvas>` rather than a descendant of
 * `<Map>`. The mode switcher dispatches the reset (`dispatchViewReset`) from
 * `view-reset-bus.ts`; this component is the mode side of that decoupled
 * handshake.
 */
export function ViewResetListener(): null {
  const map = useMap();
  const mapRef = map.current ?? map.default;

  useEffect((): (() => void) | undefined => {
    if (mapRef === undefined) {
      return undefined;
    }
    return subscribeViewReset((): void => {
      mapRef.getMap().easeTo({
        center: [MAP_VIEW_DEFAULTS.lon, MAP_VIEW_DEFAULTS.lat],
        zoom: MAP_VIEW_DEFAULTS.zoom,
        pitch: MAP_VIEW_DEFAULTS.pitch,
        duration: RESET_ANIMATION_MS,
      });
    });
  }, [mapRef]);

  return null;
}
