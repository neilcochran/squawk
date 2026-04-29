import { useCallback } from 'react';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { CHART_ROUTE_PATH } from '../modes/chart/url-state.ts';
import { dispatchChartViewReset } from '../modes/chart/view-reset-bus.ts';

/**
 * Top-level mode switcher rendered in the shell header. Each mode declares its
 * own typed `<ModeLink>` so the switcher remains type-safe end-to-end; new
 * modes are added by appending another `<ModeLink>` here once their route
 * exists, then widening the {@link ModeLinkProps} `to` union to include the
 * new path.
 *
 * Clicking the active link is treated as a "reset to defaults" gesture - the
 * default Link navigation is suppressed and a per-mode reset is dispatched
 * (e.g. the chart link fires `dispatchChartViewReset` to re-center on
 * CONUS at default zoom and pitch 0). The dispatch is decoupled from the
 * mode component via a small module-level pub/sub so the shell does not
 * need to reach into the mode's React tree.
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
 * matches the link's `to` (or any nested path under it). Clicks on an active
 * link suppress the default navigation and instead dispatch the matching
 * reset signal so users have a "click my mode tab to recenter" affordance.
 */
function ModeLink({ to, children }: ModeLinkProps): ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || pathname.startsWith(`${to}/`);
  const className = active
    ? 'inline-flex items-center rounded-md bg-slate-900 px-3 py-2.5 text-sm font-medium text-white md:py-1.5 dark:bg-slate-100 dark:text-slate-900'
    : 'inline-flex items-center rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 md:py-1.5 dark:text-slate-300 dark:hover:bg-slate-800';

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>): void => {
      if (!active) {
        return;
      }
      event.preventDefault();
      if (to === CHART_ROUTE_PATH) {
        dispatchChartViewReset();
      }
    },
    [active, to],
  );

  return (
    <Link to={to} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
