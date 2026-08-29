import type { PositionHistoryRetention } from './feed.js';

/**
 * Options shared by every `create*AircraftFeed` factory.
 */
export interface AircraftFeedOptions {
  /** Milliseconds an aircraft can go without an update before `aircraft:lost` fires. Defaults to 60000. */
  staleAfterMs?: number;
  /** How much position history to retain per aircraft. Unbounded (subject to memory) if omitted. */
  positionHistoryRetention?: PositionHistoryRetention;
}

/**
 * Options for `createJsonAircraftFeed`.
 */
export interface JsonFeedOptions extends AircraftFeedOptions {
  /**
   * Full URL to the dump1090-fa `aircraft.json` endpoint, e.g.
   * `"http://192.168.1.50:8080/data/aircraft.json"`. Not assembled from a
   * host and port - pass the complete URL for your station's configuration.
   */
  url: string;
  /** Polling interval in ms. Defaults to 1000 - dump1090-fa itself refreshes roughly once a second, so polling faster does not return fresher data. */
  pollIntervalMs?: number;
  /** Override for the global `fetch`, for tests or non-standard runtimes. */
  fetch?: typeof fetch;
}

/**
 * Options for `createSbsAircraftFeed`.
 */
export interface SbsFeedOptions extends AircraftFeedOptions {
  /** Hostname or IP address of the dump1090-fa station. */
  host: string;
  /** TCP port serving the SBS/BaseStation output. Defaults to 30003. */
  port?: number;
  /** Delay in ms before attempting to reconnect after the connection closes or errors. Defaults to 5000. */
  reconnectDelayMs?: number;
}
