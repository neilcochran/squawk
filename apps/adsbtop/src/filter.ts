import { isEmergencyAircraft } from '@squawk/adsb-feed';
import type { Aircraft, Coordinates } from '@squawk/types';
import { altitude, distance } from '@squawk/units';

import { distanceToAircraftNm } from './location.js';
import { matchesSearch } from './search.js';
import type { UnitSystem } from './units.js';

/**
 * A parsed `[F]ilter` query: every part must match for an aircraft to stay
 * in the table. Built by {@link parseFilter} from text like
 * `is:airborne within:25 UAL`.
 */
export interface AircraftFilter {
  /** The text the filter was parsed from, trimmed, for the status bar and for pre-filling the prompt. */
  text: string;
  /** Free-text terms, each matched against ICAO hex, callsign, squawk, and N-number the way search does. */
  terms: readonly string[];
  /** `true` keeps only on-ground aircraft (`is:ground`), `false` only airborne (`is:airborne`), undefined either. */
  onGround: boolean | undefined;
  /** Whether only emergency aircraft are kept (`is:emergency`) - see `isEmergencyAircraft`. */
  emergencyOnly: boolean;
  /** Maximum distance from the receiver in nautical miles (`within:<nm>`), or undefined for no limit. */
  withinNm: number | undefined;
  /** Altitude the aircraft must be above, in feet (`alt:>N` or the low end of `alt:N-M`), or undefined for no floor. */
  minAltitudeFt: number | undefined;
  /** Altitude the aircraft must be below, in feet (`alt:<N` or the high end of `alt:N-M`), or undefined for no ceiling. */
  maxAltitudeFt: number | undefined;
}

/** A `parseFilter` failure: what was wrong with the query text. */
export interface FilterError {
  /** Human-readable message describing the first bad term, for the prompt to show. */
  message: string;
}

/** Accepted values for an `is:` qualifier, mapped to their canonical name. */
const IS_QUALIFIERS: Readonly<Record<string, 'airborne' | 'ground' | 'emergency'>> = {
  airborne: 'airborne',
  air: 'airborne',
  ground: 'ground',
  gnd: 'ground',
  emergency: 'emergency',
  emerg: 'emergency',
};

/**
 * Parses `[F]ilter` query text into an {@link AircraftFilter}. Terms are
 * whitespace-separated and all must match. `is:airborne` (`is:air`),
 * `is:ground` (`is:gnd`), and `is:emergency` (`is:emerg`) select by state,
 * `within:<distance>` by distance from the receiver, `alt:>N`, `alt:<N`,
 * or `alt:N-M` by altitude, and any other term is free text matched the
 * way `[S]earch` matches. A bare `within:` or `alt:` value is read in the
 * active unit system (nautical miles and feet, or kilometres and metres
 * under metric); an explicit `nm`/`km` or `ft`/`m` suffix always wins.
 * `>` and `<` are strict, a range is inclusive, and several `alt:` terms
 * narrow each other. Qualifier names
 * and values are case-insensitive. Returns a {@link FilterError} rather
 * than guessing when a term is malformed, contradictory, or needs a
 * location that is not configured.
 *
 * @param text - The query text. Must contain at least one term - the caller treats an empty query as "clear the filter" before calling this.
 * @param hasLocation - Whether a receiver location is configured, which `within:` needs.
 * @param units - The active unit system, which decides how a bare `within:` value is read.
 * @returns The parsed filter, or a {@link FilterError} for the first bad term.
 */
