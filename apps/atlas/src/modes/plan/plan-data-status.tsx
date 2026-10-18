import type { ReactElement } from 'react';

import { FloatingPanel } from '../../shared/ui/floating-panel.tsx';

import { formatDatasetFailure } from './plan-format.ts';
import type { PlanResolverState } from './use-plan-resolver.ts';

/**
 * Props for {@link PlanDataStatus}.
 */
export interface PlanDataStatusProps {
  /** The composed resolver's state from `usePlanResolver`. */
  state: PlanResolverState;
}

/**
 * Small centered notice about the aeronautical data, positioned below the
 * route input bar so the two do not overlap. While the datasets stream in it
 * is a "loading" pill: plan mode has nothing to draw until the resolver is
 * ready, so this communicates the wait without the full-screen wash chart
 * mode uses (there are no partially-painted layers to hide here). Once every
 * fetch has settled it names any dataset that failed, says that route tokens
 * needing it will not resolve, and offers a reload; the map and the datasets
 * that did load stay usable underneath. Renders nothing when all loaded.
 */
export function PlanDataStatus({ state }: PlanDataStatusProps): ReactElement | null {
  if (state.status === 'ready' && state.failed.length === 0) {
    return null;
  }
  if (state.status === 'ready') {
    return (
      <div className="absolute inset-x-2 top-16 z-10 flex justify-center" role="alert">
        {/*
         * The red border override matches chart mode's load-error card, the
         * only other floating surface that reports a failure.
         */}
        <FloatingPanel className="flex max-w-sm flex-col items-center gap-2 rounded-lg border-red-200 px-4 py-3 text-center shadow-md dark:border-red-900">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            {formatDatasetFailure(state.failed)}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Route tokens that need this data will not resolve.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-slate-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-800 md:py-1.5 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Reload
          </button>
        </FloatingPanel>
      </div>
    );
  }
  return (
    <div
      className="absolute inset-x-0 top-16 z-10 flex justify-center"
      role="status"
      aria-live="polite"
    >
      <FloatingPanel className="flex items-center gap-2 rounded-full px-3 py-1.5 shadow-md">
        <span
          className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
          Loading aeronautical data...
        </span>
      </FloatingPanel>
    </div>
  );
}
