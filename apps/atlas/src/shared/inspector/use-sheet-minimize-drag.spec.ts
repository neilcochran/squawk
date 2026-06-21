import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { useSheetMinimizeDrag } from './use-sheet-minimize-drag.ts';
import type { UseSheetMinimizeDragParams } from './use-sheet-minimize-drag.ts';

/**
 * Builds a measurable ref backed by a real element with a fixed
 * `offsetHeight`. jsdom reports `offsetHeight` as 0 for every element, so
 * the drag hook (which sizes its slide range from the sheet and peek
 * heights) needs the value forced via `defineProperty` to exercise the
 * range math at all.
 */
function measurableRef(offsetHeight: number): { current: HTMLElement } {
  const element = document.createElement('div');
  Object.defineProperty(element, 'offsetHeight', { value: offsetHeight, configurable: true });
  return { current: element };
}

/**
 * Per-event overrides for {@link pointerEvent}. Every field defaults to a
 * primary, left-button press so a test only states the bits it cares
 * about (usually just `clientY`).
 */
interface PointerEventOptions {
  /** Whether this is the primary pointer; the down handler ignores others. */
  isPrimary?: boolean;
  /** Pressed button; the down handler only opens a session for button 0. */
  button?: number;
  /** Pointer Y in client pixels, the value the drag delta is measured from. */
  clientY?: number;
  /** Pointer id forwarded to `setPointerCapture` on activation. */
  pointerId?: number;
  /** Capture hook on the event target, or `undefined` to omit the API. */
  setPointerCapture?: ((pointerId: number) => void) | undefined;
}

/**
 * Constructs the minimal synthetic pointer event the drag handlers read:
 * the `isPrimary` / `button` guards, the `clientY` delta source, the
 * `pointerId`, and a `currentTarget.setPointerCapture` the activation path
 * may invoke.
 */
function pointerEvent(options: PointerEventOptions = {}): ReactPointerEvent<HTMLElement> {
  const {
    isPrimary = true,
    button = 0,
    clientY = 0,
    pointerId = 1,
    setPointerCapture = vi.fn(),
  } = options;
  return {
    isPrimary,
    button,
    clientY,
    pointerId,
    currentTarget: { setPointerCapture },
  } as unknown as ReactPointerEvent<HTMLElement>;
}

/**
 * Builds the hook params with a 480px sheet over a 64px peek (a 416px
 * slide range) merged with per-test overrides.
 */
function dragParams(
  overrides: Partial<UseSheetMinimizeDragParams> = {},
): UseSheetMinimizeDragParams {
  return {
    minimized: false,
    onMinimizedChange: vi.fn(),
    asideRef: measurableRef(480),
    peekRef: measurableRef(64),
    ...overrides,
  };
}

/** Renders the hook with stable params (refs are built once for the render). */
function renderDrag(params: UseSheetMinimizeDragParams) {
  return renderHook((props: UseSheetMinimizeDragParams) => useSheetMinimizeDrag(props), {
    initialProps: params,
  });
}

