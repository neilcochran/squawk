import type { Feature, FeatureCollection } from 'geojson';

import { polygonGeoJson } from '@squawk/geo';
import type { AltitudeBound } from '@squawk/types';

import type { AirspaceDatasetState } from '../../../shared/data/airspace-dataset.ts';
import {
  AIRSPACE_CEILING_FT_PROPERTY,
  AIRSPACE_CEILING_REF_PROPERTY,
  AIRSPACE_FLOOR_FT_PROPERTY,
  AIRSPACE_FLOOR_REF_PROPERTY,
  AIRSPACE_MATCH_KEY_PROPERTY,
  orderAirspaceFeatures,
  readAltitudeBoundPrimitives,
} from '../../../shared/inspector/airspace-feature.ts';
import type { AirspaceAltitudeKey } from '../../../shared/inspector/airspace-feature.ts';

/** The loaded dataset object; the projection cache is keyed on its identity. */
type LoadedAirspaceDataset = Extract<AirspaceDatasetState, { status: 'loaded' }>['dataset'];

/**
 * Synthetic per-feature property carrying the feature's 0-based position
 * inside its `(type, identifier)` grouping, in the presentation order
 * built by `orderAirspaceFeatures` (highest vertical layer first). The
 * inspector's "Feature N" section titles and the numbered badges on the
 * map both take N from this position, and the per-feature focus filter
 * matches on it when a section is hovered. Without it, the inspector's
 * sections have no visible counterpart on the map and the user cannot
 * tell which polygon corresponds to which section.
 */
export const AIRSPACE_FEATURE_INDEX_PROPERTY = '__atlasFeatureIndex';

/**
 * Vertical spacing (in EMs) between consecutive badges whose anchors
 * coincide. 1.4em at the badge text-size (13px) lands ~18px apart,
 * comfortable to read without crowding.
 */
const BADGE_VERTICAL_SPACING_EM = 1.4;

/**
 * Decimal places two anchors are rounded to before they count as the
 * same spot. Four places is roughly ten meters, so only features drawn
 * from the same geometry (ARTCC strata, a Class C core inside its own
 * shelf) collide; neighbouring sectors of one Class B never do.
 */
const ANCHOR_KEY_DECIMALS = 4;

/**
 * Latitude, in degrees, that polygon vertices are clamped to before the
 * features reach the map source. Web Mercator ends at 85.0511 degrees
 * and MapLibre's tiler pins anything beyond that to the edge, which
 * puts the vertex exactly on the top edge of a tile in the top row.
 * MapLibre reads a ring edge lying on that tile edge as wrapping the
 * pole and appends the globe projection's pole triangles, which reach
 * four tile heights past the world edge; the plain fill shader discards
 * them under Mercator, but the fill-extrusion shader does not, so an
 * airspace that runs to the pole (the Anchorage ARTCC strata and the
 * Class A derived from them) would extrude into a spike off the top of
 * the tilted map. Stopping a twentieth of a degree short of the edge keeps
 * every clamped vertex a dozen tile units below the trigger at zoom 0
 * and further at every deeper zoom, and the basemap ends well before
 * that sliver anyway. The dataset's own geometry is left alone: match
 * keys and search still derive from it, and only what the map draws is
 * clamped.
 */
export const MAX_SOURCE_LATITUDE = 85;

/**
 * One numbered badge for a feature of a multi-feature airspace grouping.
 * Consumed by the DOM badge overlay, which projects `anchor` to the
 * screen itself so the badge can sit on the feature's 3D box.
 */
export interface AirspaceFeatureBadge {
  /** The feature's position in presentation order; the same N as the inspector's "Feature N". */
  readonly featureIndex: number;
  /** Badge text: the ARTCC stratum when the feature has one, otherwise `featureIndex + 1`. */
  readonly label: string;
  /** `[lon, lat]` anchor: the polygon's pole of inaccessibility, which always lies inside the shape. */
  readonly anchor: readonly [number, number];
  /** The feature's ceiling, used to lift the badge onto the box's top face in the tilted view. */
  readonly ceiling: AltitudeBound | undefined;
  /** The feature's airspace type, which sets the box top's depth lift; `undefined` when the property is missing. */
  readonly type: string | undefined;
  /** Vertical offset in EMs that spreads badges sharing an anchor into a readable column; 0 otherwise. */
  readonly columnOffsetEm: number;
}

/** Everything derived from one airspace dataset for the chart-mode layers. */
export interface AirspaceProjection {
  /** The dataset's features with the synthetic properties the layers filter on. */
  readonly featureCollection: FeatureCollection;
  /** Badges per match key, only for groupings with two or more features, in `featureIndex` order. */
  readonly badgeGroups: ReadonlyMap<string, readonly AirspaceFeatureBadge[]>;
}

