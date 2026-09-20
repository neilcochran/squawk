import type { ScopeSnapshot, ScopeVideoMap } from '../../shared/protocol.js';

import type { ScopeViewport, ScreenPoint } from './projection.js';

/** Everything a renderer needs to paint one frame. */
export interface ScopeFrame {
  /** The mapping from scope coordinates to the canvas. */
  viewport: ScopeViewport;
  /** Nautical miles from the center to the range circle. */
  rangeNm: number;
  /** The most recent snapshot from the server, or undefined before the first one arrives. */
  snapshot: ScopeSnapshot | undefined;
  /** The video map for the current range, or undefined until one has loaded. Whether it is drawn is up to the renderer's settings. */
  videoMap: ScopeVideoMap | undefined;
  /** Monotonic time of this frame in ms, as passed to `requestAnimationFrame` callbacks. */
  frameTimeMs: number;
  /** The current value of each of the active mode's settings, keyed by setting id. */
  settings: Readonly<Record<string, string>>;
  /** The ICAO hex of the selected aircraft, or undefined if none is selected. */
  selectedIcaoHex: string | undefined;
}

/**
 * Paints the scope in one view style. Each style is one implementation, and
 * the canvas swaps between them while running. A renderer may keep state
 * between frames (an analog sweep's angle, its fading blips), which `reset`
 * discards.
 */
export interface ScopeRenderer {
  /**
   * Paints one frame. The context is already scaled so that one unit is one
   * CSS pixel.
   */
  render(context: CanvasRenderingContext2D, frame: ScopeFrame): void;
  /** Discards any state carried between frames, as when the renderer is switched to or the canvas is resized. */
  reset(): void;
  /**
   * Finds the aircraft whose data block or tag, as last drawn, covers a point,
   * so that a click on one selects the aircraft it describes.
   *
   * @param point - The point, in canvas CSS pixels.
   * @returns The ICAO hex of the aircraft, or undefined if no block or tag is under the point.
   */
  pickDataBlock(point: ScreenPoint): string | undefined;
}
