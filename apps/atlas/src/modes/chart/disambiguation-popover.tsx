import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import {
  compareAirspaceByAltitudeDesc,
  formatAirspaceAltitudeRange,
  readAirspaceAltitudeKey,
} from '../../shared/inspector/airspace-feature.ts';
import type { AirspaceAltitudeKey } from '../../shared/inspector/airspace-feature.ts';
import { useCanHover } from '../../shared/styles/use-can-hover.ts';
import { FLOATING_SURFACE_CLASSES } from '../../shared/styles/style-tokens.ts';
import { AIRPORTS_LAYER_ID } from './layers/airports-layer.tsx';
import {
  AIRSPACE_FILL_EXTRUSION_LAYER_ID,
  AIRSPACE_FILL_LAYER_ID,
  AIRSPACE_LINE_LAYER_ID,
} from './layers/airspace-layer.tsx';
import { AIRWAYS_LAYER_ID } from './layers/airways-layer.tsx';
import { FIXES_LAYER_ID } from './layers/fixes-layer.tsx';
import { NAVAIDS_LAYER_ID } from './layers/navaids-layer.tsx';
import { formatChipLabel, selectedFromFeature } from './click-to-select.ts';
import type { InspectableFeature } from './click-to-select.ts';
import { useSetHoveredChipSelection } from './highlight-context.ts';

/**
 * Pixel offset between the click point and the popover's top-left
 * corner. Keeps the popover next to the cursor instead of directly
 * under it (where it would intercept follow-up drags or hover-outs).
 */
const POPOVER_OFFSET_PX = 8;

/**
 * Props for {@link DisambiguationPopover}.
 */
export interface DisambiguationPopoverProps {
  /**
   * Click position in map-canvas screen coordinates, sourced from
   * `MapLayerMouseEvent.point`. The popover is absolutely positioned
   * relative to the chart-mode's relative ancestor (`<main>` in the
   * shell layout), and the map canvas fills that ancestor with
   * `inset: 0`, so map-canvas coords work directly here.
   */
  screen: { x: number; y: number };
  /**
   * Every feature MapLibre returned for the click, in its original
   * order (topmost-rendered first). The popover dedupes by encoded
   * selection and drops features whose layer is not encodeable.
   */
  candidates: readonly InspectableFeature[];
  /**
   * Called with a chosen feature's encoded selection string when the
   * user clicks an entry. The caller is responsible for clearing the
   * pending state that drove this popover; the popover unmounts on
   * the next render.
   */
  onSelect: (selection: string) => void;
  /**
   * Called when the popover should close without a selection - on
   * Escape or on a map view change (pan, zoom, programmatic ease).
   * Outside-click dismissal is handled by the chart-mode click flow,
   * which replaces or clears the pending state on its own.
   */
  onDismiss: () => void;
}

/**
 * Floating popover anchored to a click pixel that lists every feature
 * MapLibre returned for an ambiguous click, letting the user pick one
 * explicitly instead of relying on the layer-priority auto-pick.
 *
 * Each entry highlights its feature on the map on hover (via the
 * chart-mode highlight context, identical to how the inspector's
 * "Also here" sibling chips behave) and selects it on click.
 *
 * Auto-dismisses on:
 *
 * - Escape key (anywhere on the page).
 * - The underlying MapLibre map firing `movestart` (a pan, zoom, or
 *   programmatic ease) - dismissing at `movestart` rather than
 *   `moveend` keeps the popover from visibly detaching from its
 *   anchor mid-drag.
 *
 * Outside-click dismissal is implicit: clicks elsewhere on the map
 * run through chart-mode's click handler, which either replaces the
 * pending state with a fresh classification or clears it.
 */
