/** The CSS-pixel size a canvas was fitted to. */
export interface CanvasSize {
  /** Width in CSS pixels. */
  widthPx: number;
  /** Height in CSS pixels. */
  heightPx: number;
}

/**
 * Sizes a canvas's backing store to its laid-out CSS size times the device
 * pixel ratio, and scales the context to match, so drawing code works in CSS
 * pixels and still comes out sharp on a high-density display.
 *
 * @param canvas - The canvas to fit. Its CSS size is read from `clientWidth`/`clientHeight`.
 * @param context - The canvas's 2D context.
 * @param devicePixelRatio - Device pixels per CSS pixel.
 * @returns The CSS-pixel size the canvas was fitted to.
 */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  devicePixelRatio: number,
): CanvasSize {
  const widthPx = canvas.clientWidth;
  const heightPx = canvas.clientHeight;
  canvas.width = Math.round(widthPx * devicePixelRatio);
  canvas.height = Math.round(heightPx * devicePixelRatio);
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  return { widthPx, heightPx };
}
