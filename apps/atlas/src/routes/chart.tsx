import { createFileRoute } from '@tanstack/react-router';

import { ChartMode } from '../modes/chart/chart-mode.tsx';
import { chartSearchSchema } from '../modes/chart/url-state.ts';

/**
 * Chart-mode route. Validates URL search params via {@link chartSearchSchema}
 * and renders the {@link ChartMode} component.
 */
// The path passed to `createFileRoute` must be a string literal: `tsr generate`
// parses the AST and rejects identifiers (so `CHART_ROUTE_PATH` cannot be used here).
export const Route = createFileRoute('/chart')({
  validateSearch: chartSearchSchema,
  component: ChartMode,
});
