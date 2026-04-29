import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { AirspaceType } from '@squawk/types';
import { useAirspaceDataset } from '../../../shared/data/airspace-dataset.ts';
import { useChartColors } from '../../../shared/styles/chart-colors.ts';
import type {
  ChartAirspaceBadgeColors,
  ChartAirspaceColors,
  ChartHighlightColors,
} from '../../../shared/styles/chart-colors.ts';
import { useActiveHighlightRef, useHoveredFeatureIndex } from '../highlight-context.ts';
import { AIRSPACE_CLASS_TYPES, CHART_ROUTE_PATH } from '../url-state.ts';
import { AIRSPACE_MATCH_KEY_PROPERTY } from '../../../shared/inspector/airspace-feature.ts';
import { hatchImageId, useHatchPatternImage } from './airspace-hatch-pattern.ts';
import {
  AIRSPACE_BADGE_OFFSET_PROPERTY,
  AIRSPACE_FEATURE_COUNT_PROPERTY,
  AIRSPACE_FEATURE_INDEX_PROPERTY,
  AIRSPACE_FEATURE_LABEL_PROPERTY,
  projectAirspaceSource,
} from './airspace-source-projection.ts';
import { useTopOfStack } from './use-top-of-stack.ts';

const route = getRouteApi(CHART_ROUTE_PATH);

/** MapLibre source id for the airspace overlay. */
const AIRSPACE_SOURCE_ID = 'atlas-airspace';

/** MapLibre layer id for the airspace polygon fill. */
export const AIRSPACE_FILL_LAYER_ID = 'atlas-airspace-fill';

/** MapLibre layer id for the airspace polygon outline. */
export const AIRSPACE_LINE_LAYER_ID = 'atlas-airspace-line';

/** MapLibre layer id for the airspace selection-highlight outline overlay. */
const AIRSPACE_HIGHLIGHT_LAYER_ID = 'atlas-airspace-highlight';

/**
 * MapLibre layer id for the cross-hatched fill rendered on top of the
 * selected airspace's interior. Helps the user spot the selection even
 * when the polygon's outline is partially or fully offscreen.
 */
const AIRSPACE_HIGHLIGHT_FILL_LAYER_ID = 'atlas-airspace-highlight-fill';

/**
 * MapLibre layer id for the per-feature focus outline that brightens a
 * single polygon inside a multi-feature airspace grouping when the user
 * hovers its section in the inspector. Sits above the entity-level
 * highlight so the focused ring stands out against its siblings.
 */
const AIRSPACE_FEATURE_FOCUS_LAYER_ID = 'atlas-airspace-feature-focus';

/**
 * MapLibre layer id for the per-feature badge rendered at each polygon's
 * centroid when an airspace with multiple features is selected. The
 * badge text is the feature's index ("1", "2", "3") or its ARTCC
 * stratum name ("LOW", "HIGH"); matches the inspector section title.
 */
const AIRSPACE_FEATURE_BADGE_LAYER_ID = 'atlas-airspace-feature-badge';

/**
 * Stable array of layer ids that {@link AirspaceFeatureOverlayLayers}
 * pins to the top of the MapLibre layer stack via {@link useTopOfStack}.
 * Defined at module scope so the effect's dependency comparison sees a
 * stable reference and does not re-subscribe on every render.
 */
const TOP_OF_STACK_LAYER_IDS = [
  AIRSPACE_FEATURE_FOCUS_LAYER_ID,
  AIRSPACE_FEATURE_BADGE_LAYER_ID,
] as const;

/**
 * Filter expression that matches no feature. Used as the default highlight
 * filter when nothing airspace-shaped is currently active.
 */
const MATCH_NONE_FILTER: ExpressionSpecification = [
  '==',
  ['get', AIRSPACE_MATCH_KEY_PROPERTY],
  '__atlas-no-match__',
];

