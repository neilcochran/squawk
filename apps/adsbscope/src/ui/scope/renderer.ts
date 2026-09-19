import type { ScopeSnapshot } from '../../shared/protocol.js';

import type { ScopeViewport } from './projection.js';

/** Everything a renderer needs to paint one frame. */
export interface ScopeFrame {
  /** The mapping from scope coordinates to the canvas. */
  viewport: ScopeViewport;
  /** Nautical miles from the center to the range circle. */
  rangeNm: number;
  /** The most recent snapshot from the server, or undefined before the first one arrives. */
  snapshot: ScopeSnapshot | undefined;
  /** Monotonic time of this frame in ms, as passed to `requestAnimationFrame` callbacks. */
  frameTimeMs: number;
  /** The current value of each of the active mode's settings, keyed by setting id. */
  settings: Readonly<Record<string, string>>;
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
}
