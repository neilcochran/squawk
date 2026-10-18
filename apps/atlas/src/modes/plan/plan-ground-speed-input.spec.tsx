import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PlanGroundSpeedInput } from './plan-ground-speed-input.tsx';

function field(): HTMLElement {
  return screen.getByLabelText('Ground speed (kt)');
}

describe('PlanGroundSpeedInput', () => {
  it('shows the current speed, or nothing when unset', () => {
    const { rerender } = render(<PlanGroundSpeedInput value={450} onCommit={vi.fn()} />);
    expect(field()).toHaveValue(450);
    rerender(<PlanGroundSpeedInput value={undefined} onCommit={vi.fn()} />);
    expect(field()).toHaveValue(null);
  });

  it('does not commit while typing', () => {
    const onCommit = vi.fn();
    render(<PlanGroundSpeedInput value={undefined} onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: '4' } });
    fireEvent.change(field(), { target: { value: '45' } });
    fireEvent.change(field(), { target: { value: '450' } });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits on blur', () => {
    const onCommit = vi.fn();
    render(<PlanGroundSpeedInput value={undefined} onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: '450' } });
    fireEvent.blur(field());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(450);
  });

  it('commits on Enter', () => {
    const onCommit = vi.fn();
    render(<PlanGroundSpeedInput value={undefined} onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: '450' } });
    fireEvent.submit(field());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(450);
  });

  it('clamps a speed above the bound and shows the clamped value', () => {
    const onCommit = vi.fn();
    render(<PlanGroundSpeedInput value={450} onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: '5000' } });
    fireEvent.blur(field());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(2000);
    expect(field()).toHaveValue(2000);
  });

  it('snaps back to the bound without committing when the speed is already at it', () => {
    const onCommit = vi.fn();
    render(<PlanGroundSpeedInput value={2000} onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: '9999' } });
    fireEvent.blur(field());
    expect(onCommit).not.toHaveBeenCalled();
    expect(field()).toHaveValue(2000);
  });

  it('reverts a non-positive speed to the current one', () => {
    const onCommit = vi.fn();
    render(<PlanGroundSpeedInput value={450} onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: '0' } });
    fireEvent.blur(field());
    expect(onCommit).not.toHaveBeenCalled();
    expect(field()).toHaveValue(450);
  });

  it('clears the speed when the field is emptied', () => {
    const onCommit = vi.fn();
    render(<PlanGroundSpeedInput value={450} onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: '' } });
    fireEvent.blur(field());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('does not commit when the value is unchanged', () => {
    const onCommit = vi.fn();
    render(<PlanGroundSpeedInput value={450} onCommit={onCommit} />);
    fireEvent.blur(field());
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('resyncs to a speed changed from elsewhere', () => {
    const { rerender } = render(<PlanGroundSpeedInput value={450} onCommit={vi.fn()} />);
    fireEvent.change(field(), { target: { value: '3' } });
    rerender(<PlanGroundSpeedInput value={500} onCommit={vi.fn()} />);
    expect(field()).toHaveValue(500);
  });
});
