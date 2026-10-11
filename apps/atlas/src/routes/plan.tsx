import { createFileRoute } from '@tanstack/react-router';

import { PlanMode } from '../modes/plan/plan-mode.tsx';
import { planSearchSchema } from '../modes/plan/url-state.ts';

/**
 * Plan-mode route. Validates URL search params via {@link planSearchSchema}
 * and renders the {@link PlanMode} component.
 */
// The path passed to `createFileRoute` must be a string literal: `tsr generate`
// parses the AST and rejects identifiers (so `PLAN_ROUTE_PATH` cannot be used here).
export const Route = createFileRoute('/plan')({
  validateSearch: planSearchSchema,
  component: PlanMode,
});
