import { createContext, useContext } from 'react';

import type { EntityRef } from '../../shared/inspector/entity.ts';

/**
 * Shape of the chart-mode highlight context. Carries (a) the parsed entity
 * reference currently being highlighted on the map (which may be the URL
 * `selected` or a chip the user is hovering), and (b) a setter the
 * inspector calls on chip mouseEnter/mouseLeave to temporarily override
 * the highlight.
 *
 * Decoupled via context so the layer components do not need to take a
 * `highlight` prop and the inspector does not need an `onChipHover`
 * callback drilled through.
 */
export interface HighlightContextValue {
  /** Entity reference currently highlighted, or undefined when nothing is. */
  activeRef: EntityRef | undefined;
  /**
   * Sets the currently-hovered chip selection. The provider uses this to
   * override the URL selection while the user hovers a sibling chip in
   * the inspector. Pass `undefined` to clear (i.e. on mouseLeave).
   */
  setHoveredChipSelection: (selection: string | undefined) => void;
  /**
   * Index of the currently-hovered airspace feature within the active
   * entity's `features` array, or `undefined` when no per-feature
   * section is hovered. Used by the airspace layer's feature-focus
   * filter to brighten a single polygon when the user hovers a section
   * in the inspector. Only meaningful for airspace selections; ignored
   * for other entity types.
   */
  hoveredFeatureIndex: number | undefined;
  /**
   * Sets the currently-hovered airspace feature index. Inspector
   * sections call this on mouseEnter / mouseLeave (with `undefined`
   * to clear).
   */
  setHoveredFeatureIndex: (index: number | undefined) => void;
  /**
   * Index of the currently-hovered airway waypoint row within the
   * active entity's `waypoints` array, or `undefined` when no row is
   * hovered. The airway focus layer reads this to brighten the
   * waypoint dot at `waypoints[i]` AND, when `i > 0`, the incoming
   * leg from `waypoints[i - 1]` to `waypoints[i]`. Index `0` is the
   * route's starting waypoint (no incoming leg, just the dot).
   *
   * Only meaningful for airway selections; ignored for other entity
   * types.
   */
  hoveredAirwayWaypointIndex: number | undefined;
  /**
   * Sets the currently-hovered airway waypoint index. The airway
   * inspector panel calls this on per-row mouseEnter / mouseLeave
   * (with `undefined` to clear). Wired only on hover-capable devices
   * via the inspector's existing `useCanHover()` gate so touch
   * devices never fire it.
   */
  setHoveredAirwayWaypointIndex: (index: number | undefined) => void;
}

/**
 * The actual React context. Consumed by {@link useActiveHighlightRef} and
 * {@link useSetHoveredChipSelection}; provided by `HighlightProvider` in
 * `highlight-provider.tsx`. Default value is `null` so consumers can
 * detect a missing provider and fall back to safe defaults instead of
 * throwing.
 */
export const HighlightContext = createContext<HighlightContextValue | null>(null);

/**
 * Returns the parsed entity reference currently highlighted on the map,
 * or `undefined` if nothing is highlighted (or no provider is mounted).
 * Layer highlight filters call this to decide whether to render their
 * highlight overlay and which id to filter on.
 */
export function useActiveHighlightRef(): EntityRef | undefined {
  return useContext(HighlightContext)?.activeRef;
}

/**
 * Returns the setter the inspector calls on chip mouseEnter/mouseLeave to
 * temporarily override the URL selection's highlight with the hovered
 * chip's selection. No-op when no provider is mounted, so the inspector
 * stays render-safe in test environments and outside chart mode.
 */
export function useSetHoveredChipSelection(): (selection: string | undefined) => void {
  const ctx = useContext(HighlightContext);
  return ctx?.setHoveredChipSelection ?? noopChipSelectionSetter;
}

/**
 * Returns the index of the currently-hovered airspace feature within
 * the active entity's `features` array, or `undefined`. Consumed by
 * the airspace layer's feature-focus filter so the hovered polygon
 * lights up brighter than its siblings.
 */
export function useHoveredFeatureIndex(): number | undefined {
  return useContext(HighlightContext)?.hoveredFeatureIndex;
}

/**
 * Returns the setter the airspace inspector panel calls on per-feature
 * section mouseEnter / mouseLeave. No-op when no provider is mounted.
 */
export function useSetHoveredFeatureIndex(): (index: number | undefined) => void {
  const ctx = useContext(HighlightContext);
  return ctx?.setHoveredFeatureIndex ?? noopFeatureIndexSetter;
}

/**
 * Returns the index of the currently-hovered airway waypoint row
 * within the active airway's `waypoints` array, or `undefined`.
 * Consumed by the airway focus layer (which brightens the waypoint
 * dot AND its incoming leg when index > 0) and by the row-hover-pan
 * hook (which eases the camera if that area is offscreen).
 */
export function useHoveredAirwayWaypointIndex(): number | undefined {
  return useContext(HighlightContext)?.hoveredAirwayWaypointIndex;
}

/**
 * Returns the setter the airway inspector panel calls on per-row
 * mouseEnter / mouseLeave. No-op when no provider is mounted.
 */
export function useSetHoveredAirwayWaypointIndex(): (index: number | undefined) => void {
  const ctx = useContext(HighlightContext);
  return ctx?.setHoveredAirwayWaypointIndex ?? noopWaypointIndexSetter;
}

/** Stable no-op setter used when the inspector renders without a provider. */
function noopChipSelectionSetter(): void {
  // intentionally empty
}

/** Stable no-op feature-index setter used when no provider is mounted. */
function noopFeatureIndexSetter(): void {
  // intentionally empty
}

/** Stable no-op waypoint-index setter used when no provider is mounted. */
function noopWaypointIndexSetter(): void {
  // intentionally empty
}
