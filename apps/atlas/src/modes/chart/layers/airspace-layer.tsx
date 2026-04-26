import type { ReactElement } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import { useAirspaceDataset } from '../../../shared/data/airspace-dataset.ts';

/** MapLibre source id for the airspace overlay. */
const AIRSPACE_SOURCE_ID = 'atlas-airspace';

/** MapLibre layer id for the airspace polygon fill. */
const AIRSPACE_FILL_LAYER_ID = 'atlas-airspace-fill';

/** MapLibre layer id for the airspace polygon outline. */
const AIRSPACE_LINE_LAYER_ID = 'atlas-airspace-line';

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
 * Polygon fill layer styling. Uses a low alpha so airspace boundaries
 * read as gentle tints rather than dominant blocks of color, leaving the
 * basemap and other overlays legible. No type filter: every airspace
 * type the dataset emits is rendered. Default-display tuning (which
 * types are visible by default, zoom-aware visibility, opacity ramps)
 * lands in a later step.
 */
const AIRSPACE_FILL_LAYER_PROPS: LayerProps = {
  id: AIRSPACE_FILL_LAYER_ID,
  source: AIRSPACE_SOURCE_ID,
  type: 'fill',
  paint: {
    'fill-color': TYPE_COLOR_EXPRESSION,
    'fill-opacity': 0.08,
  },
};

/**
 * Polygon outline layer styling. Stroke color matches the fill so each
 * airspace is visually a single unit; stroke is thin so dense areas
 * (e.g. the Class B/C/D layers around busy metros) do not clutter. No
 * type filter, mirroring the fill layer.
 */
const AIRSPACE_LINE_LAYER_PROPS: LayerProps = {
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
 * client-side projection step. Returns `null` while the dataset is still
 * being fetched or if the load failed.
 */
export function AirspaceLayer(): ReactElement | null {
  const state = useAirspaceDataset();

  if (state.status !== 'loaded') {
    return null;
  }

  return (
    <Source id={AIRSPACE_SOURCE_ID} type="geojson" data={state.dataset}>
      <Layer {...AIRSPACE_FILL_LAYER_PROPS} />
      <Layer {...AIRSPACE_LINE_LAYER_PROPS} />
    </Source>
  );
}
