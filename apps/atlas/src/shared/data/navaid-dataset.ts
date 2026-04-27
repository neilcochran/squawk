import { useEffect, useState } from 'react';
import { loadUsBundledNavaids } from '@squawk/navaid-data/browser';
import type { NavaidDataset } from '@squawk/navaid-data';

/**
 * Module-level cached promise so the bundled navaid dataset is fetched at
 * most once per session, no matter how many components mount the hook.
 */
let datasetPromise: Promise<NavaidDataset> | undefined;

/**
 * Returns the cached dataset promise, kicking off the underlying fetch on
 * the first call. Exported separately from the hook so non-React callers
 * (tests, future imperative loaders) can await the dataset directly.
 */
export function loadNavaidDataset(): Promise<NavaidDataset> {
  if (datasetPromise === undefined) {
    datasetPromise = loadUsBundledNavaids();
  }
  return datasetPromise;
}

/**
 * Reactive state of the bundled navaid dataset load. Discriminated by
 * `status`. The promise is shared across all subscribers, so only the
 * first mount triggers a network request.
 */
export type NavaidDatasetState =
  | {
      /** Fetch is in flight (or has not started yet). */
      status: 'loading';
    }
  | {
      /** Fetch succeeded; `dataset` carries the parsed result. */
      status: 'loaded';
      /** The loaded navaid dataset (records plus build metadata). */
      dataset: NavaidDataset;
    }
  | {
      /** Fetch failed; `error` carries the failure cause. */
      status: 'error';
      /** The error thrown by the loader. */
      error: Error;
    };

/**
 * React hook that subscribes to the bundled navaid dataset load. Returns a
 * discriminated state value the caller can pattern-match on. The fetch is
 * memoized at module scope, so multiple components calling the hook share a
 * single network request and resolution.
 */
export function useNavaidDataset(): NavaidDatasetState {
  const [state, setState] = useState<NavaidDatasetState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadNavaidDataset()
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
