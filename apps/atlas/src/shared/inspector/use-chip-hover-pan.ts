import type { MapRef } from '@vis.gl/react-maplibre';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSetHoveredChipSelection } from '../../modes/chart/highlight-context.ts';

import { resolveSelectionFromState } from './entity-resolver.ts';
import type { ChartDatasetStates, ResolvedEntity, ResolvedEntityState } from './entity-resolver.ts';
import { bboxFromWaypoints, combinedBboxFromAirspaceFeatures } from './geometry.ts';
import type { BoundingBox } from './geometry.ts';

/**
 * Width in pixels of the inspector overlay when it renders as the
 * desktop right-edge panel. Mirrors the `--spacing-inspector` token
 * (22.5rem = 360px @ 16px root) declared in `src/index.css` and
 * consumed via `w-inspector` on the inspector aside in
 * `inspector.tsx`; keep both in sync. Stays as a plain pixel constant
 * rather than a rem value because every consumer feeds it to a
 * MapLibre canvas-pixel API (`map.easeTo({ offset })`,
 * `map.project()`).
 */
export const INSPECTOR_OVERLAY_DESKTOP_WIDTH_PX = 360;

/**
 * Tailwind `md:` breakpoint in pixels. The inspector renders as a
 * bottom sheet below this width and as a right-edge panel at or above
 * it, mirroring the `md:` overrides on the inspector aside. Keep in
 * sync with Tailwind v4's default `md` breakpoint (currently 48rem =
 * 768px); if either changes, update both.
 */
const INSPECTOR_DESKTOP_BREAKPOINT_PX = 768;

/**
 * Fraction of viewport height the inspector occupies as a mobile
 * bottom sheet. Mirrors the `max-h-[60vh]` clamp on the inspector
 * aside; the chip-hover pan keeps the selected feature visible above
 * this band.
 */
const INSPECTOR_MOBILE_HEIGHT_FRACTION = 0.6;

/**
 * Returns the inspector's chart-occlusion footprint for the current
 * viewport in canvas pixels. On desktop (>= the `md:` breakpoint) the
 * inspector occupies the right edge so the camera offset shifts the
 * focal point leftward (`x` non-zero). Below the breakpoint the
 * inspector is a bottom sheet so the offset shifts upward (`y`
 * non-zero) instead. Read at the time of pan so the camera follows
 * resize / orientation changes without cached stale geometry.
 */
function getInspectorOcclusionPx(): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }
  if (window.innerWidth >= INSPECTOR_DESKTOP_BREAKPOINT_PX) {
    return { x: INSPECTOR_OVERLAY_DESKTOP_WIDTH_PX, y: 0 };
  }
  return { x: 0, y: Math.round(window.innerHeight * INSPECTOR_MOBILE_HEIGHT_FRACTION) };
}

/**
 * Camera ease duration for chip-hover pan and recenter actions, in
 * milliseconds. Brief enough to feel responsive, long enough to be
 * smooth instead of teleporting.
 */
const PAN_DURATION_MS = 350;

/**
 * Minimum pixel margin from any visible-area edge before a feature is
 * considered "comfortably onscreen". Anything closer to an edge - or
 * fully offscreen - triggers the chip-hover pan so the user does not
 * have to peer at the periphery to see what they hovered.
 */
const PAN_EDGE_MARGIN_PX = 50;

/**
 * Inputs for {@link useChipHoverPan}. The hook is hard-wired to the
 * chart-mode map and the inspector's resolved-entity state, so the
 * caller threads its own copies of those through.
 */
export interface UseChipHoverPanArgs {
  /** Currently-selected entity URL string (read from the search params). */
  selected: string | undefined;
  /** Map ref returned by `useMap()` after `current ?? default` resolution. */
  mapRef: MapRef | undefined;
  /** Combined chart dataset state, passed to the entity resolver inside `chipCentroid`. */
  datasets: ChartDatasetStates;
  /**
   * Live viewport bounds derived from the map's current view-state.
   * The hook snapshots this on the first occluded chip-hover and uses
   * the snapshot for chip composition until the session ends.
   */
  viewportBounds: BoundingBox | undefined;
  /**
   * Resolved entity state for the current `selected`, used by the
   * recenter handler to pan the camera to the entity's centroid.
   */
  state: ResolvedEntityState;
}

