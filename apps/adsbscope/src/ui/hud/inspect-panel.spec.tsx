// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeTarget } from '../scope/test-utils.js';

import { DESELECT_LABEL, INSPECT_PANEL_LABEL, InspectPanel } from './inspect-panel.js';

const NOW = 1_000_000;

describe('InspectPanel', () => {
  it('shows nothing while no aircraft is selected', () => {
    const { container } = render(
      <InspectPanel target={undefined} now={NOW} onDeselect={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('names the selected aircraft and lists what is known about it', () => {
    const target = makeTarget({
      callsign: 'UAL123',
      squawk: '7700',
      emergency: 'general',
      altitudeFt: 12_000,
      lastSeenAt: NOW - 2000,
    });

    render(<InspectPanel target={target} now={NOW} onDeselect={vi.fn()} />);

    const panel = screen.getByRole('region', { name: INSPECT_PANEL_LABEL });
    expect(within(panel).getByRole('heading', { name: 'UAL123 EM' })).toBeInTheDocument();
    expect(within(panel).getByText('Squawk')).toBeInTheDocument();
    expect(within(panel).getByText('7700')).toBeInTheDocument();
    expect(within(panel).getByText('12,000 ft')).toBeInTheDocument();
    expect(within(panel).getByText('2 s ago')).toBeInTheDocument();
  });

  it('asks to clear the selection from its deselect button, which names its key', () => {
    const onDeselect = vi.fn();
    render(<InspectPanel target={makeTarget()} now={NOW} onDeselect={onDeselect} />);

    const button = screen.getByRole('button', { name: DESELECT_LABEL });
    fireEvent.click(button);

    expect(onDeselect).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute('title', 'Escape deselects');
  });
});
