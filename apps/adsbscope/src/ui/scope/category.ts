import type { AircraftCategory } from '@squawk/types';

/** A category an aircraft can usefully be drawn or described as: every emitter category but `unknown`, which says nothing. */
export type KnownAircraftCategory = Exclude<AircraftCategory, 'unknown'>;

/** The shape a target's position symbol is drawn as. */
export type PositionSymbol = 'square' | 'circle' | 'triangle' | 'diamond' | 'cross';

/**
 * The position symbol for each category. Powered fixed-wing aircraft of every
 * weight class keep the square, the shape a scope has always drawn; the other
 * kinds take a shape of their own, so a helicopter or a drone can be told
 * from an airliner at a glance. A surface vehicle is drawn as a cross, which
 * cannot be filled: it is never airborne.
 */
const SYMBOL_BY_CATEGORY: Readonly<Record<KnownAircraftCategory, PositionSymbol>> = {
  light: 'square',
  small: 'square',
  large: 'square',
  highVortexLarge: 'square',
  heavy: 'square',
  highPerformance: 'square',
  rotorcraft: 'circle',
  glider: 'triangle',
  lighterThanAir: 'triangle',
  parachutist: 'triangle',
  ultralight: 'triangle',
  uav: 'diamond',
  spaceVehicle: 'square',
  surfaceEmergencyVehicle: 'cross',
  surfaceServiceVehicle: 'cross',
  pointObstacle: 'cross',
  clusterObstacle: 'cross',
  lineObstacle: 'cross',
};

/** The three-letter code of each category, as a data block shows it in place of a model it does not know. */
const CODE_BY_CATEGORY: Readonly<Record<KnownAircraftCategory, string>> = {
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

/** The name of each category, with its weight class where the standard defines one, as the inspect panel writes it. */
const LABEL_BY_CATEGORY: Readonly<Record<KnownAircraftCategory, string>> = {
  light: 'Light (under 15,500 lb)',
  small: 'Small (15,500 to 75,000 lb)',
  large: 'Large (75,000 to 300,000 lb)',
  highVortexLarge: 'High vortex large (B757)',
  heavy: 'Heavy (over 300,000 lb)',
  highPerformance: 'High performance',
  rotorcraft: 'Rotorcraft',
  glider: 'Glider or sailplane',
  lighterThanAir: 'Lighter than air',
  parachutist: 'Parachutist',
  ultralight: 'Ultralight or paraglider',
  uav: 'Unmanned aerial vehicle',
  spaceVehicle: 'Space vehicle',
  surfaceEmergencyVehicle: 'Surface emergency vehicle',
  surfaceServiceVehicle: 'Surface service vehicle',
  pointObstacle: 'Point obstacle',
  clusterObstacle: 'Cluster obstacle',
  lineObstacle: 'Line obstacle',
};

/**
 * Narrows a category to one that says something. An aircraft that broadcasts
 * `unknown` (emitter category A0, "no category information") is treated
 * exactly like one that broadcasts no category at all.
 *
 * @param category - The aircraft's category, if it broadcasts one.
 * @returns The category, or undefined if there is none or it is `unknown`.
 */
export function knownCategory(
  category: AircraftCategory | undefined,
): KnownAircraftCategory | undefined {
  return category === undefined || category === 'unknown' ? undefined : category;
}

/**
 * Picks the position symbol for an aircraft. Without a category - or with an
 * `unknown` one, as every aircraft has under a source that cannot report
 * categories - it is the square of a fixed-wing aircraft.
 *
 * @param category - The aircraft's category, if it broadcasts one.
 * @returns The symbol to draw.
 */
export function positionSymbol(category: AircraftCategory | undefined): PositionSymbol {
  const known = knownCategory(category);
  return known === undefined ? 'square' : SYMBOL_BY_CATEGORY[known];
}

/**
 * Decides whether an aircraft is a heavy, whose type a flight strip prefixes
 * with `H/`.
 *
 * @param category - The aircraft's category, if it broadcasts one.
 * @returns True for the heavy wake turbulence category.
 */
export function isHeavyCategory(category: AircraftCategory | undefined): boolean {
  return category === 'heavy';
}

/**
 * Formats a category as its three-letter code, for a data block.
 *
 * @param category - The aircraft's category, if it broadcasts one.
 * @returns The code, e.g. `HVY`, or undefined if there is no category or it is `unknown`.
 */
export function categoryCode(category: AircraftCategory | undefined): string | undefined {
  const known = knownCategory(category);
  return known === undefined ? undefined : CODE_BY_CATEGORY[known];
}

/**
 * Formats a category as its name, for the inspect panel.
 *
 * @param category - The aircraft's category, if it broadcasts one.
 * @returns The name, e.g. `Heavy (over 300,000 lb)`, or undefined if there is no category or it is `unknown`.
 */
export function categoryLabel(category: AircraftCategory | undefined): string | undefined {
  const known = knownCategory(category);
  return known === undefined ? undefined : LABEL_BY_CATEGORY[known];
}