/**
 * Public API of the chip-hover pan hook. The inspector wires
 * `handleChipHover` to the sibling chip strip's onHover, calls
 * `handleChipCommit` from its chip-click commit path,
 * exposes `handleRecenter` as the recenter button's onClick, derives
 * the chip `useMemo`'s viewport input from `chipViewportBounds`, and
 * calls `resetSession` from its close handler.
 */
export interface UseChipHoverPanResult {
  /**
   * Wraps `setHoveredChipSelection` with the pan state machine. On
   * an occluded chip-hover, captures the pre-pan center and the
   * viewport snapshot, then eases the camera so the chip's feature
   * lands in the un-occluded portion of the map. On hover-leave,
   * eases the camera back to the captured center; the captured
   * state stays sticky so a rapid leave-then-enter sequence does not
   * recapture mid-restore.
   */
  handleChipHover: (selection: string | undefined) => void;
  /**
   * Pan + commit handler for chip clicks. Eases the camera so the
   * picked chip's feature lands in the un-occluded portion of the
   * map and clears any in-flight hover session so the unhover-restore
   * does not yank the user back to a position that no longer matches
   * the new selection. Caller is still responsible for the URL
   * navigation that commits the selection. Pans regardless of input
   * device (mouse hover-then-click and touch tap both end up at the
   * picked feature).
   */
  handleChipCommit: (selection: string) => void;
  /**
   * Eases the camera so the currently-resolved entity lands in the
   * un-occluded portion of the map. No-op when the entity has no
   * usable centroid or the map is not yet available.
   */
  handleRecenter: () => void;
  /**
   * Viewport input for the chip-composition `useMemo`. While a
   * hover-pan is in flight, this returns the snapshot taken at the
   * start of the session so the chip list does not reshuffle as the
   * camera pans (the chip-reorder bounce). Outside a hover session,
   * tracks the live viewport bounds.
   */
  chipViewportBounds: BoundingBox | undefined;
  /**
   * Clears the captured pre-pan center and viewport snapshot. The
   * inspector's close handler calls this so the camera does not snap
   * back after the user has dismissed the panel. Chip-click commits
   * go through `handleChipCommit`, which calls this internally.
   */
  resetSession: () => void;
}

/**
 * Encapsulates the chip-hover pan state machine: the pre-pan center
 * (so unhovered features can ease back), the viewport-bounds freeze
 * (so the chip composition does not reshuffle as the camera pans
 * toward an occluded chip), the dragstart subscription (so a
 * deliberate user pan abandons the captured state), and the recenter
 * action (so a panned-away selection can be brought back).
 *
 * Lifted out of `inspector.tsx` so the surface area is testable in
 * isolation and the inspector body stays focused on rendering. The
 * hook still relies on the highlight context for the chip-hover
 * highlight override, mirroring the original behavior.
 */
