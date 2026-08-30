/**
 * @packageDocumentation
 * Node entry point. Exposes both aircraft feed factories - the browser-safe,
 * HTTP-polling JSON source and the Node-only persistent SBS/BaseStation
 * socket source.
 *
 * Browser and edge consumers should use the `./browser` entry point instead,
 * which omits `createSbsAircraftFeed` (it depends on Node's `net` module and
 * has no browser equivalent).
 */
export { createJsonAircraftFeed } from './json-source.js';
export { createSbsAircraftFeed } from './sbs-source.js';
export type {
  AircraftFeed,
  AircraftFeedOptions,
  AircraftLostEventDetail,
  AircraftUpdateEventDetail,
  JsonFeedOptions,
  PositionHistoryEntry,
  PositionHistoryRetention,
  SbsFeedOptions,
} from './types/index.js';
