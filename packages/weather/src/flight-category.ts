import type { FlightCategory, SkyCondition } from '@squawk/types';

/**
 * Derives the flight category (VFR, MVFR, IFR, LIFR) from visibility and
 * ceiling conditions.
 *
 * The ceiling is defined as the lowest broken (BKN) or overcast (OVC) cloud layer,
 * or vertical visibility if the sky is obscured. The flight category is determined
 * by the most restrictive of ceiling or visibility.
 *
 * | Category | Ceiling            | Visibility       |
 * |----------|--------------------|------------------|
 * | VFR      | > 3,000 ft         | > 5 SM           |
 * | MVFR     | 1,000 - 3,000 ft   | 3 - 5 SM         |
 * | IFR      | 500 - 999 ft       | 1 - < 3 SM       |
 * | LIFR     | < 500 ft           | < 1 SM           |
 *
 * ```typescript
 * import { deriveFlightCategory } from '@squawk/weather';
 *
 * const category = deriveFlightCategory(10, false, { layers: [{ coverage: 'FEW', altitudeFt: 25000 }] }, false);
 * // Returns 'VFR'
 * ```
 *
 * @param visibilityStatuteMiles - Prevailing visibility in statute miles, or undefined if unknown.
 * @param isLessThan - True when visibility is reported as less than the stated value.
 * @param sky - Sky condition with cloud layers and/or vertical visibility.
 * @param isCavok - True when CAVOK is reported (implies VFR conditions).
 * @returns The derived flight category, or undefined if insufficient data to determine.
 */
export function deriveFlightCategory(
  visibilityStatuteMiles: number | undefined,
  isLessThan: boolean,
  sky: SkyCondition,
  isCavok: boolean,
): FlightCategory | undefined {
  if (isCavok) {
    return 'VFR';
  }

  // Determine ceiling: lowest BKN or OVC layer, or vertical visibility
  let ceilingFt: number | undefined;

  for (const layer of sky.layers) {
    if (layer.coverage === 'BKN' || layer.coverage === 'OVC') {
      if (ceilingFt === undefined || layer.altitudeFt < ceilingFt) {
        ceilingFt = layer.altitudeFt;
      }
    }
  }

  if (sky.verticalVisibilityFt !== undefined) {
    if (ceilingFt === undefined || sky.verticalVisibilityFt < ceilingFt) {
      ceilingFt = sky.verticalVisibilityFt;
    }
  }

  // Determine category from ceiling
  let ceilingCategory: FlightCategory | undefined;
  if (ceilingFt !== undefined) {
    if (ceilingFt < 500) {
      ceilingCategory = 'LIFR';
    } else if (ceilingFt < 1000) {
      ceilingCategory = 'IFR';
    } else if (ceilingFt <= 3000) {
      ceilingCategory = 'MVFR';
    } else {
      ceilingCategory = 'VFR';
    }
  }

  // Determine category from visibility
  let visCategory: FlightCategory | undefined;
  if (visibilityStatuteMiles !== undefined) {
    const effectiveVis = isLessThan ? visibilityStatuteMiles - 0.01 : visibilityStatuteMiles;
    if (effectiveVis < 1) {
      visCategory = 'LIFR';
    } else if (effectiveVis < 3) {
      visCategory = 'IFR';
    } else if (effectiveVis <= 5) {
      visCategory = 'MVFR';
    } else {
      visCategory = 'VFR';
    }
  }

  // Return the most restrictive category
  if (ceilingCategory === undefined && visCategory === undefined) {
    return undefined;
  }

  const categoryRank: Record<FlightCategory, number> = {
    LIFR: 0,
    IFR: 1,
    MVFR: 2,
    VFR: 3,
  };

  if (ceilingCategory === undefined) {
    return visCategory;
  }
  if (visCategory === undefined) {
    return ceilingCategory;
  }

  return categoryRank[ceilingCategory] < categoryRank[visCategory] ? ceilingCategory : visCategory;
}
