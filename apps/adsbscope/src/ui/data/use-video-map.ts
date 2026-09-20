import { useEffect, useState } from 'react';

import type { ScopeVideoMap } from '../../shared/protocol.js';

/**
 * Keeps the video map in step with the scope range. Each time the range
 * changes the map for the new range is requested; until it arrives the
 * previous map stays, so zooming never blanks the background - the old map is
 * still positioned correctly, just at the other range's level of detail. A
 * failed request likewise leaves the previous map in place.
 *
 * @param rangeNm - The current scope range in nautical miles.
 * @param loadVideoMap - Loads the map for a range, resolving undefined on any failure. Must be stable across renders, or the map is requested again on every render.
 * @returns The most recently loaded map, or undefined before the first one arrives.
 */
export function useVideoMap(
  rangeNm: number,
  loadVideoMap: (rangeNm: number) => Promise<ScopeVideoMap | undefined>,
): ScopeVideoMap | undefined {
  const [videoMap, setVideoMap] = useState<ScopeVideoMap | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void loadVideoMap(rangeNm).then((loaded) => {
      if (!cancelled && loaded !== undefined) {
        setVideoMap(loaded);
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [rangeNm, loadVideoMap]);

  return videoMap;
}
