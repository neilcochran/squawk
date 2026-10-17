import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import { useMemo } from 'react';
import type { ReactElement } from 'react';

import { useResolvedEntity } from '../../../shared/inspector/entity-resolver.ts';
import { encodeSelected } from '../../../shared/inspector/entity.ts';
import { useChartColors } from '../../../shared/styles/chart-colors.ts';
import { useActiveHighlightRef, useHoveredAirspaceExclusionKey } from '../highlight-context.ts';

import {
  AIRSPACE_EXCLUSION_FILL_LAYER_ID,
  AIRSPACE_EXCLUSION_FOCUS_LAYER_ID,
  AIRSPACE_EXCLUSION_KEY_PROPERTY,
  AIRSPACE_EXCLUSION_LINE_LAYER_ID,
  AIRSPACE_EXCLUSION_SOURCE_ID,
  toExclusionCollection,
} from './airspace-exclusion-features.ts';

/** Focus filter that matches nothing, used while no exclusion row is hovered. */
const MATCH_NONE_FILTER: ExpressionSpecification = [
  '==',
  ['get', AIRSPACE_EXCLUSION_KEY_PROPERTY],
  '',
];

/**
 * Draws the volumes carved out of the highlighted airspace - the URL
 * selection, or the "Also here" chip being hovered - over its selection
 * hatch: a neutral wash near the basemap's own tone, so each excluded
 * footprint reads as knocked out of the airspace, and a dashed outline.
 * Hovering an exclusion row in the inspector adds a solid focus outline
 * around that volume. Airspace that is not highlighted draws unchanged,
 * so the default chart carries no exclusion marks.
 *
 * The marks lie on the ground in the tilted view too, like the selection
 * ring: most exclusions cover only part of the airspace's height, and a
 * box cannot show a partial cut without splitting the extrusion. Many
 * exclusion footprints extend past the airspace's own boundary (an
 * airport's surface area overlapping a MOA's edge); they are drawn whole,
 * since the airspace does not apply anywhere inside them.
 *
 * The three layers are pinned in the chart-mode overlay order just above
 * the selection hatch and ring (see `TOP_OF_STACK_LAYER_IDS` in
 * `airspace-layer.tsx`). Returns null while nothing with exclusions is
 * highlighted.
 */
export function AirspaceExclusionLayer(): ReactElement | null {
  const activeRef = useActiveHighlightRef();
  const hoveredKey = useHoveredAirspaceExclusionKey();
  const colors = useChartColors();
  const resolved = useResolvedEntity(
    activeRef?.type === 'airspace' ? encodeSelected(activeRef) : undefined,
  );

  const data = useMemo(() => {
    if (resolved.status !== 'resolved' || resolved.entity.kind !== 'airspace') {
      return undefined;
    }
    const collection = toExclusionCollection(resolved.entity.features);
    return collection.features.length === 0 ? undefined : collection;
  }, [resolved]);

  const fillLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_EXCLUSION_FILL_LAYER_ID,
      source: AIRSPACE_EXCLUSION_SOURCE_ID,
      type: 'fill',
      paint: {
        'fill-color': colors.airspaceExclusion.wash,
        'fill-opacity': 0.55,
      },
    }),
    [colors],
  );

  const lineLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_EXCLUSION_LINE_LAYER_ID,
      source: AIRSPACE_EXCLUSION_SOURCE_ID,
      type: 'line',
      paint: {
        'line-color': colors.airspaceExclusion.line,
        'line-width': 1.5,
        'line-dasharray': [3, 2],
      },
    }),
    [colors],
  );

  const focusLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_EXCLUSION_FOCUS_LAYER_ID,
      source: AIRSPACE_EXCLUSION_SOURCE_ID,
      type: 'line',
      filter:
        hoveredKey === undefined
          ? MATCH_NONE_FILTER
          : ['==', ['get', AIRSPACE_EXCLUSION_KEY_PROPERTY], hoveredKey],
      paint: {
        'line-color': colors.highlight.focusOutline,
        'line-width': 3,
      },
    }),
    [colors, hoveredKey],
  );

  if (data === undefined) {
    return null;
  }

  return (
    <Source id={AIRSPACE_EXCLUSION_SOURCE_ID} type="geojson" data={data}>
      <Layer {...fillLayerProps} />
      <Layer {...lineLayerProps} />
      <Layer {...focusLayerProps} />
    </Source>
  );
}
