import type { GeoJsonProperties } from 'geojson';
import { AIRPORTS_LAYER_ID } from './layers/airports-layer.tsx';
import { AIRSPACE_FILL_LAYER_ID, AIRSPACE_LINE_LAYER_ID } from './layers/airspace-layer.tsx';
import { AIRWAYS_LAYER_ID } from './layers/airways-layer.tsx';
import { FIXES_LAYER_ID } from './layers/fixes-layer.tsx';
import { NAVAIDS_LAYER_ID } from './layers/navaids-layer.tsx';

/**
 * The minimal subset of a MapLibre feature `selectedFromFeature` reads:
 * the layer id (for type discrimination) and the properties bag (for the
 * entity identifier). Narrowing the parameter to this shape - rather than
 * the full `MapGeoJSONFeature` - lets tests build stub objects with no
 * type assertions, and documents the function's true dependency surface.
 */
export interface InspectableFeature {
  /** The MapLibre layer that produced this feature, identified by id. */
  layer: { id: string };
  /** GeoJSON property bag carried on the feature. May be null. */
  properties: GeoJsonProperties;
}

/**
 * Every MapLibre layer id whose features should respond to a chart-mode
 * click (and show a pointer cursor on hover). Used both as the `layers`
 * filter for `queryRenderedFeatures` and as the iteration list for the
 * cursor-on-hover effect in chart-mode. Order does not matter for either
 * consumer; topmost-wins is determined by MapLibre's z-stack at query time,
 * not by this list.
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
 * Encodes a MapLibre feature returned by `queryRenderedFeatures` into the
 * `{type}:{id}` string written to the URL `selected` search param. Returns
 * `undefined` when the feature came from a non-inspectable layer or its
 * properties lack the discriminating field.
 *
 * Pure: no map, navigation, or DOM dependencies. Tested independently of
 * the click handler.
 *
 * @param feature - Topmost feature from a `queryRenderedFeatures` call.
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
      return `airspace:${type}/${identifier}`;
    }
    default:
      return undefined;
  }
}

/**
 * Reads a string-typed property from a MapLibre feature's `properties` bag,
 * returning `undefined` when the value is missing or not a string. Lets the
 * encode logic narrow `feature.properties[key]` (typed as `unknown` from the
 * GeoJSON typings) without resorting to `as` assertions.
 */
function readString(properties: GeoJsonProperties, key: string): string | undefined {
  if (properties === null) {
    return undefined;
  }
  const value = properties[key];
  return typeof value === 'string' ? value : undefined;
}