export function useChipHoverPan(args: UseChipHoverPanArgs): UseChipHoverPanResult {
  const { selected, mapRef, datasets, viewportBounds, state } = args;
  const setHoveredChipSelection = useSetHoveredChipSelection();

  // Pre-pan center captured the first time a chip-hover triggers a
  // pan in this hover session. Stays sticky across mouseleave so a
  // rapid mouseleave-then-mouseenter on a different chip does not
  // recapture mid-restore.
  const prePanCenterRef = useRef<{ lng: number; lat: number } | undefined>(undefined);
  // Viewport snapshot taken on the first occluded hover. Holds the
  // chip-composition viewport stable while the camera animates toward
  // the hovered chip's feature; without this, the moveend after each
  // pan would recompute the bbox-overlap chip list under the cursor
  // and shuffle chips out from under the hover, triggering a runaway
  // bounce.
  const [hoverViewportFreeze, setHoverViewportFreeze] = useState<BoundingBox | undefined>(
    undefined,
  );

  // Defensive cleanup: if `selected` changes from outside the inspector
  // (e.g. the user clicks a new feature on the map), the captured
  // session state belongs to the previous selection and must clear.
  // setState-during-render is the React-sanctioned pattern for
  // deriving cleared state from a prop change; the lint rule
  // `react-hooks/set-state-in-effect` disallows the equivalent inside
  // a useEffect.
  const [previousSelected, setPreviousSelected] = useState<typeof selected>(selected);
  if (previousSelected !== selected) {
    setPreviousSelected(selected);
    setHoverViewportFreeze(undefined);
  }
  // The pre-pan center ref needs the same selection-change cleanup,
  // but ref mutation during render is disallowed by the
  // `react-hooks/refs` lint rule. useEffect is the sanctioned place.
  useEffect(() => {
    prePanCenterRef.current = undefined;
  }, [selected]);

  // A user-initiated drag is a clear "I am committed to this view"
  // signal; clear both captures so the next hover starts fresh
  // instead of yanking the camera back to a stale position.
  useEffect((): (() => void) | undefined => {
    const map = getMapInstance(mapRef);
    if (map === undefined) {
      return undefined;
    }
    function handleDragStart(): void {
      prePanCenterRef.current = undefined;
      setHoverViewportFreeze(undefined);
    }
    map.on('dragstart', handleDragStart);
    return (): void => {
      map.off('dragstart', handleDragStart);
    };
  }, [mapRef]);

  const resetSession = useCallback((): void => {
    prePanCenterRef.current = undefined;
    setHoverViewportFreeze(undefined);
  }, []);

  const handleChipHover = useCallback(
    (selection: string | undefined): void => {
      setHoveredChipSelection(selection);
      const map = getMapInstance(mapRef);
      if (map === undefined) {
        return;
      }
      if (selection === undefined) {
        const captured = prePanCenterRef.current;
        if (captured !== undefined) {
          restoreCenter(captured, map);
          // Intentionally sticky: see `prePanCenterRef` and
          // `hoverViewportFreeze` declarations above.
        }
        return;
      }
      const target = chipCentroid(selection, datasets);
      if (target === undefined) {
        return;
      }
      if (!isPointOutsideComfortableArea(target, map)) {
        return;
      }
      // Functional update keeps any existing snapshot; only the first
      // hover-enter of a session writes it.
      setHoverViewportFreeze((prev) => prev ?? viewportBounds);
      if (prePanCenterRef.current === undefined) {
        const c = map.getCenter();
        prePanCenterRef.current = { lng: c.lng, lat: c.lat };
      }
      panToFeatureWithInspectorOffset(target, map);
    },
    [setHoveredChipSelection, mapRef, datasets, viewportBounds],
  );

  const handleRecenter = useCallback((): void => {
    if (state.status !== 'resolved') {
      return;
    }
    const target = entityCentroid(state.entity);
    if (target === undefined) {
      return;
    }
    const map = getMapInstance(mapRef);
    if (map === undefined) {
      return;
    }
    // Recenter is a commit-like action: discard any in-flight hover
    // session so a subsequent chip hover captures fresh state from the
    // new view rather than restoring back to wherever the user was
    // before the recenter.
    resetSession();
    panToFeatureWithInspectorOffset(target, map);
  }, [state, mapRef, resetSession]);

  const handleChipCommit = useCallback(
    (selection: string): void => {
      // Commit ends any preview phase: clear the hover-chip highlight
      // and the pre-pan capture so the unhover-restore does not yank
      // the user back to a position that no longer matches the new
      // selection. Touch devices never enter a hover preview phase, so
      // the clears are no-ops there but harmless.
      setHoveredChipSelection(undefined);
      resetSession();
      const map = getMapInstance(mapRef);
      if (map === undefined) {
        return;
      }
      const target = chipCentroid(selection, datasets);
      if (target === undefined) {
        return;
      }
      panToFeatureWithInspectorOffset(target, map);
    },
    [setHoveredChipSelection, resetSession, mapRef, datasets],
  );

  const chipViewportBounds = hoverViewportFreeze ?? viewportBounds;

  return { handleChipHover, handleChipCommit, handleRecenter, chipViewportBounds, resetSession };
}

/**
 * Map-coordinate centroid for a resolved entity, used by the chip-hover
 * pan logic and the recenter button. Falls back to `undefined` when an
 * entity has no usable position (a degenerate airway with zero
 * waypoints, an airspace whose features carry no coordinates).
 */
function entityCentroid(entity: ResolvedEntity): { lng: number; lat: number } | undefined {
  switch (entity.kind) {
    case 'airport':
    case 'navaid':
    case 'fix':
      return { lng: entity.record.lon, lat: entity.record.lat };
    case 'airway': {
      const bbox = bboxFromWaypoints(entity.record.waypoints);
      if (bbox === undefined) {
        return undefined;
      }
      return {
        lng: (bbox.minLon + bbox.maxLon) / 2,
        lat: (bbox.minLat + bbox.maxLat) / 2,
      };
    }
    case 'airspace': {
      const bbox = combinedBboxFromAirspaceFeatures(entity.features);
      if (bbox === undefined) {
        return undefined;
      }
      return {
        lng: (bbox.minLon + bbox.maxLon) / 2,
        lat: (bbox.minLat + bbox.maxLat) / 2,
      };
    }
  }
}

