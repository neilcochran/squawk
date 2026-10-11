import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { PlanRouteInput } from './plan-route-input.tsx';

describe('PlanRouteInput', () => {
  it('commits the normalized route on submit', () => {
    const onCommit = vi.fn();
    render(<PlanRouteInput value="" onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Flight plan route' });
    fireEvent.change(input, { target: { value: 'kjfk dct klax' } });
    const form = input.closest('form');
    if (form === null) {
      throw new Error('expected the input to be inside a form');
    }
    fireEvent.submit(form);
    expect(onCommit).toHaveBeenCalledWith('KJFK DCT KLAX');
  });

  it('commits the normalized route on blur, trimming and collapsing whitespace', () => {
    const onCommit = vi.fn();
    render(<PlanRouteInput value="" onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Flight plan route' });
    fireEvent.change(input, { target: { value: '  kbos   dct   kjfk ' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith('KBOS DCT KJFK');
  });

  it('does not commit when the normalized value is unchanged', () => {
    const onCommit = vi.fn();
    render(<PlanRouteInput value="KJFK DCT KLAX" onCommit={onCommit} />);
    fireEvent.blur(screen.getByRole('textbox', { name: 'Flight plan route' }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('resyncs the draft when the value prop changes', () => {
    const { rerender } = render(<PlanRouteInput value="A" onCommit={vi.fn()} />);
    const input: HTMLInputElement = screen.getByRole('textbox', { name: 'Flight plan route' });
    expect(input.value).toBe('A');
    rerender(<PlanRouteInput value="B B" onCommit={vi.fn()} />);
    expect(input.value).toBe('B B');
  });
});
