import type { ReactElement, ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { CHART_ROUTE_PATH } from '../modes/chart/url-state.ts';

/**
 * Top-level mode switcher rendered in the shell header. Each mode declares its
 * own typed `<ModeLink>` so the switcher remains type-safe end-to-end; new
 * modes are added by appending another `<ModeLink>` here once their route
 * exists, then widening the {@link ModeLinkProps} `to` union to include the
 * new path.
 */
export function ModeSwitcher(): ReactElement {
  return (
    <nav aria-label="Mode" className="flex items-center gap-1">
      <ModeLink to={CHART_ROUTE_PATH}>Chart</ModeLink>
    </nav>
  );
}

/**
 * Props for an individual mode link in the {@link ModeSwitcher}.
 */
interface ModeLinkProps {
  /** Typed route path the link navigates to. Extend the union as new modes land. */
  to: typeof CHART_ROUTE_PATH;
  /** Visible label for the mode. */
  children: ReactNode;
}

/**
 * Single mode link. Visually marks itself as active when the current pathname
 * matches the link's `to` (or any nested path under it).
 */
function ModeLink({ to, children }: ModeLinkProps): ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || pathname.startsWith(`${to}/`);
  const className = active
    ? 'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white'
    : 'rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100';
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}