/**
 * Builds the MapLibre `match` expression that maps airspace type to
 * color. Shared between the fill and outline layers so they always
 * agree. Covers every `AirspaceType` value the dataset emits; the
 * trailing string is the default fallback for any unrecognized future
 * type. Class E subtypes (E2 through E7) all share a single pink,
 * mirroring how sectional charts use a magenta family for every Class
 * E variant.
 *
 * Built per-render from the resolved palette so a theme switch flips
 * every airspace fill/outline color in lockstep.
 */
function buildTypeColorExpression(airspace: ChartAirspaceColors): ExpressionSpecification {
  return [
    'match',
    ['get', 'type'],
    'CLASS_B',
    airspace.classB,
    'CLASS_C',
    airspace.classC,
    'CLASS_D',
    airspace.classD,
    ['CLASS_E2', 'CLASS_E3', 'CLASS_E4', 'CLASS_E5', 'CLASS_E6', 'CLASS_E7'],
    airspace.classE,
    'MOA',
    airspace.moa,
    'RESTRICTED',
    airspace.restricted,
    'PROHIBITED',
    airspace.prohibited,
    'WARNING',
    airspace.warning,
    'ALERT',
    airspace.alert,
    'NSA',
    airspace.nsa,
    'ARTCC',
    airspace.artcc,
    airspace.fallback,
  ];
}

/**
 * Chart-mode overlay that renders airspace polygons from
 * `@squawk/airspace-data` using a fill layer for tinted boundaries and a
 * line layer for the outlines. The dataset is already a GeoJSON
 * `FeatureCollection`, so MapLibre consumes it directly without a
 * client-side projection step. The fill and line layers share a MapLibre
 * `filter` expression built from the active `airspaceClasses` URL state,
 * so toggling sub-classes shows or hides only the matching features
 * without rebuilding the source. Returns `null` while the dataset is still
 * being fetched or if the load failed.
 */
export function AirspaceLayer(): ReactElement | null {
  const { airspaceClasses } = route.useSearch();
  const state = useAirspaceDataset();
  const activeRef = useActiveHighlightRef();
  const colors = useChartColors();
  const hatchId = hatchImageId(colors.highlight.primary);

  const enabledTypes = useMemo<readonly AirspaceType[]>(
    () => airspaceClasses.flatMap((cls) => AIRSPACE_CLASS_TYPES[cls]),
    [airspaceClasses],
  );

  const filter = useMemo<ExpressionSpecification>(
    () => ['in', ['get', 'type'], ['literal', [...enabledTypes]]],
    [enabledTypes],
  );

  // Polygon fill layer. Uses a low alpha so airspace boundaries read
  // as gentle tints rather than dominant blocks of color, leaving the
  // basemap and other overlays legible. Re-memoized when the resolved
  // palette flips so the type-color expression follows the theme.
  const fillLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_FILL_LAYER_ID,
      source: AIRSPACE_SOURCE_ID,
      type: 'fill',
      filter,
      paint: {
        'fill-color': buildTypeColorExpression(colors.airspace),
        'fill-opacity': 0.08,
      },
    }),
    [filter, colors],
  );

  // Polygon outline layer. Stroke color matches the fill so each
  // airspace reads as a single unit; stroke is thin so dense areas do
  // not clutter.
  const lineLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_LINE_LAYER_ID,
      source: AIRSPACE_SOURCE_ID,
      type: 'line',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      filter,
      paint: {
        'line-color': buildTypeColorExpression(colors.airspace),
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 1.2, 12, 2],
        'line-opacity': 0.7,
      },
    }),
    [filter, colors],
  );

  // Project the source dataset to add a synthetic match-key property
  // per feature. The chip / URL path encodes selections as either
  // `airspace:{TYPE}/{IDENTIFIER}` (named) or
  // `airspace:{TYPE}/c:{LON},{LAT}` (empty-id, centroid disambiguator);
  // mirroring that exact format here lets the highlight filter use a
  // single equality check that works for both. Memoized so the
  // re-projection runs once per dataset load, not per render.
  const sourceData = useMemo(() => projectAirspaceSource(state), [state]);

  // Same filter is shared between the highlight outline and the
  // cross-hatched highlight fill, so the outline + interior pattern
  // render together for whatever airspace is currently selected.
  const highlightFilter = useMemo<ExpressionSpecification>(() => {
    if (activeRef?.type === 'airspace' && activeRef.id.length > 0) {
      return ['==', ['get', AIRSPACE_MATCH_KEY_PROPERTY], activeRef.id];
    }
    return MATCH_NONE_FILTER;
  }, [activeRef]);

  // Highlight outline overlay for the currently-selected (or
  // chip-hovered) airspace. Thick yellow stroke makes the active
  // polygon pop against the basemap and against neighbouring
  // airspaces of the same type.
  const highlightLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_HIGHLIGHT_LAYER_ID,
      source: AIRSPACE_SOURCE_ID,
      type: 'line',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      filter: highlightFilter,
      paint: {
        'line-color': colors.highlight.primary,
        'line-width': 3,
        'line-opacity': 1,
      },
    }),
    [highlightFilter, colors],
  );

  // Cross-hatched fill rendered across the entire interior of the
  // highlighted airspace. Lives on top of the regular tinted fill so
  // the underlying class color stays visible underneath; rendered at
  // moderate opacity so dense overlapping selections do not wash out
  // the basemap. Without this layer, panning so the polygon's outline
  // goes offscreen would leave the user with no visual indicator of
  // which airspace is selected.
  const highlightFillLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_HIGHLIGHT_FILL_LAYER_ID,
      source: AIRSPACE_SOURCE_ID,
      type: 'fill',
      filter: highlightFilter,
      paint: {
        'fill-pattern': hatchId,
        'fill-opacity': 0.6,
      },
    }),
    [highlightFilter, hatchId],
  );

  // Register the hatch pattern image once per map instance per theme.
  // The fill layer references the per-theme image by name; if the
  // image is missing MapLibre silently skips the fill, so a slight
  // delay between mount and pattern-load is harmless.
  useHatchPatternImage(hatchId, colors.highlight.primary);

  if (state.status !== 'loaded' || sourceData === undefined) {
    return null;
  }

  return (
    <Source id={AIRSPACE_SOURCE_ID} type="geojson" data={sourceData}>
      <Layer {...fillLayerProps} />
      <Layer {...lineLayerProps} />
      <Layer {...highlightFillLayerProps} />
      <Layer {...highlightLayerProps} />
    </Source>
  );
}

