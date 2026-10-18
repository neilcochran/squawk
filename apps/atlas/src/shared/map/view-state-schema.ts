import { z } from 'zod';

import { MAP_MAX_PITCH } from './map-canvas.tsx';

/**
 * Default map view every mode opens on: the continental US center at a zoom
 * that shows the whole CONUS area, flat. Shared so switching modes keeps a
 * familiar camera, and read by the view-reset listener as its target.
 */
export const MAP_VIEW_DEFAULTS = {
  /** Default map center latitude in decimal degrees, positive north. */
  lat: 39.5,
  /** Default map center longitude in decimal degrees, positive east. */
  lon: -98.5,
  /** Default map zoom level. */
  zoom: 4,
  /** Default map pitch in degrees. 0 is the flat / plan view. */
  pitch: 0,
} as const;

/**
 * Whether a map view is exactly {@link MAP_VIEW_DEFAULTS}: the camera of a
 * link that never set one, or one the user has not moved.
 *
 * @param view - The view's center, zoom and pitch.
 * @returns `true` when every field equals its default.
 */
export function isDefaultMapView(view: {
  /** Map center latitude in decimal degrees, positive north. */
  lat: number;
  /** Map center longitude in decimal degrees, positive east. */
  lon: number;
  /** Map zoom level. */
  zoom: number;
  /** Map pitch in degrees. */
  pitch: number;
}): boolean {
  return (
    view.lat === MAP_VIEW_DEFAULTS.lat &&
    view.lon === MAP_VIEW_DEFAULTS.lon &&
    view.zoom === MAP_VIEW_DEFAULTS.zoom &&
    view.pitch === MAP_VIEW_DEFAULTS.pitch
  );
}

/**
 * Zod fields validating the map view in a mode's search params, for each
 * mode's schema to spread in. Out-of-range or wrong-typed values fall back to
 * {@link MAP_VIEW_DEFAULTS} so stale share links keep working.
 */
export const mapViewSearchFields = {
  /** Map center latitude in decimal degrees, positive north. Range: [-90, 90]. */
  lat: z.number().min(-90).max(90).default(MAP_VIEW_DEFAULTS.lat).catch(MAP_VIEW_DEFAULTS.lat),
  /** Map center longitude in decimal degrees, positive east. Range: [-180, 180]. */
  lon: z.number().min(-180).max(180).default(MAP_VIEW_DEFAULTS.lon).catch(MAP_VIEW_DEFAULTS.lon),
  /** Map zoom level. Range: [0, 22] (MapLibre's supported zoom range). */
  zoom: z.number().min(0).max(22).default(MAP_VIEW_DEFAULTS.zoom).catch(MAP_VIEW_DEFAULTS.zoom),
  /**
   * Map pitch in degrees. Range: [0, MAP_MAX_PITCH] - matches the map
   * primitive's `maxPitch` so a stale URL with a value above the cap falls
   * back to the default rather than describing a camera the map will not
   * accept.
   */
  pitch: z
    .number()
    .min(0)
    .max(MAP_MAX_PITCH)
    .default(MAP_VIEW_DEFAULTS.pitch)
    .catch(MAP_VIEW_DEFAULTS.pitch),
};
