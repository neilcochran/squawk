import type { AirspaceFeature, AltitudeBound } from '@squawk/types';

/**
 * Floor of Class A airspace: 18,000 ft MSL, per 14 CFR 71.33.
 */
const CLASS_A_FLOOR: AltitudeBound = { valueFt: 18000, reference: 'MSL' };

/**
 * Ceiling of Class A airspace: FL600, per 14 CFR 71.33. Above it the
 * airspace is Class E again (71.71(a)), which the dataset does not carry.
 */
const CLASS_A_CEILING: AltitudeBound = { valueFt: 60000, reference: 'MSL' };

/**
 * Name carried by every Class A feature. The FAA assigns Class A no name or
 * identifier of its own - it is one block over the whole domestic airspace,
 * not a set of named areas - so every feature shares this name and an empty
 * identifier. The empty identifier also keeps the features out of the
 * identifier-keyed lookups in `@squawk/airspace`, where a center code would
 * otherwise surface under `byAirport`.
 */
export const CLASS_A_NAME = 'CLASS A';

/**
 * Centers whose single CTA/FIR stratum stands in for a HIGH stratum. San
 * Juan's airspace is Class A above 18,000 ft like the rest of the United
 * States (Puerto Rico is "United States" under 14 CFR 1.1), but NASR
 * publishes ZSU as one combined oceanic stratum rather than LOW and HIGH,
 * so its lateral extent is taken from that stratum instead.
 */
const COMBINED_STRATUM_CENTERS: ReadonlySet<string> = new Set(['ZSU']);

/**
 * Decides whether an ARTCC feature's lateral extent is also the extent of
 * Class A airspace. That is every domestic HIGH stratum, which NASR
 * publishes for the 20 CONUS centers and Anchorage, plus the combined
 * stratum of the centers in {@link COMBINED_STRATUM_CENTERS}. The oceanic
 * centers (ZAK, ZAP, ZWY) and Honolulu (ZHN) publish no HIGH stratum, and
 * 71.33 designates no Class A there, so they contribute nothing.
 *
 * Exported for unit testing.
 */
export function isClassASource(feature: AirspaceFeature): boolean {
  if (feature.type !== 'ARTCC') {
    return false;
  }
  if (feature.artccStratum === 'HIGH') {
    return true;
  }
  return feature.artccStratum === 'CTA/FIR' && COMBINED_STRATUM_CENTERS.has(feature.identifier);
}

/**
 * Derives Class A airspace features from the parsed ARTCC boundaries. The
 * FAA publishes Class A as a rule rather than as geometry: 18,000 ft MSL to
 * FL600 over the 48 contiguous states and Alaska, their coastal waters, and
 * the designated offshore areas within domestic radar coverage. The HIGH
 * stratum of each domestic center traces exactly that lateral extent, and
 * the build already attaches the same vertical block to it, so one Class A
 * feature is emitted per qualifying stratum shape with the stratum's
 * polygon and the Class A bounds. Adjacent centers' HIGH polygons abut, so a
 * point on a shared boundary can fall inside two Class A features;
 * consumers that want the single answer dedupe by type.
 *
 * Two carve-outs in 71.33 are not applied and are documented instead: the
 * Alaska Peninsula west of 160 W, which ZAN HIGH covers, and the airspace
 * within 1,500 ft of the surface, which only matters over terrain above
 * 16,500 ft.
 *
 * @param artccFeatures - Every ARTCC feature the build parsed.
 * @returns One Class A feature per qualifying ARTCC shape, in input order.
 */
export function deriveClassA(artccFeatures: readonly AirspaceFeature[]): AirspaceFeature[] {
  return artccFeatures.filter(isClassASource).map((source) => ({
    type: 'CLASS_A',
    name: CLASS_A_NAME,
    identifier: '',
    floor: CLASS_A_FLOOR,
    ceiling: CLASS_A_CEILING,
    boundary: source.boundary,
    state: null,
    controllingFacility: null,
    scheduleDescription: null,
    artccStratum: null,
  }));
}
