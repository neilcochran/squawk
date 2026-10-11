import { useEffect, useState } from 'react';

import type { ProcedureDataset } from '@squawk/procedure-data';
import { loadUsBundledProcedures } from '@squawk/procedure-data/browser';
import { createProcedureResolver } from '@squawk/procedures/browser';
import type { ProcedureResolver } from '@squawk/procedures/browser';

/**
 * Module-level cached promise so the bundled procedure dataset is fetched
 * at most once per session, no matter how many components mount the hook.
 */
let datasetPromise: Promise<ProcedureDataset> | undefined;

/**
 * Returns the cached dataset promise, kicking off the underlying fetch on
 * the first call. Exported separately from the hook so non-React callers
 * (tests, future imperative loaders) can await the dataset directly.
 */
export function loadProcedureDataset(): Promise<ProcedureDataset> {
  if (datasetPromise === undefined) {
    datasetPromise = loadUsBundledProcedures();
  }
  return datasetPromise;
}

/**
 * Reactive state of the bundled procedure dataset load. Discriminated by
 * `status`. The promise is shared across all subscribers, so only the
 * first mount triggers a network request.
 */
export type ProcedureDatasetState =
  | {
      /** Fetch is in flight (or has not started yet). */
      status: 'loading';
    }
  | {
      /** Fetch succeeded; `dataset` carries the parsed result. */
      status: 'loaded';
      /** The loaded procedure dataset (records plus build metadata). */
      dataset: ProcedureDataset;
    }
  | {
      /** Fetch failed; `error` carries the failure cause. */
      status: 'error';
      /** The error thrown by the loader. */
      error: Error;
    };

/**
 * React hook that subscribes to the bundled procedure dataset load.
 * Returns a discriminated state value the caller can pattern-match on. The
 * fetch is memoized at module scope, so multiple components calling the
 * hook share a single network request and resolution.
 */
export function useProcedureDataset(): ProcedureDatasetState {
  const [state, setState] = useState<ProcedureDatasetState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadProcedureDataset()
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

/**
 * WeakMap-cached `ProcedureResolver` per loaded `ProcedureDataset`. Keyed
 * on the dataset reference so test fixtures get a fresh resolver per
 * dataset object while normal session reuse pays the indexing cost once.
 */
const resolverCache = new WeakMap<ProcedureDataset, ProcedureResolver>();

/**
 * Returns the memoized {@link ProcedureResolver} for the given dataset,
 * building it on first access.
 */
export function getProcedureResolver(dataset: ProcedureDataset): ProcedureResolver {
  let resolver = resolverCache.get(dataset);
  if (resolver === undefined) {
    resolver = createProcedureResolver({ data: dataset.records });
    resolverCache.set(dataset, resolver);
  }
  return resolver;
}
