import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

import {
  SIDE_PANEL_DEFAULT_WIDTH_PX,
  SIDE_PANEL_MIN_WIDTH_PX,
  SIDE_PANEL_OPEN_WIDTH_CSS_VAR,
  SIDE_PANEL_WIDTH_CSS_VAR,
  clampSidePanelWidthPx,
  readStoredSidePanelWidthPx,
  writeStoredSidePanelWidthPx,
} from './side-panel-width.ts';

/**
 * A resizable side panel's width state, as returned by
 * {@link useSidePanelWidth} and consumed by `SidePanelResizeHandle`.
 */
export interface SidePanelWidth {
  /** The panel's current desktop width in pixels, clamped to the viewport. */
  widthPx: number;
  /** Narrowest the panel may be dragged, in pixels. */
  minWidthPx: number;
  /** Widest the panel may be dragged on the current viewport, in pixels. */
  maxWidthPx: number;
  /** Applies a width for the session without persisting it, as a drag in progress does. */
  previewWidthPx: (widthPx: number) => void;
  /** Applies a width and persists it for this browser, as the end of a drag or a key press does. */
  commitWidthPx: (widthPx: number) => void;
  /** Returns the panel to the default width and forgets the stored one. */
  resetWidth: () => void;
}

/**
 * Width state for a right-edge side panel the user can resize, persisted per
 * browser under `storageKey`. The width is clamped to the side-panel bounds
 * for the current viewport (re-clamped as the window resizes, without losing
 * the width the user chose) and published on `documentElement` as
 * `--atlas-side-panel-width` while the panel is mounted, so the panel's own
 * `md:w-(--atlas-side-panel-width)` and the camera's occlusion offset follow
 * it, even while the panel is closed and about to open. While the panel is
 * also on screen the width is published as `--atlas-side-panel-open-width`,
 * which the overlays beside the panel read so they narrow only while there
 * is a panel to clear. Unmounting removes both properties, returning
 * everything to the `index.css` defaults.
 *
 * Pair with `SidePanelResizeHandle` for the drag and keyboard interaction.
 *
 * @param storageKey - localStorage key for this panel's width; versioned, e.g. `atlas:inspector:width:v1`.
 * @param open - Whether the panel is on screen, expanded or minimized. Defaults to `true` for a panel that always shows.
 * @returns The width and the setters the resize handle drives.
 */
export function useSidePanelWidth(storageKey: string, open = true): SidePanelWidth {
  const [chosenWidthPx, setChosenWidthPx] = useState<number | undefined>(() =>
    readStoredSidePanelWidthPx(storageKey),
  );
  const [viewportPx, setViewportPx] = useState<number>(() => window.innerWidth);

  useEffect(() => {
    function handleResize(): void {
      setViewportPx(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    return (): void => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const widthPx = clampSidePanelWidthPx(chosenWidthPx ?? SIDE_PANEL_DEFAULT_WIDTH_PX, viewportPx);
  const maxWidthPx = clampSidePanelWidthPx(Number.POSITIVE_INFINITY, viewportPx);

  // Written before paint so the panel, the overlays beside it and the camera
  // never see a frame of the old width.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(SIDE_PANEL_WIDTH_CSS_VAR, `${widthPx}px`);
    return (): void => {
      root.style.removeProperty(SIDE_PANEL_WIDTH_CSS_VAR);
    };
  }, [widthPx]);

  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }
    const root = document.documentElement;
    root.style.setProperty(SIDE_PANEL_OPEN_WIDTH_CSS_VAR, `${widthPx}px`);
    return (): void => {
      root.style.removeProperty(SIDE_PANEL_OPEN_WIDTH_CSS_VAR);
    };
  }, [open, widthPx]);

  const previewWidthPx = useCallback(
    (nextPx: number): void => {
      setChosenWidthPx(clampSidePanelWidthPx(nextPx, viewportPx));
    },
    [viewportPx],
  );

  const commitWidthPx = useCallback(
    (nextPx: number): void => {
      const clamped = clampSidePanelWidthPx(nextPx, viewportPx);
      setChosenWidthPx(clamped);
      writeStoredSidePanelWidthPx(storageKey, clamped);
    },
    [storageKey, viewportPx],
  );

  const resetWidth = useCallback((): void => {
    setChosenWidthPx(undefined);
    writeStoredSidePanelWidthPx(storageKey, undefined);
  }, [storageKey]);

  return {
    widthPx,
    minWidthPx: SIDE_PANEL_MIN_WIDTH_PX,
    maxWidthPx,
    previewWidthPx,
    commitWidthPx,
    resetWidth,
  };
}
