/**
 * @packageDocumentation
 * Pure logic library for point-in-airspace queries against US airspace polygons.
 */
export type { MatchRange } from '@squawk/search';
export { createAirspaceResolver } from './resolver.js';
export type {
  AirspaceResolver,
  AirspaceResolverOptions,
  AirspaceQuery,
  AirspaceCentroidQuery,
  AirspaceByIdentifierOptions,
  AirspaceSearchField,
  AirspaceSearchQuery,
  AirspaceSearchResult,
} from './resolver.js';
