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

/** Path of the endpoint serving the {@link ScopeVideoMap} for a range, given as the {@link VIDEO_MAP_RANGE_PARAM} query parameter. */
export const VIDEO_MAP_PATH = `${API_PREFIX}/videomap`;

/** Query parameter of {@link VIDEO_MAP_PATH}: the scope range, in nautical miles, the map is wanted for. */
export const VIDEO_MAP_RANGE_PARAM = 'rangeNm';

/** The largest scope range, in nautical miles, that can be asked for - on the command line or of the video map endpoint. */
export const MAX_RANGE_NM = 500;

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
  /** The model the aircraft is registered as (`PA-28-181`, `737-8H4`), when the registry knows it. */
  aircraftModel?: string;
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

/**
 * A {@link PolarPoint} as a `[trueBearingDeg, rangeNm]` pair. Used for the
 * vertices of video map lines, where an airspace boundary can run to hundreds
 * of points and the compact form keeps the map a fraction of the size.
 */
export type PolarTuple = readonly [trueBearingDeg: number, rangeNm: number];

/** What a {@link VideoMapPoint} marks. */
export type VideoMapPointKind = 'airport' | 'navaid' | 'fix';

/** A labeled point feature of the video map. */
export interface VideoMapPoint {
  /** What the point marks, which decides the symbol it is drawn with. */
  kind: VideoMapPointKind;
  /** The identifier drawn beside it, e.g. `KPWM`, `ENE`, `AASUM`. Absent when the feature is shown as a bare symbol, as fixes are beyond close range. */
  label?: string;
  /** Where it is, relative to the receiver. */
  position: PolarPoint;
  /** True when the feature's own outline is also sent as lines (an airport's runways), so no stand-in symbol is needed. */
  outlined?: boolean;
}

/** The classes of airspace whose boundaries the video map draws, which decides the color of the boundary. */
export type VideoMapAirspaceClass = 'classB' | 'classC' | 'classD' | 'specialUse';

/** A line feature of the video map: a runway, or the boundary of an airspace. */
export type VideoMapLine =
  | {
      /** A runway, drawn to scale from end to end. */
      kind: 'runway';
      /** The runway's two ends. */
      points: PolarTuple[];
    }
  | {
      /** The boundary of an airspace. */
      kind: 'airspace';
      /** The class of the airspace. */
      airspaceClass: VideoMapAirspaceClass;
      /** The boundary's vertices, in order, repeating the first at the end to close. */
      points: PolarTuple[];
    };

/**
 * The fixed background of the scope - airports, runways, navaids, fixes, and
 * airspace boundaries around the receiver - already resolved into scope
 * coordinates and thinned to what is worth drawing at one range.
 */
export interface ScopeVideoMap {
  /** The scope range, in nautical miles, the map was built for. It covers well beyond that range, to the corners of a wide screen. */
  rangeNm: number;
  /** Labeled point features. */
  points: VideoMapPoint[];
  /** Line features. */
  lines: VideoMapLine[];
}
