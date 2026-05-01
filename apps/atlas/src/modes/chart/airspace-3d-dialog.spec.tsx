import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Airspace3DAutoHideDialog } from './airspace-3d-dialog.tsx';

describe('Airspace3DAutoHideDialog', () => {
  it('renders the title, description, and both action buttons', () => {
    render(<Airspace3DAutoHideDialog onResolve={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Hide blanket airspace in 3D view/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hide them/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Keep them visible/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Remember my choice/i })).toBeInTheDocument();
  });

  it('marks itself as a modal dialog with linked title and description', () => {
    render(<Airspace3DAutoHideDialog onResolve={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).not.toBeNull();
    expect(document.getElementById(describedBy!)).not.toBeNull();
  });

  it('autofocuses the primary "Hide them" button on mount', () => {
    render(<Airspace3DAutoHideDialog onResolve={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Hide them/i }));
  });

  it('resolves with action "accept" and remember=false when the user clicks Hide them without checking the box', () => {
    const onResolve = vi.fn();
    render(<Airspace3DAutoHideDialog onResolve={onResolve} />);
    fireEvent.click(screen.getByRole('button', { name: /Hide them/i }));
    expect(onResolve).toHaveBeenCalledWith({ action: 'accept', remember: false });
  });

  it('resolves with action "decline" and remember=false when the user clicks Keep them visible', () => {
    const onResolve = vi.fn();
    render(<Airspace3DAutoHideDialog onResolve={onResolve} />);
    fireEvent.click(screen.getByRole('button', { name: /Keep them visible/i }));
    expect(onResolve).toHaveBeenCalledWith({ action: 'decline', remember: false });
  });

  it('passes remember=true through to onResolve when the checkbox is ticked', () => {
    const onResolve = vi.fn();
    render(<Airspace3DAutoHideDialog onResolve={onResolve} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Remember my choice/i }));
    fireEvent.click(screen.getByRole('button', { name: /Hide them/i }));
    expect(onResolve).toHaveBeenCalledWith({ action: 'accept', remember: true });
  });

  it('passes remember=true with action "decline" when the user unchecks-then-checks the box and declines', () => {
    const onResolve = vi.fn();
    render(<Airspace3DAutoHideDialog onResolve={onResolve} />);
    const checkbox = screen.getByRole('checkbox', { name: /Remember my choice/i });
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /Keep them visible/i }));
    expect(onResolve).toHaveBeenCalledWith({ action: 'decline', remember: true });
  });
});