export function parseFilter(
  text: string,
  hasLocation: boolean,
  units: UnitSystem,
): AircraftFilter | FilterError {
  const trimmed = text.trim();
  const terms: string[] = [];
  let onGround: boolean | undefined;
  let emergencyOnly = false;
  let withinNm: number | undefined;
  let minAltitudeFt: number | undefined;
  let maxAltitudeFt: number | undefined;

  for (const raw of trimmed.split(/\s+/)) {
    const separator = raw.indexOf(':');
    if (separator === -1) {
      terms.push(raw);
      continue;
    }
    const qualifier = raw.slice(0, separator).toLowerCase();
    const value = raw.slice(separator + 1);
    if (qualifier === 'is') {
      const state = IS_QUALIFIERS[value.toLowerCase()];
      if (state === undefined) {
        return {
          message: `Unknown state "${value}" - expected is:airborne, is:ground, or is:emergency.`,
        };
      }
      if (state === 'emergency') {
        emergencyOnly = true;
      } else {
        const wantGround = state === 'ground';
        if (onGround !== undefined && onGround !== wantGround) {
          return { message: 'is:airborne and is:ground cannot both apply.' };
        }
        onGround = wantGround;
      }
      continue;
    }
    if (qualifier === 'within') {
      if (!hasLocation) {
        return { message: 'within: needs a receiver location - start with --lat/--lon.' };
      }
      const match = /^(\d+(?:\.\d+)?)(nm|km)?$/i.exec(value);
      if (match === null) {
        return {
          message: `Invalid distance "${value}" - expected within:<distance>, optionally with nm or km.`,
        };
      }
      const magnitude = Number(match[1]);
      const suffix = match[2]?.toLowerCase() ?? (units === 'metric' ? 'km' : 'nm');
      withinNm = suffix === 'km' ? distance.kilometersToNauticalMiles(magnitude) : magnitude;
      continue;
    }
    if (qualifier === 'alt') {
      const match = /^(?:([<>])(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?))(ft|m)?$/i.exec(
        value,
      );
      if (match === null) {
        return {
          message: `Invalid altitude "${value}" - expected alt:>N, alt:<N, or alt:N-M, optionally with ft or m.`,
        };
      }
      const suffix = match[5]?.toLowerCase() ?? (units === 'metric' ? 'm' : 'ft');
      const toFeet = (raw: string): number =>
        suffix === 'm' ? altitude.metersToFeet(Number(raw)) : Number(raw);
      if (match[1] === '>' && match[2] !== undefined) {
        minAltitudeFt = Math.max(minAltitudeFt ?? -Infinity, toFeet(match[2]));
      } else if (match[1] === '<' && match[2] !== undefined) {
        maxAltitudeFt = Math.min(maxAltitudeFt ?? Infinity, toFeet(match[2]));
      } else if (match[3] !== undefined && match[4] !== undefined) {
        minAltitudeFt = Math.max(minAltitudeFt ?? -Infinity, toFeet(match[3]));
        maxAltitudeFt = Math.min(maxAltitudeFt ?? Infinity, toFeet(match[4]));
      }
      if (
        minAltitudeFt !== undefined &&
        maxAltitudeFt !== undefined &&
        minAltitudeFt > maxAltitudeFt
      ) {
        return { message: 'alt: floor is above its ceiling - nothing can match.' };
      }
      continue;
    }
    return { message: `Unknown qualifier "${qualifier}:" - expected is:, within:, or alt:.` };
  }

  return { text: trimmed, terms, onGround, emergencyOnly, withinNm, minAltitudeFt, maxAltitudeFt };
}

/**
 * Whether `aircraft` satisfies every part of `filter`.
 *
 * @param aircraft - The aircraft to test.
 * @param filter - The parsed filter.
 * @param location - The configured receiver location, needed for `withinNm`. An aircraft with no position never satisfies a distance limit.
 * @returns True if the aircraft should stay in the table.
 */
export function matchesFilter(
  aircraft: Aircraft,
  filter: AircraftFilter,
  location: Coordinates | undefined,
): boolean {
  if (filter.onGround !== undefined && (aircraft.onGround === true) !== filter.onGround) {
    return false;
  }
  if (filter.emergencyOnly && !isEmergencyAircraft(aircraft)) {
    return false;
  }
  if (filter.withinNm !== undefined) {
    const distanceNm =
      location === undefined ? undefined : distanceToAircraftNm(location, aircraft);
    if (distanceNm === undefined || distanceNm > filter.withinNm) {
      return false;
    }
  }
  if (filter.minAltitudeFt !== undefined || filter.maxAltitudeFt !== undefined) {
    const altitudeFt = aircraft.position?.baroAltitudeFt ?? aircraft.position?.geoAltitudeFt;
    if (altitudeFt === undefined) {
      return false;
    }
    if (filter.minAltitudeFt !== undefined && altitudeFt <= filter.minAltitudeFt) {
      return false;
    }
    if (filter.maxAltitudeFt !== undefined && altitudeFt >= filter.maxAltitudeFt) {
      return false;
    }
  }
  return filter.terms.every((term) => matchesSearch(aircraft, term));
}

/**
 * The subset of `aircraft` satisfying `filter`, in the same order.
 *
 * @param aircraft - The aircraft to filter, in display order.
 * @param filter - The parsed filter, or undefined for no filtering.
 * @param location - The configured receiver location, if any.
 * @returns The matching aircraft; `aircraft` itself when `filter` is undefined.
 */
export function filterAircraft(
  aircraft: readonly Aircraft[],
  filter: AircraftFilter | undefined,
  location: Coordinates | undefined,
): readonly Aircraft[] {
  return filter === undefined
    ? aircraft
    : aircraft.filter((candidate) => matchesFilter(candidate, filter, location));
}
