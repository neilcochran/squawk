import { useMemo } from 'react';

import { greatCircle } from '@squawk/geo';
import type { NavaidResolver } from '@squawk/navaids/browser';
import type { Fix, FixNavaidAssociation, Navaid } from '@squawk/types';

import { getNavaidResolver, useNavaidDataset } from '../data/navaid-dataset.ts';

import { useAmbiguousPointIdentifiers } from './entity-resolver.ts';
import { encodePointId, encodeSelected } from './entity.ts';

/**
 * The `selected` value for the navaid a fix's association names, so the
 * fix panel can link the row to it. The match takes both the identifier
 * and the facility type, because a localizer or marker beacon shares its
 * identifier with unrelated navaids elsewhere; where the identifier is
 * published on more than one navaid of that type, the one nearest the fix
 * wins. The selection carries a disambiguating position when the
 * identifier is shared, the same encoding a map click or a search result
 * produces.
 *
 * Returns `undefined` when the facility is not a navaid record: a
 * localizer or marker beacon, which belong to an airport's ILS, or a
 * navaid the dataset does not carry.
 *
 * @param association - One of the fix's navaid associations.
 * @param fix - The fix the association defines, for the nearest-match tie-break.
 * @param resolver - Navaid resolver over the loaded dataset.
 * @param ambiguousNavaids - Navaid identifiers published on two or more records.
 * @returns The navaid selection string, or `undefined` when there is nothing to link to.
 */
export function navaidSelectionForAssociation(
  association: FixNavaidAssociation,
  fix: Pick<Fix, 'lat' | 'lon'>,
  resolver: NavaidResolver,
  ambiguousNavaids: ReadonlySet<string>,
): string | undefined {
  let nearest: Navaid | undefined;
  let nearestDistanceNm = Number.POSITIVE_INFINITY;
  for (const navaid of resolver.byIdent(association.navaidId)) {
    if (navaid.type !== association.navaidType) {
      continue;
    }
    const distanceNm = greatCircle.distanceNm(fix.lat, fix.lon, navaid.lat, navaid.lon);
    if (distanceNm < nearestDistanceNm) {
      nearest = navaid;
      nearestDistanceNm = distanceNm;
    }
  }
  if (nearest === undefined) {
    return undefined;
  }
  const position = ambiguousNavaids.has(nearest.identifier)
    ? { lat: nearest.lat, lon: nearest.lon }
    : undefined;
  return encodeSelected({ type: 'navaid', id: encodePointId(nearest.identifier, position) });
}

/**
 * Navaid selections for every association of a fix, index-aligned with
 * `fix.navaidAssociations`: each entry is what
 * {@link navaidSelectionForAssociation} returns for that row, and every
 * entry is `undefined` while the navaid dataset is loading or errored.
 *
 * @param fix - The fix whose association rows to link.
 * @returns One selection (or `undefined`) per association.
 */
export function useFixAssociationSelections(fix: Fix): ReadonlyArray<string | undefined> {
  const navaids = useNavaidDataset();
  const ambiguous = useAmbiguousPointIdentifiers();
  return useMemo(() => {
    if (navaids.status !== 'loaded') {
      return fix.navaidAssociations.map(() => undefined);
    }
    const resolver = getNavaidResolver(navaids.dataset);
    return fix.navaidAssociations.map((association) =>
      navaidSelectionForAssociation(association, fix, resolver, ambiguous.navaids),
    );
  }, [fix, navaids, ambiguous]);
}
