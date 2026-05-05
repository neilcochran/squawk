import { useEffect, useState } from 'react';

import type { AirwayDataset } from '@squawk/airway-data';
import { loadUsBundledAirways } from '@squawk/airway-data/browser';
import { createAirwayResolver } from '@squawk/airways/browser';
import type { AirwayResolver } from '@squawk/airways/browser';

/**
 * Module-level cached promise so the bundled airway dataset is fetched at
 * most once per session, no matter how many components mount the hook.
 */
let datasetPromise: Promise<AirwayDataset> | undefined;

/**
 * Returns the cached dataset promise, kicking off the underlying fetch on
 * the first call. Exported separately from the hook so non-React callers
 * (tests, future imperative loaders) can await the dataset directly.
 */
export function loadAirwayDataset(): Promise<AirwayDataset> {
  if (datasetPromise === undefined) {
    datasetPromise = loadUsBundledAirways();
  }
  return datasetPromise;
}

/**
 * Reactive state of the bundled airway dataset load. Discriminated by
 * `status`. The promise is shared across all subscribers, so only the
 * first mount triggers a network request.
 */
export type AirwayDatasetState =
  | {
      /** Fetch is in flight (or has not started yet). */
      status: 'loading';
    }
  | {
      /** Fetch succeeded; `dataset` carries the parsed result. */
      status: 'loaded';
      /** The loaded airway dataset (records plus build metadata). */
      dataset: AirwayDataset;
    }
  | {
      /** Fetch failed; `error` carries the failure cause. */
      status: 'error';
      /** The error thrown by the loader. */
      error: Error;
    };

/**
 * React hook that subscribes to the bundled airway dataset load. Returns a
 * discriminated state value the caller can pattern-match on. The fetch is
 * memoized at module scope, so multiple components calling the hook share a
 * single network request and resolution.
 */
export function useAirwayDataset(): AirwayDatasetState {
  const [state, setState] = useState<AirwayDatasetState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadAirwayDataset()
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
 * WeakMap-cached `AirwayResolver` per loaded `AirwayDataset`. Keyed on
 * the dataset reference so test fixtures get a fresh resolver per
 * dataset object while normal session reuse pays the indexing cost once.
 */
const resolverCache = new WeakMap<AirwayDataset, AirwayResolver>();

/**
 * Returns the memoized {@link AirwayResolver} for the given dataset,
 * building it on first access.
 */
export function getAirwayResolver(dataset: AirwayDataset): AirwayResolver {
  let resolver = resolverCache.get(dataset);
  if (resolver === undefined) {
    resolver = createAirwayResolver({ data: dataset.records });
    resolverCache.set(dataset, resolver);
  }
  return resolver;
}
