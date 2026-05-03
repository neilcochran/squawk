import { fireEvent, render, screen } from '@testing-library/react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { ExpandableParentRow, SimpleParentRow, SubRow } from './layer-toggle-rows.tsx';

// Radix DropdownMenu's primitives expect to live inside a Root + Portal +
// Content tree. Mock the ones used here so the rows render unconditionally
// in jsdom without a portal layout simulation. CheckboxItem is mocked to
// expose its checked/onCheckedChange/onKeyDown/onSelect props as a plain
// div so jsdom can dispatch fireEvent against it.
vi.mock('@radix-ui/react-dropdown-menu', () => ({
  ItemIndicator: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  CheckboxItem: ({
    children,
    checked,
    onCheckedChange,
    onKeyDown,
    onSelect,
    className,
  }: {
    children: ReactNode;
    checked?: boolean;
    onCheckedChange?: (next: boolean) => void;
    onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
    onSelect?: (event: Event) => void;
    className?: string;
  }) => (
    <div
      role="menuitemcheckbox"
      aria-checked={checked === true}
      tabIndex={0}
      className={className}
      onClick={(event: MouseEvent<HTMLDivElement>): void => {
        const fakeSelect = new Event('select');
        onSelect?.(fakeSelect);
        if (!fakeSelect.defaultPrevented) {
          // The real Radix item closes the menu on select; we don't simulate that.
        }
        if (!event.defaultPrevented) {
          onCheckedChange?.(!checked);
        }
      }}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  ),
}));

describe('SimpleParentRow', () => {
  it('renders the label and toggles when clicked', () => {
    const onCheckedChange = vi.fn();
    render(
      <SimpleParentRow
        label="Airports"
        checked={false}
        onCheckedChange={onCheckedChange}
        hintMinZoom={undefined}
      />,
    );
    expect(screen.getByText('Airports')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Airports'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('renders the zoom-gated hint when hintMinZoom is provided', () => {
    render(
      <SimpleParentRow label="Airways" checked={true} onCheckedChange={vi.fn()} hintMinZoom={8} />,
    );
    expect(screen.getByText(/8/)).toBeInTheDocument();
  });
});

describe('ExpandableParentRow', () => {
  it('expands on ArrowRight when collapsed and collapses on ArrowLeft when expanded', () => {
    const onToggleExpanded = vi.fn();
    const { rerender } = render(
      <ExpandableParentRow
        label="Airspace"
        checked={true}
        onCheckedChange={vi.fn()}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
        enabledCount={3}
        totalCount={5}
        hintMinZoom={undefined}
      />,
    );
    const row = screen.getByText('Airspace').closest('[role]');
    expect(row).not.toBeNull();
    if (row === null) {
      return;
    }
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);

    rerender(
      <ExpandableParentRow
        label="Airspace"
        checked={true}
        onCheckedChange={vi.fn()}
        expanded={true}
        onToggleExpanded={onToggleExpanded}
        enabledCount={3}
        totalCount={5}
        hintMinZoom={undefined}
      />,
    );
    fireEvent.keyDown(row, { key: 'ArrowLeft' });
    expect(onToggleExpanded).toHaveBeenCalledTimes(2);
  });

  it('ignores ArrowRight when already expanded and ArrowLeft when already collapsed', () => {
    const onToggleExpanded = vi.fn();
    const { rerender } = render(
      <ExpandableParentRow
        label="Airspace"
        checked={true}
        onCheckedChange={vi.fn()}
        expanded={true}
        onToggleExpanded={onToggleExpanded}
        enabledCount={3}
        totalCount={5}
        hintMinZoom={undefined}
      />,
    );
    const row = screen.getByText('Airspace').closest('[role]');
    expect(row).not.toBeNull();
    if (row === null) {
      return;
    }
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    expect(onToggleExpanded).not.toHaveBeenCalled();

    rerender(
      <ExpandableParentRow
        label="Airspace"
        checked={true}
        onCheckedChange={vi.fn()}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
        enabledCount={3}
        totalCount={5}
        hintMinZoom={undefined}
      />,
    );
    fireEvent.keyDown(row, { key: 'ArrowLeft' });
    expect(onToggleExpanded).not.toHaveBeenCalled();
  });

  it('chevron click toggles expansion and stops propagation to the row', () => {
    const onCheckedChange = vi.fn();
    const onToggleExpanded = vi.fn();
    render(
      <ExpandableParentRow
        label="Airspace"
        checked={true}
        onCheckedChange={onCheckedChange}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
        enabledCount={3}
        totalCount={5}
        hintMinZoom={undefined}
      />,
    );
    const button = screen.getByRole('button', { name: /Expand Airspace sub-list/ });
    fireEvent.click(button);
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    // Pointer events should be stopped so the parent CheckboxItem does
    // not also flip its checked state.
    fireEvent.pointerDown(button);
    fireEvent.pointerUp(button);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});

describe('SubRow', () => {
  it('renders the label and toggles when clicked', () => {
    const onCheckedChange = vi.fn();
    render(<SubRow label="Class B" checked={true} onCheckedChange={onCheckedChange} />);
    expect(screen.getByText('Class B')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Class B'));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });
});
