import { useEffect, useState } from 'react';

import { createAirspaceResolver } from '@squawk/airspace/browser';
import type { AirspaceResolver } from '@squawk/airspace/browser';
import type { AirspaceDataset } from '@squawk/airspace-data';
import { loadUsBundledAirspace } from '@squawk/airspace-data/browser';

/**
 * Module-level cached promise so the bundled airspace dataset is fetched at
 * most once per session, no matter how many components mount the hook.
 */
let datasetPromise: Promise<AirspaceDataset> | undefined;

/**
 * Returns the cached dataset promise, kicking off the underlying fetch on
 * the first call. Exported separately from the hook so non-React callers
 * (tests, future imperative loaders) can await the dataset directly.
 */
export function loadAirspaceDataset(): Promise<AirspaceDataset> {
  if (datasetPromise === undefined) {
    datasetPromise = loadUsBundledAirspace();
  }
  return datasetPromise;
}

/**
 * Reactive state of the bundled airspace dataset load. Discriminated by
 * `status`. The promise is shared across all subscribers, so only the
 * first mount triggers a network request.
 */
export type AirspaceDatasetState =
  | {
      /** Fetch is in flight (or has not started yet). */
      status: 'loading';
    }
  | {
      /** Fetch succeeded; `dataset` carries the parsed result. */
      status: 'loaded';
      /** The loaded airspace dataset (a GeoJSON `FeatureCollection` of `Polygon` features plus build metadata). */
      dataset: AirspaceDataset;
    }
  | {
      /** Fetch failed; `error` carries the failure cause. */
      status: 'error';
      /** The error thrown by the loader. */
      error: Error;
    };

/**
 * React hook that subscribes to the bundled airspace dataset load. Returns
 * a discriminated state value the caller can pattern-match on. The fetch is
 * memoized at module scope, so multiple components calling the hook share a
 * single network request and resolution.
 */
export function useAirspaceDataset(): AirspaceDatasetState {
  const [state, setState] = useState<AirspaceDatasetState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadAirspaceDataset()
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
 * WeakMap-cached `AirspaceResolver` per loaded `AirspaceDataset`. Keyed
 * on the dataset reference so test fixtures get a fresh resolver per
 * dataset object while normal session reuse pays the indexing cost once.
 */
const resolverCache = new WeakMap<AirspaceDataset, AirspaceResolver>();

/**
 * Returns the memoized {@link AirspaceResolver} for the given dataset,
 * building it on first access.
 */
export function getAirspaceResolver(dataset: AirspaceDataset): AirspaceResolver {
  let resolver = resolverCache.get(dataset);
  if (resolver === undefined) {
    resolver = createAirspaceResolver({ data: dataset });
    resolverCache.set(dataset, resolver);
  }
  return resolver;
}