/**
 * One projection per dataset object. The source layer and the badge
 * overlay both read it, so memoizing on the dataset reference means a
 * session pays for the pole-of-inaccessibility search once while a spec
 * that builds a fresh fixture gets a fresh projection.
 */
const projectionCache = new WeakMap<LoadedAirspaceDataset, AirspaceProjection>();

/**
 * Returns the {@link AirspaceProjection} for a loaded dataset, building
 * it on first use.
 */
export function getAirspaceProjection(dataset: LoadedAirspaceDataset): AirspaceProjection {
  const cached = projectionCache.get(dataset);
  if (cached !== undefined) {
    return cached;
  }
  const projection = buildAirspaceProjection(dataset);
  projectionCache.set(dataset, projection);
  return projection;
}

/**
 * The airspace source data for MapLibre: every dataset feature decorated
 * with the synthetic `__atlasMatchKey` property (used by the highlight
 * filters), `__atlasFeatureIndex` (used by the per-feature focus filter
 * and the badges), and primitive altitude properties (used by the
 * extrusion expressions and the disambiguation popover's altitude
 * subtitle), with its polygon vertices clamped inside the Mercator world
 * (see {@link MAX_SOURCE_LATITUDE}). Returns undefined while the dataset
 * is still loading or errored.
 */
export function projectAirspaceSource(state: AirspaceDatasetState): FeatureCollection | undefined {
  if (state.status !== 'loaded') {
    return undefined;
  }
  return getAirspaceProjection(state.dataset).featureCollection;
}

/**
 * The badge groups of the dataset, keyed by match key. Returns undefined
 * while the dataset is still loading or errored.
 */
export function airspaceBadgeGroups(
  state: AirspaceDatasetState,
): ReadonlyMap<string, readonly AirspaceFeatureBadge[]> | undefined {
  if (state.status !== 'loaded') {
    return undefined;
  }
  return getAirspaceProjection(state.dataset).badgeGroups;
}

/**
 * Three passes over the dataset. The first tallies which features share
 * each `(type, identifier)` match key, reading the dataset's own
 * geometry so an empty-identifier key agrees with the entity resolver
 * and the search index, which derive theirs from the same geometry. The
 * second orders every group into presentation order with the same
 * function the inspector uses, so badge "1" on the map is "Feature 1"
 * in the panel, and computes a badge for each feature of a
 * multi-feature group. The third decorates every feature with its
 * synthetic properties. Badges and the emitted features use the
 * drawable geometry, clamped inside the Mercator world, so a badge
 * always lands on the shape the map draws.
 */
