/**
 * Width bounds, clamping, persistence and the published-width reader for a
 * resizable right-edge side panel (the chart-mode entity inspector, the
 * plan-mode summary panel). A panel keeps its width per browser under its
 * own storage key and publishes the live width on `documentElement` as
 * {@link SIDE_PANEL_WIDTH_CSS_VAR}, which the panel itself and the camera's
 * occlusion math read, and as {@link SIDE_PANEL_OPEN_WIDTH_CSS_VAR} while it
 * is on screen, which the overlays placed beside it read. Only one side panel
 * is mounted at a time (each belongs to one mode), so they share the
 * variables.
 *
 * Widths are pixels (`Px`) because they come from and go to pixel-space APIs:
 * pointer `clientX`, `window.innerWidth`, and MapLibre's camera offset.
 */

/**
 * Custom property on `documentElement` carrying the mounted side panel's
 * desktop width in pixels. `index.css` defaults it to 22.5rem so layout is
 * right before any panel mounts.
 */
export const SIDE_PANEL_WIDTH_CSS_VAR = '--atlas-side-panel-width';

/**
 * Custom property on `documentElement` carrying the side panel's desktop width
 * in pixels while the panel is on screen, so overlays beside it (the chart
 * search box, the plan route input) narrow to stay clear of it. `index.css`
 * defaults it to 0px, which is what it reads while no panel is showing.
 */
export const SIDE_PANEL_OPEN_WIDTH_CSS_VAR = '--atlas-side-panel-open-width';

/** Default desktop side-panel width: the `index.css` default of 22.5rem at a 16px root. */
export const SIDE_PANEL_DEFAULT_WIDTH_PX = 360;

/** Narrowest a user can drag a side panel (20rem at a 16px root). */
export const SIDE_PANEL_MIN_WIDTH_PX = 320;

/** Widest a user can drag a side panel (40rem at a 16px root), before the viewport cap. */
export const SIDE_PANEL_MAX_WIDTH_PX = 640;

/** Largest share of the viewport width a side panel may take, so the map stays usable. */
export const SIDE_PANEL_MAX_VIEWPORT_FRACTION = 0.6;

/**
 * Clamps a requested side-panel width to the allowed range for a viewport:
 * no narrower than {@link SIDE_PANEL_MIN_WIDTH_PX}, and no wider than the
 * smaller of {@link SIDE_PANEL_MAX_WIDTH_PX} and
 * {@link SIDE_PANEL_MAX_VIEWPORT_FRACTION} of the viewport. On a viewport too
 * narrow for even the minimum, the minimum wins. The result is rounded to a
 * whole pixel.
 *
 * @param widthPx - The requested width in pixels.
 * @param viewportWidthPx - The viewport width in pixels.
 * @returns The width the panel may take.
 */
export function clampSidePanelWidthPx(widthPx: number, viewportWidthPx: number): number {
  const maxPx = Math.max(
    SIDE_PANEL_MIN_WIDTH_PX,
    Math.min(
      SIDE_PANEL_MAX_WIDTH_PX,
      Math.floor(viewportWidthPx * SIDE_PANEL_MAX_VIEWPORT_FRACTION),
    ),
  );
  return Math.round(Math.min(maxPx, Math.max(SIDE_PANEL_MIN_WIDTH_PX, widthPx)));
}

/**
 * Reads a side panel's persisted width from localStorage. Returns `undefined`
 * when storage is unavailable, the key is unset, or the stored value is not a
 * finite number, so the caller falls back to the default.
 *
 * @param storageKey - The panel's localStorage key.
 * @returns The stored width in pixels, unclamped, or `undefined`.
 */
export function readStoredSidePanelWidthPx(storageKey: string): number | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return undefined;
  }
  if (raw === null) {
    return undefined;
  }
  const widthPx = Number(raw);
  return Number.isFinite(widthPx) ? widthPx : undefined;
}

/**
 * Persists a side panel's width to localStorage, or clears it when `undefined`
 * so the panel returns to the default. Swallows quota and disabled-storage
 * errors: the width still applies for the session, it just does not survive a
 * reload.
 *
 * @param storageKey - The panel's localStorage key.
 * @param widthPx - The width to keep, or `undefined` to forget it.
 */
export function writeStoredSidePanelWidthPx(storageKey: string, widthPx: number | undefined): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (widthPx === undefined) {
      window.localStorage.removeItem(storageKey);
    } else {
      window.localStorage.setItem(storageKey, String(widthPx));
    }
  } catch {
    // Storage disabled or full - the in-session width still applies.
  }
}

/**
 * The mounted side panel's live desktop width in pixels, read from
 * {@link SIDE_PANEL_WIDTH_CSS_VAR} on `documentElement`. Falls back to
 * {@link SIDE_PANEL_DEFAULT_WIDTH_PX} when no panel has published a pixel
 * width (the variable then holds the rem default from `index.css`).
 *
 * @returns The side panel's width in pixels.
 */
export function readPublishedSidePanelWidthPx(): number {
  if (typeof document === 'undefined') {
    return SIDE_PANEL_DEFAULT_WIDTH_PX;
  }
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(SIDE_PANEL_WIDTH_CSS_VAR)
    .trim();
  const widthPx = raw.endsWith('px') ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(widthPx) ? widthPx : SIDE_PANEL_DEFAULT_WIDTH_PX;
}
