/**
 * @packageDocumentation
 * Node entry point. Exposes all three aircraft feed factories - the
 * browser-safe, HTTP-polling JSON source, and the Node-only persistent
 * SBS/BaseStation and Beast binary socket sources.
 *
 * Browser and edge consumers should use the `./browser` entry point instead,
 * which omits `createSbsAircraftFeed` and `createBeastAircraftFeed` (both
 * depend on Node's `net` module and have no browser equivalent).
 */
export { createBeastAircraftFeed } from './beast-source.js';
export { createJsonAircraftFeed } from './json-source.js';
export { createSbsAircraftFeed } from './sbs-source.js';
export type {
  AircraftFeed,
  AircraftFeedOptions,
  AircraftLostEventDetail,
  AircraftUpdateEventDetail,
  BeastFeedOptions,
  JsonFeedOptions,
  PositionHistoryEntry,
  PositionHistoryRetention,
  SbsFeedOptions,
} from './types/index.js';
