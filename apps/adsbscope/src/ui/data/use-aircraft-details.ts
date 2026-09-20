import { useEffect, useState } from 'react';

import type { ScopeAircraftDetails } from '../../shared/protocol.js';

/** The details last loaded, and the aircraft they belong to. */
interface LoadedDetails {
  /** The ICAO hex the details were asked for. */
  icaoHex: string;
  /** What came back. */
  details: ScopeAircraftDetails;
}

/**
 * Loads the registry details of the selected aircraft, once each time the
 * selection changes. Details are only ever returned for the aircraft they
 * were loaded for: while a new selection's details are on their way, and if
 * there are none, the result is undefined rather than the previous
 * aircraft's.
 *
 * @param icaoHex - The ICAO hex of the selected aircraft, or undefined if none is selected.
 * @param loadAircraftDetails - Loads one aircraft's details, resolving to undefined if there are none.
 * @returns The selected aircraft's details, or undefined.
 */
export function useAircraftDetails(
  icaoHex: string | undefined,
  loadAircraftDetails: (icaoHex: string) => Promise<ScopeAircraftDetails | undefined>,
): ScopeAircraftDetails | undefined {
  const [loaded, setLoaded] = useState<LoadedDetails | undefined>(undefined);

  useEffect(() => {
    if (icaoHex === undefined) {
      return undefined;
    }
    let cancelled = false;
    void loadAircraftDetails(icaoHex).then((details) => {
      if (!cancelled && details !== undefined) {
        setLoaded({ icaoHex, details });
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [icaoHex, loadAircraftDetails]);

  return loaded !== undefined && loaded.icaoHex === icaoHex ? loaded.details : undefined;
}