export function DisambiguationPopover({
  screen,
  candidates,
  onSelect,
  onDismiss,
}: DisambiguationPopoverProps): ReactElement | null {
  const map = useMap();
  const mapRef = map.current ?? map.default;
  const setHoveredChipSelection = useSetHoveredChipSelection();
  const canHover = useCanHover();

  // Build the visible entry list. Drops features whose layer cannot
  // produce a selection (e.g. an airport feature missing `faaId`) and
  // dedupes by the encoded selection string so two Class B rings or a
  // fill+line pair for the same airspace collapse to one row.
  //
  // Airspace rows additionally carry a compact altitude subtitle (e.g.
  // "11k-18k" or "SFC-10k") so two MOA components or ARTCC strata that
  // share an identical lateral polygon - and therefore an identical map
  // highlight - remain visually distinguishable in the list.
  //
  // Airspace rows are then sorted by altitude descending (highest
  // ceiling first, floor as tie-break) so a stack of vertically-layered
  // airspaces (Class B + ARTCC + Class E5; MOA HIGH + MOA LOW) reads
  // top-down. Non-airspace rows keep their MapLibre z-order position
  // since they have no altitude to sort against; in practice
  // queryRenderedFeatures returns them ahead of airspace anyway, so
  // the visible result is "points/lines first, then airspace by
  // altitude".
  const entries = useMemo<readonly PopoverEntry[]>(() => {
    const seen = new Set<string>();
    const nonAirspace: PopoverEntry[] = [];
    const airspace: { entry: PopoverEntry; key: AirspaceAltitudeKey }[] = [];
    for (const feature of candidates) {
      const selection = selectedFromFeature(feature);
      if (selection === undefined) {
        continue;
      }
      if (seen.has(selection)) {
        continue;
      }
      const type = featureTypeLabel(feature);
      if (type === undefined) {
        continue;
      }
      seen.add(selection);
      const subtitle = subtitleForFeature(feature);
      const entry: PopoverEntry = {
        selection,
        type,
        label: formatChipLabel(feature),
        ...(subtitle !== undefined && { subtitle }),
      };
      const altitudeKey = isAirspaceFeature(feature)
        ? readAirspaceAltitudeKey(feature.properties)
        : undefined;
      if (altitudeKey === undefined) {
        nonAirspace.push(entry);
      } else {
        airspace.push({ entry, key: altitudeKey });
      }
    }
    airspace.sort((a, b) => compareAirspaceByAltitudeDesc(a.key, b.key));
    return [...nonAirspace, ...airspace.map((it) => it.entry)];
  }, [candidates]);

  useEffect((): (() => void) => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onDismiss();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onDismiss]);

  useEffect((): (() => void) | undefined => {
    if (mapRef === undefined) {
      return undefined;
    }
    const m = mapRef.getMap();
    function handleMoveStart(): void {
      onDismiss();
    }
    m.on('movestart', handleMoveStart);
    return (): void => {
      m.off('movestart', handleMoveStart);
    };
  }, [mapRef, onDismiss]);

  // Defensive empty guard. The chart-mode click classifier only
  // produces an `ambiguous` result with 2+ encodeable features, but
  // the dedupe pass above could in principle leave us with fewer than
  // 2 rows if every-but-one feature shared an encoding. In that case
  // render nothing rather than a single-row "menu".
  if (entries.length < 2) {
    return null;
  }

  // Heuristic for "this list is long enough to be tedious to scan".
  // Tied to the bottom hint suggesting the user zoom in for a smaller
  // candidate set; tuned against typical CONUS-zoom airspace clicks
  // where 20+ rows is overwhelming.
  const HINT_THRESHOLD = 20;

  return (
    <ClampedPopover
      anchorX={screen.x + POPOVER_OFFSET_PX}
      anchorY={screen.y + POPOVER_OFFSET_PX}
      // Re-clamp when the entry count changes (the popover height
      // changes with the entry list).
      clampKey={entries.length}
      role="menu"
      aria-label="Select a feature"
      className={`absolute z-30 flex max-h-[70vh] max-w-[calc(100vw-1rem)] min-w-[12.5rem] flex-col overflow-hidden rounded-md shadow-lg ${FLOATING_SURFACE_CLASSES}`}
    >
      <p className="flex shrink-0 items-baseline justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-slate-600 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <span>Select a feature</span>
        <span className="font-mono text-slate-400 dark:text-slate-500">{entries.length}</span>
      </p>
      <ul className="flex flex-col overflow-y-auto">
        {entries.map((entry) => (
          <li key={entry.selection}>
            <button
              type="button"
              role="menuitem"
              onClick={(): void => onSelect(entry.selection)}
              {...(canHover && {
                onMouseEnter: (): void => setHoveredChipSelection(entry.selection),
                onMouseLeave: (): void => setHoveredChipSelection(undefined),
              })}
              onFocus={(): void => setHoveredChipSelection(entry.selection)}
              onBlur={(): void => setHoveredChipSelection(undefined)}
              className="flex w-full items-baseline gap-2 px-3 py-3 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 focus:bg-indigo-50 focus:text-indigo-700 focus:outline-none md:py-1.5 dark:text-slate-200 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-300 dark:focus:bg-indigo-950/50 dark:focus:text-indigo-300"
            >
              <span className="w-14 shrink-0 text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {entry.type}
              </span>
              <span className="font-medium">{entry.label}</span>
              {entry.subtitle === undefined ? null : (
                <span className="ml-auto pl-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {entry.subtitle}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {entries.length > HINT_THRESHOLD ? (
        <p className="shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] tracking-wide text-slate-500 italic dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Zoom in for fewer options
        </p>
      ) : null}
    </ClampedPopover>
  );
}

/**
 * Wraps the popover root with a `useLayoutEffect` that measures the
 * rendered popover and shifts it so it never overflows the bounds of
 * its positioned ancestor (the chart-mode `<main>` container). The
 * naive `top: anchorY` would let a click near the bottom of the map
 * push the popover off the screen; clamping keeps it fully visible
 * while staying as close to the click as possible.
 */
function ClampedPopover({
  anchorX,
  anchorY,
  clampKey,
  children,
  ...rest
}: {
  anchorX: number;
  anchorY: number;
  clampKey: unknown;
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'style' | 'children'>): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  // Initial position uses the raw anchor; the layout effect below
  // refines it after measurement. useLayoutEffect runs synchronously
  // after layout but before paint, so the user never sees the
  // unclamped position.
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: anchorX,
    top: anchorY,
  });
  useLayoutEffect((): void => {
    const el = ref.current;
    if (el === null) {
      return;
    }
    const parent = el.parentElement;
    if (parent === null) {
      return;
    }
    const popover = el.getBoundingClientRect();
    const container = parent.getBoundingClientRect();
    // jsdom and other unlaid-out environments report all bounds as
    // zero; without this guard the clamping below would pin the
    // popover to (POPOVER_OFFSET_PX, POPOVER_OFFSET_PX) regardless of
    // anchor. Skip the clamp when there is nothing to clamp against.
    if (container.height === 0 || container.width === 0) {
      return;
    }
    let left = anchorX;
    let top = anchorY;
    // Bottom-overflow: shift popover up so its bottom sits inside
    // the parent (with a small breathing-room margin equal to the
    // anchor offset).
    if (top + popover.height > container.height - POPOVER_OFFSET_PX) {
      top = Math.max(POPOVER_OFFSET_PX, container.height - popover.height - POPOVER_OFFSET_PX);
    }
    // Right-overflow: same shift on the horizontal axis. Rare in
    // practice (the popover is narrow and clicks happen on the
    // un-occluded left side of the map), but cheap to handle.
    if (left + popover.width > container.width - POPOVER_OFFSET_PX) {
      left = Math.max(POPOVER_OFFSET_PX, container.width - popover.width - POPOVER_OFFSET_PX);
    }
    setPos({ left, top });
  }, [anchorX, anchorY, clampKey]);
  return (
    <div ref={ref} style={pos} {...rest}>
      {children}
    </div>
  );
}

