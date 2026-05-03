import { useEffect, useState } from 'react';

import type { FixDataset } from '@squawk/fix-data';
import { loadUsBundledFixes } from '@squawk/fix-data/browser';

/**
 * Module-level cached promise so the bundled fix dataset is fetched at
 * most once per session, no matter how many components mount the hook.
 */
let datasetPromise: Promise<FixDataset> | undefined;

/**
 * Returns the cached dataset promise, kicking off the underlying fetch on
 * the first call. Exported separately from the hook so non-React callers
 * (tests, future imperative loaders) can await the dataset directly.
 */
export function loadFixDataset(): Promise<FixDataset> {
  if (datasetPromise === undefined) {
    datasetPromise = loadUsBundledFixes();
  }
  return datasetPromise;
}

/**
 * Reactive state of the bundled fix dataset load. Discriminated by
 * `status`. The promise is shared across all subscribers, so only the
 * first mount triggers a network request.
 */
export type FixDatasetState =
  | {
      /** Fetch is in flight (or has not started yet). */
      status: 'loading';
    }
  | {
      /** Fetch succeeded; `dataset` carries the parsed result. */
      status: 'loaded';
      /** The loaded fix dataset (records plus build metadata). */
      dataset: FixDataset;
    }
  | {
      /** Fetch failed; `error` carries the failure cause. */
      status: 'error';
      /** The error thrown by the loader. */
      error: Error;
    };

/**
 * React hook that subscribes to the bundled fix dataset load. Returns a
 * discriminated state value the caller can pattern-match on. The fetch is
 * memoized at module scope, so multiple components calling the hook share a
 * single network request and resolution.
 */
export function useFixDataset(): FixDatasetState {
  const [state, setState] = useState<FixDatasetState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadFixDataset()
      .then((dataset) => {
        if (cancelled) {
          return;
        }
        setState({ status: 'loaded', dataset });
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }
        const error = cause instanceof Error ? cause : new Error(String(cause));
        setState({ status: 'error', error });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
