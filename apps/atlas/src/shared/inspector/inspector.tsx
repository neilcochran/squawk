import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useMap } from '@vis.gl/react-maplibre';
import type { Polygon } from 'geojson';
import { polygonGeoJson } from '@squawk/geo';
import {
  formatAirspaceLabel,
  formatChipLabel,
  selectedFromFeature,
} from '../../modes/chart/click-to-select.ts';
import type { InspectableFeature } from '../../modes/chart/click-to-select.ts';
import {
  AIRSPACE_CEILING_FT_PROPERTY,
  AIRSPACE_FLOOR_FT_PROPERTY,
} from '../../modes/chart/layers/airspace-layer.tsx';
import { useHoveredAirwayWaypointIndex } from '../../modes/chart/highlight-context.ts';
import { AIRSPACE_CLASS_FOR_TYPE, CHART_ROUTE_PATH } from '../../modes/chart/url-state.ts';
import type { AirspaceClass } from '../../modes/chart/url-state.ts';
import { useCanHover } from '../styles/use-can-hover.ts';
import { compareAirspaceByAltitudeDesc, isAirspacePolygonFeature } from './airspace-feature.ts';
import type { AirspaceAltitudeKey } from './airspace-feature.ts';
import { ENTITY_TYPES, parseSelected } from './entity.ts';
import type { EntityType } from './entity.ts';
import { bboxFromWaypoints, combinedBboxFromAirspaceFeatures } from './geometry.ts';
import type { BoundingBox } from './geometry.ts';
import { resolveSelectionFromState, useDatasetStates } from './entity-resolver.ts';
import type { ChartDatasetStates, ResolvedEntity, ResolvedEntityState } from './entity-resolver.ts';
import { useAirwayLegHoverPan } from './use-airway-leg-hover-pan.ts';
import { useChipHoverPan } from './use-chip-hover-pan.ts';
import { AirportPanel } from './renderers/airport-panel.tsx';
import { AirspacePanel } from './renderers/airspace-panel.tsx';
import { AirwayPanel } from './renderers/airway-panel.tsx';
import { FixPanel } from './renderers/fix-panel.tsx';
import { NavaidPanel } from './renderers/navaid-panel.tsx';

const route = getRouteApi(CHART_ROUTE_PATH);

/**
 * Maximum number of chips rendered in the "Switch to another feature here"
 * strip. A click on a large ARTCC or MOA can pull dozens of underlying
 * Class E5 polygons; capping the list keeps the panel readable without
 * scrolling. Future work could add an "+N more" affordance.
 */
const MAX_OVERLAP_CHIPS = 30;

/**
 * Single entry rendered in the sibling-chip disclosure. Carries the
 * URL-encoded selection (used as the click handler payload), the
 * human label, and the entity type so the disclosure can group rows
 * by type (Airports, Navaids, Fixes, Airways, Airspace).
 */
