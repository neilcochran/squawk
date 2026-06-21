import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useMap } from '@vis.gl/react-maplibre';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';

import { useHoveredAirwayWaypointIndex } from '../../modes/chart/highlight-context.ts';
import type { InspectableFeature } from '../../modes/chart/interaction/click-to-select.ts';
import { CHART_ROUTE_PATH } from '../../modes/chart/url-state.ts';

import { buildInspectorChipList } from './chip-builders.ts';
import type { Chip } from './chip-builders.ts';
import { useDatasetStates, resolveSelectionFromState } from './entity-resolver.ts';
import type { BoundingBox } from './geometry.ts';
import { InspectorBody } from './inspector-body.tsx';
import { InspectorGrabHandle } from './inspector-grab-handle.tsx';
import { InspectorHeader } from './inspector-header.tsx';
import { computeSheetOcclusionPx } from './inspector-sheet.ts';
import { SiblingChips } from './sibling-chips.tsx';
import { useAirwayLegHoverPan } from './use-airway-leg-hover-pan.ts';
import { useChipHoverPan } from './use-chip-hover-pan.ts';
import { useSheetMinimizeDrag } from './use-sheet-minimize-drag.ts';

const route = getRouteApi(CHART_ROUTE_PATH);

/**
 * Props for {@link EntityInspector}.
 */
export interface EntityInspectorProps {
  /**
   * Every feature returned by the most recent map click. The inspector
   * derives an "Also here" chip strip from this list so the user can
   * switch between stacked features (e.g. Class B + ARTCC at the same
   * point) without re-clicking. Empty (default) when no click has
   * occurred yet, e.g. on first load with a `?selected=` URL.
   */
  siblings?: readonly InspectableFeature[];
}

/**
 * Inline style for the inspector sheet. Extends {@link CSSProperties}
 * with the two custom properties the sheet transform reads, so the
 * custom-property keys type-check without a cast.
 */
interface SheetStyle extends CSSProperties {
  /** Measured height of the always-visible peek region (handle + header). */
  '--peek-h': string;
  /** Resolved vertical translate: live drag pixels, committed calc, or zero. */
  '--sheet-ty': string;
}

/**
 * Right-side inspector panel that shows details for the entity referenced
 * by the URL `selected` search param. Renders nothing when no entity is
 * selected; renders a slim loading or not-found header when the URL points
 * at an unloaded or stale id; otherwise dispatches to a per-type renderer.
 *
 * Layout is responsive: at the Tailwind `md:` breakpoint (>= 768px)
 * the panel sits `absolute` along the right edge of the chart area
 * (`top-0 right-0 bottom-0 w-inspector`, with the `inspector` spacing
 * token declared in `src/index.css`). Below that breakpoint it
 * collapses into a bottom sheet (`right-0 bottom-0 left-0
 * max-h-[60vh]`) so the map stays visible above on phones. The
 * chip-hover pan and recenter offset in `use-chip-hover-pan.ts` follow
 * the same breakpoint and shift the camera focal point along whichever
 * axis is occluded. The panel overlaps the layer-toggle dropdown when
 * both are open; the close affordance is the X in the panel header.
 *
 * Minimize without deselecting: the panel can collapse to its peek bar
 * (grab handle + header) while keeping the selection, so the user can
 * glance at the full map without losing their place. On desktop a chevron
 * button in the header toggles it; below `md` the bottom sheet exposes a
 * drag handle (drag down to minimize, up to restore, tap to toggle). The
 * minimized flag is transient component state - forgotten on refresh and
 * auto-restored to expanded whenever the selection changes, since a new
 * pick is an explicit "show me this". While minimized the collapsed
 * footprint also drops out of the chip-hover pan math so the camera stops
 * reserving space for a panel that is no longer occluding the map.
 *
 * Stacked features at the click point: when the user clicks a spot where
 * multiple features overlap (Class B inside ARTCC, an airport sitting on
 * an airway, etc.) the picker chooses the most-specific one
 * (point > line > polygon), and any unchosen features become "Also here"
 * chips below the header. Clicking a chip swaps `selected` to that
 * sibling without closing the panel or dismissing the chip strip, so the
 * user can cycle through the stack with one click each.
 *
 * Must be rendered inside the chart route's component tree so
 * `getRouteApi(CHART_ROUTE_PATH)` resolves (the panel reads + writes the
 * `selected` search param).
 */
