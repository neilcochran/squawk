import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ModeSwitcher } from './mode-switcher.tsx';

const { useRouterStateMock, dispatchMock } = vi.hoisted(() => ({
  useRouterStateMock: vi.fn(),
  dispatchMock: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useRouterState: useRouterStateMock,
  // Lightweight Link mock: renders an anchor that proxies onClick + href.
  // The real Link fires its own onClick before navigating, so a click test
  // needs the onClick to flow through.
  Link: ({
    to,
    onClick,
    className,
    children,
  }: {
    to: string;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
    className?: string;
    children: React.ReactNode;
  }) => (
    <a href={to} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('../modes/chart/view-reset-bus.ts', () => ({
  dispatchChartViewReset: dispatchMock,
}));

describe('ModeSwitcher', () => {
  beforeEach(() => {
    useRouterStateMock.mockReset();
    dispatchMock.mockReset();
  });

  it('renders the Chart link', () => {
    useRouterStateMock.mockReturnValue('/');
    render(<ModeSwitcher />);
    expect(screen.getByRole('link', { name: 'Chart' })).toBeInTheDocument();
  });

  it('does not dispatch a reset when clicking the Chart link from another route', () => {
    useRouterStateMock.mockReturnValue('/');
    render(<ModeSwitcher />);
    fireEvent.click(screen.getByRole('link', { name: 'Chart' }));
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('dispatches a chart-view reset when the active Chart link is clicked', () => {
    useRouterStateMock.mockReturnValue('/chart');
    render(<ModeSwitcher />);
    fireEvent.click(screen.getByRole('link', { name: 'Chart' }));
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });

  it('treats nested chart paths as active so deep links also trigger reset', () => {
    useRouterStateMock.mockReturnValue('/chart/something-deeper');
    render(<ModeSwitcher />);
    fireEvent.click(screen.getByRole('link', { name: 'Chart' }));
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });

  it('prevents default navigation on active-link click', () => {
    useRouterStateMock.mockReturnValue('/chart');
    render(<ModeSwitcher />);
    const link = screen.getByRole('link', { name: 'Chart' });
    const event = new globalThis.MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('selects the pathname from the router state via the select callback', () => {
    // Drive useRouterState through its `select` argument so the inline
    // selector closure (s) => s.location.pathname is exercised, matching
    // production wiring rather than the mock's short-circuit.
    useRouterStateMock.mockImplementation(
      ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
        select({ location: { pathname: '/chart' } }),
    );
    render(<ModeSwitcher />);
    fireEvent.click(screen.getByRole('link', { name: 'Chart' }));
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });
});
