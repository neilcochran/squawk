import type { AltitudeBound } from '@squawk/types';

/**
 * Tests whether an altitude in feet MSL falls within the vertical bounds
 * defined by a floor and ceiling AltitudeBound pair.
 *
 * Altitude reference handling:
 * - `SFC` - treated as 0 ft MSL (surface level)
 * - `MSL` - compared directly against the queried altitude
 * - `AGL` - the vertical check is skipped for that bound (returns true),
 *   because converting AGL to MSL requires terrain elevation data that this
 *   library does not have. This is a conservative approach: the feature is
 *   included rather than silently excluded when the bound cannot be resolved.
 *   Consumers can inspect the returned AltitudeBound references and apply
 *   their own terrain lookup if needed.
 */
export function altitudeMatches(
  /** Queried altitude in feet MSL. */
  altitudeFt: number,
  /** Lower vertical bound of the airspace feature. */
  floor: AltitudeBound,
  /** Upper vertical bound of the airspace feature. */
  ceiling: AltitudeBound,
): boolean {
  const floorFt = resolveAltitude(floor);
  const ceilingFt = resolveAltitude(ceiling);

  // If either bound is AGL (resolved as null), skip that side of the check.
  if (floorFt !== null && altitudeFt < floorFt) return false;
  if (ceilingFt !== null && altitudeFt > ceilingFt) return false;

  return true;
}

/**
 * Resolves an AltitudeBound to a feet MSL value for comparison, or null
 * if the bound uses AGL reference and cannot be resolved without terrain data.
 */
function resolveAltitude(bound: AltitudeBound): number | null {
  switch (bound.reference) {
    case 'SFC':
      return 0;
    case 'MSL':
      return bound.valueFt;
    case 'AGL':
      return null;
  }
}
