/**
 * @packageDocumentation
 * Pure logic library for querying US airport data.
 */
export type { MatchRange } from '@squawk/search';
export { createAirportResolver } from './resolver.js';
export type {
  AirportResolver,
  AirportResolverOptions,
  NearestAirportQuery,
  NearestAirportResult,
  AirportSearchQuery,
  AirportSearchField,
  AirportSearchResult,
} from './resolver.js';
