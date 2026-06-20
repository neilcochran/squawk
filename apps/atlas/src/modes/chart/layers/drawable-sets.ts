import type { Airport, FacilityType, Navaid, NavaidType } from '@squawk/types';

/**
 * Navaid types the chart renders. `FAN_MARKER`, `MARINE_NDB`, and `VOT`
 * are intentionally excluded: too niche for a general chart view, and they
 * clutter at low zoom without informing typical IFR or VFR navigation.
 *
 * Single source of truth for the navaid corpus. The navaids layer projects
 * exactly these types into its GeoJSON source, and chart-mode search scopes
 * its navaid query to the same set, so a navaid is searchable iff it is
 * drawable. Shutdown facilities are excluded separately by
 * {@link isDrawableNavaid} because status is a per-record attribute, not a
 * type.
 */
export const RENDERED_NAVAID_TYPES: ReadonlySet<NavaidType> = new Set<NavaidType>([
  'VOR',
  'VORTAC',
  'VOR/DME',
  'TACAN',
  'DME',
  'NDB',
  'NDB/DME',
]);

/**
 * Whether a navaid is part of the chart's drawable navaid corpus: an
 * operational (non-shutdown) facility whose type is in
 * {@link RENDERED_NAVAID_TYPES}. Shared by the navaids layer projection and
 * chart-mode search so the rendered set and the searchable set never drift.
 *
 * @param navaid - The navaid record to test.
 * @returns True when the chart's navaids layer renders this record.
 */
export function isDrawableNavaid(navaid: Navaid): boolean {
  return navaid.status !== 'SHUTDOWN' && RENDERED_NAVAID_TYPES.has(navaid.type);
}

/**
 * Facility types the chart's airports layer renders. Only `AIRPORT` for now:
 * heliports, seaplane bases, and other facility types will land in their own
 * layers later.
 *
 * Single source of truth for the airport corpus. The airports layer projects
 * exactly these facility types into its GeoJSON source, and chart-mode search
 * scopes its airport query to the same set, so an airport is searchable iff it
 * is drawable.
 */
export const RENDERED_AIRPORT_FACILITY_TYPES: ReadonlySet<FacilityType> = new Set<FacilityType>([
  'AIRPORT',
]);

/**
 * Whether an airport is part of the chart's drawable airport corpus: a
 * facility whose type is in {@link RENDERED_AIRPORT_FACILITY_TYPES}. Shared by
 * the airports layer projection and chart-mode search so the rendered set and
 * the searchable set never drift.
 *
 * @param airport - The airport record to test.
 * @returns True when the chart's airports layer renders this record.
 */
export function isDrawableAirport(airport: Airport): boolean {
  return RENDERED_AIRPORT_FACILITY_TYPES.has(airport.facilityType);
}
