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
  return ctx?.setHoveredChipSelection ?? noopSetter;
}

/** Stable no-op setter used when the inspector renders without a provider. */
function noopSetter(): void {
  // intentionally empty
}