export function EntityInspector({ siblings = [] }: EntityInspectorProps): ReactElement | null {
  const { selected, lat, lon, zoom, layers, airspaceClasses } = route.useSearch();
  const navigate = useNavigate({ from: CHART_ROUTE_PATH });
  const datasets = useDatasetStates();
  const map = useMap();
  const mapRef = map.current ?? map.default;
  // Approximate viewport bounds, recomputed when the URL view-state
  // (lat/lon/zoom) changes. The chart-mode round-trips view-state through
  // the URL on every moveend, so this useMemo re-runs on every map pan
  // or zoom without needing a separate event subscription. Returns
  // undefined on first render (before the map ref settles), in which
  // case the bbox-overlap chip walk skips the viewport filter.
  const viewportBounds = useMemo<BoundingBox | undefined>(() => {
    if (mapRef === undefined) {
      return undefined;
    }
    const b = mapRef.getMap().getBounds();
    return {
      minLon: b.getWest(),
      maxLon: b.getEast(),
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
    };
    // lat/lon/zoom are intentionally unused inside the body; they are in
    // the dep list so the memo recomputes after each URL-driven view
    // change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, lat, lon, zoom]);
  const state = useMemo(() => resolveSelectionFromState(selected, datasets), [selected, datasets]);

  // Transient minimize state: collapse the panel to its header without
  // dropping the selection, so the user can glance at the full map and
  // come back. Forgotten on refresh by design (it is not in the URL).
  const [minimized, setMinimized] = useState(false);
  // Auto-restore to expanded whenever the selection changes: a new pick
  // is an explicit "show me this", so the panel never opens already
  // collapsed. setState-during-render is the React-sanctioned way to
  // reset state from a changed value without an effect.
  const [previousSelected, setPreviousSelected] = useState<typeof selected>(selected);
  if (previousSelected !== selected) {
    setPreviousSelected(selected);
    if (minimized) {
      setMinimized(false);
    }
  }

  // Refs feed the drag hook the element heights it needs to size the
  // sheet's slide range; the peek wrapper's measured height also drives
  // the committed-minimized translate via the `--peek-h` custom property.
  const asideRef = useRef<HTMLElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const [peekHeightPx, setPeekHeightPx] = useState(0);
  const [asideHeightPx, setAsideHeightPx] = useState(0);
  useEffect(() => {
    const peek = peekRef.current;
    const aside = asideRef.current;
    if (peek === null || aside === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const measure = (): void => {
      setPeekHeightPx(peek.offsetHeight);
      setAsideHeightPx(aside.offsetHeight);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(peek);
    observer.observe(aside);
    measure();
    return (): void => {
      observer.disconnect();
    };
    // Re-attach when the panel mounts/unmounts across the idle boundary:
    // the peek and aside elements only exist in non-idle states, so a
    // stable `[]` dep would miss the remount and never observe the real
    // elements.
  }, [state.status]);

  const {
    dragOffsetPx,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleClick: handleGrabHandleClick,
  } = useSheetMinimizeDrag({ minimized, onMinimizedChange: setMinimized, asideRef, peekRef });

  const handleToggleMinimized = useCallback((): void => {
    setMinimized((prev) => !prev);
  }, []);

  // All chip-hover panning, recenter, and viewport-freeze state lives
  // in `useChipHoverPan`. The hook owns the pre-pan capture, the
  // bounce-fix freeze, the dragstart subscription, and the
  // selection-change cleanup; the inspector wires its outputs into
  // the chip strip, the recenter button, and the chip useMemo. The
  // minimized flag drops the inspector's occlusion footprint from the
  // pan math while the panel is collapsed.
  const { handleChipHover, handleChipCommit, handleRecenter, chipViewportBounds, resetSession } =
    useChipHoverPan({
      selected,
      mapRef,
      datasets,
      viewportBounds,
      state,
      minimized,
    });

  // Drives the camera while the user hovers per-row entries in the
  // airway inspector panel. The panel writes
  // `hoveredAirwayWaypointIndex` into the highlight context (gated on
  // `useCanHover()` so touch devices never fire it); this hook eases
  // the camera to the leg midpoint (or the start waypoint for row 0)
  // when the area is offscreen, restoring the pre-pan center on
  // unhover.
  const hoveredAirwayWaypointIndex = useHoveredAirwayWaypointIndex();
  useAirwayLegHoverPan({
    selected,
    hoveredWaypointIndex: hoveredAirwayWaypointIndex,
    mapRef,
    state,
  });

  const handleClose = useCallback((): void => {
    resetSession();
    void navigate({
      search: (prev) => ({ ...prev, selected: undefined }),
      replace: true,
    });
  }, [navigate, resetSession]);

  const handleSwitchSelected = useCallback(
    (next: string): void => {
      // Pan to the picked chip's feature first, then commit the URL.
      // `handleChipCommit` clears any in-flight hover session so the
      // unhover-restore does NOT yank the user back to a position that
      // no longer matches the new selection. The pan starts immediately
      // and continues through the URL change so the camera ends up at
      // the new feature regardless of input device.
      handleChipCommit(next);
      void navigate({
        search: (prev) => ({ ...prev, selected: next }),
        replace: true,
      });
    },
    [navigate, handleChipCommit],
  );

  // Build the chip list. The pure helper handles dedupe, footprint
  // computation, the bbox-overlap walk, altitude-descending sort, and
  // duplicate-label disambiguation - the inspector is left to memoize
  // the result against its inputs.
  const chips = useMemo<readonly Chip[]>(
    () =>
      buildInspectorChipList({
        siblings,
        selected,
        datasets,
        state,
        layers,
        airspaceClasses,
        viewportBounds: chipViewportBounds,
      }),
    [siblings, selected, datasets, state, layers, airspaceClasses, chipViewportBounds],
  );

  // Publish the mobile sheet's live occlusion height and the matching
  // transition timing so the map's zoom/tilt controls can lift to stay
  // above the bottom sheet as it expands, minimizes, or is dragged. The
  // values live on documentElement because the controls are siblings of
  // this panel, not descendants, so they cannot read a custom property
  // scoped to the aside; useLayoutEffect writes them before paint to
  // avoid a one-frame lag behind the sheet. Desktop ignores them - the
  // controls reset to a fixed offset at the md breakpoint.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const occlusionPx = computeSheetOcclusionPx({
      active: state.status !== 'idle',
      dragOffsetPx,
      minimized,
      sheetHeightPx: asideHeightPx,
      peekHeightPx,
    });
    root.style.setProperty('--atlas-inspector-occlusion', `${occlusionPx}px`);
    root.style.setProperty('--atlas-inspector-anim', dragOffsetPx === undefined ? '200ms' : '0ms');
    return (): void => {
      root.style.removeProperty('--atlas-inspector-occlusion');
      root.style.removeProperty('--atlas-inspector-anim');
    };
  }, [state.status, dragOffsetPx, minimized, asideHeightPx, peekHeightPx]);

  if (state.status === 'idle') {
    return null;
  }

  // While a drag is live the sheet must follow the finger 1:1, so the
  // committed translate becomes the live pixel offset and the snap
  // transition is suppressed; on release the offset clears, the
  // transition returns, and the sheet animates to its committed slot.
  const sheetTranslate =
    dragOffsetPx !== undefined
      ? `${dragOffsetPx}px`
      : minimized
        ? 'calc(100% - var(--peek-h))'
        : '0px';
  const sheetStyle: SheetStyle = {
    '--peek-h': `${peekHeightPx}px`,
    '--sheet-ty': sheetTranslate,
  };
  const sheetTransitionClasses =
    dragOffsetPx === undefined
      ? 'transition-transform duration-200 ease-out motion-reduce:transition-none'
      : '';
  // Desktop collapses by dropping the bottom anchor so the panel shrinks
  // to its header height; the mobile-only translate is pinned to 0 at md.
  const desktopMinimizedClasses = minimized ? 'md:bottom-auto' : '';

  return (
    <aside
      ref={asideRef}
      style={sheetStyle}
      className={`absolute right-0 bottom-0 left-0 z-20 max-h-[60vh] translate-y-[var(--sheet-ty)] overflow-y-auto rounded-t-xl border-t border-slate-200 bg-white shadow-lg md:top-0 md:left-auto md:max-h-none md:w-inspector md:translate-y-0 md:rounded-none md:border-t-0 md:border-l dark:border-slate-700 dark:bg-slate-900 ${sheetTransitionClasses} ${desktopMinimizedClasses}`}
      aria-label="Entity inspector"
    >
      <div ref={peekRef} className="sticky top-0 z-10 bg-white dark:bg-slate-900">
        <InspectorGrabHandle
          minimized={minimized}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onClick={handleGrabHandleClick}
        />
        <InspectorHeader
          state={state}
          onClose={handleClose}
          minimized={minimized}
          onToggleMinimized={handleToggleMinimized}
          {...(state.status === 'resolved' && { onRecenter: handleRecenter })}
        />
      </div>
      <div className={minimized ? 'md:hidden' : undefined} inert={minimized}>
        {chips.length === 0 ? null : (
          <SiblingChips chips={chips} onSelect={handleSwitchSelected} onHover={handleChipHover} />
        )}
        <InspectorBody state={state} />
      </div>
    </aside>
  );
}
