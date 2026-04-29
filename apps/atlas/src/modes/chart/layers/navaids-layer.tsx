import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { Navaid, NavaidType } from '@squawk/types';
import { useNavaidDataset } from '../../../shared/data/navaid-dataset.ts';
import { useChartColors } from '../../../shared/styles/chart-colors.ts';
import { useActiveHighlightRef } from '../highlight-context.ts';
import { LAYER_MIN_ZOOM } from '../url-state.ts';

/**
 * Properties carried on each navaid point feature in the GeoJSON source.
 * Kept narrow so the source payload stays small; richer fields are read
 * straight from the originating `Navaid` record once entity inspection
 * lands.
 */
interface NavaidFeatureProperties {
  /** Three-letter navaid identifier (e.g. "BOS"). */
  identifier: string;
  /** Official facility name (e.g. "BOSTON"). */
  name: string;
  /** Navaid type (`'VOR'`, `'VORTAC'`, `'NDB'`, etc.). */
  type: NavaidType;
}

/** MapLibre source id for the navaids overlay. */
const NAVAIDS_SOURCE_ID = 'atlas-navaids';

/** MapLibre layer id for the navaids circle symbology. */
export const NAVAIDS_LAYER_ID = 'atlas-navaids-circle';

/** MapLibre layer id for the navaid selection-highlight overlay. */
export const NAVAIDS_HIGHLIGHT_LAYER_ID = 'atlas-navaids-highlight';

/**
 * Filter expression that matches no feature. Used as the default for the
 * highlight layer when no navaid is currently active.
 */
const MATCH_NONE_FILTER: ExpressionSpecification = [
  '==',
  ['get', 'identifier'],
  '__atlas-no-match__',
];

/**
 * Navaid types we render. `FAN_MARKER`, `MARINE_NDB`, and `VOT` are
 * intentionally excluded: too niche for a general chart view, and they
 * clutter at low zoom without informing typical IFR or VFR navigation.
 */
const RENDERED_NAVAID_TYPES: ReadonlySet<NavaidType> = new Set<NavaidType>([
  'VOR',
  'VORTAC',
  'VOR/DME',
  'TACAN',
  'DME',
  'NDB',
  'NDB/DME',
]);

/**
 * Projects the bundled navaid records into a GeoJSON `FeatureCollection`
 * suitable for a MapLibre `geojson` source. Filters to operational
 * navaids of types in {@link RENDERED_NAVAID_TYPES}; shutdown facilities
 * and niche types do not appear on this layer.
 */
