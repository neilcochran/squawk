import type { Position } from '@squawk/types';

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

/**
 * Options for `createBeastAircraftFeed`.
 */
export interface BeastFeedOptions extends AircraftFeedOptions {
  /** Hostname or IP address of the Beast-format feed. */
  host: string;
  /** TCP port serving the Beast binary output. Defaults to 30005. */
  port?: number;
  /** Delay in ms before attempting to reconnect after the connection closes or errors. Defaults to 5000. */
  reconnectDelayMs?: number;
  /**
   * The receiving station's own position. Beast carries raw CPR-encoded
   * positions rather than decoded coordinates: an airborne position resolves
   * without this (from a paired even/odd frame, typically arriving within a
   * couple of seconds), but on-ground/surface position messages can only be
   * decoded against a known-nearby reference position - there is no
   * pair-only path for surface CPR. When provided, this also speeds up a new
   * aircraft's first airborne fix rather than waiting for a pair. Omit it
   * and surface aircraft simply carry no position.
   */
  receiverPosition?: Pick<Position, 'lat' | 'lon'>;
}
