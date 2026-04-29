import { useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { parseSelected } from '../../shared/inspector/entity.ts';
import { HighlightContext } from './highlight-context.ts';
import type { HighlightContextValue } from './highlight-context.ts';

/**
 * Props for {@link HighlightProvider}.
 */
export interface HighlightProviderProps {
  /**
   * The selection to highlight on the map. Typically `hoveredChip ?? URL
   * selected` so a hover transient override falls back to the persistent
   * selection. Pass `undefined` for "no highlight".
   */
  activeHighlight: string | undefined;
  /**
   * Callback the inspector uses to register hover state on a sibling chip.
   * Owner state should compute `activeHighlight` from this value before
   * passing it back in.
   */
  setHoveredChipSelection: (selection: string | undefined) => void;
  /**
   * Index of the currently-hovered airspace feature within the active
   * entity's `features` array, or `undefined` when no inspector section
   * is hovered. Drives the airspace layer's feature-focus filter.
   */
  hoveredFeatureIndex: number | undefined;
  /**
   * Callback the airspace inspector panel calls on per-feature section
   * mouseEnter / mouseLeave.
   */
  setHoveredFeatureIndex: (index: number | undefined) => void;
  /**
   * Index of the currently-hovered airway waypoint row within the
   * active airway's `waypoints` array, or `undefined` when no
   * inspector row is hovered. Drives the airway focus layer (waypoint
   * dot + incoming leg) and the row-hover-pan hook.
   */
  hoveredAirwayWaypointIndex: number | undefined;
  /**
   * Callback the airway inspector panel calls on per-row
   * mouseEnter / mouseLeave (hover-capable devices only).
   */
  setHoveredAirwayWaypointIndex: (index: number | undefined) => void;
  /** Children that may consume the context via the exported hooks. */
  children: ReactNode;
}

/**
 * Wraps the chart-mode subtree with the highlight context. The provider
 * parses the raw `activeHighlight` string to a typed `EntityRef` once per
 * change so consumers (layer highlight filters) can branch on `ref.type`
 * without re-parsing. Hooks live in `highlight-context.ts`; the provider
 * is split into its own `.tsx` file so React Fast Refresh sees a single
 * component export per file (the `react-refresh/only-export-components`
 * lint rule).
 */
export function HighlightProvider({
  activeHighlight,
  setHoveredChipSelection,
  hoveredFeatureIndex,
  setHoveredFeatureIndex,
  hoveredAirwayWaypointIndex,
  setHoveredAirwayWaypointIndex,
  children,
}: HighlightProviderProps): ReactElement {
  const value = useMemo<HighlightContextValue>(
    () => ({
      activeRef: parseSelected(activeHighlight),
      setHoveredChipSelection,
      hoveredFeatureIndex,
      setHoveredFeatureIndex,
      hoveredAirwayWaypointIndex,
      setHoveredAirwayWaypointIndex,
    }),
    [
      activeHighlight,
      setHoveredChipSelection,
      hoveredFeatureIndex,
      setHoveredFeatureIndex,
      hoveredAirwayWaypointIndex,
      setHoveredAirwayWaypointIndex,
    ],
  );
  return <HighlightContext.Provider value={value}>{children}</HighlightContext.Provider>;
}
