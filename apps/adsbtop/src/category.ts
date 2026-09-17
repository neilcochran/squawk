import type { AircraftCategory } from '@squawk/types';

/**
 * Every {@link AircraftCategory} in ADS-B emitter-category table order
 * (A1-A7, then B, then C). Sorting by position here puts the A-class weight
 * classes in ascending order instead of the arbitrary alphabetical order
 * of their names. `unknown` (A0, "no category information") is deliberately
 * absent - it sorts with aircraft that have no category at all.
 */
const CATEGORY_ORDER: readonly AircraftCategory[] = [
  'light',
  'small',
  'large',
  'highVortexLarge',
  'heavy',
  'highPerformance',
  'rotorcraft',
  'glider',
  'lighterThanAir',
  'parachutist',
  'ultralight',
  'uav',
  'spaceVehicle',
  'surfaceEmergencyVehicle',
  'surfaceServiceVehicle',
  'pointObstacle',
  'clusterObstacle',
  'lineObstacle',
];

/** Three-letter code per category, for the table's `Cat` column. */
const CATEGORY_CODES: Readonly<Record<AircraftCategory, string>> = {
  unknown: '-',
  light: 'LGT',
  small: 'SML',
  large: 'LRG',
  highVortexLarge: 'HVL',
  heavy: 'HVY',
  highPerformance: 'HPF',
  rotorcraft: 'ROT',
  glider: 'GLD',
  lighterThanAir: 'LTA',
  parachutist: 'PAR',
  ultralight: 'ULT',
  uav: 'UAV',
  spaceVehicle: 'SPC',
  surfaceEmergencyVehicle: 'SEV',
  surfaceServiceVehicle: 'SSV',
  pointObstacle: 'OBS',
  clusterObstacle: 'OBC',
  lineObstacle: 'OBL',
};

/** Full label per category, with the weight class where the standard defines one, for the detail view. */
const CATEGORY_LABELS: Readonly<Record<AircraftCategory, string>> = {
  unknown: 'Unknown (no category information)',
  light: 'Light (under 15,500 lb)',
  small: 'Small (15,500 to 75,000 lb)',
  large: 'Large (75,000 to 300,000 lb)',
  highVortexLarge: 'High vortex large (B-757 class)',
  heavy: 'Heavy (over 300,000 lb)',
  highPerformance: 'High performance (over 5 g, over 400 kt)',
  rotorcraft: 'Rotorcraft',
  glider: 'Glider or sailplane',
  lighterThanAir: 'Lighter than air',
  parachutist: 'Parachutist or skydiver',
  ultralight: 'Ultralight, hang glider, or paraglider',
  uav: 'Unmanned aerial vehicle',
  spaceVehicle: 'Space or trans-atmospheric vehicle',
  surfaceEmergencyVehicle: 'Surface emergency vehicle',
  surfaceServiceVehicle: 'Surface service vehicle',
  pointObstacle: 'Point obstacle (including tethered balloons)',
  clusterObstacle: 'Cluster obstacle',
  lineObstacle: 'Line obstacle',
};

/**
 * Formats a category as its three-letter code for the `Cat` column.
 *
 * @param category - The aircraft's category, if reported.
 * @returns The code, e.g. `"LRG"`, or `"-"` if unreported or reported as unknown.
 */
export function formatCategoryCode(category: AircraftCategory | undefined): string {
  return category === undefined ? '-' : CATEGORY_CODES[category];
}

/**
 * Formats a category as its full label for the detail view.
 *
 * @param category - The aircraft's category, if reported.
 * @returns The label, e.g. `"Large (75,000 to 300,000 lb)"`, or `"-"` if unreported.
 */
export function formatCategoryLabel(category: AircraftCategory | undefined): string {
  return category === undefined ? '-' : CATEGORY_LABELS[category];
}

/**
 * The category's position in emitter-category table order, for sorting the
 * `Cat` column.
 *
 * @param category - The aircraft's category, if reported.
 * @returns A sortable ordinal, or undefined for an unreported or unknown category so it sinks to the bottom.
 */
export function categoryOrdinal(category: AircraftCategory | undefined): number | undefined {
  if (category === undefined) {
    return undefined;
  }
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? undefined : index;
}