/**
 * Top-of-stack overlay layers for an airspace's per-feature focus
 * outline and numbered badges. Mounted as a sibling of every other
 * chart layer (and rendered AFTER airports / navaids / fixes so the
 * badges sit above their circles), it references the airspace source
 * mounted by {@link AirspaceLayer} by id rather than wrapping its own
 * `<Source>` - one source, two layer subtrees.
 *
 * Renders nothing while the airspace dataset is still loading; the
 * filters resolve to "match nothing" when no airspace is selected, so
 * the layers are present but invisible until selection lands.
 */
export function AirspaceFeatureOverlayLayers(): ReactElement | null {
  const state = useAirspaceDataset();
  const activeRef = useActiveHighlightRef();
  const hoveredFeatureIndex = useHoveredFeatureIndex();
  const colors = useChartColors();

  // Badge filter: visible when an airspace with 2+ features is the
  // active selection. Single-feature airspaces don't need disambiguation
  // so the count > 1 clause keeps badges off when they would add noise.
  const badgeFilter = useMemo<ExpressionSpecification>(() => {
    if (activeRef?.type === 'airspace' && activeRef.id.length > 0) {
      return [
        'all',
        ['==', ['get', AIRSPACE_MATCH_KEY_PROPERTY], activeRef.id],
        ['>', ['get', AIRSPACE_FEATURE_COUNT_PROPERTY], 1],
      ];
    }
    return MATCH_NONE_FILTER;
  }, [activeRef]);

  // Per-feature badge label rendered at each polygon centroid. Symbol
  // layers default to point-placement on Polygon source features, so
  // MapLibre auto-positions the label at the polygon's representative
  // point without a separate Point source. The dark halo gives the
  // text legibility against any basemap or fill underneath. Filter is
  // empty when no airspace is selected or when the selected airspace
  // has only one feature (single-feature airspaces need no
  // disambiguation).
  const badgeLayerProps = useMemo<LayerProps>(
    () => buildBadgeLayerProps(badgeFilter, colors.airspaceBadge),
    [badgeFilter, colors],
  );

  // Feature-focus filter: matches the polygon whose inspector section
  // is currently hovered. When no section is hovered (or no airspace
  // selected) the filter matches nothing so the layer is effectively
  // absent.
  const featureFocusFilter = useMemo<ExpressionSpecification>(() => {
    if (
      activeRef?.type === 'airspace' &&
      activeRef.id.length > 0 &&
      hoveredFeatureIndex !== undefined
    ) {
      return [
        'all',
        ['==', ['get', AIRSPACE_MATCH_KEY_PROPERTY], activeRef.id],
        ['==', ['get', AIRSPACE_FEATURE_INDEX_PROPERTY], hoveredFeatureIndex],
      ];
    }
    return MATCH_NONE_FILTER;
  }, [activeRef, hoveredFeatureIndex]);

  // Per-feature focus outline. Rendered on top of the entity-level
  // highlight stroke so the hovered feature stands out from its
  // siblings. Brighter, lighter yellow + slightly thicker line so the
  // eye registers it as "the one". Filter is empty (matches nothing)
  // when no inspector section is hovered.
  const featureFocusLayerProps = useMemo<LayerProps>(
    () => buildFeatureFocusLayerProps(featureFocusFilter, colors.highlight),
    [featureFocusFilter, colors],
  );

  // Force the focus + badge layers to the very top of MapLibre's layer
  // stack on every render. Without this, any subsequent re-add by the
  // airport / navaid / fix layer components (e.g. when their filter
  // expression changes due to a URL toggle) would push our layers back
  // down, and the badges would render underneath the point symbols
  // they are meant to label.
  useTopOfStack(TOP_OF_STACK_LAYER_IDS);

  // Bail until the airspace source is mounted; layers referencing a
  // not-yet-registered source generate noisy warnings and never paint.
  if (state.status !== 'loaded') {
    return null;
  }

  return (
    <>
      <Layer {...featureFocusLayerProps} />
      <Layer {...badgeLayerProps} />
    </>
  );
}

