import type { GeoJsonProperties, Geometry } from 'geojson';
import { polygonGeoJson } from '@squawk/geo';
import { AIRPORTS_LAYER_ID } from './layers/airports-layer.tsx';
import { AIRSPACE_FILL_LAYER_ID, AIRSPACE_LINE_LAYER_ID } from './layers/airspace-layer.tsx';
import { AIRWAYS_LAYER_ID } from './layers/airways-layer.tsx';
import { FIXES_LAYER_ID } from './layers/fixes-layer.tsx';
import { NAVAIDS_LAYER_ID } from './layers/navaids-layer.tsx';

/**
 * The minimal subset of a MapLibre feature `selectedFromFeature` reads:
 * the layer id (for type discrimination), the properties bag (for the
 * entity identifier), and optionally the geometry (used as a centroid
 * disambiguator for airspace features whose source data has a blank
 * identifier - the centroid encoding lets those features still produce
 * stable chip URLs). Narrowing the parameter to this shape - rather
 * than the full `MapGeoJSONFeature` - lets tests build stub objects
 * with no type assertions, and documents the function's true
 * dependency surface.
 */
export interface InspectableFeature {
  /** The MapLibre layer that produced this feature, identified by id. */
  layer: { id: string };
  /** GeoJSON property bag carried on the feature. May be null. */
  properties: GeoJsonProperties;
  /**
   * Underlying GeoJSON geometry, when available. Required for airspace
   * features with empty identifiers - the centroid is used as a stable
   * URL-encodable disambiguator. Optional everywhere else.
   */
  geometry?: Geometry;
}

/**
 * Every MapLibre layer id whose features should respond to a chart-mode
 * click (and show a pointer cursor on hover). Used both as the `layers`
 * filter for `interactiveLayerIds` and as the iteration list for the
 * cursor-on-hover effect in chart-mode. Order in this array does not
 * matter for either consumer; the click winner is chosen by
 * {@link pickFeatureByPriority} below, not by MapLibre z-order.
 */
export const INSPECTABLE_LAYER_IDS = [
  AIRPORTS_LAYER_ID,
  NAVAIDS_LAYER_ID,
  FIXES_LAYER_ID,
  AIRWAYS_LAYER_ID,
  AIRSPACE_FILL_LAYER_ID,
  AIRSPACE_LINE_LAYER_ID,
] as const;

/**
 * Click-resolution rank by layer id: lower number wins. Ordered so the
 * most specific entity always beats more diffuse ones at the same pixel:
 * point features (airports, navaids, fixes) beat line features (airways)
 * which beat polygon features (airspace fill / line). This fixes the
 * common case of clicking a small feature - e.g. KBOS - that sits inside
 * a Class B airspace polygon: the user almost certainly meant the airport,
 * even though the airspace covers the same pixel.
 *
 * Airspace fill and line share the lowest rank so a click on the airspace
 * outline behaves identically to a click on the fill body.
 *
 * Adding a new inspectable layer requires adding a slot here; otherwise
 * the new layer's features will be silently skipped (the lookup returns
 * undefined and {@link pickFeatureByPriority} treats undefined as "not
 * eligible").
 */
const LAYER_PRIORITY: Record<string, number> = {
  [AIRPORTS_LAYER_ID]: 0,
  [NAVAIDS_LAYER_ID]: 1,
  [FIXES_LAYER_ID]: 2,
  [AIRWAYS_LAYER_ID]: 3,
  [AIRSPACE_FILL_LAYER_ID]: 4,
  [AIRSPACE_LINE_LAYER_ID]: 4,
};

/**
 * Picks the most-specific inspectable feature from a multi-hit click,
 * using {@link LAYER_PRIORITY}. Returns `undefined` when no feature in the
 * list comes from a known inspectable layer. Within the same priority
 * rank, ties resolve to whichever feature appeared first in the input
 * (i.e. MapLibre's topmost-rendered) - rare in practice for our datasets.
 *
 * @param features - All features at the click point, as returned by
 *   MapLibre via `event.features`.
 * @returns The winner, or undefined if no feature is from a tracked layer.
 */
export function pickFeatureByPriority(
  features: readonly InspectableFeature[],
): InspectableFeature | undefined {
  let best: InspectableFeature | undefined;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const feature of features) {
    const rank = LAYER_PRIORITY[feature.layer.id];
    if (rank === undefined) {
      continue;
    }
    if (rank < bestRank) {
      best = feature;
      bestRank = rank;
    }
  }
  return best;
}

/**
 * Encodes a single MapLibre feature into the `{type}:{id}` string written
 * to the URL `selected` search param. Returns `undefined` when the feature
 * came from a non-inspectable layer or its properties lack the
 * discriminating field. Used downstream of {@link pickFeatureByPriority},
 * which selects the winner among any features that hit the click point.
 *
 * Pure: no map, navigation, or DOM dependencies. Tested independently of
 * the click handler.
 *
 * @param feature - The picked feature to encode.
 * @returns The encoded `selected` string, or undefined if the feature
 *   cannot be encoded.
 */
