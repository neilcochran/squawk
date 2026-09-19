import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { setTimeout as sleep } from 'node:timers/promises';

import type {
  AircraftFeed,
  AircraftLostEventDetail,
  AircraftUpdateEventDetail,
  ConnectionState,
  ConnectionStateEventDetail,
  PositionHistoryEntry,
  PositionHistoryRetention,
} from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

/** One parsed line of an `adsbtop --record` file. */
export type ReplayEvent =
  | {
      /** The feed event recorded. */
      type: 'new' | 'update';
      /** Unix epoch ms the event was originally observed. */
      at: number;
      /** The aircraft's state as the feed reported it. */
      aircraft: Aircraft;
    }
  | {
      /** The feed event recorded. */
      type: 'lost';
      /** Unix epoch ms the event was originally observed. */
      at: number;
      /** ICAO hex of the aircraft dropped. */
      icaoHex: string;
    };

/** How long a looping replay leaves the scope empty between the end of one pass and the start of the next. */
export const LOOP_PAUSE_MS = 1000;

/** Options for {@link createReplayAircraftFeed}. */
export interface ReplayFeedOptions {
  /** Opens the recording and yields it line by line. Called once per pass, so a looping replay reopens the file. */
  openLines: () => AsyncIterable<string>;
  /** Whether to start over when the recording ends. Defaults to true, so a short recording keeps the scope alive. */
  loop?: boolean;
  /** How much position history to retain per aircraft. Unbounded if omitted. */
  positionHistoryRetention?: PositionHistoryRetention;
  /**
   * Waits the given number of ms, rejecting early if `signal` aborts. The
   * feed aborts the signal on `stop()`, so a stopped replay leaves no timer
   * behind to keep the process alive. Injectable for tests; defaults to a
   * real, abortable timer.
   */
  delay?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Clock, injectable for tests. Defaults to `Date.now`. */
  now?: () => number;
}

/** The `AircraftFeed` events this feed dispatches, named as `@squawk/adsb-feed`'s own sources name them. */
const FEED_EVENTS = {
  aircraftNew: 'aircraft:new',
  aircraftUpdate: 'aircraft:update',
  aircraftLost: 'aircraft:lost',
  connect: 'connection:connect',
  disconnect: 'connection:disconnect',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAircraft(value: unknown): value is Aircraft {
  return (
    isRecord(value) && typeof value.icaoHex === 'string' && typeof value.lastSeenAt === 'number'
  );
}

/**
 * Parses one line of an `adsbtop --record` file. Blank lines, malformed
 * JSON, and objects that are not a recognizable record event all yield
 * undefined, so a truncated or hand-edited recording replays as far as it
 * can rather than failing.
 *
 * @param line - One line of the recording.
 * @returns The parsed event, or undefined if the line is not one.
 */
export function parseReplayLine(line: string): ReplayEvent | undefined {
  if (line.trim() === '') {
    return undefined;
  }
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isRecord(value) || typeof value.at !== 'number') {
    return undefined;
  }
  if ((value.type === 'new' || value.type === 'update') && isAircraft(value.aircraft)) {
    return { type: value.type, at: value.at, aircraft: value.aircraft };
  }
  if (value.type === 'lost' && typeof value.icaoHex === 'string') {
    return { type: 'lost', at: value.at, icaoHex: value.icaoHex };
  }
  return undefined;
}

/**
 * Opens a recording on disk as the line source for
 * {@link createReplayAircraftFeed}.
 *
 * @param path - Path to the `adsbtop --record` file.
 * @returns A function that opens the file and yields its lines.
 */
export function openRecordingLines(path: string): () => AsyncIterable<string> {
  return () => createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
}

/**
 * Creates an aircraft feed that plays back an `adsbtop --record` file in
 * place of a live station, with the recording's original timing. Returns the
 * same `AircraftFeed` shape as the `@squawk/adsb-feed` factories, so nothing
 * downstream can tell the difference.
 *
 * Recorded timestamps are shifted onto the current clock, so an aircraft's
 * `lastSeenAt` and its position history read as if the session were
 * happening now. Whether a recorded event is dispatched as `aircraft:new` or
 * `aircraft:update` follows the replay's own state rather than the recorded
 * type, so a recording that starts mid-session still introduces each
 * aircraft correctly. When the recording ends every remaining aircraft is
 * dropped with `aircraft:lost`, and after {@link LOOP_PAUSE_MS} the replay
 * starts over unless `loop` is false. The connection state is `'connected'`
 * while a pass is playing. `stop()` abandons the pass in progress and aborts
 * any wait it was in, so a stopped feed holds nothing that would keep the
 * process alive.
 *
 * @param options - Line source, looping, history retention, and injectable timing.
 * @returns An `AircraftFeed` ready to `start()`.
 */