function buildAirspaceProjection(dataset: LoadedAirspaceDataset): AirspaceProjection {
  const features: readonly Feature[] = dataset.features;
  const drawable: readonly Feature[] = features.map(clampFeatureLatitude);
  const keyByIndex: Array<string | undefined> = [];
  const groups = new Map<string, number[]>();
  features.forEach((feature, index) => {
    const key = computeAirspaceMatchKey(feature);
    keyByIndex[index] = key;
    if (key === undefined) {
      return;
    }
    const bucket = groups.get(key);
    if (bucket === undefined) {
      groups.set(key, [index]);
    } else {
      bucket.push(index);
    }
  });

  const positionByIndex = new Map<number, number>();
  const badgeGroups = new Map<string, readonly AirspaceFeatureBadge[]>();
  for (const [key, indices] of groups) {
    const ordered = orderAirspaceFeatures(indices, (index) => altitudeKeyOf(features[index]));
    ordered.forEach((index, position) => {
      positionByIndex.set(index, position);
    });
    if (ordered.length > 1) {
      badgeGroups.set(key, buildBadges(drawable, ordered));
    }
  }

  const projected: Feature[] = drawable.map((feature, index) => {
    const props = feature.properties;
    const key = keyByIndex[index];
    const position = positionByIndex.get(index);
    if (props === null || key === undefined || position === undefined) {
      return feature;
    }
    const floorPrimitives = readNestedAltitudeBound(props['floor']);
    const ceilingPrimitives = readNestedAltitudeBound(props['ceiling']);
    return {
      ...feature,
      properties: {
        ...props,
        [AIRSPACE_MATCH_KEY_PROPERTY]: key,
        [AIRSPACE_FEATURE_INDEX_PROPERTY]: position,
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
  return {
    featureCollection: { type: 'FeatureCollection', features: projected },
    badgeGroups,
  };
}

/**
 * The feature with every vertex of its polygon pulled inside
 * [-{@link MAX_SOURCE_LATITUDE}, {@link MAX_SOURCE_LATITUDE}]. A feature
 * with nothing to clamp, which is every feature but the few that reach
 * the pole, is returned as the same object so it keeps its identity
 * through the projection. Only `Polygon` geometry is clamped; the
 * dataset carries nothing else.
 */
function clampFeatureLatitude(feature: Feature): Feature {
  if (feature.geometry.type !== 'Polygon') {
    return feature;
  }
  let changed = false;
  const coordinates = feature.geometry.coordinates.map((ring) =>
    ring.map((position) => {
      const lat = position[1];
      if (lat === undefined || Math.abs(lat) <= MAX_SOURCE_LATITUDE) {
        return position;
      }
      changed = true;
      const clamped = [...position];
      clamped[1] = Math.sign(lat) * MAX_SOURCE_LATITUDE;
      return clamped;
    }),
  );
  if (!changed) {
    return feature;
  }
  return { ...feature, geometry: { ...feature.geometry, coordinates } };
}

/**
 * Builds the badges of one multi-feature grouping from its features in
 * presentation order. Each badge is anchored at its polygon's pole of
 * inaccessibility, the point deepest inside the shape, so a badge for a
 * crescent-shaped sector lands on the sector rather than in the open
 * middle that its centroid would pick. Badges whose anchors coincide,
 * which only happens for features drawn from the same geometry, are
 * spread into a vertical column centered on the shared anchor. A
 * feature whose polygon is degenerate gets no badge.
 */
function buildBadges(
  features: readonly Feature[],
  ordered: readonly number[],
): readonly AirspaceFeatureBadge[] {
  const placed: Array<Omit<AirspaceFeatureBadge, 'columnOffsetEm'>> = [];
  ordered.forEach((index, position) => {
    const feature = features[index];
    if (
      feature === undefined ||
      feature.properties === null ||
      feature.geometry.type !== 'Polygon'
    ) {
      return;
    }
    const anchor = polygonGeoJson.poleOfInaccessibility(feature.geometry);
    if (anchor === undefined) {
      return;
    }
    const type = feature.properties['type'];
    placed.push({
      featureIndex: position,
      label: computeFeatureLabel(feature.properties, position),
      anchor,
      ceiling: readNestedAltitudeBound(feature.properties['ceiling']),
      type: typeof type === 'string' ? type : undefined,
    });
  });
  const membersByAnchor = new Map<string, number[]>();
  placed.forEach((badge, placedIndex) => {
    const anchorKey = `${badge.anchor[0].toFixed(ANCHOR_KEY_DECIMALS)},${badge.anchor[1].toFixed(ANCHOR_KEY_DECIMALS)}`;
    const members = membersByAnchor.get(anchorKey);
    if (members === undefined) {
      membersByAnchor.set(anchorKey, [placedIndex]);
    } else {
      members.push(placedIndex);
    }
  });
  // Center each column on its anchor: the middle badge sits at offset
  // 0, earlier badges shift up, later ones down. A column of one is at
  // offset 0; a column of two lands at -0.7em and +0.7em.
  const offsetByPlacedIndex = new Map<number, number>();
  for (const members of membersByAnchor.values()) {
    members.forEach((placedIndex, column) => {
      offsetByPlacedIndex.set(
        placedIndex,
        (column - (members.length - 1) / 2) * BADGE_VERTICAL_SPACING_EM,
      );
    });
  }
  return placed.map((badge, placedIndex) => ({
    ...badge,
    columnOffsetEm: offsetByPlacedIndex.get(placedIndex) ?? 0,
  }));
}

/**
 * Altitude key of a dataset feature for the presentation-order sort. A
 * bound the feature lacks or that is malformed reads as 0 so the sort
 * still produces a total order.
 */
function altitudeKeyOf(feature: Feature | undefined): AirspaceAltitudeKey {
  const props = feature?.properties ?? null;
  if (props === null) {
    return { ceilingFt: 0, floorFt: 0 };
  }
  return {
    ceilingFt: readNestedAltitudeBound(props['ceiling'])?.valueFt ?? 0,
    floorFt: readNestedAltitudeBound(props['floor'])?.valueFt ?? 0,
  };
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
 * feature grouping. Format mirrors `selectedFromFeature` in
 * `click-to-select.ts`: `{TYPE}/{IDENTIFIER}` for named features,
 * `{TYPE}/c:{LON},{LAT}` (5dp centroid) for empty-id features.
 *
 * Returns `undefined` for non-Polygon geometry, missing/non-string
 * type or identifier, or empty-id features whose centroid cannot be
 * derived.
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
 * 1-based position, which matches the inspector's "Feature 1" /
 * "Feature 2" section titles.
 */
function computeFeatureLabel(props: Record<string, unknown>, position: number): string {
  const stratum = props['artccStratum'];
  if (typeof stratum === 'string' && stratum.length > 0) {
    return stratum;
  }
  return String(position + 1);
}
