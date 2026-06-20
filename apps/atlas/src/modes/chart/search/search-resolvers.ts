import { useMemo } from 'react';

import { getAirportResolver } from '../../../shared/data/airport-dataset.ts';
import { getAirspaceResolver } from '../../../shared/data/airspace-dataset.ts';
import { getAirwayResolver } from '../../../shared/data/airway-dataset.ts';
import { getFixResolver } from '../../../shared/data/fix-dataset.ts';
import { getNavaidResolver } from '../../../shared/data/navaid-dataset.ts';
import { useDatasetStates } from '../../../shared/inspector/entity-resolver.ts';

import type { ChartSearchResolvers } from './search-features.ts';

/**
 * Subscribes to all five chart datasets and exposes their `search` methods in
 * the {@link ChartSearchResolvers} shape consumed by {@link searchChartFeatures}.
 *
 * Each dataset is queried only once it has loaded; until then its slot carries
 * a stub whose `search` returns no matches, so the search box can run against
 * whatever has loaded so far without waiting on the slowest dataset. The
 * underlying `useXDataset()` fetches are shared at module scope, so mounting
 * this hook triggers no requests beyond what chart-mode already initiates.
 *
 * @returns Per-kind resolver `search` surfaces, memoized on the dataset states.
 */
export function useChartSearchResolvers(): ChartSearchResolvers {
  const states = useDatasetStates();

  return useMemo<ChartSearchResolvers>(
    () => ({
      airports:
        states.airport.status === 'loaded'
          ? getAirportResolver(states.airport.dataset)
          : { search: () => [] },
      navaids:
        states.navaid.status === 'loaded'
          ? getNavaidResolver(states.navaid.dataset)
          : { search: () => [] },
      fixes:
        states.fix.status === 'loaded' ? getFixResolver(states.fix.dataset) : { search: () => [] },
      airways:
        states.airway.status === 'loaded'
          ? getAirwayResolver(states.airway.dataset)
          : { search: () => [] },
      airspace:
        states.airspace.status === 'loaded'
          ? getAirspaceResolver(states.airspace.dataset)
          : { search: () => [] },
    }),
    [states],
  );
}
