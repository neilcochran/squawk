// @vitest-environment jsdom
import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useHotkeys } from './use-hotkeys.js';

describe('useHotkeys', () => {
  it('reports each key press with its modifier keys', () => {
    const onKeyPress = vi.fn();
    renderHook(() => useHotkeys(onKeyPress));

    fireEvent.keyDown(window, { key: 'm' });
    fireEvent.keyDown(window, { key: 'r', ctrlKey: true });

    expect(onKeyPress.mock.calls).toEqual([
      [{ key: 'm', ctrlKey: false, metaKey: false, altKey: false }],
      [{ key: 'r', ctrlKey: true, metaKey: false, altKey: false }],
    ]);
  });

  it('leaves key presses aimed at a text field alone', () => {
    const onKeyPress = vi.fn();
    renderHook(() => useHotkeys(onKeyPress));
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    document.body.append(input, textarea);

    fireEvent.keyDown(input, { key: 'm' });
    fireEvent.keyDown(textarea, { key: 't' });

    expect(onKeyPress).not.toHaveBeenCalled();
    input.remove();
    textarea.remove();
  });

  it('stops listening once unmounted', () => {
    const onKeyPress = vi.fn();
    const { unmount } = renderHook(() => useHotkeys(onKeyPress));

    unmount();
    fireEvent.keyDown(window, { key: 'm' });

    expect(onKeyPress).not.toHaveBeenCalled();
  });
});
