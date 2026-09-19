import type { ConnectionState, FeedSource } from '@squawk/adsb-feed';
import type { Coordinates } from '@squawk/types';

/** The app's name, as shown in the UI and printed by the CLI. */
export const APP_NAME = 'adsbscope';

/** The scope's view styles, in the order they are offered: a modern digital scope, and a sweep-era analog PPI. */
export const SCOPE_MODE_IDS = ['digital', 'analog'] as const;

/** Identifies one of the scope's view styles. */
export type ScopeModeId = (typeof SCOPE_MODE_IDS)[number];

/** The view style the scope opens in unless told otherwise. */
export const DEFAULT_SCOPE_MODE_ID: ScopeModeId = 'digital';

/**
 * Narrows a string to a {@link ScopeModeId}.
 *
 * @param value - The candidate, e.g. a CLI flag value or a decoded config field.
 * @returns True if it names a view style.
 */
export function isScopeModeId(value: unknown): value is ScopeModeId {
  return SCOPE_MODE_IDS.some((id) => id === value);
}

/** Where the scope's traffic comes from: a live dump1090-fa output, or a recorded session being replayed. */
export type ScopeSource = FeedSource | 'replay';

/**
 * The port the scope server listens on unless told otherwise. Shared, rather
 * than private to the CLI, because the UI dev server proxies to it.
 */
export const DEFAULT_LISTEN_PORT = 8090;

/** Path prefix of every endpoint the scope server answers itself; anything else is a static UI file. */
export const API_PREFIX = '/api';

/** Path of the endpoint serving the {@link ScopeConfig} as JSON. */
export const CONFIG_PATH = `${API_PREFIX}/config`;

/** Path of the server-sent events endpoint streaming {@link ScopeSnapshot}s. */
export const STREAM_PATH = `${API_PREFIX}/stream`;

/** Name of the server-sent event carrying a {@link ScopeSnapshot} as its JSON data. */
export const SNAPSHOT_EVENT = 'snapshot';

/**
 * A point in the scope's own coordinate system: bearing and range from the
 * receiver. The server resolves every geographic position into this form, so
 * the browser only ever does flat 2D drawing.
 */
export interface PolarPoint {
  /** Bearing from the receiver in degrees true (0-360). */
  trueBearingDeg: number;
  /** Great-circle distance from the receiver in nautical miles. */
  rangeNm: number;
}

/** One tracked aircraft as the scope draws it. */
export interface ScopeTarget {
  /** 24-bit ICAO hexadecimal address. */
  icaoHex: string;
  /** Current callsign, if the aircraft has sent one. */
  callsign?: string;
  /** Squawk transponder code. */
  squawk?: string;
  /** Altitude in feet MSL: barometric when available, otherwise geometric. */
  altitudeFt?: number;
  /** Ground speed in knots. */
  groundSpeedKt?: number;
  /** Track over ground in degrees true. */
  trueTrackDeg?: number;
  /** Vertical rate in feet per minute. */
  verticalRateFtPerMin?: number;
  /** True if the aircraft reports being on the ground. */
  onGround?: boolean;
  /** Current position relative to the receiver. Absent until the aircraft has a resolved position. */
  position?: PolarPoint;
  /** Recent past positions for the history trail, oldest first, excluding the current position. */
  history: PolarPoint[];
  /** Unix epoch ms the aircraft was last heard from. */
  lastSeenAt: number;
}

/** The full state of the scope at one instant, pushed to every connected browser. */
export interface ScopeSnapshot {
  /** Unix epoch ms the snapshot was taken. */
  at: number;
  /** The feed's connection state to the station. */
  connection: ConnectionState;
  /** Every currently tracked aircraft, with or without a position. */
  targets: ScopeTarget[];
}

/** Session-wide settings the browser reads once at startup. */
export interface ScopeConfig {
  /** The receiving station's own position: the center of the scope. */
  receiver: Coordinates;
  /** Where the traffic comes from. */
  source: ScopeSource;
  /** Human-readable description of the station or replay file, for the status bar. */
  station: string;
  /** The view style to start in. */
  mode: ScopeModeId;
  /** The scope range to start at: nautical miles from the center to the edge of the scope. */
  rangeNm: number;
}
