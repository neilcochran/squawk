import { useCallback, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import { MAP_MAX_PITCH } from './map-canvas.tsx';

/** Animation duration for the +/- zoom transitions, in milliseconds. */
const ZOOM_ANIMATION_MS = 300;

/** Animation duration for a single tilt step, in milliseconds. */
const TILT_ANIMATION_MS = 200;

/**
 * Pitch increment (in degrees) applied to each tilt button click. With
 * `MAP_MAX_PITCH = 75`, this gives the user five button-driven stops
 * (15 / 30 / 45 / 60 / 75) - fine-grained control without making the
 * fully-tilted case onerous.
 */
const TILT_STEP_DEG = 15;

/** Lower clamp for tilt (degrees). MapLibre treats 0 as the flat / plan view. */
const TILT_MIN_DEG = 0;

/**
 * Upper clamp for tilt (degrees). Sourced from the map primitive so the
 * stepper and the underlying map agree on the hard cap; if `MAP_MAX_PITCH`
 * changes, the stepper follows automatically.
 */
const TILT_MAX_DEG = MAP_MAX_PITCH;

/**
 * Float tolerance for "at-bound" comparisons. MapLibre's animations can land
 * with sub-pixel residue (e.g. 59.999999 instead of 60), and zooming via
 * scroll-wheel produces continuous values; a small epsilon keeps the
 * disabled-state logic stable when the user is effectively at the limit.
 */
const BOUND_EPSILON = 0.001;

/**
 * Floating zoom and tilt controls for the map. Renders a vertical stack of
 * `+`, `-`, tilt-up, and tilt-down buttons in the bottom-right corner of the
 * map area, raised enough that the MapLibre / OSM / Protomaps attribution
 * can sit underneath without overlap. Uses MapLibre's `easeTo({ zoom })`
 * and `easeTo({ pitch })` to animate; the `moveend` event triggers the
 * existing view-state callback for the URL (zoom only - pitch is
 * intentionally not URL-persisted yet, mirroring map-canvas.tsx's
 * deliberate omission of bearing/pitch).
 *
 * Each button reflects whether it can act: zoom-in disables at the map's
 * `getMaxZoom()`, zoom-out at `getMinZoom()`, tilt-up at `TILT_MAX_DEG`, and
 * tilt-down at `TILT_MIN_DEG`. Current zoom and pitch are tracked via
 * `useSyncExternalStore` against MapLibre's `zoomend` and `pitchend` events
 * so the disabled state stays in sync regardless of how the user changed
 * the view (button click, scroll wheel, ctrl+drag pitch gesture, etc.).
 *
 * Must be rendered inside a `<MapProvider>` so `useMap()` resolves. The
 * map collection's `current` is only populated when this component is
 * rendered as a descendant of a `<Map>` (via the `MapContext`), so the
 * controls also fall back to the `default` map registered with the
 * provider - the typical placement is as a sibling of `<MapCanvas>`,
 * outside any `<Map>`. The buttons no-op while no map is ready (e.g. on
 * first mount before MapLibre has initialized) and disable themselves
 * altogether once mapRef resolves and the bounds are known.
 */
export function ZoomControls(): ReactElement {
  const map = useMap();
  const mapRef = map.current ?? map.default;

  const subscribeViewChanges = useCallback(
    (onChange: () => void): (() => void) => {
      if (mapRef === undefined) {
        return (): void => {};
      }
      const m = mapRef.getMap();
      m.on('zoomend', onChange);
      m.on('pitchend', onChange);
      return (): void => {
        m.off('zoomend', onChange);
        m.off('pitchend', onChange);
      };
    },
    [mapRef],
  );

  const currentZoom = useSyncExternalStore(
    subscribeViewChanges,
    useCallback((): number => mapRef?.getMap().getZoom() ?? 0, [mapRef]),
  );
  const currentPitch = useSyncExternalStore(
    subscribeViewChanges,
    useCallback((): number => mapRef?.getMap().getPitch() ?? 0, [mapRef]),
  );

  const minZoom = mapRef?.getMap().getMinZoom() ?? 0;
  const maxZoom = mapRef?.getMap().getMaxZoom() ?? 22;

  const canZoomIn = mapRef !== undefined && currentZoom < maxZoom - BOUND_EPSILON;
  const canZoomOut = mapRef !== undefined && currentZoom > minZoom + BOUND_EPSILON;
  const canTiltUp = mapRef !== undefined && currentPitch < TILT_MAX_DEG - BOUND_EPSILON;
  const canTiltDown = mapRef !== undefined && currentPitch > TILT_MIN_DEG + BOUND_EPSILON;

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

  const handleTiltUp = useCallback((): void => {
    if (mapRef === undefined) {
      return;
    }
    const m = mapRef.getMap();
    const next = Math.min(TILT_MAX_DEG, m.getPitch() + TILT_STEP_DEG);
    m.easeTo({ pitch: next, duration: TILT_ANIMATION_MS });
  }, [mapRef]);

  const handleTiltDown = useCallback((): void => {
    if (mapRef === undefined) {
      return;
    }
    const m = mapRef.getMap();
    const next = Math.max(TILT_MIN_DEG, m.getPitch() - TILT_STEP_DEG);
    m.easeTo({ pitch: next, duration: TILT_ANIMATION_MS });
  }, [mapRef]);

  return (
    <div className="absolute bottom-10 right-3 z-10 flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-md">
      <button
        type="button"
        onClick={handleZoomIn}
        disabled={!canZoomIn}
        aria-label="Zoom in"
        className={CONTROL_BUTTON_CLASS}
      >
        <PlusIcon />
      </button>
      <div className="h-px bg-slate-200" aria-hidden="true" />
      <button
        type="button"
        onClick={handleZoomOut}
        disabled={!canZoomOut}
        aria-label="Zoom out"
        className={CONTROL_BUTTON_CLASS}
      >
        <MinusIcon />
      </button>
      <div className="h-px bg-slate-200" aria-hidden="true" />
      <button
        type="button"
        onClick={handleTiltUp}
        disabled={!canTiltUp}
        aria-label="Tilt up"
        className={CONTROL_BUTTON_CLASS}
      >
        <TiltUpIcon />
      </button>
      <div className="h-px bg-slate-200" aria-hidden="true" />
      <button
        type="button"
        onClick={handleTiltDown}
        disabled={!canTiltDown}
        aria-label="Tilt down"
        className={CONTROL_BUTTON_CLASS}
      >
        <TiltDownIcon />
      </button>
    </div>
  );
}

/**
 * Shared button styling for every control in the stack. Includes a Tailwind
 * `disabled:` variant block so at-bound buttons read as inert (lighter text,
 * not-allowed cursor, no hover wash) without losing their footprint in the
 * stack - keeping the control geometry stable at the bounds.
 */
const CONTROL_BUTTON_CLASS =
  'flex h-8 w-8 items-center justify-center text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white';

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

/**
 * Inline glyph for the tilt-up button: a chevron above a horizontal "horizon"
 * line, suggesting the camera is tipping forward to reveal more of the
 * landscape ahead.
 */
function TiltUpIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 5.5L7 2.5L10.5 5.5M2.5 10H11.5" />
    </svg>
  );
}

/**
 * Inline glyph for the tilt-down button: a horizontal "horizon" line above
 * a chevron, the mirror of the tilt-up icon, suggesting the camera is
 * tipping back toward the flat plan view.
 */
function TiltDownIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4H11.5M3.5 8.5L7 11.5L10.5 8.5" />
    </svg>
  );
}
