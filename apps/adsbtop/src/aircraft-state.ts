import type { Aircraft } from '@squawk/types';

/** Which underlying feed event a {@link MessageLogEntry} records. */
export type MessageLogEntryType = 'new' | 'update' | 'lost';

/** One entry in the `[M]essages` panel's log, oldest first. */
export interface MessageLogEntry {
  /** Monotonically increasing id, stable across log trimming - used as the React list key. */
  id: number;
  /** Which feed event this entry records. */
  type: MessageLogEntryType;
  /** 24-bit ICAO hex address the event concerns. */
  icaoHex: string;
  /** Callsign at the time of the event, if known. */
  callsign: string | undefined;
  /** Unix epoch ms the event was observed. */
  at: number;
}

/**
 * Maximum {@link MessageLogEntry} rows retained. Oldest entries are dropped
 * once exceeded, so the log stays a bounded "recent activity" view rather
 * than growing unbounded for a long-running session.
 */
const MAX_MESSAGE_LOG_ENTRIES = 200;

/**
 * Accumulated view of a live `@squawk/adsb-feed` `AircraftFeed`'s event
 * stream: currently tracked aircraft, two bounded logs of recent events for
 * the `[M]essages` panel, plus lightweight message-activity bookkeeping for
 * the status header.
 */
export interface AircraftTableState {
  /** Currently tracked aircraft, keyed by 24-bit ICAO hex address. */
  aircraftByHex: Map<string, Aircraft>;
  /** Total `aircraft:new`/`aircraft:update` events observed since the feed started. */
  messageCount: number;
  /** Unix epoch ms of the most recent `aircraft:new`/`aircraft:update` event, or undefined if none has arrived yet. */
  lastMessageAt: number | undefined;
  /** Every event type, oldest first, capped at {@link MAX_MESSAGE_LOG_ENTRIES} - backs the `[M]essages` panel's `all` verbosity. */
  messageLog: MessageLogEntry[];
  /**
   * `new`/`lost` events only, oldest first, capped independently at
   * {@link MAX_MESSAGE_LOG_ENTRIES} - backs the panel's default `newAndLost`
   * verbosity. Kept as its own log rather than derived by filtering
   * `messageLog`: `update` events fire far more often than `new`/`lost`, so
   * a shared cap gets dominated by update volume and evicts a still-relevant
   * new/lost entry within seconds of real traffic, even though nothing
   * about it changed - toggling verbosity back to `newAndLost` would then
   * show fewer entries than a moment before, for no reason visible to the
   * user. A separate cap means `update` volume can never evict a
   * `new`/`lost` entry.
   */
  newAndLostLog: MessageLogEntry[];
  /** Next {@link MessageLogEntry.id} to assign - kept separate from either log's length so ids stay stable once old entries are trimmed off the front. */
  nextLogId: number;
}

/** An update or removal observed on the underlying `AircraftFeed`. */
export type AircraftStateAction =
  | { type: 'message'; kind: 'new' | 'update'; aircraft: Aircraft; at: number }
  | { type: 'lost'; icaoHex: string; callsign: string | undefined; at: number };

/** Empty {@link AircraftTableState}, before any feed event has arrived. */
export const initialAircraftState: AircraftTableState = {
  aircraftByHex: new Map(),
  messageCount: 0,
  lastMessageAt: undefined,
  messageLog: [],
  newAndLostLog: [],
  nextLogId: 0,
};

/**
 * Appends `entry` to `log`, dropping the oldest entry once
 * {@link MAX_MESSAGE_LOG_ENTRIES} is exceeded.
 *
 * @param log - The current log, oldest first.
 * @param entry - The entry to append.
 * @returns A new array with `entry` appended, trimmed to the max length.
 */
function appendLogEntry(log: MessageLogEntry[], entry: MessageLogEntry): MessageLogEntry[] {
  const next = [...log, entry];
  return next.length > MAX_MESSAGE_LOG_ENTRIES
    ? next.slice(next.length - MAX_MESSAGE_LOG_ENTRIES)
    : next;
}

/**
 * Reducer accumulating {@link AircraftStateAction}s into an {@link AircraftTableState}.
 * Pure and side-effect-free - the caller supplies `at` from `Date.now()` at
 * dispatch time, rather than this function reading the clock itself, so it
 * stays trivially testable with fixed timestamps. Every action appends a
 * {@link MessageLogEntry}, including a `lost` action for an ICAO hex this
 * state never tracked - that shouldn't happen against a real `AircraftFeed`,
 * but the log's job is showing what events actually arrived, not judging
 * whether they were expected.
 *
 * @param state - The current accumulated state.
 * @param action - The event to apply.
 * @returns The next state. Always a new `aircraftByHex` map when it changes, so React's `useReducer` sees a fresh reference.
 */
export function aircraftStateReducer(
  state: AircraftTableState,
  action: AircraftStateAction,
): AircraftTableState {
  switch (action.type) {
    case 'message': {
      const aircraftByHex = new Map(state.aircraftByHex);
      aircraftByHex.set(action.aircraft.icaoHex, action.aircraft);
      const logEntry: MessageLogEntry = {
        id: state.nextLogId,
        type: action.kind,
        icaoHex: action.aircraft.icaoHex,
        callsign: action.aircraft.callsign,
        at: action.at,
      };
      const newAndLostLog =
        action.kind === 'new' ? appendLogEntry(state.newAndLostLog, logEntry) : state.newAndLostLog;
      return {
        aircraftByHex,
        messageCount: state.messageCount + 1,
        lastMessageAt: action.at,
        messageLog: appendLogEntry(state.messageLog, logEntry),
        newAndLostLog,
        nextLogId: state.nextLogId + 1,
      };
    }
    case 'lost': {
      const logEntry: MessageLogEntry = {
        id: state.nextLogId,
        type: 'lost',
        icaoHex: action.icaoHex,
        callsign: action.callsign,
        at: action.at,
      };
      const messageLog = appendLogEntry(state.messageLog, logEntry);
      const newAndLostLog = appendLogEntry(state.newAndLostLog, logEntry);
      const nextLogId = state.nextLogId + 1;
      if (!state.aircraftByHex.has(action.icaoHex)) {
        return { ...state, messageLog, newAndLostLog, nextLogId };
      }
      const aircraftByHex = new Map(state.aircraftByHex);
      aircraftByHex.delete(action.icaoHex);
      return { ...state, aircraftByHex, messageLog, newAndLostLog, nextLogId };
    }
    default:
      return state;
  }
}
