import { Text } from 'ink';
import { render } from 'ink-testing-library';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { AircraftLostEventDetail, AircraftUpdateEventDetail } from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

import { createFakeAircraftFeed } from './test-utils.js';
import type { FakeAircraftFeed } from './test-utils.js';
import { useAircraftFeed } from './use-aircraft-feed.js';

function makeAircraft(icaoHex: string): Aircraft {
  return { icaoHex, lastSeenAt: 0 };
}

function Harness({ feed }: { feed: FakeAircraftFeed }): ReactElement {
  const view = useAircraftFeed(feed);
  return (
    <Text>
      {JSON.stringify({
        count: view.aircraft.length,
        messageCount: view.messageCount,
        logLength: view.messageLog.length,
        lastLogType: view.messageLog.at(-1)?.type,
      })}
    </Text>
  );
}

function dispatchUpdate(
  feed: FakeAircraftFeed,
  type: 'aircraft:new' | 'aircraft:update',
  aircraft: Aircraft,
): void {
  const detail: AircraftUpdateEventDetail = { aircraft };
  feed.dispatchEvent(new CustomEvent(type, { detail }));
}

function dispatchLost(feed: FakeAircraftFeed, icaoHex: string): void {
  const detail: AircraftLostEventDetail = { icaoHex, lastAircraft: makeAircraft(icaoHex) };
  feed.dispatchEvent(new CustomEvent('aircraft:lost', { detail }));
}

function flush(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Without an explicit unmount, an earlier test's Harness instance (and its
// feed event listeners) keeps running in the background during later tests
// in this file - harmless for assertions on a single dispatch/flush cycle,
// but it made a multi-step test (dispatch, flush, assert, dispatch again)
// flaky by timing rather than by code path once enough instances piled up.
// Mirrors the same cleanup already established in app.spec.tsx.
let activeUnmount: (() => void) | undefined;

afterEach(() => {
  activeUnmount?.();
  activeUnmount = undefined;
});

function renderHarness(feed: FakeAircraftFeed): ReturnType<typeof render> {
  const instance = render(<Harness feed={feed} />);
  activeUnmount = instance.unmount;
  return instance;
}

describe('useAircraftFeed', () => {
  it('starts the feed on mount and stops it on unmount', async () => {
    const feed = createFakeAircraftFeed();
    const { unmount } = renderHarness(feed);
    await flush();

    expect(feed.startCalls).toBe(1);
    expect(feed.stopCalls).toBe(0);

    unmount();

    expect(feed.stopCalls).toBe(1);
  });

  it('renders an empty aircraft list before any event arrives', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame } = renderHarness(feed);
    await flush();

    expect(lastFrame()).toContain('"count":0');
    expect(lastFrame()).toContain('"messageCount":0');
  });

  it('adds a tracked aircraft and increments the message count on aircraft:new', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame } = renderHarness(feed);
    dispatchUpdate(feed, 'aircraft:new', makeAircraft('A0B1C2'));
    await flush();

    expect(lastFrame()).toContain('"count":1');
    expect(lastFrame()).toContain('"messageCount":1');
  });

  it('removes a tracked aircraft on aircraft:lost', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame } = renderHarness(feed);
    dispatchUpdate(feed, 'aircraft:new', makeAircraft('A0B1C2'));
    await flush();
    dispatchLost(feed, 'A0B1C2');
    await flush();

    expect(lastFrame()).toContain('"count":0');
  });

  it('distinguishes new, update, and lost events in the message log', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame } = renderHarness(feed);

    dispatchUpdate(feed, 'aircraft:new', makeAircraft('A0B1C2'));
    await flush();
    expect(lastFrame()).toContain('"logLength":1');
    expect(lastFrame()).toContain('"lastLogType":"new"');

    dispatchUpdate(feed, 'aircraft:update', makeAircraft('A0B1C2'));
    await flush();
    expect(lastFrame()).toContain('"logLength":2');
    expect(lastFrame()).toContain('"lastLogType":"update"');

    dispatchLost(feed, 'A0B1C2');
    await flush();
    expect(lastFrame()).toContain('"logLength":3');
    expect(lastFrame()).toContain('"lastLogType":"lost"');
  });
});