interface Chip {
  /** URL-encoded selection string (e.g. `airport:BOS`). */
  selection: string;
  /** Display label, identical to the popover and possibly suffixed with `(N)` when several chips share a base label. */
  label: string;
  /** Entity type, used to drive the disclosure's per-type grouping. */
  type: EntityType;
  /**
   * Altitude key for airspace chips. Drives the altitude-descending
   * sort so a stack of vertically-layered airspaces (Class B + ARTCC,
   * MOA HIGH + MOA LOW) reads top-down. Undefined for non-airspace
   * chips, which keep their natural collection order.
   */
  altitudeKey?: AirspaceAltitudeKey;
}

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

  // Build the chip list. Two sources are merged, with same-pixel chips
  // first (those came from the click event so they are most relevant) and
  // bbox-overlap chips after (other airspaces whose bounding box overlaps
  // the selected one - the visual "things inside or partially inside this
  // polygon" that the user expects to see).
  //
  // Dedupes by encoded selection (two Class B rings collapse to one chip),
  // drops any chip whose selection equals the current one (it would be a
  // no-op), drops unencodeable features, and drops chips that would
  // resolve to `not-found` against the loaded datasets. Chips whose
  // dataset is still loading are kept; they will resolve once the fetch
  // completes. Capped at MAX_OVERLAP_CHIPS to keep the strip readable -
  // a large MOA can pull dozens of underlying Class E5 polygons, more
  // than the panel can show without scrolling.
  const chips = useMemo<readonly Chip[]>(() => {
    const seen = new Set<string>();
    const result: Chip[] = [];

    for (const feature of siblings) {
      const selection = selectedFromFeature(feature);
      if (selection === undefined) {
        continue;
      }
      if (selection === selected) {
        continue;
      }
      if (seen.has(selection)) {
        continue;
      }
      const ref = parseSelected(selection);
      if (ref === undefined) {
        continue;
      }
      const resolution = resolveSelectionFromState(selection, datasets);
      if (resolution.status === 'not-found' || resolution.status === 'idle') {
        continue;
      }
      seen.add(selection);
      const altitudeKey = readAirspaceAltitudeKeyFromSibling(feature);
      result.push({
        selection,
        label: formatChipLabel(feature),
        type: ref.type,
        ...(altitudeKey !== undefined && { altitudeKey }),
      });
    }

    // Overlap chips: walk the airspace dataset for features that
    // actually overlap the selected entity's footprint AND are visible
    // in the current viewport. For an airspace selection, "actually
    // overlap" is true polygon-polygon overlap (vertex-in-polygon both
    // directions); for an airway selection there is no polygon to
    // intersect, so bbox-overlap is the best we can cheaply do. Apply
    // the user's class toggles so hidden classes do not surface, and
    // skip chips that would resolve to `not-found`. Capped to keep the
    // strip readable.
    const footprint = footprintForSelection(state, layers);
    if (footprint !== undefined) {
      const selectedAirspaceKey =
        state.status === 'resolved' && state.entity.kind === 'airspace'
          ? `${state.entity.airspaceType}/${state.entity.identifier}`
          : undefined;
      for (const chip of buildOverlappingAirspaceChips(
        footprint,
        selectedAirspaceKey,
        datasets,
        seen,
        chipViewportBounds,
        airspaceClasses,
      )) {
        if (result.length >= MAX_OVERLAP_CHIPS) {
          break;
        }
        const resolution = resolveSelectionFromState(chip.selection, datasets);
        if (resolution.status === 'not-found' || resolution.status === 'idle') {
          continue;
        }
        seen.add(chip.selection);
        result.push({ ...chip, type: 'airspace' });
      }
    }

    // Sort airspace chips by altitude descending (highest ceiling first,
    // floor as tie-break) so a stack of vertically-layered airspaces -
    // whether from the click siblings (Class B + ARTCC at the same
    // pixel) or from the overlap walk (MOA HIGH + MOA LOW underneath
    // the selected feature) - reads top-down. Non-airspace chips keep
    // their collection order, and the airspace block sits where it
    // naturally landed in the result list. Sort happens before label
    // disambiguation so any `(N)` suffix follows the post-sort order.
    const nonAirspace: Chip[] = [];
    const airspace: { chip: Chip; key: AirspaceAltitudeKey }[] = [];
    for (const chip of result) {
      if (chip.altitudeKey === undefined) {
        nonAirspace.push(chip);
      } else {
        airspace.push({ chip, key: chip.altitudeKey });
      }
    }
    airspace.sort((a, b) => compareAirspaceByAltitudeDesc(a.key, b.key));
    return disambiguateLabels([...nonAirspace, ...airspace.map((it) => it.chip)]);
  }, [siblings, selected, datasets, state, layers, airspaceClasses, chipViewportBounds]);

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

/**
 * Plural-form labels for the chip-disclosure group headers. Mirrors the
 * canonical {@link ENTITY_TYPES} order so iterating the constant
 * produces a deterministic Airport > Navaid > Fix > Airway > Airspace
 * grouping, matching the layer-priority ordering used by the click
 * picker.
 */
const CHIP_GROUP_LABELS: Record<EntityType, string> = {
  airport: 'Airports',
  navaid: 'Navaids',
  fix: 'Fixes',
  airway: 'Airways',
  airspace: 'Airspace',
};

