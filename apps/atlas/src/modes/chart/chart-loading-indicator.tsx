import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import { useAirportDataset } from '../../shared/data/airport-dataset.ts';
import { useAirspaceDataset } from '../../shared/data/airspace-dataset.ts';
import { useAirwayDataset } from '../../shared/data/airway-dataset.ts';
import { useFixDataset } from '../../shared/data/fix-dataset.ts';
import { useNavaidDataset } from '../../shared/data/navaid-dataset.ts';

/**
 * Brief hold after the map has finished painting before the card starts
 * to fade, milliseconds. Long enough for the user to see the "Loading
 * complete" state, short enough not to feel like a delay.
 */
const COMPLETE_HOLD_MS = 400;

/**
 * Fade-out duration, milliseconds. Matches the inline `transitionDuration`
 * applied to the card so the JS dismissal timer and the CSS opacity
 * transition stay in sync.
 */
const FADE_OUT_MS = 300;

/**
 * Maximum time to wait for MapLibre to fire its `idle` event after every
 * dataset has resolved, milliseconds. The idle event is the canonical
 * "map is fully painted" signal, but in pathological cases (user pans
 * the map mid-load, a tile request hangs, etc.) the event might never
 * arrive. The fallback timer dismisses anyway so the indicator does not
 * get stuck.
 */
const RENDER_FALLBACK_MS = 5000;

/** One row in the dataset roster the indicator aggregates. */
interface DatasetSlot {
  /** Current load status of this dataset. */
  status: 'loading' | 'loaded' | 'error';
  /** Verb-phrase shown in the status line while loading. */
  loadingLabel: string;
  /** Bare noun used in the error message ("couldn't load <noun>"). */
  noun: string;
}

/**
 * Initial-load indicator for chart mode. Shows a small centered card
 * over a translucent white wash that hides the basemap tile streaming
 * and layer compositing while loading. The status line reflects
 * whichever dataset is currently still loading. After every dataset
 * resolves the message switches to "Rendering map..." and the indicator
 * subscribes to the underlying MapLibre instance's `idle` event - the
 * canonical "map is fully painted" signal - via the `<MapProvider>`
 * context. When idle fires the spinner is replaced by a green dot, the
 * message reads "Loading complete", the card holds briefly, and fades
 * out together with the wash. If any dataset fails to load, the card
 * switches to an error state with a reload button. A fallback timer
 * dismisses if idle never fires within {@link RENDER_FALLBACK_MS} of
 * the data being loaded (e.g. the user panned the map mid-load).
 */
export function ChartLoadingIndicator(): ReactElement | null {
  const airports = useAirportDataset();
  const navaids = useNavaidDataset();
  const fixes = useFixDataset();
  const airways = useAirwayDataset();
  const airspace = useAirspaceDataset();

  const map = useMap();
  const mapRef = map.current;

  // Ordered roughly by bundled `.gz` size (smallest first) so the
  // displayed message - always the first still-loading slot - actually
  // progresses through several phrases as fetches resolve, rather than
  // getting stuck on whichever happens to be defined first.
  const slots: DatasetSlot[] = [
    { status: navaids.status, loadingLabel: 'Tuning navaids...', noun: 'navaids' },
    { status: airways.status, loadingLabel: 'Plotting airways...', noun: 'airways' },
    { status: fixes.status, loadingLabel: 'Cross-checking fixes...', noun: 'fixes' },
    { status: airports.status, loadingLabel: 'Verifying airports...', noun: 'airports' },
    { status: airspace.status, loadingLabel: 'Reviewing airspace...', noun: 'airspace' },
  ];

  const erroredSlot = slots.find((slot) => slot.status === 'error');
  const allDataLoaded = slots.every((slot) => slot.status === 'loaded');
  const firstStillLoading = slots.find((slot) => slot.status === 'loading');

  // Subscribe to the map's `idle` event after every dataset has loaded.
  // The event fires asynchronously when MapLibre has finished its render
  // pipeline, so the `setMapIdleAfterData` call lives in the event
  // handler (the sanctioned external-subscription pattern), not in the
  // effect body - keeping us clear of the `react-hooks/set-state-in-effect`
  // rule. `triggerRepaint()` covers the corner case where the map was
  // already idle when we subscribed (e.g. cached data resolves before
  // any layer adds a source) by forcing a fresh render cycle that lands
  // back at idle.
  const [mapIdleAfterData, setMapIdleAfterData] = useState(false);
  useEffect(() => {
    if (!allDataLoaded || mapRef === undefined) {
      return undefined;
    }
    const maplibreMap = mapRef.getMap();
    const handleIdle = (): void => {
      setMapIdleAfterData(true);
    };
    maplibreMap.on('idle', handleIdle);
    maplibreMap.triggerRepaint();
    return () => {
      maplibreMap.off('idle', handleIdle);
    };
  }, [allDataLoaded, mapRef]);

  // Fallback in case the map never goes idle (rare, but possible if the
  // user pans during load or a tile request hangs). The setState fires
  // from the timer callback, again outside the effect body.
  const [renderFallbackElapsed, setRenderFallbackElapsed] = useState(false);
  useEffect(() => {
    if (!allDataLoaded) {
      return undefined;
    }
    const id = window.setTimeout(() => setRenderFallbackElapsed(true), RENDER_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [allDataLoaded]);

  const complete = allDataLoaded && (mapIdleAfterData || renderFallbackElapsed);

  const [dismissing, setDismissing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!complete || dismissing) {
      return undefined;
    }
    const id = window.setTimeout(() => setDismissing(true), COMPLETE_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [complete, dismissing]);

  useEffect(() => {
    if (!dismissing) {
      return undefined;
    }
    const id = window.setTimeout(() => setDismissed(true), FADE_OUT_MS);
    return () => window.clearTimeout(id);
  }, [dismissing]);

  if (dismissed) {
    return null;
  }

  if (erroredSlot !== undefined) {
    return (
      <div
        className="absolute inset-0 z-10 flex items-center justify-center bg-white/85"
        role="alert"
      >
        <div className="w-72 rounded-lg border border-red-200 bg-white px-5 py-4 text-center shadow-md">
          <div className="text-sm font-medium text-red-700">
            Couldn&apos;t load {erroredSlot.noun}.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  let message: string;
  if (firstStillLoading !== undefined) {
    message = firstStillLoading.loadingLabel;
  } else if (!complete) {
    message = 'Rendering map...';
  } else {
    message = 'Loading complete';
  }

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 transition-opacity"
      style={{
        transitionDuration: `${FADE_OUT_MS}ms`,
        opacity: dismissing ? 0 : 1,
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex w-72 items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-md">
        {complete ? (
          <span
            className="inline-block h-4 w-4 shrink-0 rounded-full bg-emerald-500"
            aria-hidden="true"
          />
        ) : (
          <span
            className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"
            aria-hidden="true"
          />
        )}
        <span className="text-sm font-medium text-slate-700">{message}</span>
      </div>
    </div>
  );
}
