import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-maplibre';

/**
 * Base name for the diagonal hatch pattern image used by the highlight
 * fill. The actual MapLibre image id is suffixed with the highlight
 * color so a theme switch registers a fresh image instead of reusing
 * the stale one from the previous palette - MapLibre's `hasImage`
 * short-circuit would otherwise keep the original color forever.
 */
const HATCH_IMAGE_BASE_ID = 'atlas-airspace-hatch';

/**
 * Builds the MapLibre image id for the hatch pattern, suffixed by the
 * highlight color so light and dark themes reference distinct images
 * and a theme switch never sees a stale color through `hasImage`.
 */
export function hatchImageId(highlightPrimary: string): string {
  return `${HATCH_IMAGE_BASE_ID}-${highlightPrimary}`;
}

/**
 * Registers the cross-hatch pattern image with the underlying MapLibre
 * map. The fill-pattern layer above references the image by name, so
 * the image must exist before the layer paints (MapLibre silently
 * skips fill-pattern when the image is missing, then re-paints once
 * it lands).
 *
 * The image id is suffixed by the highlight color, so a theme switch
 * registers a fresh image with the new color rather than reusing a
 * stale one through `hasImage`. Subscribes to `styledata` so the image
 * is re-registered if the style is reloaded (e.g. on basemap swap).
 */
export function useHatchPatternImage(imageId: string, primary: string): void {
  const map = useMap();
  const mapRef = map.current ?? map.default;
  useEffect((): (() => void) | undefined => {
    if (mapRef === undefined) {
      return undefined;
    }
    const m = mapRef.getMap();
    function ensurePattern(): void {
      if (m.hasImage(imageId)) {
        return;
      }
      const image = createHatchPatternImage(primary);
      if (image === undefined) {
        return;
      }
      m.addImage(imageId, image);
    }
    if (m.isStyleLoaded()) {
      ensurePattern();
    }
    m.on('styledata', ensurePattern);
    return (): void => {
      m.off('styledata', ensurePattern);
    };
  }, [mapRef, imageId, primary]);
}

/**
 * Builds an 8x8 cross-hatch pattern image (diagonal stripes in the
 * supplied stroke color on a transparent background) used as the
 * highlight fill. Returns undefined if the canvas 2D context is
 * unavailable (e.g. in a non-DOM test environment).
 */
function createHatchPatternImage(
  strokeColor: string,
): { width: number; height: number; data: Uint8Array } | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const size = 8;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    return undefined;
  }
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'square';
  // Three diagonal segments so the pattern tiles seamlessly across
  // adjacent 8x8 cells: the main diagonal plus the two corner wraps.
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.moveTo(-2, 2);
  ctx.lineTo(2, -2);
  ctx.moveTo(size - 2, size + 2);
  ctx.lineTo(size + 2, size - 2);
  ctx.stroke();
  const imageData = ctx.getImageData(0, 0, size, size);
  return { width: size, height: size, data: new Uint8Array(imageData.data) };
}
