import { render } from 'ink-testing-library';
import { afterEach, describe, expect, it } from 'vitest';

import type { AircraftUpdateEventDetail } from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

import { App } from './app.js';
import { createFakeAircraftFeed } from './test-utils.js';
import type { FakeAircraftFeed } from './test-utils.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: Date.now(), ...overrides };
}

function dispatchNew(feed: FakeAircraftFeed, aircraft: Aircraft): void {
  const detail: AircraftUpdateEventDetail = { aircraft };
  feed.dispatchEvent(new CustomEvent('aircraft:new', { detail }));
}

function flush(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Each test's `render()` starts a real setInterval (the clock tick) and an
// event subscription on the fake feed; without an explicit unmount, an
// earlier test's App instance keeps ticking in the background during later
// tests, which previously made coverage flaky by timing rather than by code
// path. Tracking and unmounting the active instance after every test avoids
// that leak.
let activeUnmount: (() => void) | undefined;

afterEach(() => {
  activeUnmount?.();
  activeUnmount = undefined;
});

function renderApp(feed: FakeAircraftFeed): ReturnType<typeof render> {
  const instance = render(<App feed={feed} source="sbs" host="localhost" port={30003} />);
  activeUnmount = instance.unmount;
  return instance;
}

describe('App', () => {
  it('renders the status header, table, and hotkey bar', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame } = renderApp(feed);
    await flush();

    const frame = lastFrame();
    expect(frame).toContain('adsbtop');
    expect(frame).toContain('No aircraft tracked yet.');
    expect(frame).toContain('[Q]');
  });

  it('toggles the help overlay with H and closes it with Escape', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame, stdin } = renderApp(feed);
    await flush();

    stdin.write('h');
    await flush();
    expect(lastFrame()).toContain('adsbtop help');

    stdin.write(String.fromCharCode(27));
    await flush();
    expect(lastFrame()).not.toContain('adsbtop help');
  });

  it('toggles compact columns with C', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame, stdin } = renderApp(feed);
    await flush();

    expect(lastFrame()).toContain('Grnd');

    stdin.write('c');
    await flush();
    expect(lastFrame()).not.toContain('Grnd');
  });

  it('cycles the sort column with O', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame, stdin } = renderApp(feed);
    dispatchNew(feed, makeAircraft({ icaoHex: 'B00000', callsign: 'ZZZ999' }));
    dispatchNew(feed, makeAircraft({ icaoHex: 'A00000', callsign: 'AAA111' }));
    await flush();

    // Default sort is icaoHex ascending: A00000 before B00000.
    const byIcao = lastFrame() ?? '';
    expect(byIcao.indexOf('A00000')).toBeLessThan(byIcao.indexOf('B00000'));

    stdin.write('o');
    await flush();

    // Next in the cycle is callsign ascending: AAA111 before ZZZ999.
    const byCallsign = lastFrame() ?? '';
    expect(byCallsign.indexOf('AAA111')).toBeLessThan(byCallsign.indexOf('ZZZ999'));
  });

  it('freezes the table while paused and shows the current state on resume', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame, stdin } = renderApp(feed);
    dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2' }));
    await flush();
    expect(lastFrame()).toContain('A0B1C2');

    stdin.write('p');
    await flush();
    dispatchNew(feed, makeAircraft({ icaoHex: 'D3E4F5' }));
    await flush();
    expect(lastFrame()).not.toContain('D3E4F5');

    stdin.write('p');
    await flush();
    expect(lastFrame()).toContain('D3E4F5');
  });
});
