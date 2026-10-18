import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SidePanelResizeHandle } from './side-panel-resize-handle.tsx';
import type { SidePanelWidth } from './use-side-panel-width.ts';

/** A width state at 400 px within 320-640, with spy setters. */
function makeWidth(): SidePanelWidth {
  return {
    widthPx: 400,
    minWidthPx: 320,
    maxWidthPx: 640,
    previewWidthPx: vi.fn(),
    commitWidthPx: vi.fn(),
    resetWidth: vi.fn(),
  };
}

/** The rendered separator and the pointer capture spies stubbed onto it. */
interface RenderedHandle {
  /** The handle's separator element. */
  separator: HTMLElement;
  /** Spy standing in for `setPointerCapture`. */
  setCapture: ReturnType<typeof vi.fn>;
  /** Spy standing in for `releasePointerCapture`. */
  releaseCapture: ReturnType<typeof vi.fn>;
}

/**
 * Renders the handle and returns its separator with pointer capture stubbed,
 * since jsdom does not implement the pointer capture API.
 */
function renderHandle(width: SidePanelWidth): RenderedHandle {
  render(<SidePanelResizeHandle width={width} label="Resize test panel" />);
  const separator = screen.getByRole('separator', { name: 'Resize test panel' });
  const setCapture = vi.fn();
  const releaseCapture = vi.fn();
  separator.setPointerCapture = setCapture;
  separator.releasePointerCapture = releaseCapture;
  separator.hasPointerCapture = (): boolean => true;
  return { separator, setCapture, releaseCapture };
}

describe('SidePanelResizeHandle', () => {
  it('exposes a vertical separator carrying the width and its bounds', () => {
    const { separator } = renderHandle(makeWidth());
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    expect(separator).toHaveAttribute('aria-valuenow', '400');
    expect(separator).toHaveAttribute('aria-valuemin', '320');
    expect(separator).toHaveAttribute('aria-valuemax', '640');
    expect(separator).toHaveAttribute('tabindex', '0');
  });

  it('widens the panel as the edge is dragged left, storing the width on release', () => {
    const width = makeWidth();
    const { separator, setCapture, releaseCapture } = renderHandle(width);
    fireEvent.pointerDown(separator, { button: 0, clientX: 1000, pointerId: 1 });
    expect(setCapture).toHaveBeenCalledWith(1);
    // Pressing the edge focuses it, so the arrow keys work straight after.
    expect(separator).toHaveFocus();

    fireEvent.pointerMove(separator, { clientX: 940, pointerId: 1 });
    expect(width.previewWidthPx).toHaveBeenCalledWith(460);
    expect(width.commitWidthPx).not.toHaveBeenCalled();

    fireEvent.pointerUp(separator, { clientX: 900, pointerId: 1 });
    expect(width.commitWidthPx).toHaveBeenCalledWith(500);
    expect(releaseCapture).toHaveBeenCalledWith(1);
  });

  it('narrows the panel as the edge is dragged right', () => {
    const width = makeWidth();
    const { separator } = renderHandle(width);
    fireEvent.pointerDown(separator, { button: 0, clientX: 1000 });
    fireEvent.pointerUp(separator, { clientX: 1050 });
    expect(width.commitWidthPx).toHaveBeenCalledWith(350);
  });

  it('keeps the last width when the pointer is cancelled', () => {
    const width = makeWidth();
    const { separator } = renderHandle(width);
    fireEvent.pointerDown(separator, { button: 0, clientX: 1000 });
    fireEvent.pointerCancel(separator, { clientX: 980 });
    expect(width.commitWidthPx).toHaveBeenCalledWith(420);
  });

  it('ignores pointer movement without a press, and presses of other buttons', () => {
    const width = makeWidth();
    const { separator } = renderHandle(width);
    fireEvent.pointerMove(separator, { clientX: 900 });
    fireEvent.pointerDown(separator, { button: 2, clientX: 1000 });
    fireEvent.pointerMove(separator, { clientX: 900 });
    fireEvent.pointerUp(separator, { clientX: 900 });
    expect(width.previewWidthPx).not.toHaveBeenCalled();
    expect(width.commitWidthPx).not.toHaveBeenCalled();
  });

  it('moves the edge from the keyboard', () => {
    const width = makeWidth();
    const { separator } = renderHandle(width);
    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(width.commitWidthPx).toHaveBeenLastCalledWith(416);
    fireEvent.keyDown(separator, { key: 'ArrowLeft', shiftKey: true });
    expect(width.commitWidthPx).toHaveBeenLastCalledWith(464);
    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(width.commitWidthPx).toHaveBeenLastCalledWith(384);
    fireEvent.keyDown(separator, { key: 'Home' });
    expect(width.commitWidthPx).toHaveBeenLastCalledWith(320);
    fireEvent.keyDown(separator, { key: 'End' });
    expect(width.commitWidthPx).toHaveBeenLastCalledWith(640);
  });

  it('leaves other keys alone', () => {
    const width = makeWidth();
    const { separator } = renderHandle(width);
    fireEvent.keyDown(separator, { key: 'Enter' });
    expect(width.commitWidthPx).not.toHaveBeenCalled();
  });

  it('resets the default width on double-click', () => {
    const width = makeWidth();
    const { separator } = renderHandle(width);
    fireEvent.doubleClick(separator);
    expect(width.resetWidth).toHaveBeenCalledTimes(1);
  });
});
