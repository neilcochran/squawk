import { useEffect, useState } from 'react';

import { SNAPSHOT_EVENT, STREAM_PATH } from '../../shared/protocol.js';
import type { ScopeSnapshot } from '../../shared/protocol.js';

/** The browser's link to the scope server: not yet open, open, or dropped and retrying. */
export type StreamState = 'connecting' | 'open' | 'lost';

/** What {@link useScopeStream} returns. */
export interface ScopeStream {
  /** The most recent snapshot, or undefined before the first one arrives. Kept across a dropped link so the scope does not blank. */
  snapshot: ScopeSnapshot | undefined;
  /** The state of the link to the scope server. */
  state: StreamState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Decodes one snapshot event's data. Only the envelope is checked - the
 * server is this app's own, so the targets are trusted once the shape is
 * recognizably a snapshot.
 *
 * @param data - The event's raw data string.
 * @returns The snapshot, or undefined if the data is not one.
 */
export function parseSnapshot(data: string): ScopeSnapshot | undefined {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return undefined;
  }
  if (
    !isRecord(value) ||
    typeof value.at !== 'number' ||
    (value.connection !== 'connected' && value.connection !== 'reconnecting') ||
    !Array.isArray(value.targets)
  ) {
    return undefined;
  }
  return { at: value.at, connection: value.connection, targets: value.targets };
}

/**
 * Subscribes to the scope server's snapshot stream for the life of the
 * component. `EventSource` reconnects on its own after a dropped link, so
 * `state` moves to `'lost'` and back to `'open'` without any retry logic
 * here.
 *
 * @returns The latest snapshot and the link state.
 */
export function useScopeStream(): ScopeStream {
  const [snapshot, setSnapshot] = useState<ScopeSnapshot | undefined>(undefined);
  const [state, setState] = useState<StreamState>('connecting');

  useEffect(() => {
    const source = new EventSource(STREAM_PATH);
    function handleSnapshot(event: MessageEvent<string>): void {
      const parsed = parseSnapshot(event.data);
      if (parsed !== undefined) {
        setSnapshot(parsed);
      }
    }
    function handleOpen(): void {
      setState('open');
    }
    function handleError(): void {
      setState('lost');
    }
    source.addEventListener(SNAPSHOT_EVENT, handleSnapshot);
    source.addEventListener('open', handleOpen);
    source.addEventListener('error', handleError);
    return (): void => {
      source.removeEventListener(SNAPSHOT_EVENT, handleSnapshot);
      source.removeEventListener('open', handleOpen);
      source.removeEventListener('error', handleError);
      source.close();
    };
  }, []);

  return { snapshot, state };
}
