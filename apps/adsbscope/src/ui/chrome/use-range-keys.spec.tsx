// @vitest-environment jsdom
import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useRangeKeys } from './use-range-keys.js';

describe('useRangeKeys', () => {
  it('steps the range for range keys and ignores every other key', () => {
    const onStep = vi.fn();
    renderHook(() => useRangeKeys(onStep));

    fireEvent.keyDown(window, { key: '+' });
    fireEvent.keyDown(window, { key: '[' });
    fireEvent.keyDown(window, { key: 'x' });

    expect(onStep.mock.calls).toEqual([['in'], ['out']]);
  });

  it('leaves key presses aimed at a text field alone', () => {
    const onStep = vi.fn();
    renderHook(() => useRangeKeys(onStep));
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    document.body.append(input, textarea);

    fireEvent.keyDown(input, { key: '+' });
    fireEvent.keyDown(textarea, { key: '-' });

    expect(onStep).not.toHaveBeenCalled();
    input.remove();
    textarea.remove();
  });

  it('stops listening once unmounted', () => {
    const onStep = vi.fn();
    const { unmount } = renderHook(() => useRangeKeys(onStep));

    unmount();
    fireEvent.keyDown(window, { key: '+' });

    expect(onStep).not.toHaveBeenCalled();
  });
});
