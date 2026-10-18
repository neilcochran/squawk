import { z } from 'zod';

import { MAP_VIEW_DEFAULTS, mapViewSearchFields } from '../../shared/map/view-state-schema.ts';

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
  ...MAP_VIEW_DEFAULTS,
  /** Default route string: empty until the user types one. */
  route: '',
} as const;

/** Slowest planning ground speed the URL accepts, in knots. */
export const PLAN_MIN_GROUND_SPEED_KT = 1;

/** Fastest planning ground speed the URL accepts, in knots. */
export const PLAN_MAX_GROUND_SPEED_KT = 2000;

/**
 * Zod schema validating the plan-mode search params. Encodes the map view
 * (center + zoom + pitch), the raw route string, and an optional planning
 * ground speed. Out-of-range, unknown, or otherwise invalid values fall back
 * to the matching default so stale share links keep working.
 */
export const planSearchSchema = z.object({
  ...mapViewSearchFields,
  /**
   * Raw flight-plan route string, e.g. `KSEA DCT SEA J70 GEP DCT KJFK`.
   * Default empty. Round-tripped through the URL so a planned route is
   * shareable; resolution happens at render time against the bundled data.
   */
  route: z.string().default(PLAN_DEFAULTS.route).catch(PLAN_DEFAULTS.route),
  /**
   * Optional planning ground speed in knots, used for the estimated time
   * enroute. Range [PLAN_MIN_GROUND_SPEED_KT, PLAN_MAX_GROUND_SPEED_KT];
   * absent (or invalid) means ETE is not shown. Kept separate from the route
   * string so changing speed does not rewrite the route.
   */
  gs: z
    .number()
    .min(PLAN_MIN_GROUND_SPEED_KT)
    .max(PLAN_MAX_GROUND_SPEED_KT)
    .optional()
    .catch(undefined),
});

/**
 * Validated plan-mode search params, inferred from {@link planSearchSchema}.
 */
export type PlanSearch = z.infer<typeof planSearchSchema>;
