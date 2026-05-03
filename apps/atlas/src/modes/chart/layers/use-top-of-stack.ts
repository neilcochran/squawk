import { useMap } from '@vis.gl/react-maplibre';
import { useEffect } from 'react';

/**
 * Subscribes to MapLibre layer-stack changes (`styledata`) and re-asserts
 * the supplied layer ids at the top of the stack each time. Order within
 * the input array is preserved - the last id ends up topmost. Used by
 * the airspace feature-focus + badge layers to stay above every other
 * layer's symbology even when other layer components re-add themselves
 * during the session.
 *
 * The hook tolerates layers that have not been registered yet (initial
 * mount race) by silently skipping any id that `getLayer` cannot find;
 * the next `styledata` event after the layer mounts triggers another
 * pass.
 */
export function useTopOfStack(layerIds: readonly string[]): void {
  const map = useMap();
  const mapRef = map.current ?? map.default;
  useEffect((): (() => void) | undefined => {
    if (mapRef === undefined) {
      return undefined;
    }
    const m = mapRef.getMap();
    function reassertOrder(): void {
      for (const id of layerIds) {
        if (m.getLayer(id) !== undefined) {
          // moveLayer with no `beforeId` moves the layer to the top.
          m.moveLayer(id);
        }
      }
    }
    reassertOrder();
    m.on('styledata', reassertOrder);
    return (): void => {
      m.off('styledata', reassertOrder);
    };
  }, [mapRef, layerIds]);
}
