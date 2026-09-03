/**
 * @packageDocumentation
 * Browser / edge entry point. Exposes only `createJsonAircraftFeed` - the
 * HTTP-polling source has no Node-specific dependencies. `createSbsAircraftFeed`
 * and `createBeastAircraftFeed` depend on Node's `net` module (raw TCP
 * sockets have no browser API) and are only available from the default
 * entry point.
 */
export { createJsonAircraftFeed } from './json-source.js';
export type {
  AircraftFeed,
  AircraftFeedOptions,
  AircraftLostEventDetail,
  AircraftUpdateEventDetail,
  JsonFeedOptions,
  PositionHistoryEntry,
  PositionHistoryRetention,
} from './types/index.js';