describe('useSheetMinimizeDrag', () => {
  it('ignores non-primary and secondary-button presses', () => {
    const { result } = renderDrag(dragParams());

    act(() => result.current.handlePointerDown(pointerEvent({ isPrimary: false })));
    act(() => result.current.handlePointerMove(pointerEvent({ clientY: 100 })));
    expect(result.current.dragOffsetPx).toBeUndefined();

    act(() => result.current.handlePointerDown(pointerEvent({ button: 1 })));
    act(() => result.current.handlePointerMove(pointerEvent({ clientY: 100 })));
    expect(result.current.dragOffsetPx).toBeUndefined();
  });

  it('ignores a press before the sheet or peek refs are measured', () => {
    const onMinimizedChange = vi.fn();

    const withoutAside = renderDrag(dragParams({ onMinimizedChange, asideRef: { current: null } }));
    act(() => withoutAside.result.current.handlePointerDown(pointerEvent({ clientY: 0 })));
    act(() => withoutAside.result.current.handlePointerMove(pointerEvent({ clientY: 100 })));
    expect(withoutAside.result.current.dragOffsetPx).toBeUndefined();

    const withoutPeek = renderDrag(dragParams({ onMinimizedChange, peekRef: { current: null } }));
    act(() => withoutPeek.result.current.handlePointerDown(pointerEvent({ clientY: 0 })));
    act(() => withoutPeek.result.current.handlePointerMove(pointerEvent({ clientY: 100 })));
    expect(withoutPeek.result.current.dragOffsetPx).toBeUndefined();

    expect(onMinimizedChange).not.toHaveBeenCalled();
  });

  it('does not slide until the pointer crosses the activation slop', () => {
    const { result } = renderDrag(dragParams());
    act(() => result.current.handlePointerDown(pointerEvent({ clientY: 0 })));
    // A 6px move sits exactly on the slop boundary and must not slide.
    act(() => result.current.handlePointerMove(pointerEvent({ clientY: 6 })));
    expect(result.current.dragOffsetPx).toBeUndefined();
  });

  it('activates past the slop, captures the pointer, and tracks the finger', () => {
    const capture = vi.fn();
    const { result } = renderDrag(dragParams());
    act(() => result.current.handlePointerDown(pointerEvent({ clientY: 100 })));
    act(() =>
      result.current.handlePointerMove(pointerEvent({ clientY: 110, setPointerCapture: capture })),
    );
    expect(result.current.dragOffsetPx).toBe(10);
    expect(capture).toHaveBeenCalledWith(1);
  });

  it('keeps tracking once active without re-capturing the pointer', () => {
    const capture = vi.fn();
    const { result } = renderDrag(dragParams());
    act(() => result.current.handlePointerDown(pointerEvent({ clientY: 0 })));
    act(() =>
      result.current.handlePointerMove(pointerEvent({ clientY: 100, setPointerCapture: capture })),
    );
    act(() =>
      result.current.handlePointerMove(pointerEvent({ clientY: 150, setPointerCapture: capture })),
    );
    expect(result.current.dragOffsetPx).toBe(150);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('activates without pointer capture when the API is unavailable', () => {
    const { result } = renderDrag(dragParams());
    act(() => result.current.handlePointerDown(pointerEvent({ clientY: 0 })));
    act(() =>
      result.current.handlePointerMove(
        pointerEvent({ clientY: 100, setPointerCapture: undefined }),
      ),
    );
    expect(result.current.dragOffsetPx).toBe(100);
  });

  it('clamps the live drag offset within the slide range', () => {
    const overshoot = renderDrag(dragParams());
    act(() => overshoot.result.current.handlePointerDown(pointerEvent({ clientY: 0 })));
    act(() => overshoot.result.current.handlePointerMove(pointerEvent({ clientY: 1000 })));
    expect(overshoot.result.current.dragOffsetPx).toBe(416);

    const undershoot = renderDrag(dragParams());
    act(() => undershoot.result.current.handlePointerDown(pointerEvent({ clientY: 100 })));
    act(() => undershoot.result.current.handlePointerMove(pointerEvent({ clientY: 40 })));
    expect(undershoot.result.current.dragOffsetPx).toBe(0);
  });

  it('snaps to minimized after a downward drag past the threshold', () => {
    const onMinimizedChange = vi.fn();
    const { result } = renderDrag(dragParams({ onMinimizedChange }));
    act(() => result.current.handlePointerDown(pointerEvent({ clientY: 0 })));
    act(() => result.current.handlePointerMove(pointerEvent({ clientY: 200 })));
    act(() => result.current.handlePointerUp(pointerEvent({ clientY: 200 })));
    expect(onMinimizedChange).toHaveBeenCalledWith(true);
    expect(result.current.dragOffsetPx).toBeUndefined();
  });

  it('reverts to expanded after a short downward drag', () => {
    const onMinimizedChange = vi.fn();
    const { result } = renderDrag(dragParams({ onMinimizedChange }));
    act(() => result.current.handlePointerDown(pointerEvent({ clientY: 0 })));
    act(() => result.current.handlePointerMove(pointerEvent({ clientY: 20 })));
    act(() => result.current.handlePointerUp(pointerEvent({ clientY: 20 })));
    expect(onMinimizedChange).toHaveBeenCalledWith(false);
  });

  it('snaps to expanded after an upward drag past the threshold from minimized', () => {
    const onMinimizedChange = vi.fn();
    const { result } = renderDrag(dragParams({ onMinimizedChange, minimized: true }));
    act(() => result.current.handlePointerDown(pointerEvent({ clientY: 500 })));
    act(() => result.current.handlePointerMove(pointerEvent({ clientY: 300 })));
    act(() => result.current.handlePointerUp(pointerEvent({ clientY: 300 })));
    expect(onMinimizedChange).toHaveBeenCalledWith(false);
  });

  it('keeps minimized after a short upward drag', () => {
    const onMinimizedChange = vi.fn();
    const { result } = renderDrag(dragParams({ onMinimizedChange, minimized: true }));
    act(() => result.current.handlePointerDown(pointerEvent({ clientY: 500 })));
    act(() => result.current.handlePointerMove(pointerEvent({ clientY: 480 })));
    act(() => result.current.handlePointerUp(pointerEvent({ clientY: 480 })));
    expect(onMinimizedChange).toHaveBeenCalledWith(true);
  });

  it('ignores a release when the drag never activated (a tap)', () => {
    const onMinimizedChange = vi.fn();
    const { result } = renderDrag(dragParams({ onMinimizedChange }));
    act(() => result.current.handlePointerDown(pointerEvent({ clientY: 0 })));
    act(() => result.current.handlePointerUp(pointerEvent({ clientY: 0 })));
    expect(onMinimizedChange).not.toHaveBeenCalled();
    expect(result.current.dragOffsetPx).toBeUndefined();
  });

  it('ignores a release with no active session', () => {
    const onMinimizedChange = vi.fn();
    const { result } = renderDrag(dragParams({ onMinimizedChange }));
    act(() => result.current.handlePointerUp(pointerEvent({ clientY: 0 })));
    expect(onMinimizedChange).not.toHaveBeenCalled();
  });

  it('abandons the drag on cancel without committing', () => {
    const onMinimizedChange = vi.fn();
    const { result } = renderDrag(dragParams({ onMinimizedChange }));
    act(() => result.current.handlePointerDown(pointerEvent({ clientY: 0 })));
    act(() => result.current.handlePointerMove(pointerEvent({ clientY: 200 })));
    act(() => result.current.handlePointerCancel());
    expect(result.current.dragOffsetPx).toBeUndefined();
    expect(onMinimizedChange).not.toHaveBeenCalled();
  });

  it('toggles minimized on a tap or keyboard activation', () => {
    const expandToMinimize = vi.fn();
    const fromExpanded = renderDrag(dragParams({ onMinimizedChange: expandToMinimize }));
    act(() => fromExpanded.result.current.handleClick());
    expect(expandToMinimize).toHaveBeenCalledWith(true);

    const minimizeToExpand = vi.fn();
    const fromMinimized = renderDrag(
      dragParams({ onMinimizedChange: minimizeToExpand, minimized: true }),
    );
    act(() => fromMinimized.result.current.handleClick());
    expect(minimizeToExpand).toHaveBeenCalledWith(false);
  });

  it('suppresses the synthetic click after a real drag, then toggles on the next click', () => {
    const onMinimizedChange = vi.fn();
    const { result } = renderDrag(dragParams({ onMinimizedChange }));
    act(() => result.current.handlePointerDown(pointerEvent({ clientY: 0 })));
    act(() => result.current.handlePointerMove(pointerEvent({ clientY: 200 })));
    act(() => result.current.handlePointerUp(pointerEvent({ clientY: 200 })));
    // The release committed the snap once; the browser-synthesized click
    // that follows must be swallowed so the same gesture does not toggle
    // a second time.
    expect(onMinimizedChange).toHaveBeenCalledTimes(1);
    act(() => result.current.handleClick());
    expect(onMinimizedChange).toHaveBeenCalledTimes(1);
    // A genuine later tap toggles normally once the suppression clears.
    act(() => result.current.handleClick());
    expect(onMinimizedChange).toHaveBeenCalledTimes(2);
  });

  it('resets the suppress flag on a fresh pointer down so a later tap still toggles', () => {
    const onMinimizedChange = vi.fn();
    const { result } = renderDrag(dragParams({ onMinimizedChange }));
    act(() => result.current.handlePointerDown(pointerEvent({ clientY: 0 })));
    act(() => result.current.handlePointerMove(pointerEvent({ clientY: 200 })));
    act(() => result.current.handlePointerUp(pointerEvent({ clientY: 200 })));
    expect(onMinimizedChange).toHaveBeenCalledTimes(1);
    // Touch does not always synthesize the trailing click, so a new press
    // must clear the suppression itself rather than waiting for one.
    act(() => result.current.handlePointerDown(pointerEvent({ clientY: 0 })));
    act(() => result.current.handleClick());
    expect(onMinimizedChange).toHaveBeenCalledTimes(2);
  });
});
