import { createWriteStream } from 'node:fs';

import type {
  AircraftFeed,
  AircraftLostEventDetail,
  AircraftUpdateEventDetail,
} from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

/** One line of a `--record` file, before serialization. */
export type RecordEvent =
  | {
      /** The feed event recorded. */
      type: 'new' | 'update';
      /** Unix epoch ms the event was observed. */
      at: number;
      /** The aircraft's state as the feed reported it, before adsbtop's registration lookup. */
      aircraft: Aircraft;
    }
  | {
      /** The feed event recorded. */
      type: 'lost';
      /** Unix epoch ms the event was observed. */
      at: number;
      /** ICAO hex of the aircraft dropped. */
      icaoHex: string;
      /** The aircraft's last known state. */
      lastAircraft: Aircraft;
    };

/** Where record lines go: a file by default, a buffer in tests. */
export interface RecordSink {
  /** Appends one line (already newline-terminated). */
  write(line: string): void;
  /** Flushes and closes the sink. */
  end(): void;
}

/** A running `--record` session. */
export interface EventRecorder {
  /** Unsubscribes from the feed and closes the sink. */
  stop(): void;
}

/**
 * Serializes one record event as a single JSON line. Each line is a
 * self-contained object with its type and timestamp first, so a file can
 * be streamed line by line without parsing it whole.
 *
 * @param event - The event to serialize.
 * @returns One line of JSON, newline-terminated.
 */
export function formatRecordLine(event: RecordEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Opens `path` for appending as a {@link RecordSink}. Appending rather than
 * truncating, so a second session against the same file extends the log
 * instead of erasing the first. Stream errors (a missing directory, a
 * permissions problem, a full disk) go to `onError` rather than throwing,
 * since they surface asynchronously while the UI is running.
 *
 * @param path - The file to append to, as given on the command line.
 * @param onError - Called with any stream error.
 * @returns The sink.
 */
export function openRecordSink(path: string, onError: (error: Error) => void): RecordSink {
  const stream = createWriteStream(path, { flags: 'a' });
  stream.on('error', onError);
  return {
    write(line: string): void {
      stream.write(line);
    },
    end(): void {
      stream.end();
    },
  };
}

/**
 * Subscribes to `feed`'s aircraft events and writes each one to `sink` as
 * a JSON line - see {@link formatRecordLine}. Records raw feed events, not
 * adsbtop's enriched view, so the file reflects what the receiver sent.
 *
 * @param feed - The feed to record.
 * @param sink - Where the lines go.
 * @param now - Clock, injectable for tests. Defaults to `Date.now`.
 * @returns A handle whose `stop()` unsubscribes and closes the sink.
 */
export function createEventRecorder(
  feed: AircraftFeed,
  sink: RecordSink,
  now: () => number = Date.now,
): EventRecorder {
  function handleNew(event: Event): void {
    const { aircraft } = (event as CustomEvent<AircraftUpdateEventDetail>).detail;
    sink.write(formatRecordLine({ type: 'new', at: now(), aircraft }));
  }
  function handleUpdate(event: Event): void {
    const { aircraft } = (event as CustomEvent<AircraftUpdateEventDetail>).detail;
    sink.write(formatRecordLine({ type: 'update', at: now(), aircraft }));
  }
  function handleLost(event: Event): void {
    const { icaoHex, lastAircraft } = (event as CustomEvent<AircraftLostEventDetail>).detail;
    sink.write(formatRecordLine({ type: 'lost', at: now(), icaoHex, lastAircraft }));
  }

  feed.addEventListener('aircraft:new', handleNew);
  feed.addEventListener('aircraft:update', handleUpdate);
  feed.addEventListener('aircraft:lost', handleLost);

  return {
    stop(): void {
      feed.removeEventListener('aircraft:new', handleNew);
      feed.removeEventListener('aircraft:update', handleUpdate);
      feed.removeEventListener('aircraft:lost', handleLost);
      sink.end();
    },
  };
}
