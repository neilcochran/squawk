import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useMap } from '@vis.gl/react-maplibre';
import { useCallback, useMemo } from 'react';
import type { ReactElement } from 'react';

import type { InspectableFeature } from '../../modes/chart/click-to-select.ts';
import { useHoveredAirwayWaypointIndex } from '../../modes/chart/highlight-context.ts';
import { CHART_ROUTE_PATH } from '../../modes/chart/url-state.ts';

import { buildInspectorChipList } from './chip-builders.ts';
import type { Chip } from './chip-builders.ts';
import { useDatasetStates, resolveSelectionFromState } from './entity-resolver.ts';
import type { BoundingBox } from './geometry.ts';
import { InspectorBody } from './inspector-body.tsx';
import { InspectorHeader } from './inspector-header.tsx';
import { SiblingChips } from './sibling-chips.tsx';
import { useAirwayLegHoverPan } from './use-airway-leg-hover-pan.ts';
import { useChipHoverPan } from './use-chip-hover-pan.ts';

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

  // All chip-hover panning, recenter, and viewport-freeze state lives
  // in `useChipHoverPan`. The hook owns the pre-pan capture, the
  // bounce-fix freeze, the dragstart subscription, and the
  // selection-change cleanup; the inspector wires its outputs into
  // the chip strip, the recenter button, and the chip useMemo.
  const { handleChipHover, handleChipCommit, handleRecenter, chipViewportBounds, resetSession } =
    useChipHoverPan({
      selected,
      mapRef,
      datasets,
      viewportBounds,
      state,
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

  if (state.status === 'idle') {
    return null;
  }

  return (
    <aside
      className="absolute right-0 bottom-0 left-0 z-20 max-h-[60vh] overflow-y-auto rounded-t-xl border-t border-slate-200 bg-white shadow-lg md:top-0 md:left-auto md:max-h-none md:w-inspector md:rounded-none md:border-t-0 md:border-l dark:border-slate-700 dark:bg-slate-900"
      aria-label="Entity inspector"
    >
      <InspectorHeader
        state={state}
        onClose={handleClose}
        {...(state.status === 'resolved' && { onRecenter: handleRecenter })}
      />
      {chips.length === 0 ? null : (
        <SiblingChips chips={chips} onSelect={handleSwitchSelected} onHover={handleChipHover} />
      )}
      <InspectorBody state={state} />
    </aside>
  );
}
