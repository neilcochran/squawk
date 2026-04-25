import { z } from 'zod';

/**
 * Router path that the chart mode mounts at. Single source of truth for any
 * code that needs to reference the route (the route file, the mode component's
 * `useNavigate` / `getRouteApi` calls, the shell's mode switcher).
 */
export const CHART_ROUTE_PATH = '/chart';

/**
 * Default chart-mode map view, centered over the continental US at a zoom that
 * shows the full CONUS area.
 */
export const CHART_DEFAULTS = {
  /** Default map center latitude in decimal degrees, positive north. */
  lat: 39.5,
  /** Default map center longitude in decimal degrees, positive east. */
  lon: -98.5,
  /** Default map zoom level. */
  zoom: 4,
} as const;

/**
 * Zod schema validating the chart-mode search params. v0 only encodes the map
 * view; later phases extend this with active layer set and selected entity.
 * Out-of-range or otherwise invalid values fall back to the matching default.
 */
export const chartSearchSchema = z.object({
  /** Map center latitude in decimal degrees, positive north. Range: [-90, 90]. */
  lat: z.number().min(-90).max(90).default(CHART_DEFAULTS.lat).catch(CHART_DEFAULTS.lat),
  /** Map center longitude in decimal degrees, positive east. Range: [-180, 180]. */
  lon: z.number().min(-180).max(180).default(CHART_DEFAULTS.lon).catch(CHART_DEFAULTS.lon),
  /** Map zoom level. Range: [0, 22] (MapLibre's supported zoom range). */
  zoom: z.number().min(0).max(22).default(CHART_DEFAULTS.zoom).catch(CHART_DEFAULTS.zoom),
});

/**
 * Validated chart-mode search params, inferred from {@link chartSearchSchema}.
 */
export type ChartSearch = z.infer<typeof chartSearchSchema>;
