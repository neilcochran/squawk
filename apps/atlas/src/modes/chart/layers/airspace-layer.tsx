import { useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Source, Layer, useMap } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Feature, FeatureCollection } from 'geojson';
import { polygonGeoJson } from '@squawk/geo';
import type { AirspaceType } from '@squawk/types';
import { useAirspaceDataset } from '../../../shared/data/airspace-dataset.ts';
import { useActiveHighlightRef, useHoveredFeatureIndex } from '../highlight-context.ts';
import { AIRSPACE_CLASS_TYPES, CHART_ROUTE_PATH } from '../url-state.ts';

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
 * MapLibre image id for the diagonal hatch pattern used by the
 * highlight fill. Registered once per map instance via `addImage` and
 * referenced by name from the layer's `fill-pattern` paint property.
 */
const HATCH_IMAGE_ID = 'atlas-airspace-hatch';

/**
 * Synthetic per-feature property added at source-projection time so the
 * highlight filter can match against the same encoding the chip / URL
 * path uses. Format mirrors `selectedFromFeature` in `click-to-select.ts`:
 * `{TYPE}/{IDENTIFIER}` for named features, `{TYPE}/c:{LON},{LAT}` (5dp
 * centroid) for empty-id features. Without this, the highlight filter
 * for a centroid-encoded selection would never match because the real
 * `identifier` field is empty.
 *
 * Exported so the click-time encoder in `click-to-select.ts` can read
 * the same value rather than recomputing the centroid from MapLibre's
 * tile-clipped geometry (which would not round-trip through the
 * resolver's source-geometry centroid lookup).
 */
export const AIRSPACE_MATCH_KEY_PROPERTY = '__atlasMatchKey';

/**
 * Synthetic per-feature properties carrying the floor / ceiling values
 * as primitives (number + string), copied at source-projection time
 * from the `floor` / `ceiling` `AltitudeBound` objects on the original
 * dataset feature. Primitive copies are necessary because MapLibre's
 * GeoJSON worker pipeline does not reliably round-trip nested object
 * properties through `queryRenderedFeatures` - downstream consumers
 * (e.g. the disambiguation popover) only see strings, numbers, and
 * booleans. The primitive split (Ft + Ref) preserves enough fidelity
 * to format an "11k-18k" or "700ft AGL" subtitle without re-fetching
 * the source dataset. Exported so the popover and any other consumer
 * stay aligned on the property names.
 */
export const AIRSPACE_FLOOR_FT_PROPERTY = '__atlasFloorFt';
/** Reference datum for the floor altitude. One of `'MSL'`, `'AGL'`, `'SFC'`. */
export const AIRSPACE_FLOOR_REF_PROPERTY = '__atlasFloorRef';
/** Ceiling altitude in feet. See {@link AIRSPACE_FLOOR_FT_PROPERTY}. */
export const AIRSPACE_CEILING_FT_PROPERTY = '__atlasCeilingFt';
/** Reference datum for the ceiling altitude. */
export const AIRSPACE_CEILING_REF_PROPERTY = '__atlasCeilingRef';

/**
 * Synthetic per-feature `[xEm, yEm]` offset applied to the badge layer's
 * `text-offset` so badges in a multi-feature airspace whose polygons
 * share a centroid (Class B's concentric rings, ARTCC's stacked strata)
 * spread out into a readable vertical column instead of stacking on the
 * same pixel. Computed at projection time: each feature gets a unique
 * Y offset proportional to its index within the grouping, centered on
 * the centroid so the column hangs symmetrically above and below it.
 */
export const AIRSPACE_BADGE_OFFSET_PROPERTY = '__atlasBadgeOffset';

/**
 * Vertical spacing (in EMs) between consecutive badges in the same
 * airspace grouping. 1.4em at the badge text-size (13px) lands ~18px
 * apart, comfortable to read without crowding.
 */
const BADGE_VERTICAL_SPACING_EM = 1.4;

/**
 * Synthetic per-feature properties that label individual features
 * inside a multi-feature airspace grouping (Class B rings, ARTCC
 * strata, MOA altitude bands, antimeridian-split oceanic boundaries).
 * Computed at source-projection time by walking the dataset and
 * counting features that share a `(type, identifier)` key. Without
 * these, the inspector's "Feature 1 / Feature 2" sections have no
 * visible counterpart on the map and the user cannot tell which
 * polygon corresponds to which section.
 */
