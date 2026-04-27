import { useCallback, useMemo } from 'react';
import type { ReactElement } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useMap } from '@vis.gl/react-maplibre';
import type { Polygon } from 'geojson';
import { polygonGeoJson } from '@squawk/geo';
import type { AirspaceFeature } from '@squawk/types';
import {
  formatAirspaceLabel,
  formatChipLabel,
  selectedFromFeature,
} from '../../modes/chart/click-to-select.ts';
import type { InspectableFeature } from '../../modes/chart/click-to-select.ts';
import { useSetHoveredChipSelection } from '../../modes/chart/highlight-context.ts';
import { AIRSPACE_CLASS_FOR_TYPE, CHART_ROUTE_PATH } from '../../modes/chart/url-state.ts';
import type { AirspaceClass } from '../../modes/chart/url-state.ts';
import { isAirspacePolygonFeature } from './airspace-feature.ts';
import { bboxFromCoords } from './geometry.ts';
import type { BoundingBox } from './geometry.ts';
import { resolveSelectionFromState, useDatasetStates } from './entity-resolver.ts';
import type { ChartDatasetStates, ResolvedEntity, ResolvedEntityState } from './entity-resolver.ts';
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
 * The panel is positioned `absolute` along the right edge of the chart
 * area (`top-0 right-0 bottom-0 w-[360px]`). It overlaps the layer-toggle
 * dropdown when both are open; the close affordance is the X in the
 * panel header.
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
  const setHoveredChipSelection = useSetHoveredChipSelection();

  const handleClose = useCallback((): void => {
    void navigate({
      search: (prev) => ({ ...prev, selected: undefined }),
      replace: true,
    });
  }, [navigate]);

  const handleSwitchSelected = useCallback(
    (next: string): void => {
      void navigate({
        search: (prev) => ({ ...prev, selected: next }),
        replace: true,
      });
    },
    [navigate],
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
  const chips = useMemo<readonly { selection: string; label: string }[]>(() => {
    const seen = new Set<string>();
    const result: { selection: string; label: string }[] = [];

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
      const resolution = resolveSelectionFromState(selection, datasets);
      if (resolution.status === 'not-found' || resolution.status === 'idle') {
        continue;
      }
      seen.add(selection);
      result.push({ selection, label: formatChipLabel(feature) });
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
        viewportBounds,
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
        result.push(chip);
      }
    }

    return disambiguateLabels(result);
  }, [siblings, selected, datasets, state, layers, airspaceClasses, viewportBounds]);

  if (state.status === 'idle') {
    return null;
  }

  return (
    <aside
      className="absolute top-0 right-0 bottom-0 z-20 w-[360px] overflow-y-auto border-l border-slate-200 bg-white shadow-lg"
      aria-label="Entity inspector"
    >
      <InspectorHeader state={state} onClose={handleClose} />
      {chips.length === 0 ? null : (
        <SiblingChips
          chips={chips}
          onSelect={handleSwitchSelected}
          onHover={setHoveredChipSelection}
        />
      )}
      <InspectorBody state={state} />
    </aside>
  );
}

/**
 * Horizontal chip strip rendered below the inspector header when the most
 * recent click hit more than one feature. Visually distinct from the
 * details body (indigo accent + thicker top rule) so it reads as
 * "alternative selections you can switch to" rather than as further
 * details of the current entity. Each chip is a `<button>` so it is
 * keyboard-focusable and announces correctly to screen readers; the
 * strip wraps so a busy click (ARTCC + Class B + Class E + ...) does
 * not overflow the panel.
 */
function SiblingChips({
  chips,
  onSelect,
  onHover,
}: {
  chips: readonly { selection: string; label: string }[];
  onSelect: (selection: string) => void;
  /**
   * Called on chip hover-enter (with the chip's selection) and on
   * hover-leave / blur (with `undefined`). Used by chart-mode to
   * temporarily highlight that chip's feature on the map so the user
   * can confirm which entity a chip refers to before clicking.
   */
  onHover: (selection: string | undefined) => void;
}): ReactElement {
  return (
    <div className="border-y-2 border-indigo-200 bg-indigo-50 px-4 py-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-indigo-700 uppercase">
        <SwitchIcon />
        Switch to another feature here
      </p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.selection}
            type="button"
            onClick={() => onSelect(chip.selection)}
            onMouseEnter={() => onHover(chip.selection)}
            onMouseLeave={() => onHover(undefined)}
            onFocus={() => onHover(chip.selection)}
            onBlur={() => onHover(undefined)}
            className="rounded-full border border-indigo-300 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 shadow-sm hover:border-indigo-400 hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {chip.label}
          </button>
        ))}
      </div>
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

