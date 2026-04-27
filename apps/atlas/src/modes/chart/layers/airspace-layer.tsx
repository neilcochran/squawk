import { useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Source, Layer, useMap } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Feature, FeatureCollection } from 'geojson';
import type { AirspaceType } from '@squawk/types';
import { useAirspaceDataset } from '../../../shared/data/airspace-dataset.ts';
import { polygonCentroid } from '../click-to-select.ts';
import { useActiveHighlightRef } from '../highlight-context.ts';
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
 */
const MATCH_KEY_PROPERTY = '__atlasMatchKey';

/**
 * Filter expression that matches no feature. Used as the default highlight
 * filter when nothing airspace-shaped is currently active.
 */
const MATCH_NONE_FILTER: ExpressionSpecification = [
  '==',
  ['get', MATCH_KEY_PROPERTY],
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
      return ['==', ['get', MATCH_KEY_PROPERTY], activeRef.id];
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
 * Adds the synthetic `__atlasMatchKey` property to every feature in the
 * airspace dataset so highlight-layer filters can match the
 * chip / URL encoding via a simple `==` expression. Returns undefined
 * while the dataset is still loading or errored.
 */
function projectAirspaceSource(
  state: ReturnType<typeof useAirspaceDataset>,
): FeatureCollection | undefined {
  if (state.status !== 'loaded') {
    return undefined;
  }
  const projected: Feature[] = state.dataset.features.map((feature) => {
    const props = feature.properties;
    if (props === null || feature.geometry.type !== 'Polygon') {
      return feature;
    }
    const type = props['type'];
    const identifier = props['identifier'];
    if (typeof type !== 'string' || typeof identifier !== 'string') {
      return feature;
    }
    let matchKey: string;
    if (identifier !== '') {
      matchKey = `${type}/${identifier}`;
    } else {
      const centroid = polygonCentroid(feature.geometry);
      if (centroid === undefined) {
        return feature;
      }
      matchKey = `${type}/c:${centroid[0].toFixed(5)},${centroid[1].toFixed(5)}`;
    }
    return {
      ...feature,
      properties: { ...props, [MATCH_KEY_PROPERTY]: matchKey },
    };
  });
  return { type: 'FeatureCollection', features: projected };
}
