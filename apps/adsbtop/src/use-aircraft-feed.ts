import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import type {
  AircraftFeed,
  AircraftLostEventDetail,
  AircraftUpdateEventDetail,
} from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

import { aircraftStateReducer, initialAircraftState } from './aircraft-state.js';
import type { MessageLogEntry } from './aircraft-state.js';

/** How often {@link useAircraftFeed} recomputes `messageRatePerSec`. */
const RATE_SAMPLE_INTERVAL_MS = 1000;

/** Live view of an `AircraftFeed`'s tracked aircraft and activity stats. */
export interface AircraftFeedView {
  /** Currently tracked aircraft, in no particular order - sort before display. */
  aircraft: Aircraft[];
  /** Total update events observed since the feed started. */
  messageCount: number;
  /** Unix epoch ms of the most recent update, or undefined if none has arrived yet. */
  lastMessageAt: number | undefined;
  /** Update events observed in roughly the last second. */
  messageRatePerSec: number;
  /** Recent `aircraft:new`/`aircraft:update`/`aircraft:lost` events, oldest first, for the `[M]essages` panel. */
  messageLog: MessageLogEntry[];
}

/**
 * Subscribes to `feed`'s aircraft events for the component's lifetime,
 * starting it on mount and stopping it on unmount, and accumulates tracked
 * aircraft plus activity stats via the pure `aircraftStateReducer`.
 *
 * @param feed - The feed to subscribe to. Changing the reference tears down the old subscription and starts a new one.
 * @returns The current aircraft list and activity stats, updated as events arrive.
 */
export function useAircraftFeed(feed: AircraftFeed): AircraftFeedView {
  const [state, dispatch] = useReducer(aircraftStateReducer, initialAircraftState);
  const [messageRatePerSec, setMessageRatePerSec] = useState(0);
  const messageCountRef = useRef(state.messageCount);

  useEffect(() => {
    messageCountRef.current = state.messageCount;
  }, [state.messageCount]);

  useEffect(() => {
    function handleNew(event: Event): void {
      const { aircraft } = (event as CustomEvent<AircraftUpdateEventDetail>).detail;
      dispatch({ type: 'message', kind: 'new', aircraft, at: Date.now() });
    }
    function handleUpdate(event: Event): void {
      const { aircraft } = (event as CustomEvent<AircraftUpdateEventDetail>).detail;
      dispatch({ type: 'message', kind: 'update', aircraft, at: Date.now() });
    }
    function handleLost(event: Event): void {
      const { icaoHex, lastAircraft } = (event as CustomEvent<AircraftLostEventDetail>).detail;
      dispatch({ type: 'lost', icaoHex, callsign: lastAircraft.callsign, at: Date.now() });
    }

    feed.addEventListener('aircraft:new', handleNew);
    feed.addEventListener('aircraft:update', handleUpdate);
    feed.addEventListener('aircraft:lost', handleLost);
    feed.start();

    return () => {
      feed.removeEventListener('aircraft:new', handleNew);
      feed.removeEventListener('aircraft:update', handleUpdate);
      feed.removeEventListener('aircraft:lost', handleLost);
      feed.stop();
    };
  }, [feed]);

  useEffect(() => {
    let lastCount = messageCountRef.current;
    const handle = setInterval(() => {
      setMessageRatePerSec(messageCountRef.current - lastCount);
      lastCount = messageCountRef.current;
    }, RATE_SAMPLE_INTERVAL_MS);
    return () => {
      clearInterval(handle);
    };
  }, []);

  // Memoized against the Map reference (which the reducer only replaces on a
  // real message/lost action) rather than recomputed on every render - a
  // fresh array on every render would make `aircraft` look "changed" to any
  // consumer's effect/memo dependency array even when nothing happened, e.g.
  // on the clock-tick re-renders the app's age column relies on.
  const aircraft = useMemo(() => Array.from(state.aircraftByHex.values()), [state.aircraftByHex]);

  return {
    aircraft,
    messageCount: state.messageCount,
    lastMessageAt: state.lastMessageAt,
    messageRatePerSec,
    messageLog: state.messageLog,
  };
}