/**
 * Collapsible disclosure rendered below the inspector header when the
 * most recent click pulled in alternative features (same-pixel hits
 * plus bbox-overlap airspaces). Collapsed by default - the popover is
 * the primary disambiguation surface, and the chip disclosure is the
 * "other things in this area" follow-up. Click the header to expand;
 * inside, chips are grouped by feature type (Airports, Navaids, Fixes,
 * Airways, Airspace) so a click into a busy area is readable instead
 * of an unsorted wall of buttons.
 *
 * Each chip is a `<button>` so it is keyboard-focusable. On devices
 * with a real hover gesture (mouse / trackpad) chip hover and keyboard
 * focus call `onHover` so chart-mode can preview the highlight on the
 * map before the user commits with a click. On `(hover: none)` devices
 * (touch-only phones / tablets) the mouse-event preview is gated off
 * to avoid synthesized-event flicker on tap; focus events still drive
 * `onHover` so a connected keyboard or screen reader keeps the same
 * affordance.
 */
function SiblingChips({
  chips,
  onSelect,
  onHover,
}: {
  chips: readonly Chip[];
  onSelect: (selection: string) => void;
  /**
   * Called when a chip is hover-entered or focused (with the chip's
   * selection) and when it is hover-left or blurred (with `undefined`).
   * Used by chart-mode to temporarily highlight that chip's feature on
   * the map so the user can confirm which entity a chip refers to
   * before clicking.
   */
  onHover: (selection: string | undefined) => void;
}): ReactElement {
  const canHover = useCanHover();
  const [expanded, setExpanded] = useState(false);
  // Group chips by entity type, in canonical ENTITY_TYPES order, and
  // drop empty groups. The result is recomputed only when the chip
  // list changes (chip clicks rebuild it from a new selection).
  const groups = useMemo<readonly { type: EntityType; chips: readonly Chip[] }[]>(() => {
    const byType = new Map<EntityType, Chip[]>();
    for (const chip of chips) {
      const bucket = byType.get(chip.type);
      if (bucket === undefined) {
        byType.set(chip.type, [chip]);
      } else {
        bucket.push(chip);
      }
    }
    return ENTITY_TYPES.flatMap((type) => {
      const bucket = byType.get(type);
      return bucket === undefined || bucket.length === 0 ? [] : [{ type, chips: bucket }];
    });
  }, [chips]);

  const headerText =
    chips.length === 1 ? '1 other feature here' : `${chips.length} other features here`;

  return (
    <div className="border-y-2 border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40">
      <button
        type="button"
        onClick={(): void => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 px-4 py-3 text-left text-xs font-semibold tracking-wide text-indigo-700 uppercase hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 md:py-2 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
      >
        <SwitchIcon />
        <span className="flex-1">{headerText}</span>
        <ChevronIcon expanded={expanded} />
      </button>
      {expanded ? (
        <div className="flex flex-col gap-2 px-4 pt-1 pb-3">
          {groups.map((group) => (
            <div key={group.type}>
              <p className="mb-1 text-[10px] font-semibold tracking-wider text-indigo-600/80 uppercase dark:text-indigo-300/80">
                {CHIP_GROUP_LABELS[group.type]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.chips.map((chip) => (
                  <button
                    key={chip.selection}
                    type="button"
                    onClick={(): void => onSelect(chip.selection)}
                    {...(canHover && {
                      onMouseEnter: (): void => onHover(chip.selection),
                      onMouseLeave: (): void => onHover(undefined),
                    })}
                    onFocus={(): void => onHover(chip.selection)}
                    onBlur={(): void => onHover(undefined)}
                    className="rounded-full border border-indigo-300 bg-white px-3 py-2 text-xs font-medium text-indigo-700 shadow-sm hover:border-indigo-400 hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 md:px-2.5 md:py-1 dark:border-indigo-700 dark:bg-slate-900 dark:text-indigo-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/50"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Footprint of a selected entity, used to test which other airspaces
 * "overlap" it. Discriminated by `kind`:
 *
 * - `airspace-polygons`: array of polygons. The chip walk does true
 *   polygon-polygon overlap against each. Used for airspace selections.
 * - `airway-bbox`: a bounding box from the waypoint chain. Polylines
 *   have no interior to intersect, so the cheap bbox proxy is the best
 *   we can do without distance-to-line math.
 */
type SelectionFootprint =
  | { kind: 'airspace-polygons'; polygons: readonly Polygon[]; bbox: BoundingBox }
  | { kind: 'airway-bbox'; bbox: BoundingBox };

/**
 * Returns the selected entity's footprint, or undefined when the
 * selection has no footprint to compare against (point features) or
 * its owning layer is hidden.
 */
function footprintForSelection(
  state: ResolvedEntityState,
  layers: readonly string[],
): SelectionFootprint | undefined {
  if (state.status !== 'resolved') {
    return undefined;
  }
  if (state.entity.kind === 'airspace') {
    if (!layers.includes('airspace')) {
      return undefined;
    }
    const polygons = state.entity.features.map((f) => f.boundary);
    const bbox = combinedBboxFromAirspaceFeatures(state.entity.features);
    if (bbox === undefined) {
      return undefined;
    }
    return { kind: 'airspace-polygons', polygons, bbox };
  }
  if (state.entity.kind === 'airway') {
    if (!layers.includes('airways')) {
      return undefined;
    }
    const bbox = bboxFromWaypoints(state.entity.record.waypoints);
    if (bbox === undefined) {
      return undefined;
    }
    return { kind: 'airway-bbox', bbox };
  }
  return undefined;
}

/**
 * Generator for "Switch to another feature here" chips that come from
 * airspace polygons that actually overlap the selected entity's
 * footprint AND fall within the current map viewport. Yielded in
 * dataset order; the caller dedupes against `seen` and applies the cap.
 *
 * Overlap test depends on the footprint kind:
 * - `airspace-polygons`: true polygon-polygon overlap (vertex-in-polygon
 *   both directions). Catches all realistic cases for our airspace
 *   dataset and filters out bbox false positives like a Class E2 surface
 *   area that happens to share a bounding rectangle with an L-shaped
 *   MOA but not its interior.
 * - `airway-bbox`: bbox-overlap only. Polylines have no interior to
 *   intersect; bbox is the cheap proxy.
 *
 * Filters applied (in order, cheap-first):
 * 1. Feature's user-facing class is in the active `airspaceClasses` list.
 * 2. `(type, identifier)` differs from `excludeAirspaceKey`.
 * 3. `seen` does not already contain the encoded selection.
 * 4. Feature's bbox overlaps the footprint's bbox (cheap pre-filter).
 * 5. Feature's bbox overlaps `viewportBounds` (when known).
 * 6. Feature actually overlaps the footprint (expensive polygon test).
 *
 * Skips features whose properties cannot be encoded (e.g. missing
 * `type` or `identifier`) - those have no stable URL handle.
 */
function* buildOverlappingAirspaceChips(
  footprint: SelectionFootprint,
  excludeAirspaceKey: string | undefined,
  datasets: ChartDatasetStates,
  seen: ReadonlySet<string>,
  viewportBounds: BoundingBox | undefined,
  activeClasses: readonly AirspaceClass[],
): Generator<{ selection: string; label: string; altitudeKey: AirspaceAltitudeKey }, void, void> {
  if (datasets.airspace.status !== 'loaded') {
    return;
  }
  const activeClassSet = new Set<string>(activeClasses);
  for (const feature of datasets.airspace.dataset.features) {
    if (!isAirspacePolygonFeature(feature)) {
      continue;
    }
    const props = feature.properties;
    if (!activeClassSet.has(AIRSPACE_CLASS_FOR_TYPE[props.type])) {
      continue;
    }
    // Build the encoded selection. Empty-identifier features use a
    // centroid-based disambiguator so they still get a stable URL
    // handle (and thus a clickable chip) - same convention the click
    // path uses.
    const selection = encodeAirspaceChipSelection(props.type, props.identifier, feature.geometry);
    if (selection === undefined) {
      continue;
    }
    if (selection === `airspace:${excludeAirspaceKey ?? ''}`) {
      continue;
    }
    if (seen.has(selection)) {
      continue;
    }
    const featureBbox = polygonGeoJson.polygonBoundingBox(feature.geometry);
    // Cheap bbox pre-filter against the selected footprint, then a
    // per-feature centroid for both the viewport check and (for
    // airspace selections) the substantial-overlap check below.
    if (!polygonGeoJson.boundingBoxesOverlap(footprint.bbox, featureBbox)) {
      continue;
    }
    const featureCentroid = polygonGeoJson.polygonCentroid(feature.geometry);
    if (featureCentroid === undefined) {
      continue;
    }
    // Viewport filter: only show chips whose centroid is on screen.
    // Bbox-overlap was too lenient - a feature whose bbox just clips
    // the viewport edge but whose body is offscreen would slip through
    // and the highlight preview on hover would render somewhere the
    // user cannot see.
    if (
      viewportBounds !== undefined &&
      !polygonGeoJson.pointInBoundingBox(featureCentroid, viewportBounds)
    ) {
      continue;
    }
    if (footprint.kind === 'airspace-polygons') {
      let overlaps = false;
      for (const polygon of footprint.polygons) {
        if (
          polygonGeoJson.polygonsSubstantiallyOverlap(feature.geometry, polygon, featureCentroid)
        ) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        continue;
      }
    }
    yield {
      selection,
      label: formatAirspaceLabel(props.type, props.identifier, props.name),
      altitudeKey: { ceilingFt: props.ceiling.valueFt, floorFt: props.floor.valueFt },
    };
  }
}

/**
 * Reads an {@link AirspaceAltitudeKey} off a click-derived sibling
 * feature's synthetic floor/ceiling primitive properties (added by
 * `projectAirspaceSource` in the airspace layer). Returns `undefined`
 * for any feature whose properties bag does not carry the primitive
 * pair - non-airspace features and any defensive-fallback case land
 * here, and the chip falls through to the non-airspace bucket so it
 * keeps its natural collection order.
 */
function readAirspaceAltitudeKeyFromSibling(
  feature: InspectableFeature,
): AirspaceAltitudeKey | undefined {
  const props = feature.properties;
  if (props === null) {
    return undefined;
  }
  const ceilingFt = props[AIRSPACE_CEILING_FT_PROPERTY];
  const floorFt = props[AIRSPACE_FLOOR_FT_PROPERTY];
  if (typeof ceilingFt !== 'number' || typeof floorFt !== 'number') {
    return undefined;
  }
  return { ceilingFt, floorFt };
}

/**
 * Builds the encoded URL `selected` value for an airspace chip. Mirrors
 * the click-handler encoding in `click-to-select.ts`: real identifier
 * when set, polygon-centroid disambiguator otherwise. Returns undefined
 * when the feature has neither a usable identifier nor a polygon
 * centroid (no stable URL handle possible).
 */
function encodeAirspaceChipSelection(
  type: string,
  identifier: string,
  geometry: Polygon,
): string | undefined {
  if (identifier !== '') {
    return `airspace:${type}/${identifier}`;
  }
  const centroid = polygonGeoJson.polygonCentroid(geometry);
  if (centroid === undefined) {
    return undefined;
  }
  return `airspace:${type}/c:${centroid[0].toFixed(5)},${centroid[1].toFixed(5)}`;
}

/**
 * Walks a chip list and rewrites duplicate labels so each chip is
 * visually distinct. Two chips can share a label when distinct
 * empty-identifier features happen to share a `name` (e.g. two
 * different "BILLINGS CLASS E5" surfaces at different floor altitudes).
 * The first occurrence keeps its original label; the Nth duplicate
 * gains a `(N)` suffix. Selection strings are unchanged - they remain
 * the per-feature centroid encoding.
 */
function disambiguateLabels<T extends { selection: string; label: string }>(
  chips: readonly T[],
): readonly T[] {
  const counts = new Map<string, number>();
  for (const chip of chips) {
    counts.set(chip.label, (counts.get(chip.label) ?? 0) + 1);
  }
  const seenIndex = new Map<string, number>();
  return chips.map((chip) => {
    if ((counts.get(chip.label) ?? 0) <= 1) {
      return chip;
    }
    const idx = (seenIndex.get(chip.label) ?? 0) + 1;
    seenIndex.set(chip.label, idx);
    return { ...chip, label: `${chip.label} (${idx})` };
  });
}

/**
 * Caret-style chevron used in the sibling-chip disclosure header.
 * Rotates 180 degrees via a CSS transform when `expanded` is true so
 * the same SVG path serves both states; the surrounding button owns
 * the `aria-expanded` attribute that announces the change.
 */
function ChevronIcon({ expanded }: { expanded: boolean }): ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={expanded ? 'rotate-180' : ''}
      aria-hidden="true"
    >
      <path d="M3 5L7 9L11 5" />
    </svg>
  );
}

/** Small icon hint next to the sibling-chip heading: stacked layers. */
function SwitchIcon(): ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 1.5L12.5 4.25L7 7L1.5 4.25L7 1.5ZM1.5 7L7 9.75L12.5 7M1.5 9.75L7 12.5L12.5 9.75" />
    </svg>
  );
}

/**
 * Sticky header at the top of the panel showing a one-line summary
 * (entity type + identifier or status), an optional recenter button
 * that brings the selected entity back into view, and a close button.
 * The recenter button is only rendered when an `onRecenter` handler is
 * supplied, which the inspector ties to the resolved-entity state -
 * loading and not-found states have nothing to recenter on.
 */
function InspectorHeader({
  state,
  onClose,
  onRecenter,
}: {
  state: ResolvedEntityState;
  onClose: () => void;
  onRecenter?: () => void;
}): ReactElement {
  return (
    <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <HeaderText state={state} />
      <div className="flex shrink-0 items-center gap-1">
        {onRecenter === undefined ? null : (
          <button
            type="button"
            onClick={onRecenter}
            aria-label="Recenter on this feature"
            title="Recenter on this feature"
            className="flex h-11 w-11 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 md:h-7 md:w-7 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus-visible:ring-slate-500"
          >
            <RecenterIcon />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="flex h-11 w-11 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 md:h-7 md:w-7"
        >
          <CloseIcon />
        </button>
      </div>
    </header>
  );
}

/**
 * Renders the left-side text inside the inspector header. Branches on the
 * resolution state so the loading / not-found cases get their own labelling
 * without dropping the user out of the panel entirely.
 */
function HeaderText({ state }: { state: ResolvedEntityState }): ReactElement | null {
  if (state.status === 'idle') {
    return null;
  }
  if (state.status === 'loading') {
    return (
      <div>
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {state.ref.type}
        </p>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {state.ref.id}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Loading dataset...</p>
      </div>
    );
  }
  if (state.status === 'not-found') {
    return (
      <div>
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {state.ref.type}
        </p>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {state.ref.id}
        </h2>
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">No matching record</p>
      </div>
    );
  }
  return <ResolvedHeaderText entity={state.entity} />;
}

/**
 * Header text for a successfully resolved entity. Each kind picks the most
 * informative one-or-two-line label its dataset can produce.
 */
function ResolvedHeaderText({ entity }: { entity: ResolvedEntity }): ReactElement {
  switch (entity.kind) {
    case 'airport':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Airport
          </p>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {entity.record.faaId}
            {entity.record.icao !== undefined ? (
              <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                {entity.record.icao}
              </span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{entity.record.name}</p>
        </div>
      );
    case 'navaid':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {entity.record.type}
          </p>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {entity.record.identifier}
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{entity.record.name}</p>
        </div>
      );
    case 'fix':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Fix
          </p>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {entity.record.identifier}
          </h2>
        </div>
      );
    case 'airway':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {entity.record.type} airway
          </p>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {entity.record.designation}
          </h2>
        </div>
      );
    case 'airspace':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {entity.airspaceType.replace(/_/g, ' ')}
          </p>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {entity.identifier}
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {entity.features.length} feature{entity.features.length === 1 ? '' : 's'}
          </p>
        </div>
      );
  }
}

/**
 * Body of the inspector panel below the header. For loading / not-found
 * states the body is empty (the header carries the status); for resolved
 * entities, dispatches to a per-type renderer.
 */
function InspectorBody({ state }: { state: ResolvedEntityState }): ReactElement | null {
  if (state.status !== 'resolved') {
    return null;
  }
  const entity = state.entity;
  switch (entity.kind) {
    case 'airport':
      return <AirportPanel record={entity.record} />;
    case 'navaid':
      return <NavaidPanel record={entity.record} />;
    case 'fix':
      return <FixPanel record={entity.record} />;
    case 'airway':
      return <AirwayPanel record={entity.record} />;
    case 'airspace':
      return <AirspacePanel features={entity.features} />;
  }
}

/** Inline X glyph for the inspector close button. */
function CloseIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" />
    </svg>
  );
}

/** Crosshair / target icon used by the recenter button. */
function RecenterIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="3" />
      <path d="M7 1V3M7 11V13M1 7H3M11 7H13" />
    </svg>
  );
}
