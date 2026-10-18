import { useMemo } from 'react';

import { createFlightplanResolver } from '@squawk/flightplan/browser';
import type { FlightplanResolver, FlightplanResolverOptions } from '@squawk/flightplan/browser';

import { getAirportResolver, useAirportDataset } from '../../shared/data/airport-dataset.ts';
import { getAirwayResolver, useAirwayDataset } from '../../shared/data/airway-dataset.ts';
import { getFixResolver, useFixDataset } from '../../shared/data/fix-dataset.ts';
import { getNavaidResolver, useNavaidDataset } from '../../shared/data/navaid-dataset.ts';
import { getProcedureResolver, useProcedureDataset } from '../../shared/data/procedure-dataset.ts';

/**
 * One of the five datasets a route string can reference, named for display
 * (`"Couldn't load procedures"`).
 */
export type PlanDatasetName = 'airports' | 'navaids' | 'fixes' | 'airways' | 'procedures';

/**
 * State of the composed plan resolver, discriminated by `status`.
 */
export type PlanResolverState =
  | {
      /** At least one dataset fetch is still in flight. */
      status: 'loading';
    }
  | {
      /** Every dataset fetch has settled; the resolver is composed from the ones that loaded. */
      status: 'ready';
      /** Flightplan resolver over every dataset that loaded. */
      resolver: FlightplanResolver;
      /** Datasets whose fetch failed, so tokens that reference them do not resolve. Empty when all loaded. */
      failed: readonly PlanDatasetName[];
    };

/**
 * Composes a {@link FlightplanResolver} from the five datasets a route string
 * can reference: airports, navaids, fixes, airways, and procedures. Reports
 * `loading` until every fetch has settled, so a route is never parsed against
 * a partial resolver set mid-load (which would surface spurious `unresolved`
 * tokens that clear a moment later). Once nothing is loading, the resolver is
 * built from whichever datasets loaded and the rest are listed as `failed`:
 * a failed procedure fetch should not stop a direct route from drawing, and
 * the caller can say why a token that needed the missing data did not
 * resolve. The underlying `useXDataset()` fetches are shared at module scope,
 * so mounting this hook triggers one request per dataset no matter how many
 * components subscribe.
 *
 * @returns The resolver state.
 */
export function usePlanResolver(): PlanResolverState {
  const airports = useAirportDataset();
  const navaids = useNavaidDataset();
  const fixes = useFixDataset();
  const airways = useAirwayDataset();
  const procedures = useProcedureDataset();

  return useMemo<PlanResolverState>(() => {
    const statuses: ReadonlyArray<[PlanDatasetName, 'loading' | 'loaded' | 'error']> = [
      ['airports', airports.status],
      ['navaids', navaids.status],
      ['fixes', fixes.status],
      ['airways', airways.status],
      ['procedures', procedures.status],
    ];
    if (statuses.some(([, status]) => status === 'loading')) {
      return { status: 'loading' };
    }
    const options: FlightplanResolverOptions = {
      ...(airports.status === 'loaded' && { airports: getAirportResolver(airports.dataset) }),
      ...(navaids.status === 'loaded' && { navaids: getNavaidResolver(navaids.dataset) }),
      ...(fixes.status === 'loaded' && { fixes: getFixResolver(fixes.dataset) }),
      ...(airways.status === 'loaded' && { airways: getAirwayResolver(airways.dataset) }),
      ...(procedures.status === 'loaded' && {
        procedures: getProcedureResolver(procedures.dataset),
      }),
    };
    return {
      status: 'ready',
      resolver: createFlightplanResolver(options),
      failed: statuses.filter(([, status]) => status === 'error').map(([name]) => name),
    };
  }, [airports, navaids, fixes, airways, procedures]);
}