export const AIRSPACE_FEATURE_INDEX_PROPERTY = '__atlasFeatureIndex';
/** Total feature count in this feature's `(type, identifier)` grouping. Used as the badge-visibility filter so single-feature airspaces stay unlabeled. */
export const AIRSPACE_FEATURE_COUNT_PROPERTY = '__atlasFeatureCount';
/** Display label for the badge: ARTCC stratum (e.g. `LOW`, `HIGH`) when set on the source feature, otherwise the 1-based feature index. */
export const AIRSPACE_FEATURE_LABEL_PROPERTY = '__atlasFeatureLabel';

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
 * Highlight overlay for the currently-selected (or chip-hovered) airspace.
 * Thick yellow stroke makes the active polygon pop against the basemap and
 * against neighbouring airspaces of the same type.
 */
const AIRSPACE_HIGHLIGHT_LAYER_BASE: LayerProps = {
  id: AIRSPACE_HIGHLIGHT_LAYER_ID,
  source: AIRSPACE_SOURCE_ID,
  type: 'line',
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#fde047',
    'line-width': 3,
    'line-opacity': 1,
  },
};

/**
 * Cross-hatched fill rendered across the entire interior of the
 * highlighted airspace. Lives on top of the regular tinted fill so the
 * underlying class color stays visible underneath; rendered at moderate
 * opacity so dense overlapping selections do not wash out the basemap.
 *
 * Without this layer, panning so the polygon's outline goes offscreen
 * would leave the user with no visual indicator of which airspace is
 * selected (the yellow outline alone is offscreen). With the hatch,
 * the visible portion of the polygon shows the pattern, anchoring the
 * selection even at extreme zooms.
 */
const AIRSPACE_HIGHLIGHT_FILL_LAYER_BASE: LayerProps = {
  id: AIRSPACE_HIGHLIGHT_FILL_LAYER_ID,
  source: AIRSPACE_SOURCE_ID,
  type: 'fill',
  paint: {
    'fill-pattern': HATCH_IMAGE_ID,
    'fill-opacity': 0.6,
  },
};

/**
 * Per-feature focus outline. Rendered on top of the entity-level
 * highlight stroke so the hovered feature stands out from its
 * siblings. Brighter, lighter yellow + slightly thicker line so the
 * eye registers it as "the one". Filter is empty (matches nothing)
 * when no inspector section is hovered.
 */
const AIRSPACE_FEATURE_FOCUS_LAYER_BASE: LayerProps = {
  id: AIRSPACE_FEATURE_FOCUS_LAYER_ID,
  source: AIRSPACE_SOURCE_ID,
  type: 'line',
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#fef9c3',
    'line-width': 5,
    'line-opacity': 1,
  },
};

/**
 * Per-feature badge label rendered at each polygon centroid. Symbol
 * layers default to point-placement on Polygon source features, so
 * MapLibre auto-positions the label at the polygon's representative
 * point without a separate Point source. The dark halo gives the text
 * legibility against any basemap or fill underneath. Filter is empty
 * when no airspace is selected or when the selected airspace has only
 * one feature (single-feature airspaces need no disambiguation).
 */
const AIRSPACE_FEATURE_BADGE_LAYER_BASE: LayerProps = {
  id: AIRSPACE_FEATURE_BADGE_LAYER_ID,
  source: AIRSPACE_SOURCE_ID,
  type: 'symbol',
  layout: {
    'text-field': ['get', AIRSPACE_FEATURE_LABEL_PROPERTY],
    'text-font': ['Noto Sans Bold'],
    'text-size': 13,
    // Per-feature offset attached at projection time. Distributes
    // badges into a vertical column centered on the polygon centroid
    // so concentric rings (Class B) and stacked strata (ARTCC) -
    // whose centroids would otherwise sit on the same pixel - end
    // up readable at any zoom.
    'text-offset': ['get', AIRSPACE_BADGE_OFFSET_PROPERTY],
    'text-allow-overlap': true,
    'text-ignore-placement': true,
  },
  paint: {
    'text-color': '#fef08a',
    'text-halo-color': '#0f172a',
    'text-halo-width': 2.5,
  },
};

/**
 * MapLibre `match` expression mapping airspace type to color. Shared
 * between the fill and outline layers so they always agree. Covers every
 * `AirspaceType` value the dataset emits; the trailing string is the
 * default fallback for any unrecognized future type.
 *
 * Class E subtypes (E2 through E7) all share a single pink, mirroring how
 * sectional charts use a magenta family for every Class E variant.
 */
