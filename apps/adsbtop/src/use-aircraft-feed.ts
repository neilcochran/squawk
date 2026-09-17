import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import type {
  AircraftFeed,
  AircraftLostEventDetail,
  AircraftUpdateEventDetail,
  ConnectionState,
  ConnectionStateEventDetail,
} from '@squawk/adsb-feed';
import type { Aircraft, Coordinates } from '@squawk/types';

import { aircraftStateReducer, initialAircraftState } from './aircraft-state.js';
import type { MessageLogEntry } from './aircraft-state.js';
import { distanceToAircraftNm } from './location.js';
import type { MaxDistanceRecord } from './stats.js';

/** How often {@link useAircraftFeed} recomputes `messageRatePerSec`. */
const RATE_SAMPLE_INTERVAL_MS = 1000;

/** How many per-second rate samples `rateHistory` keeps - one minute at {@link RATE_SAMPLE_INTERVAL_MS}. */
export const RATE_HISTORY_LENGTH = 60;

/** Live view of an `AircraftFeed`'s tracked aircraft and activity stats. */
export interface AircraftFeedView {
  /** Currently tracked aircraft, in no particular order - sort before display. */
  aircraft: Aircraft[];
  /** Total update events observed since the feed started. */
  messageCount: number;
  /** Update events observed per currently tracked aircraft, keyed by ICAO hex. Entries are dropped when the aircraft is lost. */
  messageCountByHex: Map<string, number>;
  /** Unix epoch ms each currently tracked aircraft was first observed, keyed by ICAO hex, for the table's new-row highlight. */
  firstSeenAtByHex: ReadonlyMap<string, number>;
  /** Unix epoch ms of the most recent update, or undefined if none has arrived yet. */
  lastMessageAt: number | undefined;
  /** Update events observed in roughly the last second. */
  messageRatePerSec: number;
  /** The last {@link RATE_HISTORY_LENGTH} per-second rate samples, oldest first, for the stats panel's sparkline. */
  rateHistory: readonly number[];
  /** Unix epoch ms the hook first subscribed - the session start, for the stats panel's uptime. */
  startedAt: number;
  /** Most aircraft tracked at once this session. */
  peakAircraftCount: number;
  /** Distinct ICAO hexes seen this session, including ones since lost. */
  uniqueAircraftCount: number;
  /** The farthest aircraft observed this session, when a receiver location is configured. */
  maxDistance: MaxDistanceRecord | undefined;
  /** Every event type, oldest first, for the `[M]essages` panel's `all` verbosity. */
  messageLog: MessageLogEntry[];
  /** `aircraft:new`/`aircraft:lost` events only, oldest first, for the panel's default `newAndLost` verbosity - capped independently of `messageLog` so update volume can't evict a still-relevant entry. */
  newAndLostLog: MessageLogEntry[];
  /** The feed's current connection state, for the status header's connection badge. */
  connectionState: ConnectionState;
}

/**
 * Subscribes to `feed`'s aircraft events for the component's lifetime,
 * starting it on mount and stopping it on unmount, and accumulates tracked
 * aircraft plus activity stats via the pure `aircraftStateReducer`.
 *
 * @param feed - The feed to subscribe to. Changing the reference tears down the old subscription and starts a new one.
 * @param location - The configured receiver location, if any. When set, each update is stamped with its distance so the session's farthest aircraft can be tracked.
 * @returns The current aircraft list and activity stats, updated as events arrive.
 */
export function useAircraftFeed(
  feed: AircraftFeed,
  location: Coordinates | undefined,
): AircraftFeedView {
  const [state, dispatch] = useReducer(aircraftStateReducer, initialAircraftState);
  const [messageRatePerSec, setMessageRatePerSec] = useState(0);
  const [rateHistory, setRateHistory] = useState<readonly number[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [connectionState, setConnectionState] = useState<ConnectionState>(() =>
    feed.getConnectionState(),
  );
  const messageCountRef = useRef(state.messageCount);

  useEffect(() => {
    messageCountRef.current = state.messageCount;
  }, [state.messageCount]);

  useEffect(() => {
    function distanceOf(aircraft: Aircraft): { distanceNm: number } | Record<string, never> {
      const distanceNm =
        location === undefined ? undefined : distanceToAircraftNm(location, aircraft);
      return distanceNm === undefined ? {} : { distanceNm };
    }
    function handleNew(event: Event): void {
      const { aircraft } = (event as CustomEvent<AircraftUpdateEventDetail>).detail;
      dispatch({
        type: 'message',
        kind: 'new',
        aircraft,
        at: Date.now(),
        ...distanceOf(aircraft),
      });
    }
    function handleUpdate(event: Event): void {
      const { aircraft } = (event as CustomEvent<AircraftUpdateEventDetail>).detail;
      dispatch({
        type: 'message',
        kind: 'update',
        aircraft,
        at: Date.now(),
        ...distanceOf(aircraft),
      });
    }
    function handleLost(event: Event): void {
      const { icaoHex, lastAircraft } = (event as CustomEvent<AircraftLostEventDetail>).detail;
      dispatch({ type: 'lost', icaoHex, callsign: lastAircraft.callsign, at: Date.now() });
    }
    function handleConnectionChange(event: Event): void {
      const { state: nextConnectionState } = (event as CustomEvent<ConnectionStateEventDetail>)
        .detail;
      setConnectionState(nextConnectionState);
    }

    feed.addEventListener('aircraft:new', handleNew);
    feed.addEventListener('aircraft:update', handleUpdate);
    feed.addEventListener('aircraft:lost', handleLost);
    feed.addEventListener('connection:connect', handleConnectionChange);
    feed.addEventListener('connection:disconnect', handleConnectionChange);
    feed.start();

    return () => {
      feed.removeEventListener('aircraft:new', handleNew);
      feed.removeEventListener('aircraft:update', handleUpdate);
      feed.removeEventListener('aircraft:lost', handleLost);
      feed.removeEventListener('connection:connect', handleConnectionChange);
      feed.removeEventListener('connection:disconnect', handleConnectionChange);
      feed.stop();
    };
  }, [feed, location]);

  useEffect(() => {
    let lastCount = messageCountRef.current;
    const handle = setInterval(() => {
      const rate = messageCountRef.current - lastCount;
      lastCount = messageCountRef.current;
      setMessageRatePerSec(rate);
      setRateHistory((history) => [...history, rate].slice(-RATE_HISTORY_LENGTH));
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
    messageCountByHex: state.messageCountByHex,
    firstSeenAtByHex: state.firstSeenAtByHex,
    lastMessageAt: state.lastMessageAt,
    messageRatePerSec,
    rateHistory,
    startedAt,
    peakAircraftCount: state.peakAircraftCount,
    uniqueAircraftCount: state.seenHexes.size,
    maxDistance: state.maxDistance,
    messageLog: state.messageLog,
    newAndLostLog: state.newAndLostLog,
    connectionState,
  };
}
