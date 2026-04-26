import { useCallback } from 'react';
import type { ReactElement } from 'react';
import { useMap } from '@vis.gl/react-maplibre';

/** Animation duration for the +/- zoom transitions, in milliseconds. */
const ZOOM_ANIMATION_MS = 300;

/**
 * Floating zoom controls for the map. Renders a small vertical stack of
 * `+` and `-` buttons in the bottom-right corner of the map area, raised
 * enough that the MapLibre / OSM / Protomaps attribution can sit
 * underneath without overlap. Uses MapLibre's `easeTo({ zoom: z+/-1 })`
 * to animate the zoom; the `moveend` event fires at the end of the
 * animation, which triggers the same view-state callback the user's
 * drag/scroll already uses, so the URL stays in sync without any extra
 * wiring.
 *
 * Must be rendered inside a `<MapProvider>` so `useMap()` resolves. The
 * map collection's `current` is only populated when this component is
 * rendered as a descendant of a `<Map>` (via the `MapContext`), so the
 * controls also fall back to the `default` map registered with the
 * provider - the typical placement is as a sibling of `<MapCanvas>`,
 * outside any `<Map>`. The buttons no-op while no map is ready (e.g. on
 * first mount before MapLibre has initialized).
 */
export function ZoomControls(): ReactElement {
  const map = useMap();
  const mapRef = map.current ?? map.default;

  const handleZoomIn = useCallback((): void => {
    if (mapRef === undefined) {
      return;
    }
    const m = mapRef.getMap();
    m.easeTo({ zoom: m.getZoom() + 1, duration: ZOOM_ANIMATION_MS });
  }, [mapRef]);

  const handleZoomOut = useCallback((): void => {
    if (mapRef === undefined) {
      return;
    }
    const m = mapRef.getMap();
    m.easeTo({ zoom: m.getZoom() - 1, duration: ZOOM_ANIMATION_MS });
  }, [mapRef]);

  return (
    <div className="absolute bottom-10 right-3 z-10 flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-md">
      <button
        type="button"
        onClick={handleZoomIn}
        aria-label="Zoom in"
        className="flex h-8 w-8 items-center justify-center text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
      >
        <PlusIcon />
      </button>
      <div className="h-px bg-slate-200" aria-hidden="true" />
      <button
        type="button"
        onClick={handleZoomOut}
        aria-label="Zoom out"
        className="flex h-8 w-8 items-center justify-center text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
      >
        <MinusIcon />
      </button>
    </div>
  );
}

/** Inline plus glyph for the zoom-in button. */
function PlusIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 2.5V11.5M2.5 7H11.5" />
    </svg>
  );
}

/** Inline minus glyph for the zoom-out button. */
function MinusIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 7H11.5" />
    </svg>
  );
}
