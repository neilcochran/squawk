import { z } from 'zod';
import type { AirspaceType, AirwayType } from '@squawk/types';

/**
 * Router path that the chart mode mounts at. Single source of truth for any
 * code that needs to reference the route (the route file, the mode component's
 * `useNavigate` / `getRouteApi` calls, the shell's mode switcher).
 */
export const CHART_ROUTE_PATH = '/chart';

/**
 * Stable string identifiers for every chart-mode data layer. Used both as
 * the discriminator in the URL `layers` array and as the lookup key in the
 * layer-toggle UI. Order in this tuple does not affect map z-stack (that is
 * controlled by JSX child order in `chart-mode.tsx`).
 */
export const LAYER_IDS = ['airports', 'navaids', 'fixes', 'airways', 'airspace'] as const;

/**
 * Discriminated string-literal type for a single chart data layer.
 */
export type LayerId = (typeof LAYER_IDS)[number];

/**
 * User-facing airspace classes exposed by the layer toggle. `CLASS_E`
 * collapses the underlying `CLASS_E2` through `CLASS_E7` AirspaceType
 * variants into a single concept matching how pilots think about Class E
 * airspace; the others are 1:1 with their AirspaceType counterparts.
 */
export const AIRSPACE_CLASSES = [
  'CLASS_B',
  'CLASS_C',
  'CLASS_D',
  'CLASS_E',
  'MOA',
  'RESTRICTED',
  'PROHIBITED',
  'WARNING',
  'ALERT',
  'NSA',
  'ARTCC',
] as const;

/**
 * Discriminated string-literal type for a single user-facing airspace class.
 */
export type AirspaceClass = (typeof AIRSPACE_CLASSES)[number];

/**
 * Maps each user-facing airspace class to the underlying `AirspaceType`
 * values it covers. Used by the airspace layer to build a MapLibre `filter`
 * expression from the active `airspaceClasses` URL state. Class E expands
 * to all six E-stratum variants; the rest are identity mappings.
 */
export const AIRSPACE_CLASS_TYPES: Record<AirspaceClass, readonly AirspaceType[]> = {
  CLASS_B: ['CLASS_B'],
  CLASS_C: ['CLASS_C'],
  CLASS_D: ['CLASS_D'],
  CLASS_E: ['CLASS_E2', 'CLASS_E3', 'CLASS_E4', 'CLASS_E5', 'CLASS_E6', 'CLASS_E7'],
  MOA: ['MOA'],
  RESTRICTED: ['RESTRICTED'],
  PROHIBITED: ['PROHIBITED'],
  WARNING: ['WARNING'],
  ALERT: ['ALERT'],
  NSA: ['NSA'],
  ARTCC: ['ARTCC'],
};

/**
 * User-facing airway categories exposed by the layer toggle. Groups the
 * underlying `AirwayType` values into three buckets: low-altitude V-routes
 * and RNAV-T, high-altitude J-routes and RNAV-Q, and a combined
 * "oceanic & regional" bucket that covers the actual oceanic routes
 * (Atlantic, Bahama, Pacific, Puerto Rico) plus the small set of
 * Alaska / historical colored airways (GREEN, RED, AMBER, BLUE).
 *
 * The colored airways were originally proposed as their own bucket, but the
 * shipping US dataset only contains 7 of them - all in Alaska - so a
 * standalone "Colored" toggle was effectively empty for any user not
 * already looking at Alaska. Folding them into the regional bucket gives
 * them a sensible home without surprising the user.
 */
export const AIRWAY_CATEGORIES = ['LOW', 'HIGH', 'OCEANIC'] as const;

/**
 * Discriminated string-literal type for a single user-facing airway category.
 */
export type AirwayCategory = (typeof AIRWAY_CATEGORIES)[number];

/**
 * Maps each user-facing airway category to the underlying `AirwayType` values
 * it covers. Used by the airways layer to build a MapLibre `filter`
 * expression from the active `airwayCategories` URL state. `OCEANIC` is the
 * "oceanic & regional" catch-all and includes the Alaska / colored airways.
 */
export const AIRWAY_CATEGORY_TYPES: Record<AirwayCategory, readonly AirwayType[]> = {
  LOW: ['VICTOR', 'RNAV_T'],
  HIGH: ['JET', 'RNAV_Q'],
  OCEANIC: ['ATLANTIC', 'BAHAMA', 'PACIFIC', 'PUERTO_RICO', 'GREEN', 'RED', 'AMBER', 'BLUE'],
};

/**
 * Default chart-mode map view: continental US center at a zoom that shows the
 * full CONUS area, with every data layer and every sub-class enabled.
 */
export const CHART_DEFAULTS = {
  /** Default map center latitude in decimal degrees, positive north. */
  lat: 39.5,
  /** Default map center longitude in decimal degrees, positive east. */
  lon: -98.5,
  /** Default map zoom level. */
  zoom: 4,
  /** Default active layer set: every layer visible. */
  layers: LAYER_IDS,
  /** Default active airspace classes: every class visible. */
  airspaceClasses: AIRSPACE_CLASSES,
  /** Default active airway categories: every category visible. */
  airwayCategories: AIRWAY_CATEGORIES,
} as const;

/**
 * Zod schema validating the chart-mode search params. Encodes the map view
 * (center + zoom), the active layer set, and the active sub-class sets for
 * airspace and airways. Out-of-range, unknown, or otherwise invalid values
 * fall back to the matching default so stale share links keep working.
 */
export const chartSearchSchema = z.object({
  /** Map center latitude in decimal degrees, positive north. Range: [-90, 90]. */
  lat: z.number().min(-90).max(90).default(CHART_DEFAULTS.lat).catch(CHART_DEFAULTS.lat),
  /** Map center longitude in decimal degrees, positive east. Range: [-180, 180]. */
  lon: z.number().min(-180).max(180).default(CHART_DEFAULTS.lon).catch(CHART_DEFAULTS.lon),
  /** Map zoom level. Range: [0, 22] (MapLibre's supported zoom range). */
  zoom: z.number().min(0).max(22).default(CHART_DEFAULTS.zoom).catch(CHART_DEFAULTS.zoom),
  /**
   * Active layer set. Default is every layer enabled; an empty array is a
   * legitimate "basemap only" state and is preserved. Unknown ids or
   * non-array values fall back to the all-on default.
   */
  layers: z
    .array(z.enum(LAYER_IDS))
    .default([...CHART_DEFAULTS.layers])
    .catch([...CHART_DEFAULTS.layers]),
  /**
   * Active airspace classes (consulted only when `layers` includes `airspace`).
   * Default is every class enabled; an empty array yields a layer that renders
   * no features. Unknown ids or non-array values fall back to the default.
   */
  airspaceClasses: z
    .array(z.enum(AIRSPACE_CLASSES))
    .default([...CHART_DEFAULTS.airspaceClasses])
    .catch([...CHART_DEFAULTS.airspaceClasses]),
  /**
   * Active airway categories (consulted only when `layers` includes `airways`).
   * Default is every category enabled; an empty array yields a layer that
   * renders no features. Unknown ids or non-array values fall back to the
   * default.
   */
  airwayCategories: z
    .array(z.enum(AIRWAY_CATEGORIES))
    .default([...CHART_DEFAULTS.airwayCategories])
    .catch([...CHART_DEFAULTS.airwayCategories]),
});

/**
 * Validated chart-mode search params, inferred from {@link chartSearchSchema}.
 */
export type ChartSearch = z.infer<typeof chartSearchSchema>;