function toFeatureCollection(records: Navaid[]): FeatureCollection<Point, NavaidFeatureProperties> {
  const features: Feature<Point, NavaidFeatureProperties>[] = [];
  for (const navaid of records) {
    if (navaid.status === 'SHUTDOWN') {
      continue;
    }
    if (!RENDERED_NAVAID_TYPES.has(navaid.type)) {
      continue;
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [navaid.lon, navaid.lat] },
      properties: {
        identifier: navaid.identifier,
        name: navaid.name,
        type: navaid.type,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Visibility threshold for the second-tier navaid types (TACAN, DME).
 * Below this zoom only the IFR-backbone primary types (VOR, VORTAC,
 * VOR/DME) paint; from here on TACANs and DMEs join at the same dot
 * size as the VOR they sit next to.
 */
const NAVAID_SECONDARY_TIER_MIN_ZOOM = 7;
/** Visibility threshold for tertiary navaid types (NDB, NDB/DME). */
const NAVAID_TERTIARY_TIER_MIN_ZOOM = 10;

/**
 * Visibility filter shared by every render of {@link NavaidsLayer}.
 * Pulled out so the per-render `useMemo` building the layer props
 * does not need to recreate the filter array (which is color-
 * independent) when the theme changes.
 */
const NAVAIDS_VISIBILITY_FILTER: ExpressionSpecification = [
  'any',
  ['in', ['get', 'type'], ['literal', ['VOR', 'VORTAC', 'VOR/DME']]],
  [
    'all',
    ['>=', ['zoom'], NAVAID_SECONDARY_TIER_MIN_ZOOM],
    ['in', ['get', 'type'], ['literal', ['TACAN', 'DME']]],
  ],
  ['>=', ['zoom'], NAVAID_TERTIARY_TIER_MIN_ZOOM],
];

/**
 * Chart-mode overlay that renders navaids from `@squawk/navaid-data` as
 * MapLibre circle symbols. Returns `null` while the dataset is still being
 * fetched or if the load failed; callers needing fetch-state UI should read
 * the same hook directly.
 *
 * Visibility is gated by navaid type: the IFR backbone (VOR / VORTAC /
 * VOR/DME) shows from the layer's `minzoom`, TACAN and DME join at z7,
 * NDB and NDB/DME at z10. Color uses a magenta hue to distinguish
 * navaids from the blue/slate airports layer at a glance. `minzoom` is
 * sourced from the central {@link LAYER_MIN_ZOOM} table so the
 * layer-toggle dropdown's "appears at z N+" hint and the actual paint
 * cutoff stay in lockstep.
 *
 * Each tier appears at the same dot size as the tier(s) already on
 * screen so a TACAN popping in at z7 is the same size as the VOR it
 * sits next to, not a sub-class speck. Visibility runs through the
 * layer's `filter` rather than a `circle-radius: 0` paint stop because
 * MapLibre still draws the 1px white stroke around a zero-radius
 * circle, and a chart at CONUS zoom would show thousands of speck-
 * sized stroke artifacts otherwise.
 */
export function NavaidsLayer(): ReactElement | null {
  const state = useNavaidDataset();
  const activeRef = useActiveHighlightRef();
  const colors = useChartColors();

  const data = useMemo<FeatureCollection<Point, NavaidFeatureProperties> | undefined>(() => {
    if (state.status !== 'loaded') {
      return undefined;
    }
    return toFeatureCollection(state.dataset.records);
  }, [state]);

  // Layer paint props are themed: re-memoize when the resolved chart
  // palette flips so MapLibre receives the new color values through
  // its declarative `paint` prop pipeline.
  const layerProps = useMemo<LayerProps>(
    () => ({
      id: NAVAIDS_LAYER_ID,
      source: NAVAIDS_SOURCE_ID,
      type: 'circle',
      ...(LAYER_MIN_ZOOM.navaids !== undefined && { minzoom: LAYER_MIN_ZOOM.navaids }),
      filter: NAVAIDS_VISIBILITY_FILTER,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 7, 5, 10, 6, 16, 10],
        'circle-color': colors.navaid,
        'circle-stroke-color': colors.symbolStroke,
        'circle-stroke-width': 1,
      },
    }),
    [colors],
  );

  // Highlight overlay for the currently-selected (or chip-hovered)
  // navaid. Mirrors the airport / fix highlight so the affordance is
  // consistent across point layers. Inherits the base layer's
  // `minzoom` so a stray highlight does not float over an empty
  // viewport when the user is zoomed out below the threshold.
  const highlightLayerProps = useMemo<LayerProps>(() => {
    const filter: ExpressionSpecification =
      activeRef?.type === 'navaid'
        ? ['==', ['get', 'identifier'], activeRef.id]
        : MATCH_NONE_FILTER;
    return {
      id: NAVAIDS_HIGHLIGHT_LAYER_ID,
      source: NAVAIDS_SOURCE_ID,
      type: 'circle',
      ...(LAYER_MIN_ZOOM.navaids !== undefined && { minzoom: LAYER_MIN_ZOOM.navaids }),
      filter,
      paint: {
        'circle-radius': 9,
        'circle-color': colors.highlight.primary,
        'circle-stroke-color': colors.highlight.stroke,
        'circle-stroke-width': 2,
      },
    };
  }, [activeRef, colors]);

  if (data === undefined) {
    return null;
  }

  return (
    <Source id={NAVAIDS_SOURCE_ID} type="geojson" data={data}>
      <Layer {...layerProps} />
      <Layer {...highlightLayerProps} />
    </Source>
  );
}
