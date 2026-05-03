import { useMap } from '@vis.gl/react-maplibre';
import { useCallback, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';

import { FOCUS_RING_INSET_CLASSES } from '../styles/style-tokens.ts';
import { FloatingPanel } from '../ui/floating-panel.tsx';

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
 * `+`, `-`, tilt-up, and tilt-down buttons in the bottom-left corner of the
 * map area, raised enough that the MapLibre / OSM / Protomaps attribution
 * can sit underneath without overlap. The bottom-left position keeps the
 * controls clear of the right-side entity inspector overlay; the user
 * can zoom or tilt without losing sight of the controls when an inspector
 * panel opens. Uses MapLibre's `easeTo({ zoom })` and `easeTo({ pitch })`
 * to animate; the `moveend` event triggers the existing view-state
 * callback for the URL (zoom only - pitch is intentionally not
 * URL-persisted yet, mirroring map-canvas.tsx's deliberate omission of
 * bearing/pitch).
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
    <FloatingPanel className="absolute bottom-10 left-3 z-10 flex flex-col overflow-hidden rounded-md shadow-md">
      <ZoomReadout zoom={currentZoom} />
      <div className="h-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
      <button
        type="button"
        onClick={handleZoomIn}
        disabled={!canZoomIn}
        aria-label="Zoom in"
        className={CONTROL_BUTTON_CLASS}
      >
        <PlusIcon />
      </button>
      <div className="h-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
      <button
        type="button"
        onClick={handleZoomOut}
        disabled={!canZoomOut}
        aria-label="Zoom out"
        className={CONTROL_BUTTON_CLASS}
      >
        <MinusIcon />
      </button>
      <div className="h-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
      <button
        type="button"
        onClick={handleTiltUp}
        disabled={!canTiltUp}
        aria-label="Tilt up"
        className={CONTROL_BUTTON_CLASS}
      >
        <TiltUpIcon />
      </button>
      <div className="h-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
      <button
        type="button"
        onClick={handleTiltDown}
        disabled={!canTiltDown}
        aria-label="Tilt down"
        className={CONTROL_BUTTON_CLASS}
      >
        <TiltDownIcon />
      </button>
    </FloatingPanel>
  );
}

/**
 * Shared button styling for every control in the stack. Inset focus
 * ring (so the ring sits flush against the panel edge), `disabled:`
 * variants so at-bound buttons read as inert without losing their
 * footprint, and a slightly larger desktop size (md:h-8 md:w-8) to
 * match the panel's denser stacked layout.
 */
const CONTROL_BUTTON_CLASS = `flex h-11 w-11 items-center justify-center text-slate-700 hover:bg-slate-50 ${FOCUS_RING_INSET_CLASSES} disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white md:h-8 md:w-8 dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:text-slate-600 dark:disabled:hover:bg-slate-900`;

/**
 * Compact text formatter for the {@link ZoomReadout}: integer zooms
 * render bare ("4"), fractional zooms render to one decimal ("4.5").
 * Matches the threshold style in the layer-toggle hints so a user can
 * visually compare "Zoom 4.5" with a "Zoom 5+" hint at a glance.
 */
function formatZoomText(zoom: number): string {
  // Round first so 4.04 does not display as "4.0" and 4.95 does not
  // display as "5.0" (toFixed alone would produce both surprises).
  const rounded = Math.round(zoom * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Static readout chip showing the current map zoom, rendered atop the
 * zoom/tilt control stack. Drives the same numeric language as the
 * layer-toggle dropdown's "Zoom N+" hint so the user can sanity-check
 * whether a zoom-gated layer is about to appear or recently appeared.
 *
 * Non-interactive by design - clicking does nothing, the surrounding
 * `+ / -` buttons are the way to change zoom. The icon stacks above
 * the digits rather than sitting inline so the magnifying-glass shape
 * stays large enough to be unambiguous (an inline 11px icon next to
 * the digits visually compresses into a "Q" at desktop chip width).
 * `tabular-nums` keeps the digit width stable across "4" / "10" /
 * "12.5" so the chip footprint does not breathe.
 */
function ZoomReadout({ zoom }: { zoom: number }): ReactElement {
  const text = formatZoomText(zoom);
  return (
    <div
      role="status"
      aria-label={`Current zoom: ${text}`}
      className="flex h-11 w-11 flex-col items-center justify-center text-[10px] font-medium leading-none tabular-nums text-slate-600 md:h-8 md:w-8 dark:text-slate-300"
    >
      <ZoomIcon />
      <span className="mt-0.5">{text}</span>
    </div>
  );
}

/**
 * Magnifying-glass glyph used in the {@link ZoomReadout} chip. Sized
 * at 14x14 (mobile) / 12x12 (desktop) so the round lens reads clearly
 * - small enough to leave room for the digits below, large enough not
 * to be mistaken for a "Q" formed by a tiny circle plus inline text.
 * A small `+` inside the lens disambiguates the icon further: a
 * magnifying-glass-with-plus is the universally-read "zoom" affordance,
 * while a plain magnifying glass alone often reads as "search".
 */
function ZoomIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="md:h-3.5 md:w-3.5"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M5 7H9" />
      <path d="M7 5V9" />
      <path d="M10.5 10.5L13.5 13.5" />
    </svg>
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
