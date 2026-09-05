import { render } from 'ink-testing-library';
import { afterEach, describe, expect, it } from 'vitest';

import type { AircraftUpdateEventDetail } from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

import { App } from './app.js';
import { createFakeAircraftFeed, createFakeRegistryDataLoader } from './test-utils.js';
import type { FakeAircraftFeed } from './test-utils.js';
import type { RegistryDataLoader } from './use-icao-registry.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: Date.now(), ...overrides };
}

function dispatchNew(feed: FakeAircraftFeed, aircraft: Aircraft): void {
  const detail: AircraftUpdateEventDetail = { aircraft };
  feed.dispatchEvent(new CustomEvent('aircraft:new', { detail }));
}

function dispatchUpdate(feed: FakeAircraftFeed, aircraft: Aircraft): void {
  const detail: AircraftUpdateEventDetail = { aircraft };
  feed.dispatchEvent(new CustomEvent('aircraft:update', { detail }));
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

function renderApp(
  feed: FakeAircraftFeed,
  registryDataLoader: RegistryDataLoader = createFakeRegistryDataLoader(),
): ReturnType<typeof render> {
  const instance = render(
    <App
      feed={feed}
      source="sbs"
      host="localhost"
      port={30003}
      registryDataLoader={registryDataLoader}
    />,
  );
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

  describe('row cursor and detail view', () => {
    it('defaults the cursor to the first row and opens its detail with Enter', async () => {
      const feed = createFakeAircraftFeed();
      const { lastFrame, stdin } = renderApp(feed);
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL111' }));
      dispatchNew(feed, makeAircraft({ icaoHex: 'D3E4F5', callsign: 'DAL222' }));
      await flush();

      stdin.write('\r');
      await flush();

      const frame = lastFrame() ?? '';
      expect(frame).toContain('A0B1C2 detail');
      expect(frame).not.toContain('D3E4F5 detail');
    });

    it('moves the cursor down with the arrow key before opening detail', async () => {
      const feed = createFakeAircraftFeed();
      const { lastFrame, stdin } = renderApp(feed);
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL111' }));
      dispatchNew(feed, makeAircraft({ icaoHex: 'D3E4F5', callsign: 'DAL222' }));
      await flush();

      stdin.write('[B');
      await flush();
      stdin.write('d');
      await flush();

      expect(lastFrame()).toContain('D3E4F5 detail');
    });

    it('closes the detail view with Escape', async () => {
      const feed = createFakeAircraftFeed();
      const { lastFrame, stdin } = renderApp(feed);
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2' }));
      await flush();

      stdin.write('d');
      await flush();
      expect(lastFrame()).toContain('A0B1C2 detail');

      stdin.write(String.fromCharCode(27));
      await flush();
      expect(lastFrame()).not.toContain('A0B1C2 detail');
    });

    it('moves the cursor back up with the up arrow key', async () => {
      const feed = createFakeAircraftFeed();
      const { lastFrame, stdin } = renderApp(feed);
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL111' }));
      dispatchNew(feed, makeAircraft({ icaoHex: 'D3E4F5', callsign: 'DAL222' }));
      await flush();

      stdin.write(`${String.fromCharCode(27)}[B`);
      await flush();
      stdin.write(`${String.fromCharCode(27)}[A`);
      await flush();
      stdin.write('d');
      await flush();

      expect(lastFrame()).toContain('A0B1C2 detail');
    });

    it('does nothing on Enter/D when no aircraft is tracked', async () => {
      const feed = createFakeAircraftFeed();
      const { lastFrame, stdin } = renderApp(feed);
      await flush();

      stdin.write('\r');
      await flush();
      stdin.write('d');
      await flush();

      expect(lastFrame()).toContain('No aircraft tracked yet.');
    });

    it('does nothing on Escape when the table is already showing', async () => {
      const feed = createFakeAircraftFeed();
      const { lastFrame, stdin } = renderApp(feed);
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2' }));
      await flush();

      stdin.write(String.fromCharCode(27));
      await flush();

      expect(lastFrame()).toContain('A0B1C2');
    });
  });

  describe('search', () => {
    it('opens a search prompt with S, jumps to the match on submit, and reveals [N]', async () => {
      const feed = createFakeAircraftFeed();
      const { lastFrame, stdin } = renderApp(feed);
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL111' }));
      dispatchNew(feed, makeAircraft({ icaoHex: 'D3E4F5', callsign: 'DAL222' }));
      await flush();

      stdin.write('s');
      await flush();
      expect(lastFrame()).toContain('Search:');

      stdin.write('dal');
      await flush();
      stdin.write('\r');
      await flush();

      expect(lastFrame()).not.toContain('Search:');
      expect(lastFrame()).toContain('[N]');

      stdin.write('d');
      await flush();
      expect(lastFrame()).toContain('D3E4F5 detail');
    });

    it('cancels the search prompt with Escape without changing the selection', async () => {
      const feed = createFakeAircraftFeed();
      const { lastFrame, stdin } = renderApp(feed);
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2' }));
      dispatchNew(feed, makeAircraft({ icaoHex: 'D3E4F5' }));
      await flush();

      stdin.write('s');
      await flush();
      stdin.write('zzz');
      await flush();
      stdin.write(String.fromCharCode(27));
      await flush();

      expect(lastFrame()).not.toContain('Search:');

      stdin.write('d');
      await flush();
      expect(lastFrame()).toContain('A0B1C2 detail');
    });

    it('cycles forward through matches with N and back with Shift+N', async () => {
      const feed = createFakeAircraftFeed();
      const { lastFrame, stdin } = renderApp(feed);
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL111' }));
      dispatchNew(feed, makeAircraft({ icaoHex: 'D3E4F5', callsign: 'DAL222' }));
      dispatchNew(feed, makeAircraft({ icaoHex: 'F6A7B8', callsign: 'UAL333' }));
      await flush();

      // Cursor defaults to A0B1C2 (first row); submitting "ual" searches
      // forward from there and skips it, landing on the next match, F6A7B8.
      stdin.write('s');
      await flush();
      stdin.write('ual');
      await flush();
      stdin.write('\r');
      await flush();
      stdin.write('d');
      await flush();
      expect(lastFrame()).toContain('F6A7B8 detail');

      // [N]ext wraps around past the end back to the first match, A0B1C2.
      stdin.write(String.fromCharCode(27));
      await flush();
      stdin.write('n');
      await flush();
      stdin.write('d');
      await flush();
      expect(lastFrame()).toContain('A0B1C2 detail');

      // Shift+N (previous) wraps back around to the last match, F6A7B8.
      stdin.write(String.fromCharCode(27));
      await flush();
      stdin.write('N');
      await flush();
      stdin.write('d');
      await flush();
      expect(lastFrame()).toContain('F6A7B8 detail');
    });

    it('does nothing on n/N before any search has been submitted', async () => {
      const feed = createFakeAircraftFeed();
      const { lastFrame, stdin } = renderApp(feed);
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2' }));
      await flush();

      stdin.write('n');
      await flush();
      stdin.write('N');
      await flush();
      stdin.write('d');
      await flush();

      expect(lastFrame()).toContain('A0B1C2 detail');
    });
  });

  describe('messages panel', () => {
    it('toggles the messages panel with M and logs new/lost events', async () => {
      const feed = createFakeAircraftFeed();
      const { lastFrame, stdin } = renderApp(feed);

      stdin.write('m');
      await flush();
      expect(lastFrame()).toContain('No messages yet.');

      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL123' }));
      await flush();
      expect(lastFrame()).toContain('UAL123');
    });

    it('filters update events by default and reveals them with V', async () => {
      const feed = createFakeAircraftFeed();
      const { lastFrame, stdin } = renderApp(feed);
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL123' }));
      await flush();

      stdin.write('m');
      await flush();
      dispatchUpdate(
        feed,
        makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL123', groundSpeedKt: 200 }),
      );
      await flush();
      expect(lastFrame()).toContain('(new/lost)');
      expect(lastFrame()).not.toContain('UPDT');

      stdin.write('v');
      await flush();
      dispatchUpdate(
        feed,
        makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL123', groundSpeedKt: 210 }),
      );
      await flush();
      expect(lastFrame()).toContain('(all)');
      expect(lastFrame()).toContain('UPDT');
    });

    it('keeps showing a new/lost entry after switching to verbose and back, even with updates in between', async () => {
      // Regression test for a real bug: filtering one shared capped log at
      // render time meant switching verbosity could make a still-relevant
      // new/lost entry vanish, since enough intervening `update` traffic
      // could have already evicted it from the shared cap. newAndLostLog is
      // now a separate log update volume can't touch.
      const feed = createFakeAircraftFeed();
      const { lastFrame, stdin } = renderApp(feed);
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL123' }));
      await flush();

      stdin.write('m');
      await flush();
      expect(lastFrame()).toContain('UAL123');

      stdin.write('v');
      await flush();
      for (let i = 0; i < 20; i += 1) {
        dispatchUpdate(
          feed,
          makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL123', groundSpeedKt: 200 + i }),
        );
      }
      await flush();
      expect(lastFrame()).toContain('(all)');

      stdin.write('v');
      await flush();
      expect(lastFrame()).toContain('(new/lost)');
      expect(lastFrame()).toContain('UAL123');
    });
  });

  describe('registration enrichment', () => {
    it('populates the Reg column once the registry loads and finds a match', async () => {
      const feed = createFakeAircraftFeed();
      const loader = createFakeRegistryDataLoader([{ icaoHex: 'A0B1C2', registration: 'N12345' }]);
      const { lastFrame } = renderApp(feed, loader);
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL123' }));
      await flush();

      expect(lastFrame()).toContain('UAL123');
      expect(lastFrame()).toContain('N12345');
    });

    it('leaves the Reg column at "-" for an aircraft with no registry match', async () => {
      const feed = createFakeAircraftFeed();
      const { lastFrame } = renderApp(feed, createFakeRegistryDataLoader([]));
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL123' }));
      await flush();

      expect(lastFrame()).toContain('UAL123');
      expect(lastFrame()).not.toContain('N12345');
    });

    it('finds an aircraft by N-number with Search', async () => {
      const feed = createFakeAircraftFeed();
      const loader = createFakeRegistryDataLoader([{ icaoHex: 'A0B1C2', registration: 'N12345' }]);
      const { lastFrame, stdin } = renderApp(feed, loader);
      dispatchNew(feed, makeAircraft({ icaoHex: 'A0B1C2' }));
      dispatchNew(feed, makeAircraft({ icaoHex: 'D3E4F5' }));
      await flush();

      stdin.write('s');
      await flush();
      stdin.write('n12345');
      await flush();
      stdin.write('\r');
      await flush();
      stdin.write('d');
      await flush();

      expect(lastFrame()).toContain('A0B1C2 detail');
    });
  });
});
