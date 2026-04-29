import type { Feature, FeatureCollection } from 'geojson';
import { polygonGeoJson } from '@squawk/geo';
import type { AltitudeBound } from '@squawk/types';
import {
  AIRSPACE_CEILING_FT_PROPERTY,
  AIRSPACE_CEILING_REF_PROPERTY,
  AIRSPACE_FLOOR_FT_PROPERTY,
  AIRSPACE_FLOOR_REF_PROPERTY,
  AIRSPACE_MATCH_KEY_PROPERTY,
  readAltitudeBoundPrimitives,
} from '../../../shared/inspector/airspace-feature.ts';
import type { useAirspaceDataset } from '../../../shared/data/airspace-dataset.ts';

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
export function projectAirspaceSource(
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
    const floorPrimitives = readNestedAltitudeBound(props['floor']);
    const ceilingPrimitives = readNestedAltitudeBound(props['ceiling']);
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
 * Narrows a nested `{ valueFt, reference }` object pulled off a
 * GeoJSON property bag into the shared {@link AltitudeBound} shape.
 * Returns `undefined` when the input is missing, not an object, or
 * has unexpected field types - the projection code then omits the
 * corresponding flat-primitive properties so downstream consumers
 * get `undefined` reads instead of garbage values.
 */
function readNestedAltitudeBound(value: unknown): AltitudeBound | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  if (!('valueFt' in value) || !('reference' in value)) {
    return undefined;
  }
  return readAltitudeBoundPrimitives(value.valueFt, value.reference);
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
