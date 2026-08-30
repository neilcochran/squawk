import type { Aircraft, Position } from '@squawk/types';

/**
 * A single recorded position sample for a tracked aircraft, used to build
 * per-aircraft position history.
 */
export interface PositionHistoryEntry {
  /** The recorded position. */
  position: Position;
  /** Unix epoch ms when this position was recorded. */
  recordedAt: number;
}

/**
 * Configuration for how much position history to retain per aircraft. When
 * both bounds are set, an entry is dropped once either bound is exceeded.
 */
export interface PositionHistoryRetention {
  /** Maximum number of position entries to retain per aircraft. */
  maxEntries?: number;
  /** Maximum age, in ms, of a retained position entry. */
  maxAgeMs?: number;
}

/**
 * Detail payload carried by `aircraft:new` and `aircraft:update` events as
 * `CustomEvent.detail`.
 */
export interface AircraftUpdateEventDetail {
  /** The aircraft's current normalized state. */
  aircraft: Aircraft;
}

/**
 * Detail payload carried by the `aircraft:lost` event as `CustomEvent.detail`,
 * dispatched when an aircraft has not been updated within the feed's
 * staleness window.
 */
export interface AircraftLostEventDetail {
  /** 24-bit ICAO hex address of the aircraft that was lost. */
  icaoHex: string;
  /** The aircraft's last known normalized state before it was lost. */
  lastAircraft: Aircraft;
}

/**
 * A live, typed feed of ADS-B aircraft state, normalized from a dump1090-fa
 * source into `Aircraft` events. Dispatches `aircraft:new` and
 * `aircraft:update` (both carrying {@link AircraftUpdateEventDetail}) and
 * `aircraft:lost` (carrying {@link AircraftLostEventDetail}).
 *
 * Create one with `createJsonAircraftFeed` or `createSbsAircraftFeed` rather
 * than implementing this interface directly.
 */
export interface AircraftFeed extends EventTarget {
  /** Starts polling or connecting to the underlying source. No-op if already started. */
  start(): void;
  /** Stops the underlying source and clears all tracked state. No-op if already stopped. */
  stop(): void;
  /** Returns the current normalized state for one aircraft, or undefined if not currently tracked. */
  getAircraft(icaoHex: string): Aircraft | undefined;
  /** Returns the current normalized state for every currently tracked aircraft. */
  getAllAircraft(): Aircraft[];
  /** Returns the retained position history for one aircraft, oldest first. Empty if not tracked or no positions recorded yet. */
  getPositionHistory(icaoHex: string): PositionHistoryEntry[];
}