const TYPE_COLOR_EXPRESSION = [
  'match',
  ['get', 'type'],
  'CLASS_B',
  '#1e3a8a',
  'CLASS_C',
  '#be185d',
  'CLASS_D',
  '#2563eb',
  ['CLASS_E2', 'CLASS_E3', 'CLASS_E4', 'CLASS_E5', 'CLASS_E6', 'CLASS_E7'],
  '#ec4899',
  'MOA',
  '#d97706',
  'RESTRICTED',
  '#dc2626',
  'PROHIBITED',
  '#991b1b',
  'WARNING',
  '#f97316',
  'ALERT',
  '#facc15',
  'NSA',
  '#6b7280',
  'ARTCC',
  '#94a3b8',
  '#64748b',
] satisfies ExpressionSpecification;

/**
 * Polygon fill layer styling, sans filter. Uses a low alpha so airspace
 * boundaries read as gentle tints rather than dominant blocks of color,
 * leaving the basemap and other overlays legible. The visibility filter is
 * built per-render from the active `airspaceClasses` URL state.
 */
const AIRSPACE_FILL_LAYER_BASE: LayerProps = {
  id: AIRSPACE_FILL_LAYER_ID,
  source: AIRSPACE_SOURCE_ID,
  type: 'fill',
  paint: {
    'fill-color': TYPE_COLOR_EXPRESSION,
    'fill-opacity': 0.08,
  },
};

/**
 * Polygon outline layer styling, sans filter. Stroke color matches the
 * fill so each airspace is visually a single unit; stroke is thin so
 * dense areas do not clutter.
 */
