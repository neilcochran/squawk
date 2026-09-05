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
 * stream: currently tracked aircraft, a bounded log of recent events for the
 * `[M]essages` panel, plus lightweight message-activity bookkeeping for the
 * status header.
 */
export interface AircraftTableState {
  /** Currently tracked aircraft, keyed by 24-bit ICAO hex address. */
  aircraftByHex: Map<string, Aircraft>;
  /** Total `aircraft:new`/`aircraft:update` events observed since the feed started. */
  messageCount: number;
  /** Unix epoch ms of the most recent `aircraft:new`/`aircraft:update` event, or undefined if none has arrived yet. */
  lastMessageAt: number | undefined;
  /** Recent `aircraft:new`/`aircraft:update`/`aircraft:lost` events, oldest first, capped at {@link MAX_MESSAGE_LOG_ENTRIES}. */
  messageLog: MessageLogEntry[];
  /** Next {@link MessageLogEntry.id} to assign - kept separate from `messageLog.length` so ids stay stable once old entries are trimmed off the front. */
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
      return {
        aircraftByHex,
        messageCount: state.messageCount + 1,
        lastMessageAt: action.at,
        messageLog: appendLogEntry(state.messageLog, logEntry),
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
      const nextLogId = state.nextLogId + 1;
      if (!state.aircraftByHex.has(action.icaoHex)) {
        return { ...state, messageLog, nextLogId };
      }
      const aircraftByHex = new Map(state.aircraftByHex);
      aircraftByHex.delete(action.icaoHex);
      return { ...state, aircraftByHex, messageLog, nextLogId };
    }
    default:
      return state;
  }
}
