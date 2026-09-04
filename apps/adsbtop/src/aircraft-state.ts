import type { Aircraft } from '@squawk/types';

/**
 * Accumulated view of a live `@squawk/adsb-feed` `AircraftFeed`'s event
 * stream: currently tracked aircraft plus lightweight message-activity
 * bookkeeping for the status header.
 */
export interface AircraftTableState {
  /** Currently tracked aircraft, keyed by 24-bit ICAO hex address. */
  aircraftByHex: Map<string, Aircraft>;
  /** Total `aircraft:new`/`aircraft:update` events observed since the feed started. */
  messageCount: number;
  /** Unix epoch ms of the most recent `aircraft:new`/`aircraft:update` event, or undefined if none has arrived yet. */
  lastMessageAt: number | undefined;
}

/** An update or removal observed on the underlying `AircraftFeed`. */
export type AircraftStateAction =
  { type: 'message'; aircraft: Aircraft; at: number } | { type: 'lost'; icaoHex: string };

/** Empty {@link AircraftTableState}, before any feed event has arrived. */
export const initialAircraftState: AircraftTableState = {
  aircraftByHex: new Map(),
  messageCount: 0,
  lastMessageAt: undefined,
};

/**
 * Reducer accumulating {@link AircraftStateAction}s into an {@link AircraftTableState}.
 * Pure and side-effect-free - the caller supplies `at` from `Date.now()` at
 * dispatch time, rather than this function reading the clock itself, so it
 * stays trivially testable with fixed timestamps.
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
      return { aircraftByHex, messageCount: state.messageCount + 1, lastMessageAt: action.at };
    }
    case 'lost': {
      if (!state.aircraftByHex.has(action.icaoHex)) {
        return state;
      }
      const aircraftByHex = new Map(state.aircraftByHex);
      aircraftByHex.delete(action.icaoHex);
      return { ...state, aircraftByHex };
    }
    default:
      return state;
  }
}