/**
 * Resolves a chip's URL selection string into a map-coordinate centroid
 * by routing through the dataset-backed entity resolver. Returns
 * `undefined` if the selection is unparseable, the dataset is still
 * loading, or the entity has no usable position.
 */
function chipCentroid(
  selection: string,
  datasets: ChartDatasetStates,
): { lng: number; lat: number } | undefined {
  const resolution = resolveSelectionFromState(selection, datasets);
  if (resolution.status !== 'resolved') {
    return undefined;
  }
  return entityCentroid(resolution.entity);
}

/**
 * Returns true when a map-coordinate point lies outside the
 * comfortable viewing area, gating the chip-hover pan. The
 * comfortable area is the canvas minus whichever edge the inspector
 * occludes (right on desktop, bottom on mobile), with a
 * {@link PAN_EDGE_MARGIN_PX} buffer around every other edge. Returns
 * true for:
 *
 * - Fully offscreen points (negative coords or beyond canvas size).
 * - Points within `PAN_EDGE_MARGIN_PX` of any non-occluded edge -
 *   they would render barely visible and easy to miss.
 * - Points within the inspector-occluded strip (right on desktop,
 *   bottom on mobile) plus the same margin.
 *
 * Features comfortably inside this area are skipped from panning so
 * the camera does not jolt for chip-hovers on already-visible
 * features.
 */
export function isPointOutsideComfortableArea(
  lngLat: { lng: number; lat: number },
  map: MaplibreMap,
): boolean {
  const point = map.project([lngLat.lng, lngLat.lat]);
  const canvas = map.getCanvas();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const occlusion = getInspectorOcclusionPx();
  const usableRightEdge = w - occlusion.x - PAN_EDGE_MARGIN_PX;
  const usableBottomEdge = h - occlusion.y - PAN_EDGE_MARGIN_PX;
  return (
    point.x < PAN_EDGE_MARGIN_PX ||
    point.x > usableRightEdge ||
    point.y < PAN_EDGE_MARGIN_PX ||
    point.y > usableBottomEdge
  );
}

/**
 * Eases the camera so a target lng/lat lands at the center of the
 * un-occluded portion of the map (geometric center minus half the
 * inspector overlay's footprint). On desktop the negative x-offset
 * shifts the focal point left so the target appears in the visible
 * left strip rather than directly under the right-side panel; on
 * mobile the negative y-offset shifts the focal point up so the
 * target appears in the visible top strip above the bottom sheet.
 */
export function panToFeatureWithInspectorOffset(
  lngLat: { lng: number; lat: number },
  map: MaplibreMap,
): void {
  const occlusion = getInspectorOcclusionPx();
  // Guard against negative zero on the un-occluded axis: dividing 0 by
  // 2 and negating yields `-0`, which trips strict object-equality
  // assertions and is technically distinct from `+0` even though
  // MapLibre treats them identically.
  const offsetX = occlusion.x === 0 ? 0 : -(occlusion.x / 2);
  const offsetY = occlusion.y === 0 ? 0 : -(occlusion.y / 2);
  map.easeTo({
    center: [lngLat.lng, lngLat.lat],
    offset: [offsetX, offsetY],
    duration: PAN_DURATION_MS,
  });
}

/**
 * Eases the camera back to a previously-captured center, undoing a
 * chip-hover pan. No `offset` here: the captured center represents the
 * user's pre-pan view exactly, with no inspector compensation needed
 * since the user established that view themselves.
 */
export function restoreCenter(lngLat: { lng: number; lat: number }, map: MaplibreMap): void {
  map.easeTo({
    center: [lngLat.lng, lngLat.lat],
    duration: PAN_DURATION_MS,
  });
}

/**
 * Resolves a `MapRef | undefined` into the underlying maplibre `Map`
 * instance, or `undefined` when no map ref is available (e.g. the
 * inspector renders before MapLibre has initialized, or in tests
 * where `useMap` returns an empty collection).
 */
export function getMapInstance(mapRef: MapRef | undefined): MaplibreMap | undefined {
  return mapRef?.getMap();
}
