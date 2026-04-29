import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { Fix, FixUseCode } from '@squawk/types';
import { useFixDataset } from '../../../shared/data/fix-dataset.ts';
import {
  CHART_FIX_COLOR,
  CHART_HIGHLIGHT_COLORS,
  CHART_SYMBOL_STROKE,
} from '../../../shared/styles/chart-colors.ts';
import { useActiveHighlightRef } from '../highlight-context.ts';
import { LAYER_MIN_ZOOM } from '../url-state.ts';

/**
 * Properties carried on each fix point feature in the GeoJSON source.
 * Kept narrow so the source payload stays small; richer fields are read
 * straight from the originating `Fix` record once entity inspection
 * lands.
 */
interface FixFeatureProperties {
  /** Fix identifier (e.g. "MERIT", "BOSCO"). */
  identifier: string;
  /** Usage category (`'WP'`, `'RP'`, `'MW'`, etc.). */
  useCode: FixUseCode;
  /** Whether the fix carries a compulsory reporting designation. */
  compulsory: boolean;
}

/** MapLibre source id for the fixes overlay. */
const FIXES_SOURCE_ID = 'atlas-fixes';

/** MapLibre layer id for the fixes circle symbology. */
export const FIXES_LAYER_ID = 'atlas-fixes-circle';

/** MapLibre layer id for the fix selection-highlight overlay. */
const FIXES_HIGHLIGHT_LAYER_ID = 'atlas-fixes-highlight';

/**
 * Filter expression that matches no feature. Used as the default for the
 * highlight layer when no fix is currently active.
 */
const MATCH_NONE_FILTER: ExpressionSpecification = [
  '==',
  ['get', 'identifier'],
  '__atlas-no-match__',
];

/**
 * Highlight overlay for the currently-selected (or chip-hovered) fix.
 * Mirrors the airport / navaid highlight (yellow + dark stroke).
 * Inherits the same `minzoom` as the base layer so a stray highlight
 * does not float over an empty viewport when the user is zoomed out
 * below the threshold.
 *
 * `minzoom` is included via conditional spread so the property is omitted
 * when {@link LAYER_MIN_ZOOM} carries no entry, satisfying
 * `exactOptionalPropertyTypes` (which rejects an explicit `undefined` for
 * an optional property).
 */
const FIXES_HIGHLIGHT_LAYER_BASE: LayerProps = {
  id: FIXES_HIGHLIGHT_LAYER_ID,
  source: FIXES_SOURCE_ID,
  type: 'circle',
  ...(LAYER_MIN_ZOOM.fixes !== undefined && { minzoom: LAYER_MIN_ZOOM.fixes }),
  paint: {
    'circle-radius': 9,
    'circle-color': CHART_HIGHLIGHT_COLORS.primary,
    'circle-stroke-color': CHART_HIGHLIGHT_COLORS.stroke,
    'circle-stroke-width': 2,
  },
};

/**
 * Fix usage codes we render. `CN` (computer navigation fix - internal FAA
 * automation) and `RADAR` (operational radar fix) are intentionally
 * excluded: neither is meaningful to a typical user browsing the chart.
 */
const RENDERED_FIX_USE_CODES: ReadonlySet<FixUseCode> = new Set<FixUseCode>([
  'WP',
  'RP',
  'MW',
  'MR',
  'VFR',
  'NRS',
]);

/**
 * Projects the bundled fix records into a GeoJSON `FeatureCollection`
 * suitable for a MapLibre `geojson` source. Filters to fixes with a
 * usage code in {@link RENDERED_FIX_USE_CODES}.
 */
function toFeatureCollection(records: Fix[]): FeatureCollection<Point, FixFeatureProperties> {
  const features: Feature<Point, FixFeatureProperties>[] = [];
  for (const fix of records) {
    if (!RENDERED_FIX_USE_CODES.has(fix.useCode)) {
      continue;
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [fix.lon, fix.lat] },
      properties: {
        identifier: fix.identifier,
        useCode: fix.useCode,
        compulsory: fix.compulsory !== undefined,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Visibility threshold for the secondary fix tier (military, VFR, NRS,
 * MR, MW). At the layer's minzoom only compulsory reporting points and
 * enroute waypoints (`WP` / `RP`) are visible; the remaining categories
 * join from this zoom onward, at the same dot size as the WP they sit
 * next to.
 */
const FIX_SECONDARY_TIER_MIN_ZOOM = 9;

/**
 * MapLibre layer styling. Visibility is gated by usage code: at the
 * layer's minzoom only compulsory reporting points and enroute
 * waypoints (`WP` / `RP`) paint, with the remaining categories
 * joining at z9. Color uses an amber hue to distinguish fixes from
 * the blue airports and magenta navaids layers.
 *
 * `minzoom` is sourced from the central {@link LAYER_MIN_ZOOM} table so
 * the layer-toggle dropdown's "appears at z N+" hint and the actual
 * paint cutoff stay in lockstep.
 *
 * Each tier appears at the same dot size as the tiers already on
 * screen so a military or VFR fix popping in at z9 is the same size
 * as the WP it sits next to, not a sub-class speck. Visibility runs
 * through the layer's `filter` rather than a `circle-radius: 0` paint
 * stop because MapLibre still draws the 0.75px white stroke around a
 * zero-radius circle, and a chart at the layer's minzoom would show
 * a fog of speck-sized stroke artifacts otherwise.
 */
const FIXES_LAYER_PROPS: LayerProps = {
  id: FIXES_LAYER_ID,
  source: FIXES_SOURCE_ID,
  type: 'circle',
  ...(LAYER_MIN_ZOOM.fixes !== undefined && { minzoom: LAYER_MIN_ZOOM.fixes }),
  filter: [
    'any',
    ['get', 'compulsory'],
    ['in', ['get', 'useCode'], ['literal', ['WP', 'RP']]],
    ['>=', ['zoom'], FIX_SECONDARY_TIER_MIN_ZOOM],
  ],
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3, 9, 4, 12, 5, 16, 9],
    'circle-color': CHART_FIX_COLOR,
    'circle-stroke-color': CHART_SYMBOL_STROKE,
    'circle-stroke-width': 0.75,
  },
};

/**
 * Chart-mode overlay that renders fixes from `@squawk/fix-data` as
 * MapLibre circle symbols. Returns `null` while the dataset is still being
 * fetched or if the load failed; callers needing fetch-state UI should read
 * the same hook directly.
 */
export function FixesLayer(): ReactElement | null {
  const state = useFixDataset();
  const activeRef = useActiveHighlightRef();

  const data = useMemo<FeatureCollection<Point, FixFeatureProperties> | undefined>(() => {
    if (state.status !== 'loaded') {
      return undefined;
    }
    return toFeatureCollection(state.dataset.records);
  }, [state]);

  const highlightLayerProps = useMemo<LayerProps>(() => {
    const filter: ExpressionSpecification =
      activeRef?.type === 'fix' ? ['==', ['get', 'identifier'], activeRef.id] : MATCH_NONE_FILTER;
    return { ...FIXES_HIGHLIGHT_LAYER_BASE, filter };
  }, [activeRef]);

  if (data === undefined) {
    return null;
  }

  return (
    <Source id={FIXES_SOURCE_ID} type="geojson" data={data}>
      <Layer {...FIXES_LAYER_PROPS} />
      <Layer {...highlightLayerProps} />
    </Source>
  );
}
