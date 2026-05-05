import { useEffect, useState } from 'react';

import type { AirportDataset } from '@squawk/airport-data';
import { loadUsBundledAirports } from '@squawk/airport-data/browser';
import { createAirportResolver } from '@squawk/airports/browser';
import type { AirportResolver } from '@squawk/airports/browser';

/**
 * Module-level cached promise so the bundled airport dataset is fetched at
 * most once per session, no matter how many components mount the hook.
 */
let datasetPromise: Promise<AirportDataset> | undefined;

/**
 * Returns the cached dataset promise, kicking off the underlying fetch on
 * the first call. Exported separately from the hook so non-React callers
 * (tests, future imperative loaders) can await the dataset directly.
 */
export function loadAirportDataset(): Promise<AirportDataset> {
  if (datasetPromise === undefined) {
    datasetPromise = loadUsBundledAirports();
  }
  return datasetPromise;
}

/**
 * Reactive state of the bundled airport dataset load. Discriminated by
 * `status`. The promise is shared across all subscribers, so only the
 * first mount triggers a network request.
 */
export type AirportDatasetState =
  | {
      /** Fetch is in flight (or has not started yet). */
      status: 'loading';
    }
  | {
      /** Fetch succeeded; `dataset` carries the parsed result. */
      status: 'loaded';
      /** The loaded airport dataset (records plus build metadata). */
      dataset: AirportDataset;
    }
  | {
      /** Fetch failed; `error` carries the failure cause. */
      status: 'error';
      /** The error thrown by the loader. */
      error: Error;
    };

/**
 * React hook that subscribes to the bundled airport dataset load. Returns a
 * discriminated state value the caller can pattern-match on. The fetch is
 * memoized at module scope, so multiple components calling the hook share a
 * single network request and resolution.
 */
export function useAirportDataset(): AirportDatasetState {
  const [state, setState] = useState<AirportDatasetState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadAirportDataset()
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
 * WeakMap-cached `AirportResolver` per loaded `AirportDataset`. The
 * dataset itself is module-cached above, so in normal app use this map
 * holds at most one entry; tests that build fresh dataset objects per
 * case get fresh resolvers per case.
 */
const resolverCache = new WeakMap<AirportDataset, AirportResolver>();

/**
 * Returns the memoized {@link AirportResolver} for the given dataset,
 * building it on first access. Keyed on the dataset reference so a
 * subsequent reload (or a test fixture's fresh dataset) gets a fresh
 * resolver while normal session reuse pays the indexing cost once.
 */
export function getAirportResolver(dataset: AirportDataset): AirportResolver {
  let resolver = resolverCache.get(dataset);
  if (resolver === undefined) {
    resolver = createAirportResolver({ data: dataset.records });
    resolverCache.set(dataset, resolver);
  }
  return resolver;
}
