import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

import type { ViewStateChange } from './map-canvas.tsx';

/**
 * Returns the `onViewStateChange` handler a mode passes to `MapCanvas`: it
 * writes the settled camera (center, zoom, pitch) into the current route's
 * search params, replacing the history entry so panning does not flood the
 * back stack. Every other search field passes through untouched, so the hook
 * works for any mode whose schema spreads in `mapViewSearchFields`.
 *
 * @returns A stable callback that mirrors a view-state change into the URL.
 */
export function useViewStateWriteBack(): (view: ViewStateChange) => void {
  const navigate = useNavigate();
  return useCallback(
    (view: ViewStateChange): void => {
      void navigate({
        to: '.',
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
}
