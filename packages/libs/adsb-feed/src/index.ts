/**
 * @packageDocumentation
 * Node entry point. Exposes all three aircraft feed factories - the
 * browser-safe, HTTP-polling JSON source, and the Node-only persistent
 * SBS/BaseStation and Beast binary socket sources - plus
 * `createAircraftFeedForSource`, which dispatches to one of them for a
 * source chosen at runtime, and the emergency classification helpers.
 *
 * Browser and edge consumers should use the `./browser` entry point instead,
 * which omits `createSbsAircraftFeed`, `createBeastAircraftFeed`, and
 * `createAircraftFeedForSource` (all depend on Node's `net` module and have
 * no browser equivalent).
 */
export { createBeastAircraftFeed } from './beast-source.js';
export { createJsonAircraftFeed } from './json-source.js';
export { createSbsAircraftFeed } from './sbs-source.js';
export { createAircraftFeedForSource } from './source-feed.js';
export { DEFAULT_PORT_BY_SOURCE } from './default-ports.js';
export {
  EMERGENCY_SQUAWKS,
  isDeclaredEmergencyState,
  isEmergencyAircraft,
  isEmergencySquawk,
} from './emergency.js';
export type {
  AircraftFeed,
  AircraftFeedOptions,
  AircraftLostEventDetail,
  AircraftUpdateEventDetail,
  BeastFeedOptions,
  ConnectionState,
  ConnectionStateEventDetail,
  FeedSource,
  JsonFeedOptions,
  PositionHistoryEntry,
  PositionHistoryRetention,
  SbsFeedOptions,
  SourceFeedOptions,
} from './types/index.js';
