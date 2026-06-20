/**
 * @packageDocumentation
 * Pure logic library for querying US airway data.
 */
export type { MatchRange } from '@squawk/search';
export { createAirwayResolver } from './resolver.js';
export type {
  AirwayResolver,
  AirwayResolverOptions,
  AirwayExpansionResult,
  AirwaySearchQuery,
  AirwaySearchField,
  AirwaySearchResult,
  AirwayByFixResult,
} from './resolver.js';
