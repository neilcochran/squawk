import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { resolveSheetSnap } from './inspector-sheet.ts';

/**
 * Distance in pixels a pointer must travel from its press point before a
 * sheet drag activates. Below this the gesture is treated as a tap (which
 * toggles through the click handler) rather than a drag, so a small finger
 * jitter on press never starts sliding the sheet.
 */
const DRAG_ACTIVATION_SLOP_PX = 6;

/**
 * Minimal read-only ref shape the drag hook needs: just the current
 * element, or `null` before the ref attaches. Declared structurally so
 * callers can pass precisely-typed refs (an `HTMLDivElement` ref, say)
 * without a cast.
 */
interface MeasurableRef {
  /** The measured element, or `null` before mount. */
  readonly current: HTMLElement | null;
}

/**
 * Mutable per-gesture state captured at pointer-down and read by the move
 * and up handlers. Held in a ref so updates never trigger a re-render
 * mid-drag.
 */
interface DragSession {
  /** Pointer Y at press, in client pixels. Drag delta is measured from here. */
  startY: number;
  /** Slide range in pixels: the sheet height minus the peek height. */
  maxOffset: number;
  /**
   * Offset the sheet sat at when the gesture began: `0` when expanded,
   * `maxOffset` when minimized.
   */
  baseOffset: number;
  /** Whether movement has crossed the slop and the drag is now live. */
  active: boolean;
}

/**
 * Inputs for {@link useSheetMinimizeDrag}.
 */
export interface UseSheetMinimizeDragParams {
  /** Whether the sheet is currently committed to the minimized state. */
  minimized: boolean;
  /**
   * Commits a new minimized state on release or tap, called with the snap
   * target the gesture resolved to.
   */
  onMinimizedChange: (minimized: boolean) => void;
  /** Ref to the sheet element whose full height bounds the slide range. */
  asideRef: MeasurableRef;
  /** Ref to the always-visible peek region subtracted from the slide range. */
  peekRef: MeasurableRef;
}

/**
 * Outputs of {@link useSheetMinimizeDrag}.
 */
export interface UseSheetMinimizeDragResult {
  /**
   * Live drag offset in pixels while a drag is active, or `undefined`
   * when no drag is in progress (the sheet then rests at its committed
   * position). Drives the inline translate so the sheet tracks the finger
   * 1:1 with the CSS transition suppressed.
   */
  dragOffsetPx: number | undefined;
  /** Pointer-down handler for the grab handle. */
  handlePointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Pointer-move handler; activates and tracks the drag past the slop. */
  handlePointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Pointer-up handler; snaps to the nearest state and commits it. */
  handlePointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Pointer-cancel handler; abandons the drag without committing. */
  handlePointerCancel: () => void;
  /**
   * Click handler for the grab handle. Toggles the minimized state for a
   * tap or keyboard activation, but is suppressed after a real drag so the
   * synthetic click that follows pointer-up does not toggle a second time.
   */
  handleClick: () => void;
}

/**
 * Hand-rolled pointer-drag for the inspector bottom sheet on touch
 * layouts. A downward drag past a third of the slide range minimizes the
 * sheet; an upward drag past a third restores it; anything short reverts
 * to where it started. A tap (or keyboard activation, which arrives as a
 * click) toggles the state outright.
 *
 * The gesture is movement-gated: nothing slides until the pointer crosses
 * {@link DRAG_ACTIVATION_SLOP_PX}, so a press that turns out to be a tap
 * never nudges the sheet. Once active the pointer is captured so the drag
 * keeps tracking even if the finger leaves the handle. Snap decisions
 * defer to the pure {@link resolveSheetSnap}.
 *
 * @param params - Current state, the commit callback, and the sheet and
 * peek refs used to measure the slide range.
 * @returns The live drag offset plus the pointer and click handlers to
 * spread onto the grab handle.
 */
export function useSheetMinimizeDrag(
  params: UseSheetMinimizeDragParams,
): UseSheetMinimizeDragResult {
  const { minimized, onMinimizedChange, asideRef, peekRef } = params;
  const [dragOffsetPx, setDragOffsetPx] = useState<number | undefined>(undefined);
  const sessionRef = useRef<DragSession | undefined>(undefined);
  // Set on pointer-up after a real drag and consumed by the click the
  // browser synthesizes from the same gesture, so a drag is never also
  // counted as a tap. Reset on the next pointer-down in case no click
  // follows (touch does not always synthesize one).
  const suppressClickRef = useRef(false);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (!event.isPrimary || event.button !== 0) {
        return;
      }
      suppressClickRef.current = false;
      const aside = asideRef.current;
      const peek = peekRef.current;
      if (aside === null || peek === null) {
        return;
      }
      const maxOffset = Math.max(aside.offsetHeight - peek.offsetHeight, 0);
      sessionRef.current = {
        startY: event.clientY,
        maxOffset,
        baseOffset: minimized ? maxOffset : 0,
        active: false,
      };
    },
    [asideRef, peekRef, minimized],
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>): void => {
    const session = sessionRef.current;
    if (session === undefined) {
      return;
    }
    const delta = event.clientY - session.startY;
    if (!session.active) {
      if (Math.abs(delta) <= DRAG_ACTIVATION_SLOP_PX) {
        return;
      }
      session.active = true;
      if (typeof event.currentTarget.setPointerCapture === 'function') {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
    const offset = Math.min(Math.max(session.baseOffset + delta, 0), session.maxOffset);
    setDragOffsetPx(offset);
  }, []);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const session = sessionRef.current;
      sessionRef.current = undefined;
      if (session === undefined || !session.active) {
        return;
      }
      const delta = event.clientY - session.startY;
      const offset = Math.min(Math.max(session.baseOffset + delta, 0), session.maxOffset);
      const snap = resolveSheetSnap({
        offsetPx: offset,
        maxOffsetPx: session.maxOffset,
        startedMinimized: minimized,
      });
      suppressClickRef.current = true;
      setDragOffsetPx(undefined);
      onMinimizedChange(snap === 'minimized');
    },
    [minimized, onMinimizedChange],
  );

  const handlePointerCancel = useCallback((): void => {
    sessionRef.current = undefined;
    setDragOffsetPx(undefined);
  }, []);

  const handleClick = useCallback((): void => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onMinimizedChange(!minimized);
  }, [minimized, onMinimizedChange]);

  return {
    dragOffsetPx,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleClick,
  };
}
