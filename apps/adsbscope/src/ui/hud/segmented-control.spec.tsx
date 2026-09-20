// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SegmentedControl } from './segmented-control.js';

const OPTIONS = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Medium' },
  { value: 'fast', label: 'Fast' },
] as const;

describe('SegmentedControl', () => {
  it('shows every option as a button in a named group, with only the selected one pressed', () => {
    render(
      <SegmentedControl
        label="Speed"
        options={OPTIONS}
        selectedValue="medium"
        onSelect={vi.fn()}
      />,
    );

    const buttons = within(screen.getByRole('group', { name: 'Speed' })).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Slow', 'Medium', 'Fast']);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);
  });

  it("prefixes each option's accessible name with what is being chosen, keeping the visible text in it", () => {
    render(
      <SegmentedControl label="Speed" options={OPTIONS} selectedValue="slow" onSelect={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Speed: Fast' })).toHaveTextContent('Fast');
  });

  it('reports the value of the option pressed, including the one already selected', () => {
    const onSelect = vi.fn();
    render(
      <SegmentedControl label="Speed" options={OPTIONS} selectedValue="slow" onSelect={onSelect} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Speed: Fast' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speed: Slow' }));

    expect(onSelect.mock.calls).toEqual([['fast'], ['slow']]);
  });

  it('shows a caption only when given one', () => {
    const view = render(
      <SegmentedControl label="Speed" options={OPTIONS} selectedValue="slow" onSelect={vi.fn()} />,
    );
    expect(screen.getByRole('group', { name: 'Speed' })).toHaveTextContent('SlowMediumFast');

    view.rerender(
      <SegmentedControl
        label="Speed"
        caption="Speed"
        options={OPTIONS}
        selectedValue="slow"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('group', { name: 'Speed' })).toHaveTextContent('SpeedSlowMediumFast');
  });

  it('puts the hint on every option, and none when there is no hint', () => {
    const view = render(
      <SegmentedControl
        label="Speed"
        options={OPTIONS}
        selectedValue="slow"
        hint="S changes speed"
        onSelect={vi.fn()}
      />,
    );
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('title', 'S changes speed');
    }

    view.rerender(
      <SegmentedControl label="Speed" options={OPTIONS} selectedValue="slow" onSelect={vi.fn()} />,
    );
    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toHaveAttribute('title');
    }
  });
});
