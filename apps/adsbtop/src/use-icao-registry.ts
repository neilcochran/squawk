import { useEffect, useState } from 'react';

import { createIcaoRegistry } from '@squawk/icao-registry';
import type { IcaoRegistry } from '@squawk/icao-registry';
import type { AircraftRegistration } from '@squawk/types';

/** The subset of `@squawk/icao-registry-data`'s module exports this hook needs. */
export interface RegistryDataModule {
  /** The bundled US aircraft registry dataset. */
  usBundledRegistry: {
    /** Raw registration records, keyed by `icaoHex` once loaded into a resolver. */
    records: AircraftRegistration[];
  };
}

/** Loads the bundled registry dataset module - overridable so tests don't import the real ~40MB dataset. */
export type RegistryDataLoader = () => Promise<RegistryDataModule>;

const defaultLoader: RegistryDataLoader = () => import('@squawk/icao-registry-data');

/**
 * Lazily loads `@squawk/icao-registry-data` and builds an `IcaoRegistry`
 * after mount, so the dataset's decompress-and-parse cost doesn't block
 * adsbtop's first paint. `@squawk/icao-registry-data` is a hard dependency
 * (registration lookup is adsbtop's headline enrichment feature, unlike
 * `@squawk/mcp`'s optional-peer treatment of the same dataset, where it's
 * one tool among many) - a load failure is unexpected, and degrades to
 * leaving registration columns/fields at `-` rather than crashing the live
 * dashboard over a non-core enhancement.
 *
 * @param loadData - Loader for the bundled dataset module. Defaults to a real dynamic import of `@squawk/icao-registry-data`; overridable in tests.
 * @returns The ready-to-query registry, or undefined while loading (or if loading failed).
 */
export function useIcaoRegistry(
  loadData: RegistryDataLoader = defaultLoader,
): IcaoRegistry | undefined {
  const [registry, setRegistry] = useState<IcaoRegistry | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadData()
      .then(({ usBundledRegistry }) => {
        if (!cancelled) {
          setRegistry(createIcaoRegistry({ data: usBundledRegistry.records }));
        }
      })
      .catch(() => {
        // Registration enrichment is a display enhancement, not core
        // tracking functionality - leave the registry unset rather than
        // crash the dashboard over a failed load.
      });
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  return registry;
}
