// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RANGE_STEPS_NM } from '../scope/range.js';

import { RangeControls } from './range-controls.js';

describe('RangeControls', () => {
  it('offers a labeled zoom-in and zoom-out button in a named group', () => {
    render(<RangeControls rangeNm={60} onStep={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'Scope range' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  });

  it('reports the direction of the button pressed', () => {
    const onStep = vi.fn();
    render(<RangeControls rangeNm={60} onStep={onStep} />);

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));

    expect(onStep.mock.calls).toEqual([['in'], ['out']]);
  });

  it('disables zooming in at the smallest range and zooming out at the largest', () => {
    const view = render(<RangeControls rangeNm={RANGE_STEPS_NM[0] ?? 0} onStep={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();

    view.rerender(<RangeControls rangeNm={RANGE_STEPS_NM.at(-1) ?? 0} onStep={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
  });
});
