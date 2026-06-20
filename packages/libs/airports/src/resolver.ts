import { greatCircle } from '@squawk/geo';
import { fuzzySearch } from '@squawk/search';
import type { FuzzySearchOptions, MatchRange, SearchField } from '@squawk/search';
import type { Airport, FacilityType } from '@squawk/types';

/**
 * Options for creating an airport resolver.
 */
export interface AirportResolverOptions {
  /** Array of Airport records to index for queries. */
  data: Airport[];
}

/**
 * A query to find airports near a geographic position.
 */
export interface NearestAirportQuery {
  /** Latitude in decimal degrees (WGS84). */
  lat: number;
  /** Longitude in decimal degrees (WGS84). */
  lon: number;
  /** Maximum distance in nautical miles. Defaults to 30. */
  maxDistanceNm?: number;
  /** Maximum number of results to return. Defaults to 10. */
  limit?: number;
  /** Optional set of facility types to include. When omitted, all types are included. */
  types?: ReadonlySet<FacilityType>;
  /** Minimum runway length in feet. When set, only airports with at least one runway meeting this length are included. */
  minRunwayLengthFt?: number;
}

/**
 * An airport result with distance information from a nearest-airport query.
 */
export interface NearestAirportResult {
  /** The matched airport record. */
  airport: Airport;
  /** Distance in nautical miles from the query position. */
  distanceNm: number;
}

/**
 * The searchable fields an airport {@link AirportSearchResult} can match on.
 */
export type AirportSearchField = 'faaId' | 'icao' | 'name' | 'city';

/**
 * Options for a fuzzy text search query against airport identifiers, names, and
 * cities.
 */
export interface AirportSearchQuery {
  /** Search text, matched fuzzily and case-insensitively against each airport's FAA ID, ICAO code, name, and city. */
  text: string;
  /** Maximum number of results to return. Defaults to 20. */
  limit?: number;
  /** Optional set of facility types to include. When omitted, all types are included. */
  types?: ReadonlySet<FacilityType>;
  /** Minimum match score (exclusive) in `[0, 1]` a result must reach. Defaults to 0, which keeps every match. Raise it to drop weak fuzzy matches. */
  minScore?: number;
}

/**
 * A scored airport result from a fuzzy {@link AirportResolver.search}.
 */
export interface AirportSearchResult {
  /** The matched airport record. */
  airport: Airport;
  /** Match strength in `[0, 1]`, where 1 is an exact identifier or name match. */
  score: number;
  /** Which field produced the best match, identifying what {@link AirportSearchResult.ranges} index into. */
  matchedField: AirportSearchField;
  /** Matched character ranges within the best-matching field's text, for highlighting. */
  ranges: MatchRange[];
}

/**
 * A stateless resolver providing airport lookup methods.
 */
export interface AirportResolver {
  /**
   * Looks up an airport by its FAA location identifier (e.g. "JFK", "LAX", "3N6").
   * Returns undefined if no match is found.
   */
  byFaaId(faaId: string): Airport | undefined;

  /**
   * Looks up an airport by its ICAO code (e.g. "KJFK", "KLAX").
   * Returns undefined if no match is found.
   */
  byIcao(icao: string): Airport | undefined;

  /**
   * Finds airports nearest to a geographic position, sorted by distance.
   * Results are filtered by max distance and limited to the requested count.
   */
  nearest(query: NearestAirportQuery): NearestAirportResult[];

  /**
   * Fuzzy-searches airports across FAA ID, ICAO code, name, and city. Results
   * are scored and returned best-match first, each carrying the matched field
   * and character ranges for highlighting.
   */
  search(query: AirportSearchQuery): AirportSearchResult[];
}

/**
 * Default maximum distance in nautical miles for nearest-airport queries.
 */
const DEFAULT_MAX_DISTANCE_NM = 30;

/**
 * Default maximum number of results for nearest-airport queries.
 */
const DEFAULT_NEAREST_LIMIT = 10;

/**
 * Default maximum number of results for text search queries.
 */
const DEFAULT_SEARCH_LIMIT = 20;

/**
 * Creates a stateless airport resolver. The resolver accepts an array of
 * Airport records at initialization (typically from `@squawk/airport-data`)
 * and returns an object with methods for looking up airports by identifier,
 * finding nearby airports, or searching by name/city.
 *
 * The resolver builds internal indexes at creation time for fast lookups
 * by FAA ID and ICAO code. Proximity and text searches iterate over the
 * full dataset.
 *
 * ```typescript
 * import { usBundledAirports } from '@squawk/airport-data';
 * import { createAirportResolver } from '@squawk/airports';
 *
 * const resolver = createAirportResolver({ data: usBundledAirports.records });
 *
 * const jfk = resolver.byFaaId('JFK');
 * const nearby = resolver.nearest({ lat: 40.6413, lon: -73.7781 });
 * const results = resolver.search({ text: 'chicago' });
 * ```
 */
export function createAirportResolver(options: AirportResolverOptions): AirportResolver {
  const airports = options.data;

  const byFaaIdMap = new Map<string, Airport>();
  const byIcaoMap = new Map<string, Airport>();

  for (const airport of airports) {
    byFaaIdMap.set(airport.faaId.toUpperCase(), airport);
    if (airport.icao) {
      byIcaoMap.set(airport.icao.toUpperCase(), airport);
    }
  }

  return {
    byFaaId(faaId: string): Airport | undefined {
      return byFaaIdMap.get(faaId.toUpperCase());
    },

    byIcao(icao: string): Airport | undefined {
      return byIcaoMap.get(icao.toUpperCase());
    },

    nearest(query: NearestAirportQuery): NearestAirportResult[] {
      const maxDist = query.maxDistanceNm ?? DEFAULT_MAX_DISTANCE_NM;
      const limit = query.limit ?? DEFAULT_NEAREST_LIMIT;
      const results: NearestAirportResult[] = [];

      for (const airport of airports) {
        if (query.types && !query.types.has(airport.facilityType)) {
          continue;
        }

        if (
          query.minRunwayLengthFt !== undefined &&
          !airport.runways.some(
            (rwy) => rwy.lengthFt !== undefined && rwy.lengthFt >= query.minRunwayLengthFt!,
          )
        ) {
          continue;
        }

        const dist = greatCircle.distanceNm(query.lat, query.lon, airport.lat, airport.lon);
        if (dist <= maxDist) {
          results.push({ airport, distanceNm: Math.round(dist * 100) / 100 });
        }
      }

      results.sort((a, b) => a.distanceNm - b.distanceNm);
      return results.slice(0, limit);
    },

    search(query: AirportSearchQuery): AirportSearchResult[] {
      const options: FuzzySearchOptions<Airport, AirportSearchField> = {
        keys: (airport) => {
          const fields: SearchField<AirportSearchField>[] = [
            { name: 'faaId', text: airport.faaId },
            { name: 'name', text: airport.name },
            { name: 'city', text: airport.city },
          ];
          if (airport.icao) {
            fields.push({ name: 'icao', text: airport.icao });
          }
          return fields;
        },
        limit: query.limit ?? DEFAULT_SEARCH_LIMIT,
        minScore: query.minScore ?? 0,
      };

      const types = query.types;
      if (types) {
        options.filter = (airport) => types.has(airport.facilityType);
      }

      return fuzzySearch(airports, query.text, options).map((match) => ({
        airport: match.item,
        score: match.score,
        matchedField: match.field,
        ranges: match.ranges,
      }));
    },
  };
}
