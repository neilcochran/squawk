/**
 * Typed unit string literals for fuel quantities to prevent unit confusion at the call site.
 *
 * - `gal`: US liquid gallons (3.785411784 L). The UK Imperial gallon (4.54609 L) is out of
 *   scope; callers working with Imperial gallons should convert to US gallons first.
 * - `L`: litres.
 * - `lb`: international avoirdupois pounds.
 * - `kg`: kilograms.
 */
export type FuelUnit = 'gal' | 'L' | 'lb' | 'kg';

/**
 * Fuel density, expressed either in kilograms per litre or pounds per US gallon.
 *
 * The discriminated shape forces the call site to name its unit explicitly. This
 * prevents the classic silent bug where a caller passes a bare density number in the
 * wrong unit (lb/gal and kg/L differ by a factor of ~0.12) and gets a plausible-looking
 * but badly wrong weight. US flight-planning materials typically publish fuel density
 * in `lb/gal`; SI and European sources use `kg/L`.
 */
export type FuelDensity = { readonly kgPerL: number } | { readonly lbPerGal: number };

/** US liquid gallon to litre conversion factor (exact, per NIST). */
const GAL_TO_L = 3.785411784;

/** International avoirdupois pound to kilogram conversion factor (exact). */
const LB_TO_KG = 0.45359237;

/**
 * Converts a {@link FuelDensity} to its kilograms-per-litre value. Both discriminated
 * variants yield the same canonical internal unit, so every cross-dimension conversion
 * normalizes through this helper.
 *
 * @param density - Fuel density in either `kg/L` or `lb/gal`.
 * @returns Density in kg/L.
 */
function densityToKgPerL(density: FuelDensity): number {
  if ('kgPerL' in density) {
    return density.kgPerL;
  }
  return (density.lbPerGal * LB_TO_KG) / GAL_TO_L;
}

/**
 * Nominal fuel densities for common aviation fuels, referenced at 15 degrees C per
 * industry convention. Real-world fuel density varies roughly 0.7% per 10 degrees C
 * temperature change and also between refinery batches, so pilots performing precise
 * weight-and-balance calculations should prefer the field-measured density printed on
 * the fuel ticket. These constants are appropriate defaults for planning and estimation.
 */
export const FUEL_DENSITY: {
  /** 100 low-lead avgas, the standard piston-aircraft fuel in the US. */
  readonly '100LL': FuelDensity;
  /** Jet A, the primary turbine fuel used in North America. */
  readonly 'Jet A': FuelDensity;
  /** Jet A-1, the international turbine fuel (lower freeze point than Jet A). */
  readonly 'Jet A-1': FuelDensity;
  /** Jet B, a wide-cut turbine fuel used in very cold climates. */
  readonly 'Jet B': FuelDensity;
} = {
  '100LL': { kgPerL: 0.72 },
  'Jet A': { kgPerL: 0.803 },
  'Jet A-1': { kgPerL: 0.804 },
  'Jet B': { kgPerL: 0.762 },
};

/**
 * Converts US liquid gallons to litres.
 *
 * @param gallons - Fuel quantity in US gallons.
 * @returns Fuel quantity in litres.
 */
export function gallonsToLiters(gallons: number): number {
  return gallons * GAL_TO_L;
}

/**
 * Converts litres to US liquid gallons.
 *
 * @param liters - Fuel quantity in litres.
 * @returns Fuel quantity in US gallons.
 */
export function litersToGallons(liters: number): number {
  return liters / GAL_TO_L;
}

/**
 * Converts pounds to kilograms.
 *
 * @param pounds - Fuel mass in pounds.
 * @returns Fuel mass in kilograms.
 */
export function poundsToKilograms(pounds: number): number {
  return pounds * LB_TO_KG;
}

/**
 * Converts kilograms to pounds.
 *
 * @param kilograms - Fuel mass in kilograms.
 * @returns Fuel mass in pounds.
 */