/**
 * Builds the {@link LayerProps} for the per-feature focus outline,
 * sourcing the line color from the resolved highlight palette so a
 * theme switch flips the focused-polygon outline along with the rest
 * of the highlight chrome.
 */
function buildFeatureFocusLayerProps(
  filter: ExpressionSpecification,
  highlight: ChartHighlightColors,
): LayerProps {
  return {
    id: AIRSPACE_FEATURE_FOCUS_LAYER_ID,
    source: AIRSPACE_SOURCE_ID,
    type: 'line',
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    filter,
    paint: {
      'line-color': highlight.focusOutline,
      'line-width': 5,
      'line-opacity': 1,
    },
  };
}

/**
 * Builds the {@link LayerProps} for the per-feature badge label,
 * sourcing the text and halo colors from the resolved badge palette.
 */
function buildBadgeLayerProps(
  filter: ExpressionSpecification,
  badge: ChartAirspaceBadgeColors,
): LayerProps {
  return {
    id: AIRSPACE_FEATURE_BADGE_LAYER_ID,
    source: AIRSPACE_SOURCE_ID,
    type: 'symbol',
    layout: {
      'text-field': ['get', AIRSPACE_FEATURE_LABEL_PROPERTY],
      'text-font': ['Noto Sans Bold'],
      'text-size': 13,
      // Per-feature offset attached at projection time. Distributes
      // badges into a vertical column centered on the polygon
      // centroid so concentric rings (Class B) and stacked strata
      // (ARTCC) - whose centroids would otherwise sit on the same
      // pixel - end up readable at any zoom.
      'text-offset': ['get', AIRSPACE_BADGE_OFFSET_PROPERTY],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    filter,
    paint: {
      'text-color': badge.text,
      'text-halo-color': badge.halo,
      'text-halo-width': 2.5,
    },
  };
}
