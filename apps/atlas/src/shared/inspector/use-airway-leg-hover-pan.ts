import type { MapRef } from '@vis.gl/react-maplibre';
import { useEffect, useRef } from 'react';

import type { ResolvedEntityState } from './entity-resolver.ts';
import {
  getMapInstance,
  isPointOutsideComfortableArea,
  panToFeatureWithInspectorOffset,
  restoreCenter,
} from './use-chip-hover-pan.ts';

/**
 * Inputs for {@link useAirwayLegHoverPan}. The hook is hard-wired to
 * the chart-mode map and the inspector's resolved-entity state, so the
 * caller threads its own copies of those through.
 */
export interface UseAirwayLegHoverPanArgs {
  /**
   * Currently-selected entity URL string (read from the search params).
   * Drives the cleanup-on-selection-change effect so a stale captured
   * center cannot bleed into a new selection.
   */
  selected: string | undefined;
  /**
   * Index of the waypoint row the inspector panel is currently
   * hovering, or `undefined` when no row is hovered. Sourced from the
   * chart-mode highlight context so the airway-panel is the single
   * point of truth for the hover state.
   */
  hoveredWaypointIndex: number | undefined;
  /**
   * Resolved entity state for the current `selected`. The hook reads
   * the airway record's waypoints to compute the pan target.
   */
  state: ResolvedEntityState;
  /** Map ref returned by `useMap()` after `current ?? default` resolution. */
  mapRef: MapRef | undefined;
}

/**
 * Drives the camera while the user hovers per-row entries in the
 * airway inspector panel. On hover, captures the pre-pan center and
 * eases the camera so the relevant area lands in the un-occluded
 * portion of the map; on unhover, eases back to the captured center.
 * The captured center stays sticky across row-to-row transitions so
 * the camera flows between legs without snapping back in between,
 * only restoring once the cursor leaves the panel entirely.
 *
 * Pan target by row:
 * - Row 0 (the route's start waypoint): the waypoint's own coords. No
 *   incoming leg exists, so panning to the waypoint puts it center.
 * - Rows 1+: the midpoint of the leg ending at that waypoint, so
 *   both endpoints sit in view.
 *
 * Does nothing when the target is already comfortably onscreen - the
 * user's request was specifically "if the leg is out of view, pan to
 * it", and panning toward an already-visible feature would jolt the
 * camera for no reason.
 *
 * Mobile callers gate the hover wiring at the panel level via
 * `useCanHover()`, so on touch devices `hoveredWaypointIndex` never
 * transitions and this hook stays inert. The pan-on-hover affordance
 * is desktop-only by design: synthesized mouse events from a tap
 * would otherwise yank the camera around on every touch.
 */
export function useAirwayLegHoverPan(args: UseAirwayLegHoverPanArgs): void {
  const { selected, hoveredWaypointIndex, state, mapRef } = args;

  // Pre-pan center captured the first time a leg-hover triggers a pan
  // in this hover session. Persists across leg-to-leg transitions; the
  // unhover-restore animates back to it.
  const prePanCenterRef = useRef<{ lng: number; lat: number } | undefined>(undefined);

  // A user-initiated drag is a clear "I am committed to this view"
  // signal; clear the captured center so the next hover starts fresh
  // instead of yanking the camera back to a stale position.
  useEffect((): (() => void) | undefined => {
    const map = getMapInstance(mapRef);
    if (map === undefined) {
      return undefined;
    }
    function handleDragStart(): void {
      prePanCenterRef.current = undefined;
    }
    map.on('dragstart', handleDragStart);
    return (): void => {
      map.off('dragstart', handleDragStart);
    };
  }, [mapRef]);

  // Selection change cleanup: a new entity should not inherit the
  // pre-pan center captured for the previous one. useEffect is the
  // sanctioned place for ref mutation in response to a prop change.
  useEffect(() => {
    prePanCenterRef.current = undefined;
  }, [selected]);

  // Drive the camera in response to hovered-row changes. Reads the
  // current waypoints off the resolved entity so we always pan to
  // fresh coordinates even if the airway dataset reloaded mid-session.
  useEffect((): void => {
    const map = getMapInstance(mapRef);
    if (map === undefined) {
      return;
    }
    if (hoveredWaypointIndex === undefined) {
      const captured = prePanCenterRef.current;
      if (captured !== undefined) {
        restoreCenter(captured, map);
        // Intentionally sticky: captured stays so a rapid leave-then-
        // enter sequence does not recapture mid-restore.
      }
      return;
    }
    if (state.status !== 'resolved' || state.entity.kind !== 'airway') {
      return;
    }
    const waypoints = state.entity.record.waypoints;
    const current = waypoints[hoveredWaypointIndex];
    if (current === undefined) {
      return;
    }
    // Row 0 has no incoming leg - pan to the start waypoint itself
    // so the user can see "this is where the route begins". Rows 1+
    // pan to the leg midpoint so both endpoints stay in view.
    const target =
      hoveredWaypointIndex === 0
        ? { lng: current.lon, lat: current.lat }
        : (() => {
            const previous = waypoints[hoveredWaypointIndex - 1];
            if (previous === undefined) {
              return { lng: current.lon, lat: current.lat };
            }
            return {
              lng: (previous.lon + current.lon) / 2,
              lat: (previous.lat + current.lat) / 2,
            };
          })();
    if (!isPointOutsideComfortableArea(target, map)) {
      return;
    }
    if (prePanCenterRef.current === undefined) {
      const c = map.getCenter();
      prePanCenterRef.current = { lng: c.lng, lat: c.lat };
    }
    panToFeatureWithInspectorOffset(target, map);
  }, [hoveredWaypointIndex, state, mapRef]);
}
