import { EventEmitter } from 'node:events';

import { render } from 'ink';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { AircraftUpdateEventDetail } from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

import { App } from './app.js';
import { createFakeAircraftFeed, createFakeRegistryDataLoader } from './test-utils.js';
import type { FakeAircraftFeed } from './test-utils.js';

/**
 * A fake stdout that reports a terminal size, which ink-testing-library's
 * does not - the whole point here is exercising the row budget.
 */
class SizedStdout extends EventEmitter {
  frames: string[] = [];
  private last = '';

  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {
    super();
  }

  write = (frame: string): boolean => {
    this.frames.push(frame);
    this.last = frame;
    return true;
  };

  lastFrame = (): string => this.last;
}

class FakeStdin extends EventEmitter {
  isTTY = true;
  private pending: string | null = null;

  write = (data: string): boolean => {
    this.pending = data;
    this.emit('readable');
    this.emit('data', data);
    return true;
  };

  read = (): string | null => {
    const data = this.pending;
    this.pending = null;
    return data;
  };

  setEncoding(): void {
    // no-op
  }

  setRawMode(): void {
    // no-op
  }

  resume(): void {
    // no-op
  }

  pause(): void {
    // no-op
  }

  ref(): void {
    // no-op
  }

  unref(): void {
    // no-op
  }
}

let activeUnmount: (() => void) | undefined;

afterEach(() => {
  activeUnmount?.();
  activeUnmount = undefined;
});

function renderSized(
  element: ReactElement,
  rows: number,
): { lastFrame: () => string; stdin: FakeStdin } {
  const stdout = new SizedStdout(120, rows);
  const stdin = new FakeStdin();
  const instance = render(element, {
    // The fakes cover the parts of the streams Ink touches in debug mode.
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  activeUnmount = instance.unmount;
  return { lastFrame: stdout.lastFrame, stdin };
}

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: Date.now(), ...overrides };
}

function dispatchNew(feed: FakeAircraftFeed, aircraft: Aircraft): void {
  const detail: AircraftUpdateEventDetail = { aircraft };
  feed.dispatchEvent(new CustomEvent('aircraft:new', { detail }));
}

function flush(ms = 30): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function app(feed: FakeAircraftFeed): ReactElement {
  return (
    <App
      feed={feed}
      source="sbs"
      host="localhost"
      port={30003}
      registryDataLoader={createFakeRegistryDataLoader()}
      location={undefined}
      columnKeys={['icaoHex', 'callsign']}
      filter={undefined}
      staleAfterMs={60_000}
      watchlist={[]}
      alertEmergency={false}
      bell={true}
      recordPath={undefined}
      units="aviation"
    />
  );
}

/** Twenty aircraft, hex A00000 through A00019, in the table's default sort order. */
function twentyAircraft(feed: FakeAircraftFeed): void {
  for (let i = 0; i < 20; i++) {
    dispatchNew(feed, makeAircraft({ icaoHex: `A000${i.toString().padStart(2, '0')}` }));
  }
}

describe('App row windowing', () => {
  it('shows only the rows that fit and labels the hidden ones', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame } = renderSized(app(feed), 16);
    twentyAircraft(feed);
    await flush();

    const frame = lastFrame();
    // 16 rows - status 2 - hotkey 2 = 12 for the table; minus border, header,
    // border, footer = 8 data rows.
    expect(frame).toContain('A00000');
    expect(frame).toContain('A00007');
    expect(frame).not.toContain('A00008');
    expect(frame).toContain('rows 1-8 of 20');
  });

  it('scrolls the window to follow the cursor and jumps by page and to the ends', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame, stdin } = renderSized(app(feed), 16);
    twentyAircraft(feed);
    await flush();

    for (let i = 0; i < 8; i++) {
      stdin.write('\u001B[B');
      await flush(5);
    }
    await flush();
    expect(lastFrame()).toContain('rows 2-9 of 20');
    expect(lastFrame()).toContain('A00008');

    stdin.write('\u001B[6~');
    await flush();
    expect(lastFrame()).toContain('A00016');
    expect(lastFrame()).toContain('rows 10-17 of 20');

    stdin.write('\u001B[F');
    await flush();
    expect(lastFrame()).toContain('rows 13-20 of 20');
    expect(lastFrame()).toContain('A00019');

    stdin.write('\u001B[H');
    await flush();
    expect(lastFrame()).toContain('rows 1-8 of 20');
    expect(lastFrame()).toContain('A00000');

    stdin.write('\u001B[5~');
    await flush();
    expect(lastFrame()).toContain('rows 1-8 of 20');
  });

  it('shows everything and no footer when the rows fit', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame } = renderSized(app(feed), 40);
    twentyAircraft(feed);
    await flush();

    expect(lastFrame()).toContain('A00019');
    expect(lastFrame()).not.toContain('of 20');
  });

  it('windows the detail view and scrolls it with Up/Down, keeping Left/Right for browsing', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame, stdin } = renderSized(app(feed), 16);
    dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2' }));
    dispatchNew(feed, makeAircraft({ icaoHex: 'D3E4F5' }));
    await flush();

    stdin.write('d');
    await flush();
    let frame = lastFrame();
    expect(frame).toContain('A0B1C2 detail');
    expect(frame).toContain('ICAO:');
    expect(frame).not.toContain('Last seen:');
    expect(frame).toContain('lines 1-8 of');

    stdin.write('\u001B[B');
    await flush();
    frame = lastFrame();
    expect(frame).not.toContain('ICAO:');
    expect(frame).toContain('lines 2-9 of');

    stdin.write('\u001B[F');
    await flush();
    expect(lastFrame()).toContain('Last seen:');

    stdin.write('\u001B[C');
    await flush();
    expect(lastFrame()).toContain('D3E4F5 detail');
  });
});
