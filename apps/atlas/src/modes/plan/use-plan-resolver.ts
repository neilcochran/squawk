import { useMemo } from 'react';

import { createFlightplanResolver } from '@squawk/flightplan/browser';
import type { FlightplanResolver } from '@squawk/flightplan/browser';

import { getAirportResolver, useAirportDataset } from '../../shared/data/airport-dataset.ts';
import { getAirwayResolver, useAirwayDataset } from '../../shared/data/airway-dataset.ts';
import { getFixResolver, useFixDataset } from '../../shared/data/fix-dataset.ts';
import { getNavaidResolver, useNavaidDataset } from '../../shared/data/navaid-dataset.ts';
import { getProcedureResolver, useProcedureDataset } from '../../shared/data/procedure-dataset.ts';

/**
 * Composes a {@link FlightplanResolver} from the five datasets a route string
 * can reference: airports, navaids, fixes, airways, and procedures. Returns
 * `undefined` until every dataset has loaded, so a route is never parsed
 * against a partial resolver set (which would surface spurious `unresolved`
 * tokens mid-load). The underlying `useXDataset()` fetches are shared at
 * module scope, so mounting this hook triggers one request per dataset no
 * matter how many components subscribe.
 *
 * @returns A ready flightplan resolver, or `undefined` while data loads.
 */
export function usePlanResolver(): FlightplanResolver | undefined {
  const airports = useAirportDataset();
  const navaids = useNavaidDataset();
  const fixes = useFixDataset();
  const airways = useAirwayDataset();
  const procedures = useProcedureDataset();

  return useMemo<FlightplanResolver | undefined>(() => {
    if (
      airports.status !== 'loaded' ||
      navaids.status !== 'loaded' ||
      fixes.status !== 'loaded' ||
      airways.status !== 'loaded' ||
      procedures.status !== 'loaded'
    ) {
      return undefined;
    }
    return createFlightplanResolver({
      airports: getAirportResolver(airports.dataset),
      navaids: getNavaidResolver(navaids.dataset),
      fixes: getFixResolver(fixes.dataset),
      airways: getAirwayResolver(airways.dataset),
      procedures: getProcedureResolver(procedures.dataset),
    });
  }, [airports, navaids, fixes, airways, procedures]);
}