export function kilogramsToPounds(kilograms: number): number {
  return kilograms / LB_TO_KG;
}

/**
 * Converts US gallons of fuel to pounds using the given fuel density.
 *
 * @param gallons - Fuel quantity in US gallons.
 * @param density - Fuel density as `{ kgPerL }` or `{ lbPerGal }`.
 * @returns Fuel mass in pounds.
 */
export function gallonsToPounds(gallons: number, density: FuelDensity): number {
  const kgPerL = densityToKgPerL(density);
  const kilograms = gallons * GAL_TO_L * kgPerL;
  return kilograms / LB_TO_KG;
}

/**
 * Converts pounds of fuel to US gallons using the given fuel density.
 *
 * @param pounds - Fuel mass in pounds.
 * @param density - Fuel density as `{ kgPerL }` or `{ lbPerGal }`.
 * @returns Fuel quantity in US gallons.
 */
export function poundsToGallons(pounds: number, density: FuelDensity): number {
  const kgPerL = densityToKgPerL(density);
  const kilograms = pounds * LB_TO_KG;
  return kilograms / kgPerL / GAL_TO_L;
}

/**
 * Converts US gallons of fuel to kilograms using the given fuel density.
 *
 * @param gallons - Fuel quantity in US gallons.
 * @param density - Fuel density as `{ kgPerL }` or `{ lbPerGal }`.
 * @returns Fuel mass in kilograms.
 */
export function gallonsToKilograms(gallons: number, density: FuelDensity): number {
  const kgPerL = densityToKgPerL(density);
  return gallons * GAL_TO_L * kgPerL;
}

/**
 * Converts kilograms of fuel to US gallons using the given fuel density.
 *
 * @param kilograms - Fuel mass in kilograms.
 * @param density - Fuel density as `{ kgPerL }` or `{ lbPerGal }`.
 * @returns Fuel quantity in US gallons.
 */
export function kilogramsToGallons(kilograms: number, density: FuelDensity): number {
  const kgPerL = densityToKgPerL(density);
  return kilograms / kgPerL / GAL_TO_L;
}

/**
 * Converts litres of fuel to pounds using the given fuel density.
 *
 * @param liters - Fuel quantity in litres.
 * @param density - Fuel density as `{ kgPerL }` or `{ lbPerGal }`.
 * @returns Fuel mass in pounds.
 */
export function litersToPounds(liters: number, density: FuelDensity): number {
  const kgPerL = densityToKgPerL(density);
  return (liters * kgPerL) / LB_TO_KG;
}

/**
 * Converts pounds of fuel to litres using the given fuel density.
 *
 * @param pounds - Fuel mass in pounds.
 * @param density - Fuel density as `{ kgPerL }` or `{ lbPerGal }`.
 * @returns Fuel quantity in litres.
 */
export function poundsToLiters(pounds: number, density: FuelDensity): number {
  const kgPerL = densityToKgPerL(density);
  return (pounds * LB_TO_KG) / kgPerL;
}

/**
 * Converts litres of fuel to kilograms using the given fuel density.
 *
 * @param liters - Fuel quantity in litres.
 * @param density - Fuel density as `{ kgPerL }` or `{ lbPerGal }`.
 * @returns Fuel mass in kilograms.
 */
export function litersToKilograms(liters: number, density: FuelDensity): number {
  const kgPerL = densityToKgPerL(density);
  return liters * kgPerL;
}

/**
 * Converts kilograms of fuel to litres using the given fuel density.
 *
 * @param kilograms - Fuel mass in kilograms.
 * @param density - Fuel density as `{ kgPerL }` or `{ lbPerGal }`.
 * @returns Fuel quantity in litres.
 */
export function kilogramsToLiters(kilograms: number, density: FuelDensity): number {
  const kgPerL = densityToKgPerL(density);
  return kilograms / kgPerL;
}