const AIRSPACE_LINE_LAYER_BASE: LayerProps = {
  id: AIRSPACE_LINE_LAYER_ID,
  source: AIRSPACE_SOURCE_ID,
  type: 'line',
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': TYPE_COLOR_EXPRESSION,
    'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 1.2, 12, 2],
    'line-opacity': 0.7,
  },
};

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

  const enabledTypes = useMemo<readonly AirspaceType[]>(
    () => airspaceClasses.flatMap((cls) => AIRSPACE_CLASS_TYPES[cls]),
    [airspaceClasses],
  );

  const filter = useMemo<ExpressionSpecification>(
    () => ['in', ['get', 'type'], ['literal', [...enabledTypes]]],
    [enabledTypes],
  );

  const fillLayerProps = useMemo<LayerProps>(
    () => ({ ...AIRSPACE_FILL_LAYER_BASE, filter }),
    [filter],
  );

  const lineLayerProps = useMemo<LayerProps>(
    () => ({ ...AIRSPACE_LINE_LAYER_BASE, filter }),
    [filter],
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

  const highlightLayerProps = useMemo<LayerProps>(
    () => ({ ...AIRSPACE_HIGHLIGHT_LAYER_BASE, filter: highlightFilter }),
    [highlightFilter],
  );

  const highlightFillLayerProps = useMemo<LayerProps>(
    () => ({ ...AIRSPACE_HIGHLIGHT_FILL_LAYER_BASE, filter: highlightFilter }),
    [highlightFilter],
  );

  // Register the hatch pattern image once per map instance. The fill
  // layer references it by name; if the image is missing MapLibre
  // silently skips the fill, so a slight delay between mount and
  // pattern-load is harmless.
  useHatchPatternImage();

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

  const badgeLayerProps = useMemo<LayerProps>(
    () => ({ ...AIRSPACE_FEATURE_BADGE_LAYER_BASE, filter: badgeFilter }),
    [badgeFilter],
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

  const featureFocusLayerProps = useMemo<LayerProps>(
    () => ({ ...AIRSPACE_FEATURE_FOCUS_LAYER_BASE, filter: featureFocusFilter }),
    [featureFocusFilter],
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
 * Subscribes to MapLibre layer-stack changes (`styledata`) and re-asserts
 * the supplied layer ids at the top of the stack each time. Order within
 * the input array is preserved - the last id ends up topmost. Used to
 * keep the airspace feature-focus + badge labels above every other
 * layer's symbology even when other layer components re-add themselves
 * during the session.
 *
 * The hook tolerates layers that have not been registered yet (initial
 * mount race) by silently skipping any id that `getLayer` cannot find;
 * the next `styledata` event after the layer mounts triggers another
 * pass.
 */
function useTopOfStack(layerIds: readonly string[]): void {
  const map = useMap();
  const mapRef = map.current ?? map.default;
  useEffect((): (() => void) | undefined => {
    if (mapRef === undefined) {
      return undefined;
    }
    const m = mapRef.getMap();
    function reassertOrder(): void {
      for (const id of layerIds) {
        if (m.getLayer(id) !== undefined) {
          // moveLayer with no `beforeId` moves the layer to the top.
          m.moveLayer(id);
        }
      }
    }
    reassertOrder();
    m.on('styledata', reassertOrder);
    return (): void => {
      m.off('styledata', reassertOrder);
    };
  }, [mapRef, layerIds]);
}

/**
 * Registers the cross-hatch pattern image with the underlying MapLibre
 * map exactly once per style load. The fill-pattern layer above
 * references the image by name, so the image must exist before the
 * layer paints (MapLibre silently skips fill-pattern when the image is
 * missing, then re-paints once it lands).
 *
 * Subscribes to `styledata` so the image is re-registered if the style
 * is reloaded (e.g. on basemap swap). `hasImage` short-circuits the
 * common "already there" case so we only allocate the canvas once.
 */
function useHatchPatternImage(): void {
  const map = useMap();
  const mapRef = map.current ?? map.default;
  useEffect((): (() => void) | undefined => {
    if (mapRef === undefined) {
      return undefined;
    }
    const m = mapRef.getMap();
    function ensurePattern(): void {
      if (m.hasImage(HATCH_IMAGE_ID)) {
        return;
      }
      const image = createHatchPatternImage();
      if (image === undefined) {
        return;
      }
      m.addImage(HATCH_IMAGE_ID, image);
    }
    if (m.isStyleLoaded()) {
      ensurePattern();
    }
    m.on('styledata', ensurePattern);
    return (): void => {
      m.off('styledata', ensurePattern);
    };
  }, [mapRef]);
}

/**
 * Builds an 8x8 cross-hatch pattern image (yellow diagonal stripes on a
 * transparent background) used as the highlight fill. Returns undefined
 * if the canvas 2D context is unavailable (e.g. in a non-DOM test
 * environment).
 */
function createHatchPatternImage():
  | { width: number; height: number; data: Uint8Array }
  | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const size = 8;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    return undefined;
  }
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'square';
  // Three diagonal segments so the pattern tiles seamlessly across
  // adjacent 8x8 cells: the main diagonal plus the two corner wraps.
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.moveTo(-2, 2);
  ctx.lineTo(2, -2);
  ctx.moveTo(size - 2, size + 2);
  ctx.lineTo(size + 2, size - 2);
  ctx.stroke();
  const imageData = ctx.getImageData(0, 0, size, size);
  return { width: size, height: size, data: new Uint8Array(imageData.data) };
}

/**
 * Adds the synthetic `__atlasMatchKey` property (used by the highlight
 * filters), per-feature index/count/label properties (used by the
 * feature-badge layer to disambiguate multi-feature airspace
 * groupings), and primitive altitude properties (used by the
 * disambiguation popover's altitude subtitle) to every feature in the
 * airspace dataset. Returns undefined while the dataset is still
 * loading or errored.
 *
 * Two-pass: the first pass tallies how many features share each
 * `(type, identifier)` match key; the second pass walks the dataset
 * again to assign each feature a 0-based index within its group plus
 * the final group count. The order of `__atlasFeatureIndex` matches
 * the order `entity-resolver.ts` uses when grouping features for the
 * inspector, so badge "1" on the map maps to "Feature 1" in the panel.
 */
function projectAirspaceSource(
  state: ReturnType<typeof useAirspaceDataset>,
): FeatureCollection | undefined {
  if (state.status !== 'loaded') {
    return undefined;
  }
  const groupCounts = new Map<string, number>();
  for (const feature of state.dataset.features) {
    const matchKey = computeAirspaceMatchKey(feature);
    if (matchKey !== undefined) {
      groupCounts.set(matchKey, (groupCounts.get(matchKey) ?? 0) + 1);
    }
  }
  const runningIndex = new Map<string, number>();
  const projected: Feature[] = state.dataset.features.map((feature) => {
    const props = feature.properties;
    if (props === null || feature.geometry.type !== 'Polygon') {
      return feature;
    }
    const matchKey = computeAirspaceMatchKey(feature);
    if (matchKey === undefined) {
      return feature;
    }
    const featureIndex = runningIndex.get(matchKey) ?? 0;
    runningIndex.set(matchKey, featureIndex + 1);
    const featureCount = groupCounts.get(matchKey) ?? 1;
    const featureLabel = computeFeatureLabel(props, featureIndex);
    // Center the badge column on the centroid: the middle index sits
    // at offset 0, indices below shift up, indices above shift down.
    // For a 2-feature group: offsets land at -0.7em and +0.7em.
    // For a 12-feature group: offsets span -7.7em to +7.7em.
    const badgeOffsetY = (featureIndex - (featureCount - 1) / 2) * BADGE_VERTICAL_SPACING_EM;
    const floorPrimitives = readAltitudePrimitives(props['floor']);
    const ceilingPrimitives = readAltitudePrimitives(props['ceiling']);
    return {
      ...feature,
      properties: {
        ...props,
        [AIRSPACE_MATCH_KEY_PROPERTY]: matchKey,
        [AIRSPACE_FEATURE_INDEX_PROPERTY]: featureIndex,
        [AIRSPACE_FEATURE_COUNT_PROPERTY]: featureCount,
        [AIRSPACE_FEATURE_LABEL_PROPERTY]: featureLabel,
        [AIRSPACE_BADGE_OFFSET_PROPERTY]: [0, badgeOffsetY],
        ...(floorPrimitives !== undefined && {
          [AIRSPACE_FLOOR_FT_PROPERTY]: floorPrimitives.valueFt,
          [AIRSPACE_FLOOR_REF_PROPERTY]: floorPrimitives.reference,
        }),
        ...(ceilingPrimitives !== undefined && {
          [AIRSPACE_CEILING_FT_PROPERTY]: ceilingPrimitives.valueFt,
          [AIRSPACE_CEILING_REF_PROPERTY]: ceilingPrimitives.reference,
        }),
      },
    };
  });
  return { type: 'FeatureCollection', features: projected };
}

/**
 * Computes the match-key string used by the highlight filters and the
 * feature-grouping count. Format mirrors `selectedFromFeature` in
 * `click-to-select.ts`: `{TYPE}/{IDENTIFIER}` for named features,
 * `{TYPE}/c:{LON},{LAT}` (5dp centroid) for empty-id features.
 *
 * Returns `undefined` for non-Polygon geometry, missing/non-string
 * type or identifier, or empty-id features whose centroid cannot be
 * derived. Pulled into a helper so the per-feature projection and the
 * pre-projection group tally share the same exact key derivation.
 */
function computeAirspaceMatchKey(feature: Feature): string | undefined {
  const props = feature.properties;
  if (props === null) {
    return undefined;
  }
  if (feature.geometry.type !== 'Polygon') {
    return undefined;
  }
  const type = props['type'];
  const identifier = props['identifier'];
  if (typeof type !== 'string' || typeof identifier !== 'string') {
    return undefined;
  }
  if (identifier !== '') {
    return `${type}/${identifier}`;
  }
  const centroid = polygonGeoJson.polygonCentroid(feature.geometry);
  if (centroid === undefined) {
    return undefined;
  }
  return `${type}/c:${centroid[0].toFixed(5)},${centroid[1].toFixed(5)}`;
}

/**
 * Computes the badge label for one feature. ARTCC features carry a
 * stratum string ("LOW" / "HIGH" / "UTA") that disambiguates them
 * meaningfully on the map; for everything else the badge is the
 * 1-based index, which matches the inspector's "Feature 1" /
 * "Feature 2" section titles.
 */
function computeFeatureLabel(props: Record<string, unknown>, index: number): string {
  const stratum = props['artccStratum'];
  if (typeof stratum === 'string' && stratum.length > 0) {
    return stratum;
  }
  return String(index + 1);
}

/**
 * Narrows a `floor` or `ceiling` value from the airspace dataset's
 * GeoJSON property bag into the `{ valueFt, reference }` shape, ready
 * to be flattened into primitive feature properties for downstream
 * MapLibre consumers. Returns `undefined` when the input is missing
 * or has an unexpected shape; callers omit the corresponding primitive
 * properties in that case so the popover row falls back to no
 * subtitle.
 */
function readAltitudePrimitives(
  value: unknown,
): { valueFt: number; reference: 'MSL' | 'AGL' | 'SFC' } | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  if (!('valueFt' in value) || !('reference' in value)) {
    return undefined;
  }
  const { valueFt, reference } = value;
  if (typeof valueFt !== 'number' || typeof reference !== 'string') {
    return undefined;
  }
  if (reference !== 'MSL' && reference !== 'AGL' && reference !== 'SFC') {
    return undefined;
  }
  return { valueFt, reference };
}