export function selectedFromFeature(feature: InspectableFeature): string | undefined {
  switch (feature.layer.id) {
    case AIRPORTS_LAYER_ID: {
      const faaId = readString(feature.properties, 'faaId');
      return faaId === undefined ? undefined : `airport:${faaId}`;
    }
    case NAVAIDS_LAYER_ID: {
      const identifier = readString(feature.properties, 'identifier');
      return identifier === undefined ? undefined : `navaid:${identifier}`;
    }
    case FIXES_LAYER_ID: {
      const identifier = readString(feature.properties, 'identifier');
      return identifier === undefined ? undefined : `fix:${identifier}`;
    }
    case AIRWAYS_LAYER_ID: {
      const designation = readString(feature.properties, 'designation');
      return designation === undefined ? undefined : `airway:${designation}`;
    }
    case AIRSPACE_FILL_LAYER_ID:
    case AIRSPACE_LINE_LAYER_ID: {
      const type = readString(feature.properties, 'type');
      const identifier = readString(feature.properties, 'identifier');
      if (type === undefined || identifier === undefined) {
        return undefined;
      }
      if (identifier !== '') {
        return `airspace:${type}/${identifier}`;
      }
      // Empty identifier: encode the polygon centroid as a stable
      // URL-decodable disambiguator. The resolver detects the `c:`
      // prefix and matches features by centroid coordinates.
      const centroid = polygonCentroidFromGeometry(feature.geometry);
      if (centroid === undefined) {
        return undefined;
      }
      return `airspace:${type}/c:${centroid[0].toFixed(5)},${centroid[1].toFixed(5)}`;
    }
    default:
      return undefined;
  }
}

/**
 * Builds the chip label for an airspace feature. Three cases:
 *
 * - Identifier is non-empty: standard `{TYPE} {IDENTIFIER}` (e.g.
 *   `MOA MADAW`, `CLASS B JFK`).
 * - Identifier is empty but the dataset has a `name`: use the name
 *   directly (e.g. `BILLINGS CLASS E5`, `HARDIN CLASS E5`). The name
 *   already conveys both the airspace's locale and its class, so we
 *   skip prepending the type to avoid redundancy like
 *   "CLASS E5 BILLINGS CLASS E5".
 * - Both empty: fall back to the friendly type alone.
 *
 * Exported so the inspector's bbox-overlap chip walk uses the same
 * label format as click-derived chips.
 */
export function formatAirspaceLabel(type: string, identifier: string, name: string): string {
  const friendlyType = type.replace(/_/g, ' ');
  if (identifier !== '') {
    return `${friendlyType} ${identifier}`;
  }
  if (name !== '') {
    return name;
  }
  return friendlyType;
}

/**
 * Extracts the centroid (mean of outer-ring coordinates) of a polygon
 * geometry, or returns undefined when the geometry is missing or not a
 * Polygon. Used to disambiguate airspace features whose source data has
 * an empty `identifier` - the centroid serves as a stable, URL-encodable
 * surrogate.
 *
 * @param geometry - Optional GeoJSON geometry. When this is a Polygon,
 *                   the centroid of its outer ring is returned.
 * @returns The centroid as `[lon, lat]`, or undefined when the geometry
 *          is missing, non-Polygon, or has no usable coordinates.
 */
export function polygonCentroidFromGeometry(
  geometry: Geometry | undefined,
): [number, number] | undefined {
  if (geometry === undefined || geometry.type !== 'Polygon') {
    return undefined;
  }
  return polygonGeoJson.polygonCentroid(geometry);
}

/**
 * Builds a short human-friendly label for a feature, used in the
 * inspector's "Also here" sibling chip strip. Falls back to a generic
 * type label when the discriminating property is missing rather than
 * dropping the chip - preserving every chip is more useful than silently
 * skipping one when the underlying data is unexpectedly thin.
 *
 * @param feature - Feature to label.
 * @returns The chip label (e.g. "BOS", "V16", "CLASS B JFK").
 */
export function formatChipLabel(feature: InspectableFeature): string {
  const props = feature.properties;
  switch (feature.layer.id) {
    case AIRPORTS_LAYER_ID:
      return readString(props, 'faaId') ?? 'Airport';
    case NAVAIDS_LAYER_ID:
      return readString(props, 'identifier') ?? 'Navaid';
    case FIXES_LAYER_ID:
      return readString(props, 'identifier') ?? 'Fix';
    case AIRWAYS_LAYER_ID:
      return readString(props, 'designation') ?? 'Airway';
    case AIRSPACE_FILL_LAYER_ID:
    case AIRSPACE_LINE_LAYER_ID: {
      const type = readString(props, 'type') ?? 'Airspace';
      const identifier = readString(props, 'identifier') ?? '';
      const name = readString(props, 'name') ?? '';
      return formatAirspaceLabel(type, identifier, name);
    }
    default:
      return 'Unknown';
  }
}

/**
 * Reads a string-typed property from a MapLibre feature's `properties` bag,
 * returning `undefined` when the value is missing or not a string. Lets the
 * encode logic narrow `feature.properties[key]` (typed as `unknown` from the
 * GeoJSON typings) without resorting to `as` assertions.
 *
 * Empty strings pass through; identifier-style properties in the FAA NASR
 * sources occasionally publish blank values (most commonly some Class E5
 * polygons), and dropping the click on those features would silently
 * swallow the click. The inspector handles empty-identifier airspaces via
 * a click-feature fallback in `inspector.tsx` - the resolver returns
 * not-found, and the inspector then renders the feature's own properties.
 */
function readString(properties: GeoJsonProperties, key: string): string | undefined {
  if (properties === null) {
    return undefined;
  }
  const value = properties[key];
  return typeof value === 'string' ? value : undefined;
}
