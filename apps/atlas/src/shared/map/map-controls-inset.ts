/**
 * The zoom / tilt control stack's published reach into the map from its left
 * edge, which the camera's framing reads so a fitted route or feature never
 * lands under the controls. The controls write it on `documentElement` while
 * mounted; this module owns the property name and the reader so writer and
 * readers cannot drift.
 *
 * Pixels (`Px`) because the value feeds MapLibre's `fitBounds` padding.
 */

/**
 * Custom property on `documentElement` carrying how far the map controls
 * reach in from the map's left edge, in pixels: their left offset plus their
 * width. `index.css` defaults it to 0px for when no controls are mounted.
 */
export const MAP_CONTROLS_INSET_CSS_VAR = '--atlas-map-controls-inset';

/**
 * The map controls' published reach in from the map's left edge, in pixels,
 * read from {@link MAP_CONTROLS_INSET_CSS_VAR}. Falls back to `0` when no
 * controls have published a pixel value.
 *
 * @returns The controls' right edge measured from the map's left edge, in pixels.
 */
export function readPublishedMapControlsInsetPx(): number {
  if (typeof document === 'undefined') {
    return 0;
  }
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(MAP_CONTROLS_INSET_CSS_VAR)
    .trim();
  const insetPx = raw.endsWith('px') ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(insetPx) ? insetPx : 0;
}
