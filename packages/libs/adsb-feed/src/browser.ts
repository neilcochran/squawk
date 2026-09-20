/**
 * @packageDocumentation
 * Browser / edge entry point. Of the feed factories it exposes only
 * `createJsonAircraftFeed` - the HTTP-polling source has no Node-specific
 * dependencies - alongside the emergency classification helpers, which are
 * pure. `createSbsAircraftFeed`
 * and `createBeastAircraftFeed` depend on Node's `net` module (raw TCP
 * sockets have no browser API) and are only available from the default
 * entry point.
 */
export { createJsonAircraftFeed } from './json-source.js';
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
  ConnectionState,
  ConnectionStateEventDetail,
  JsonFeedOptions,
  PositionHistoryEntry,
  PositionHistoryRetention,
} from './types/index.js';
