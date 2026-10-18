import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FlightplanResolver } from '@squawk/flightplan/browser';

import { PlanDataStatus } from './plan-data-status.tsx';

const RESOLVER: FlightplanResolver = { parse: vi.fn() };

describe('PlanDataStatus', () => {
  it('shows the loading pill while the data is loading', () => {
    render(<PlanDataStatus state={{ status: 'loading' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading aeronautical data/i);
  });

  it('renders nothing once every dataset has loaded', () => {
    const { container } = render(
      <PlanDataStatus state={{ status: 'ready', resolver: RESOLVER, failed: [] }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names the datasets that failed and what that means for the route', () => {
    render(
      <PlanDataStatus
        state={{ status: 'ready', resolver: RESOLVER, failed: ['navaids', 'procedures'] }}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load navaids and procedures.");
    expect(alert).toHaveTextContent(/route tokens that need this data will not resolve/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('reloads the page from the failure notice', () => {
    // jsdom's window.location.reload is non-configurable, so swap the whole
    // location through a property descriptor and restore it afterwards.
    const original = window.location;
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...original, reload },
    });
    try {
      render(
        <PlanDataStatus state={{ status: 'ready', resolver: RESOLVER, failed: ['airports'] }} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: original,
      });
    }
  });
});