export function createReplayAircraftFeed(options: ReplayFeedOptions): AircraftFeed {
  const loop = options.loop ?? true;
  const delay =
    options.delay ??
    ((ms: number, signal: AbortSignal): Promise<void> => sleep(ms, undefined, { signal }));
  const now = options.now ?? Date.now;
  const retention = options.positionHistoryRetention;

  const target = new EventTarget();
  const aircraftByHex = new Map<string, Aircraft>();
  const historyByHex = new Map<string, PositionHistoryEntry[]>();
  let connectionState: ConnectionState = 'reconnecting';
  let generation = 0;
  let running = false;
  let stopController = new AbortController();

  function setConnectionState(state: ConnectionState): void {
    if (state === connectionState) {
      return;
    }
    connectionState = state;
    const eventName = state === 'connected' ? FEED_EVENTS.connect : FEED_EVENTS.disconnect;
    target.dispatchEvent(
      new CustomEvent<ConnectionStateEventDetail>(eventName, { detail: { state } }),
    );
  }

  function recordPosition(aircraft: Aircraft): void {
    const position = aircraft.position;
    if (position === undefined) {
      return;
    }
    const history = historyByHex.get(aircraft.icaoHex) ?? [];
    const last = history.at(-1);
    if (last?.position.lat === position.lat && last.position.lon === position.lon) {
      return;
    }
    history.push({ position, recordedAt: aircraft.lastSeenAt });
    const maxEntries = retention?.maxEntries;
    if (maxEntries !== undefined && history.length > maxEntries) {
      history.splice(0, history.length - maxEntries);
    }
    const maxAgeMs = retention?.maxAgeMs;
    if (maxAgeMs !== undefined) {
      const cutoff = aircraft.lastSeenAt - maxAgeMs;
      const firstKept = history.findIndex((entry) => entry.recordedAt >= cutoff);
      history.splice(0, firstKept);
    }
    historyByHex.set(aircraft.icaoHex, history);
  }

  function dropAircraft(icaoHex: string): void {
    const lastAircraft = aircraftByHex.get(icaoHex);
    if (lastAircraft === undefined) {
      return;
    }
    aircraftByHex.delete(icaoHex);
    historyByHex.delete(icaoHex);
    target.dispatchEvent(
      new CustomEvent<AircraftLostEventDetail>(FEED_EVENTS.aircraftLost, {
        detail: { icaoHex, lastAircraft },
      }),
    );
  }

  function applyEvent(event: ReplayEvent, offsetMs: number): void {
    if (event.type === 'lost') {
      dropAircraft(event.icaoHex);
      return;
    }
    const aircraft: Aircraft = {
      ...event.aircraft,
      lastSeenAt: event.aircraft.lastSeenAt + offsetMs,
    };
    const eventName = aircraftByHex.has(aircraft.icaoHex)
      ? FEED_EVENTS.aircraftUpdate
      : FEED_EVENTS.aircraftNew;
    aircraftByHex.set(aircraft.icaoHex, aircraft);
    recordPosition(aircraft);
    target.dispatchEvent(
      new CustomEvent<AircraftUpdateEventDetail>(eventName, { detail: { aircraft } }),
    );
  }

  async function playOnce(myGeneration: number): Promise<boolean> {
    let offsetMs: number | undefined;
    for await (const line of options.openLines()) {
      if (myGeneration !== generation) {
        return false;
      }
      const event = parseReplayLine(line);
      if (event === undefined) {
        continue;
      }
      if (offsetMs === undefined) {
        offsetMs = now() - event.at;
        setConnectionState('connected');
      }
      const waitMs = event.at + offsetMs - now();
      if (waitMs > 0) {
        await delay(waitMs, stopController.signal);
        if (myGeneration !== generation) {
          return false;
        }
      }
      applyEvent(event, offsetMs);
    }
    for (const icaoHex of [...aircraftByHex.keys()]) {
      dropAircraft(icaoHex);
    }
    return offsetMs !== undefined;
  }

  async function run(myGeneration: number): Promise<void> {
    try {
      let playedAnything = await playOnce(myGeneration);
      while (loop && playedAnything && myGeneration === generation) {
        await delay(LOOP_PAUSE_MS, stopController.signal);
        playedAnything = myGeneration === generation && (await playOnce(myGeneration));
      }
    } catch {
      // Either the recording could not be read, which ends the replay (the state
      // change below reports it), or stop() aborted a wait, which already reset state.
    }
    if (myGeneration === generation) {
      running = false;
      setConnectionState('reconnecting');
    }
  }

  return Object.assign(target, {
    start(): void {
      if (running) {
        return;
      }
      running = true;
      generation++;
      stopController = new AbortController();
      void run(generation);
    },
    stop(): void {
      if (!running) {
        return;
      }
      running = false;
      generation++;
      stopController.abort();
      aircraftByHex.clear();
      historyByHex.clear();
      setConnectionState('reconnecting');
    },
    getAircraft(icaoHex: string): Aircraft | undefined {
      return aircraftByHex.get(icaoHex);
    },
    getAllAircraft(): Aircraft[] {
      return [...aircraftByHex.values()];
    },
    getPositionHistory(icaoHex: string): PositionHistoryEntry[] {
      return [...(historyByHex.get(icaoHex) ?? [])];
    },
    getConnectionState(): ConnectionState {
      return connectionState;
    },
  });
}
