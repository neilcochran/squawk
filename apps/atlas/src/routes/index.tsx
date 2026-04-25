import { createFileRoute, redirect } from '@tanstack/react-router';
import { CHART_ROUTE_PATH } from '../modes/chart/url-state.ts';

/**
 * Root index route. Redirects `/` to the chart mode (the v0 default).
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: CHART_ROUTE_PATH });
  },
});
