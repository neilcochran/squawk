import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent, ReactElement } from 'react';

import { SIDE_PANEL_WIDTH_CSS_VAR } from './side-panel-width.ts';
import type { SidePanelWidth } from './use-side-panel-width.ts';

/** Pixels one arrow-key press moves the panel edge. */
const KEY_STEP_PX = 16;

/** Pixels one Shift + arrow-key press moves the panel edge. */
const KEY_STEP_LARGE_PX = 64;

/**
 * Props for {@link SidePanelResizeHandle}.
 */
export interface SidePanelResizeHandleProps {
  /** The panel's width state from `useSidePanelWidth`. */
  width: SidePanelWidth;
  /** Accessible name for the separator (e.g. "Resize inspector"). */
  label: string;
}

/**
 * Vertical separator on the left edge of a right-edge side panel that the
 * user drags to resize the panel, following the WAI-ARIA window-splitter
 * pattern. Rendered as a sibling of the panel, positioned at
 * `--atlas-side-panel-width` from the right, so it stays put while the panel
 * scrolls. Desktop only: below the `md:` breakpoint the panels are bottom
 * sheets.
 *
 * Dragging previews the width live and persists it on release. Arrow keys
 * move the edge by {@link KEY_STEP_PX} (or {@link KEY_STEP_LARGE_PX} with
 * Shift), Home and End jump to the narrowest and widest widths, and a
 * double-click resets the default.
 */
export function SidePanelResizeHandle({ width, label }: SidePanelResizeHandleProps): ReactElement {
  const dragRef = useRef<{ startX: number; startWidthPx: number } | undefined>(undefined);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
      return;
    }
    // Keeps the drag from selecting text, which also suppresses the focus a
    // press would give, so focus the separator directly for the arrow keys.
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startWidthPx: width.widthPx };
  }

  // The panel is anchored on the right, so moving the edge left widens it.
  function widthAt(clientX: number): number | undefined {
    const drag = dragRef.current;
    return drag === undefined ? undefined : drag.startWidthPx + (drag.startX - clientX);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    const next = widthAt(event.clientX);
    if (next !== undefined) {
      width.previewWidthPx(next);
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    const next = widthAt(event.clientX);
    dragRef.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (next !== undefined) {
      width.commitWidthPx(next);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const step = event.shiftKey ? KEY_STEP_LARGE_PX : KEY_STEP_PX;
    let next: number | undefined;
    switch (event.key) {
      case 'ArrowLeft':
        next = width.widthPx + step;
        break;
      case 'ArrowRight':
        next = width.widthPx - step;
        break;
      case 'Home':
        next = width.minWidthPx;
        break;
      case 'End':
        next = width.maxWidthPx;
        break;
      default:
        return;
    }
    event.preventDefault();
    width.commitWidthPx(next);
  }

  return (
    // A focusable separator carrying aria-valuenow is the WAI-ARIA window
    // splitter widget, which takes keyboard focus and input; the jsx-a11y
    // rules treat every separator as a static divider.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width.widthPx}
      aria-valuemin={width.minWidthPx}
      aria-valuemax={width.maxWidthPx}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the splitter takes focus (see above)
      tabIndex={0}
      title="Drag to resize; double-click to reset"
      style={{ right: `var(${SIDE_PANEL_WIDTH_CSS_VAR})` }}
      className="group absolute top-0 bottom-0 z-30 hidden w-2 translate-x-1/2 cursor-col-resize touch-none focus:outline-none md:block"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      onDoubleClick={width.resetWidth}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-transparent transition-colors group-hover:bg-indigo-400 group-focus-visible:bg-indigo-500 dark:group-hover:bg-indigo-500 dark:group-focus-visible:bg-indigo-400"
      />
    </div>
  );
}
