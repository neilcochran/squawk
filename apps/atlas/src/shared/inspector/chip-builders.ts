import type { Polygon } from 'geojson';

import { polygonGeoJson } from '@squawk/geo';

import {
  formatAirspaceLabel,
  formatChipLabel,
  selectedFromFeature,
} from '../../modes/chart/click-to-select.ts';
import type { InspectableFeature } from '../../modes/chart/click-to-select.ts';
import { AIRSPACE_CLASS_FOR_TYPE } from '../../modes/chart/url-state.ts';
import type { AirspaceClass } from '../../modes/chart/url-state.ts';

import {
  compareAirspaceByAltitudeDesc,
  isAirspacePolygonFeature,
  readAirspaceAltitudeKey,
} from './airspace-feature.ts';
import type { AirspaceAltitudeKey } from './airspace-feature.ts';
import { resolveSelectionFromState } from './entity-resolver.ts';
import type { ChartDatasetStates, ResolvedEntityState } from './entity-resolver.ts';
import { parseSelected } from './entity.ts';
import type { EntityType } from './entity.ts';
import { bboxFromWaypoints, combinedBboxFromAirspaceFeatures } from './geometry.ts';
import type { BoundingBox } from './geometry.ts';

/**
 * Maximum number of chips rendered in the "Switch to another feature here"
 * strip. A click on a large ARTCC or MOA can pull dozens of underlying
 * Class E5 polygons; capping the list keeps the panel readable without
 * scrolling. Future work could add an "+N more" affordance.
 */
export const MAX_OVERLAP_CHIPS = 30;

/**
 * Plural-form labels for the chip-disclosure group headers. Mirrors the
 * canonical {@link ENTITY_TYPES} order so iterating the constant
 * produces a deterministic Airport > Navaid > Fix > Airway > Airspace
 * grouping, matching the layer-priority ordering used by the click
 * picker.
 */
export const CHIP_GROUP_LABELS: Record<EntityType, string> = {
  airport: 'Airports',
  navaid: 'Navaids',
  fix: 'Fixes',
  airway: 'Airways',
  airspace: 'Airspace',
};

/**
 * Single entry rendered in the sibling-chip disclosure. Carries the
 * URL-encoded selection (used as the click handler payload), the
 * human label, and the entity type so the disclosure can group rows
 * by type (Airports, Navaids, Fixes, Airways, Airspace).
 */
export interface Chip {
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
 * Footprint of a selected entity, used to test which other airspaces
 * "overlap" it. Discriminated by `kind`:
 *
 * - `airspace-polygons`: array of polygons. The chip walk does true
 *   polygon-polygon overlap against each. Used for airspace selections.
 * - `airway-bbox`: a bounding box from the waypoint chain. Polylines
 *   have no interior to intersect, so the cheap bbox proxy is the best
 *   we can do without distance-to-line math.
 */
export type SelectionFootprint =
  | { kind: 'airspace-polygons'; polygons: readonly Polygon[]; bbox: BoundingBox }
  | { kind: 'airway-bbox'; bbox: BoundingBox };

/**
 * Returns the selected entity's footprint, or undefined when the
 * selection has no footprint to compare against (point features) or
 * its owning layer is hidden.
 */
export function footprintForSelection(
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
export function* buildOverlappingAirspaceChips(
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
export function disambiguateLabels<T extends { selection: string; label: string }>(
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
 * Builds the inspector chip list from the most recent click siblings
 * plus an optional bbox-overlap walk against the airspace dataset.
 * Same-pixel chips come first (those came from the click event so
 * they are most relevant); bbox-overlap chips after (other airspaces
 * whose bounding box overlaps the selected one). Dedupes by encoded
 * selection, drops chips that resolve to `not-found`, sorts airspace
 * chips by altitude descending, and disambiguates duplicate labels.
 */
export function buildInspectorChipList(input: {
  /** Sibling features from the most recent map click. */
  siblings: readonly InspectableFeature[];
  /** Currently selected encoded selection (excluded from chips). */
  selected: string | undefined;
  /** Loaded-state of every dataset, for resolve checks. */
  datasets: ChartDatasetStates;
  /** Resolved selection state, for footprint computation. */
  state: ResolvedEntityState;
  /** Active layer ids from the URL (drives footprint-source eligibility). */
  layers: readonly string[];
  /** Active airspace classes for filtering overlap chips. */
  airspaceClasses: readonly AirspaceClass[];
  /** Viewport bbox snapshot used to drop offscreen overlap chips. */
  viewportBounds: BoundingBox | undefined;
}): readonly Chip[] {
  const seen = new Set<string>();
  const result: Chip[] = [];

  for (const feature of input.siblings) {
    const selection = selectedFromFeature(feature);
    if (selection === undefined) {
      continue;
    }
    if (selection === input.selected) {
      continue;
    }
    if (seen.has(selection)) {
      continue;
    }
    const ref = parseSelected(selection);
    if (ref === undefined) {
      continue;
    }
    const resolution = resolveSelectionFromState(selection, input.datasets);
    if (resolution.status === 'not-found' || resolution.status === 'idle') {
      continue;
    }
    seen.add(selection);
    const altitudeKey = readAirspaceAltitudeKey(feature.properties);
    result.push({
      selection,
      label: formatChipLabel(feature),
      type: ref.type,
      ...(altitudeKey !== undefined && { altitudeKey }),
    });
  }

  const footprint = footprintForSelection(input.state, input.layers);
  if (footprint !== undefined) {
    const selectedAirspaceKey =
      input.state.status === 'resolved' && input.state.entity.kind === 'airspace'
        ? `${input.state.entity.airspaceType}/${input.state.entity.identifier}`
        : undefined;
    for (const chip of buildOverlappingAirspaceChips(
      footprint,
      selectedAirspaceKey,
      input.datasets,
      seen,
      input.viewportBounds,
      input.airspaceClasses,
    )) {
      if (result.length >= MAX_OVERLAP_CHIPS) {
        break;
      }
      const resolution = resolveSelectionFromState(chip.selection, input.datasets);
      if (resolution.status === 'not-found' || resolution.status === 'idle') {
        continue;
      }
      seen.add(chip.selection);
      result.push({ ...chip, type: 'airspace' });
    }
  }

  return sortAndDisambiguate(result);
}

/**
 * Sorts airspace chips by altitude descending (highest ceiling first,
 * floor as tie-break) so a stack of vertically-layered airspaces -
 * whether from the click siblings (Class B + ARTCC at the same pixel)
 * or from the overlap walk (MOA HIGH + MOA LOW underneath the selected
 * feature) - reads top-down. Non-airspace chips keep their collection
 * order, and the airspace block sits where it naturally landed in the
 * input list. Sort happens before label disambiguation so any `(N)`
 * suffix follows the post-sort order.
 */
function sortAndDisambiguate(chips: readonly Chip[]): readonly Chip[] {
  const nonAirspace: Chip[] = [];
  const airspace: { chip: Chip; key: AirspaceAltitudeKey }[] = [];
  for (const chip of chips) {
    if (chip.altitudeKey === undefined) {
      nonAirspace.push(chip);
    } else {
      airspace.push({ chip, key: chip.altitudeKey });
    }
  }
  airspace.sort((a, b) => compareAirspaceByAltitudeDesc(a.key, b.key));
  return disambiguateLabels([...nonAirspace, ...airspace.map((it) => it.chip)]);
}
