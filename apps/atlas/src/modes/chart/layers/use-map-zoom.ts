import { useMap } from '@vis.gl/react-maplibre';
import { useEffect, useState } from 'react';

import { quantizeMapZoom } from './airspace-extrusion-scale.ts';

/**
 * The live camera zoom, quantized to {@link quantizeMapZoom}'s step, as
 * React state. The URL zoom only updates at the end of a camera move,
 * which is too late for anything that has to track a zoom gesture
 * frame by frame - the 3D airspace exaggeration would snap to its new
 * height when the gesture ends instead of following it. Subscribing to
 * the map's `zoom` event and quantizing keeps the re-render count to one
 * per tenth of a zoom level while the camera is in motion.
 *
 * Until the map reports a zoom (no map mounted yet, or a test harness
 * without one) the quantized `fallbackZoom` is returned, so callers pass
 * the URL zoom and get a sensible value on the first render.
 */
export function useMapZoom(fallbackZoom: number): number {
  const map = useMap();
  const mapRef = map.current ?? map.default;
  const [zoom, setZoom] = useState<number | undefined>(() =>
    mapRef === undefined ? undefined : quantizeMapZoom(mapRef.getMap().getZoom()),
  );
  useEffect((): (() => void) | undefined => {
    if (mapRef === undefined) {
      return undefined;
    }
    const m = mapRef.getMap();
    function onZoom(): void {
      setZoom(quantizeMapZoom(m.getZoom()));
    }
    m.on('zoom', onZoom);
    return (): void => {
      m.off('zoom', onZoom);
    };
  }, [mapRef]);
  return zoom ?? quantizeMapZoom(fallbackZoom);
}
