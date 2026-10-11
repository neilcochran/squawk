import { z } from 'zod';

import { MAP_MAX_PITCH } from '../../shared/map/map-canvas.tsx';

/**
 * Router path that plan mode mounts at. Single source of truth for any code
 * that needs to reference the route (the route file, the mode component's
 * `useNavigate` / `getRouteApi` calls, the shell's mode switcher).
 */
export const PLAN_ROUTE_PATH = '/plan';

/**
 * Default plan-mode state: the CONUS-centered map view shared with chart
 * mode (so switching modes keeps a familiar camera) and an empty route. The
 * route string starts blank - the input prompts the user - and no ground
 * speed is set until the user enters one, so ETE stays hidden initially.
 */
export const PLAN_DEFAULTS = {
  /** Default map center latitude in decimal degrees, positive north. */
  lat: 39.5,
  /** Default map center longitude in decimal degrees, positive east. */
  lon: -98.5,
  /** Default map zoom level. */
  zoom: 4,
  /** Default map pitch in degrees. 0 is the flat / plan view. */
  pitch: 0,
  /** Default route string: empty until the user types one. */
  route: '',
} as const;

/**
 * Zod schema validating the plan-mode search params. Encodes the map view
 * (center + zoom + pitch), the raw route string, and an optional planning
 * ground speed. Out-of-range, unknown, or otherwise invalid values fall back
 * to the matching default so stale share links keep working.
 */
export const planSearchSchema = z.object({
  /** Map center latitude in decimal degrees, positive north. Range: [-90, 90]. */
  lat: z.number().min(-90).max(90).default(PLAN_DEFAULTS.lat).catch(PLAN_DEFAULTS.lat),
  /** Map center longitude in decimal degrees, positive east. Range: [-180, 180]. */
  lon: z.number().min(-180).max(180).default(PLAN_DEFAULTS.lon).catch(PLAN_DEFAULTS.lon),
  /** Map zoom level. Range: [0, 22] (MapLibre's supported zoom range). */
  zoom: z.number().min(0).max(22).default(PLAN_DEFAULTS.zoom).catch(PLAN_DEFAULTS.zoom),
  /**
   * Map pitch in degrees. Range: [0, MAP_MAX_PITCH] - matches the map
   * primitive's `maxPitch` so a stale URL with a value above the cap clamps
   * to the default rather than landing somewhere the camera will then clip
   * on next interaction.
   */
  pitch: z
    .number()
    .min(0)
    .max(MAP_MAX_PITCH)
    .default(PLAN_DEFAULTS.pitch)
    .catch(PLAN_DEFAULTS.pitch),
  /**
   * Raw flight-plan route string, e.g. `KLAX DCT LAX J60 SAX DCT KJFK`.
   * Default empty. Round-tripped through the URL so a planned route is
   * shareable; resolution happens at render time against the bundled data.
   */
  route: z.string().default(PLAN_DEFAULTS.route).catch(PLAN_DEFAULTS.route),
  /**
   * Optional planning ground speed in knots, used for the estimated time
   * enroute. Range [1, 2000]; absent (or invalid) means ETE is not shown.
   * Kept separate from the route string so changing speed does not rewrite
   * the route.
   */
  gs: z.number().min(1).max(2000).optional().catch(undefined),
});

/**
 * Validated plan-mode search params, inferred from {@link planSearchSchema}.
 */
export type PlanSearch = z.infer<typeof planSearchSchema>;
