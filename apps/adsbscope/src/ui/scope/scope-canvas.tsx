import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { ScopeSnapshot, ScopeVideoMap } from '../../shared/protocol.js';

import { fitCanvas } from './fit-canvas.js';
import { createViewport } from './projection.js';
import type { ScopeRenderer } from './renderer.js';
import styles from './scope-canvas.module.css';
import { readPxPerRem } from './units.js';

/** Props for {@link ScopeCanvas}. */
export interface ScopeCanvasProps {
  /** The view style to paint with. Swapping it takes effect on the next frame. */
  renderer: ScopeRenderer;
  /** Nautical miles from the center to the range circle. */
  rangeNm: number;
  /** The most recent snapshot from the server, or undefined before the first one arrives. */
  snapshot: ScopeSnapshot | undefined;
  /** The video map for the current range, or undefined until one has loaded. */
  videoMap: ScopeVideoMap | undefined;
  /** The current value of each of the active mode's settings, handed to the renderer with every frame. */
  settings: Readonly<Record<string, string>>;
}

/**
 * The scope itself: a canvas that fills its container and repaints every
 * animation frame with the current renderer. The frame loop is started once,
 * when the canvas element mounts, and reads the latest props through a ref,
 * so a new snapshot, map, range, or setting never restarts it.
 *
 * Whenever the window is resized the canvas is re-fitted to its new size and
 * pixel density, the rem scale is re-read, and the renderer is reset - so the
 * scope follows a window resize, a device rotation, a browser zoom, or a
 * change of font size without any of them being handled specially.
 */
export function ScopeCanvas({
  renderer,
  rangeNm,
  snapshot,
  videoMap,
  settings,
}: ScopeCanvasProps): ReactElement {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const latest = useRef({ renderer, rangeNm, snapshot, videoMap, settings });

  useEffect(() => {
    latest.current = { renderer, rangeNm, snapshot, videoMap, settings };
  }, [renderer, rangeNm, snapshot, videoMap, settings]);

  useEffect(() => {
    renderer.reset();
  }, [renderer]);

  useEffect(() => {
    const context = canvas?.getContext('2d') ?? null;
    if (canvas === null || context === null) {
      return undefined;
    }
    const scopeCanvas = canvas;
    const scopeContext = context;

    let size = fitCanvas(scopeCanvas, scopeContext, window.devicePixelRatio);
    let pxPerRem = readPxPerRem(document.documentElement);
    function handleResize(): void {
      size = fitCanvas(scopeCanvas, scopeContext, window.devicePixelRatio);
      pxPerRem = readPxPerRem(document.documentElement);
      latest.current.renderer.reset();
    }
    window.addEventListener('resize', handleResize);

    let frameHandle = 0;
    function paint(frameTimeMs: number): void {
      const current = latest.current;
      current.renderer.render(scopeContext, {
        viewport: createViewport(size.widthPx, size.heightPx, current.rangeNm, pxPerRem),
        rangeNm: current.rangeNm,
        snapshot: current.snapshot,
        videoMap: current.videoMap,
        frameTimeMs,
        settings: current.settings,
      });
      frameHandle = window.requestAnimationFrame(paint);
    }
    frameHandle = window.requestAnimationFrame(paint);

    return (): void => {
      window.cancelAnimationFrame(frameHandle);
      window.removeEventListener('resize', handleResize);
    };
  }, [canvas]);

  return <canvas ref={setCanvas} className={styles.scopeCanvas} aria-label="Radar scope" />;
}