/** Bounding box from an airway's ordered list of waypoints. */
function bboxFromWaypoints(
  waypoints: readonly { lat: number; lon: number }[],
): BoundingBox | undefined {
  return bboxFromCoords(coordsOfWaypoints(waypoints));
}

/** Yields each waypoint as a `[lon, lat]` pair for the bbox reducer. */
function* coordsOfWaypoints(
  waypoints: readonly { lat: number; lon: number }[],
): Generator<readonly [number, number]> {
  for (const wp of waypoints) {
    yield [wp.lon, wp.lat];
  }
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
): Generator<{ selection: string; label: string }, void, void> {
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
    yield { selection, label: formatAirspaceLabel(props.type, props.identifier, props.name) };
  }
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
function disambiguateLabels(
  chips: readonly { selection: string; label: string }[],
): readonly { selection: string; label: string }[] {
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
    return { selection: chip.selection, label: `${chip.label} (${idx})` };
  });
}

/**
 * Combined bounding box across every feature in an airspace grouping. A
 * Class B has multiple ring features; an ARTCC has multiple strata. The
 * combined bbox is the smallest rectangle that contains all of them.
 * Returns undefined if no feature has any coordinates.
 */
function combinedBboxFromAirspaceFeatures(
  features: readonly AirspaceFeature[],
): BoundingBox | undefined {
  return bboxFromCoords(coordsOfAirspaceFeatures(features));
}

/** Yields every defined `[lon, lat]` pair across a list of airspace feature boundaries. */
function* coordsOfAirspaceFeatures(
  features: readonly AirspaceFeature[],
): Generator<readonly [number, number]> {
  for (const feature of features) {
    yield* coordsOfPolygon(feature.boundary);
  }
}

/**
 * Yields every defined `[lon, lat]` pair across all rings of a polygon.
 * GeoJSON's `Position` is typed as `number[]`, so the inner coords can be
 * shorter than two elements at the type level; entries with an undefined
 * lon or lat are skipped.
 */
function* coordsOfPolygon(polygon: Polygon): Generator<readonly [number, number]> {
  for (const ring of polygon.coordinates) {
    for (const coord of ring) {
      const lon = coord[0];
      const lat = coord[1];
      if (lon === undefined || lat === undefined) {
        continue;
      }
      yield [lon, lat];
    }
  }
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
 * Sticky header at the top of the panel showing a one-line summary (entity
 * type + identifier or status) and a close button.
 */
function InspectorHeader({
  state,
  onClose,
}: {
  state: ResolvedEntityState;
  onClose: () => void;
}): ReactElement {
  return (
    <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <HeaderText state={state} />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close inspector"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <CloseIcon />
      </button>
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
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {state.ref.type}
        </p>
        <h2 className="text-base font-semibold text-slate-900">{state.ref.id}</h2>
        <p className="mt-1 text-xs text-slate-500">Loading dataset...</p>
      </div>
    );
  }
  if (state.status === 'not-found') {
    return (
      <div>
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {state.ref.type}
        </p>
        <h2 className="text-base font-semibold text-slate-900">{state.ref.id}</h2>
        <p className="mt-1 text-xs text-rose-600">No matching record</p>
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
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Airport</p>
          <h2 className="text-base font-semibold text-slate-900">
            {entity.record.faaId}
            {entity.record.icao !== undefined ? (
              <span className="ml-2 text-sm font-normal text-slate-500">{entity.record.icao}</span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">{entity.record.name}</p>
        </div>
      );
    case 'navaid':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {entity.record.type}
          </p>
          <h2 className="text-base font-semibold text-slate-900">{entity.record.identifier}</h2>
          <p className="mt-0.5 text-xs text-slate-600">{entity.record.name}</p>
        </div>
      );
    case 'fix':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Fix</p>
          <h2 className="text-base font-semibold text-slate-900">{entity.record.identifier}</h2>
        </div>
      );
    case 'airway':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {entity.record.type} airway
          </p>
          <h2 className="text-base font-semibold text-slate-900">{entity.record.designation}</h2>
        </div>
      );
    case 'airspace':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {entity.airspaceType.replace(/_/g, ' ')}
          </p>
          <h2 className="text-base font-semibold text-slate-900">{entity.identifier}</h2>
          <p className="mt-0.5 text-xs text-slate-600">
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
