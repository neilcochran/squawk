/**
 * @packageDocumentation
 * Pure logic library for point-in-airspace queries against US airspace polygons.
 */
export { createAirspaceResolver } from './resolver.js';
export type {
  AirspaceResolver,
  AirspaceResolverOptions,
  AirspaceQuery,
  AirspaceCentroidQuery,
  AirspaceByIdentifierOptions,
} from './resolver.js';