/**
 * Single entry rendered as a popover row. `subtitle` is currently set
 * only for airspace rows (a compact altitude range like "11k-18k") so
 * two MOA components or ARTCC strata that share a lateral polygon -
 * and therefore an identical map highlight - remain visually
 * distinguishable. Other feature types omit it.
 */
interface PopoverEntry {
  /** URL-encoded selection string passed back to the caller on click. */
  selection: string;
  /** Short human-readable layer label (e.g. "Airspace", "Fix"). */
  type: string;
  /** Primary label, identical to the inspector's chip-strip label. */
  label: string;
  /** Optional secondary detail, currently used for altitude bands. */
  subtitle?: string;
}

/**
 * Tiny predicate kept inline because it is only used in this module
 * (the inspector reads its altitude key directly from the synthetic
 * floor/ceiling primitives and does not need the layer-id check).
 */
function isAirspaceFeature(feature: InspectableFeature): boolean {
  return (
    feature.layer.id === AIRSPACE_FILL_LAYER_ID ||
    feature.layer.id === AIRSPACE_LINE_LAYER_ID ||
    feature.layer.id === AIRSPACE_FILL_EXTRUSION_LAYER_ID
  );
}

/**
 * Human-friendly type label for an inspectable feature, used as the
 * leading column of each popover row. Returns `undefined` for features
 * from layers the popover does not know how to label, which causes the
 * row to be dropped silently. Mirrors the layer set encoded by
 * {@link selectedFromFeature}; if that function gains a new branch,
 * add the matching label here.
 */
function featureTypeLabel(feature: InspectableFeature): string | undefined {
  switch (feature.layer.id) {
    case AIRPORTS_LAYER_ID:
      return 'Airport';
    case NAVAIDS_LAYER_ID:
      return 'Navaid';
    case FIXES_LAYER_ID:
      return 'Fix';
    case AIRWAYS_LAYER_ID:
      return 'Airway';
    case AIRSPACE_FILL_LAYER_ID:
    case AIRSPACE_LINE_LAYER_ID:
    case AIRSPACE_FILL_EXTRUSION_LAYER_ID:
      return 'Airspace';
    default:
      return undefined;
  }
}

/**
 * Optional secondary line for a popover row. Today this only fires for
 * airspace features, where the altitude band (read from the GeoJSON
 * `floor`/`ceiling` properties carried by the airspace dataset) is the
 * only thing distinguishing two features that share a lateral polygon
 * - e.g. `MOA MEUREKAH` (high) and `MOA MEUREKAL` (low). Returns
 * `undefined` for non-airspace features and for airspace features
 * whose altitude bounds are missing or malformed.
 */
function subtitleForFeature(feature: InspectableFeature): string | undefined {
  if (!isAirspaceFeature(feature)) {
    return undefined;
  }
  return formatAirspaceAltitudeRange(feature.properties);
}
