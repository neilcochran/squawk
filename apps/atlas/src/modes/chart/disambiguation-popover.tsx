import { useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import type { GeoJsonProperties } from 'geojson';
import { AIRPORTS_LAYER_ID } from './layers/airports-layer.tsx';
import {
  AIRSPACE_CEILING_FT_PROPERTY,
  AIRSPACE_CEILING_REF_PROPERTY,
  AIRSPACE_FILL_LAYER_ID,
  AIRSPACE_FLOOR_FT_PROPERTY,
  AIRSPACE_FLOOR_REF_PROPERTY,
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

  // Build the visible entry list. Drops features whose layer cannot
  // produce a selection (e.g. an airport feature missing `faaId`) and
  // dedupes by the encoded selection string so two Class B rings or a
  // fill+line pair for the same airspace collapse to one row.
  //
  // Airspace rows additionally carry a compact altitude subtitle (e.g.
  // "11k-18k" or "SFC-10k") so two MOA components or ARTCC strata that
  // share an identical lateral polygon - and therefore an identical map
  // highlight - remain visually distinguishable in the list.
  const entries = useMemo<readonly PopoverEntry[]>(() => {
    const seen = new Set<string>();
    const result: PopoverEntry[] = [];
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
      result.push({
        selection,
        type,
        label: formatChipLabel(feature),
        ...(subtitle !== undefined && { subtitle }),
      });
    }
    return result;
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

  return (
    <div
      role="menu"
      aria-label="Select a feature"
      className="absolute z-30 min-w-[180px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
      style={{ left: screen.x + POPOVER_OFFSET_PX, top: screen.y + POPOVER_OFFSET_PX }}
    >
      <p className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
        Select a feature
      </p>
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <li key={entry.selection}>
            <button
              type="button"
              role="menuitem"
              onClick={(): void => onSelect(entry.selection)}
              onMouseEnter={(): void => setHoveredChipSelection(entry.selection)}
              onMouseLeave={(): void => setHoveredChipSelection(undefined)}
              onFocus={(): void => setHoveredChipSelection(entry.selection)}
              onBlur={(): void => setHoveredChipSelection(undefined)}
              className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 focus:bg-indigo-50 focus:text-indigo-700 focus:outline-none"
            >
              <span className="w-14 shrink-0 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                {entry.type}
              </span>
              <span className="font-medium">{entry.label}</span>
              {entry.subtitle === undefined ? null : (
                <span className="ml-auto pl-2 font-mono text-xs text-slate-500">
                  {entry.subtitle}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
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
  if (feature.layer.id !== AIRSPACE_FILL_LAYER_ID && feature.layer.id !== AIRSPACE_LINE_LAYER_ID) {
    return undefined;
  }
  return readAirspaceAltitudeRange(feature.properties);
}

/**
 * Compact altitude bound for popover display.
 *
 * - SFC reference renders as the literal `SFC` (the value is always 0).
 * - MSL/AGL values land on a clean thousand render as `{N}k` (e.g.
 *   `11k`); other values render as `{N}ft` so an oddball "200 AGL"
 *   floor is not silently rounded.
 * - AGL values append the suffix; MSL is the implied default and
 *   stays bare to keep rows narrow.
 */
function formatAltitudeBound(bound: { valueFt: number; reference: 'MSL' | 'AGL' | 'SFC' }): string {
  if (bound.reference === 'SFC') {
    return 'SFC';
  }
  const formatted = bound.valueFt % 1000 === 0 ? `${bound.valueFt / 1000}k` : `${bound.valueFt}ft`;
  return bound.reference === 'AGL' ? `${formatted} AGL` : formatted;
}

/**
 * Reads the flat-primitive floor/ceiling properties added by
 * `projectAirspaceSource` and renders them as a compact range like
 * `11k-18k`. Reads primitives (not nested `{ valueFt, reference }`
 * objects) because MapLibre's GeoJSON worker pipeline does not
 * reliably round-trip nested objects through `queryRenderedFeatures`.
 *
 * Returns `undefined` when any required primitive is missing or has
 * an unexpected type - the popover row simply omits the subtitle in
 * that case.
 */
function readAirspaceAltitudeRange(properties: GeoJsonProperties): string | undefined {
  if (properties === null) {
    return undefined;
  }
  const floor = readBoundPrimitives(
    properties[AIRSPACE_FLOOR_FT_PROPERTY],
    properties[AIRSPACE_FLOOR_REF_PROPERTY],
  );
  const ceiling = readBoundPrimitives(
    properties[AIRSPACE_CEILING_FT_PROPERTY],
    properties[AIRSPACE_CEILING_REF_PROPERTY],
  );
  if (floor === undefined || ceiling === undefined) {
    return undefined;
  }
  return `${formatAltitudeBound(floor)}-${formatAltitudeBound(ceiling)}`;
}

/**
 * Validates a `(valueFt, reference)` primitive pair into an
 * `AltitudeBound` shape, defensively rejecting malformed inputs.
 */
function readBoundPrimitives(
  valueFt: unknown,
  reference: unknown,
): { valueFt: number; reference: 'MSL' | 'AGL' | 'SFC' } | undefined {
  if (typeof valueFt !== 'number' || typeof reference !== 'string') {
    return undefined;
  }
  if (reference !== 'MSL' && reference !== 'AGL' && reference !== 'SFC') {
    return undefined;
  }
  return { valueFt, reference };
}
