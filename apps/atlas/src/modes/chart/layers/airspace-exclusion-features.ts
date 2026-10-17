import type { Feature, FeatureCollection, Polygon } from 'geojson';

import type { AirspaceFeature } from '@squawk/types';

import { airspaceExclusionKey } from '../../../shared/inspector/airspace-feature.ts';

/** MapLibre source id for the selected airspace's excluded volumes. */
export const AIRSPACE_EXCLUSION_SOURCE_ID = 'atlas-airspace-exclusion';

/** MapLibre layer id for the neutral wash over each excluded footprint. */
export const AIRSPACE_EXCLUSION_FILL_LAYER_ID = 'atlas-airspace-exclusion-fill';

/** MapLibre layer id for the dashed outline of each excluded footprint. */
export const AIRSPACE_EXCLUSION_LINE_LAYER_ID = 'atlas-airspace-exclusion-line';

/** MapLibre layer id for the outline of the excluded volume whose inspector row is hovered. */
export const AIRSPACE_EXCLUSION_FOCUS_LAYER_ID = 'atlas-airspace-exclusion-focus';

/** GeoJSON property carrying each volume's `airspaceExclusionKey`, which the focus layer filters on. */
export const AIRSPACE_EXCLUSION_KEY_PROPERTY = 'exclusionKey';

/** Properties carried on each excluded-volume feature in the GeoJSON source. */
export interface AirspaceExclusionFeatureProperties {
  /** The volume's `airspaceExclusionKey`: its feature's presentation index and its own index. */
  [AIRSPACE_EXCLUSION_KEY_PROPERTY]: string;
}

/**
 * Projects the excluded volumes of one airspace grouping into a
 * `FeatureCollection` of their footprints, each keyed the way the inspector
 * keys its exclusion rows. `features` must be in presentation order (as the
 * entity resolver returns them) so a volume's key matches its row.
 *
 * @param features - The grouping's features in presentation order.
 * @returns One polygon per excluded volume; empty when none has exclusions.
 */
export function toExclusionCollection(
  features: readonly AirspaceFeature[],
): FeatureCollection<Polygon, AirspaceExclusionFeatureProperties> {
  const collection: Feature<Polygon, AirspaceExclusionFeatureProperties>[] = features.flatMap(
    (feature, featureIndex) =>
      (feature.exclusions ?? []).map(
        (exclusion, exclusionIndex): Feature<Polygon, AirspaceExclusionFeatureProperties> => ({
          type: 'Feature',
          geometry: exclusion.boundary,
          properties: {
            [AIRSPACE_EXCLUSION_KEY_PROPERTY]: airspaceExclusionKey(featureIndex, exclusionIndex),
          },
        }),
      ),
  );
  return { type: 'FeatureCollection', features: collection };
}
