import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import { INSPECTABLE_LAYER_IDS } from './click-to-select.ts';

/**
 * Renders nothing; subscribes to MapLibre `mouseenter` / `mouseleave`
 * events on every inspectable chart layer and toggles the canvas cursor
 * between `'pointer'` and the basemap default. Without this the cursor
 * stays in MapLibre's grab/grabbing mode over every feature, leaving the
 * user no visual hint that clicking does anything.
 *
 * Lives inside `<MapProvider>` so `useMap()` resolves; falls back to the
 * `default` map registered with the provider when rendered as a sibling
 * of `<MapCanvas>` rather than a descendant of `<Map>`. The hover handlers
 * compare layer ids in `INSPECTABLE_LAYER_IDS` only, so non-inspectable
 * basemap features (water, roads, labels) keep the default cursor.
 */
export function InspectableHoverCursor(): null {
  const map = useMap();
  const mapRef = map.current ?? map.default;

  useEffect((): (() => void) | undefined => {
    if (mapRef === undefined) {
      return undefined;
    }
    const m = mapRef.getMap();
    function handleEnter(): void {
      m.getCanvas().style.cursor = 'pointer';
    }
    function handleLeave(): void {
      m.getCanvas().style.cursor = '';
    }
    for (const layerId of INSPECTABLE_LAYER_IDS) {
      m.on('mouseenter', layerId, handleEnter);
      m.on('mouseleave', layerId, handleLeave);
    }
    return (): void => {
      for (const layerId of INSPECTABLE_LAYER_IDS) {
        m.off('mouseenter', layerId, handleEnter);
        m.off('mouseleave', layerId, handleLeave);
      }
    };
  }, [mapRef]);

  return null;
}
