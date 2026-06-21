import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react';

import { FOCUS_RING_INSET_CLASSES } from '../styles/style-tokens.ts';

/**
 * Props for {@link InspectorGrabHandle}.
 */
export interface InspectorGrabHandleProps {
  /** Whether the sheet is currently minimized; drives the accessible label. */
  minimized: boolean;
  /** Pointer-down handler that opens a drag session. */
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Pointer-move handler that tracks the drag. */
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Pointer-up handler that snaps and commits the drag. */
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Pointer-cancel handler that abandons the drag. */
  onPointerCancel: () => void;
  /** Click handler for tap and keyboard activation. */
  onClick: () => void;
}

/**
 * Mobile-only grab handle at the top of the inspector bottom sheet. Shows
 * a pill bar the user drags down to minimize the sheet or up to restore
 * it; tapping it (or activating it with the keyboard) toggles the same
 * state. Hidden at the `md` breakpoint and up, where the sheet becomes a
 * right-edge panel with a header chevron instead.
 *
 * The handler props come straight from `useSheetMinimizeDrag`; this
 * component owns only the markup, the `touch-action` reset that lets the
 * gesture own vertical movement, and the accessible labelling.
 *
 * @param props - The minimized flag and the pointer and click handlers.
 * @returns The grab-handle button.
 */
export function InspectorGrabHandle({
  minimized,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClick,
}: InspectorGrabHandleProps): ReactElement {
  return (
    <button
      type="button"
      className={`flex w-full touch-none items-center justify-center py-2.5 md:hidden ${FOCUS_RING_INSET_CLASSES}`}
      aria-label={minimized ? 'Expand inspector' : 'Minimize inspector'}
      aria-expanded={!minimized}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
    >
      <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
    </button>
  );
}
