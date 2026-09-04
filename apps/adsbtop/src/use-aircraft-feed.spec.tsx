import { Text } from 'ink';
import { render } from 'ink-testing-library';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

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
    <Text>{JSON.stringify({ count: view.aircraft.length, messageCount: view.messageCount })}</Text>
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

describe('useAircraftFeed', () => {
  it('starts the feed on mount and stops it on unmount', async () => {
    const feed = createFakeAircraftFeed();
    const { unmount } = render(<Harness feed={feed} />);
    await flush();

    expect(feed.startCalls).toBe(1);
    expect(feed.stopCalls).toBe(0);

    unmount();

    expect(feed.stopCalls).toBe(1);
  });

  it('renders an empty aircraft list before any event arrives', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame } = render(<Harness feed={feed} />);
    await flush();

    expect(lastFrame()).toContain('"count":0');
    expect(lastFrame()).toContain('"messageCount":0');
  });

  it('adds a tracked aircraft and increments the message count on aircraft:new', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame } = render(<Harness feed={feed} />);
    dispatchUpdate(feed, 'aircraft:new', makeAircraft('A0B1C2'));
    await flush();

    expect(lastFrame()).toContain('"count":1');
    expect(lastFrame()).toContain('"messageCount":1');
  });

  it('removes a tracked aircraft on aircraft:lost', async () => {
    const feed = createFakeAircraftFeed();
    const { lastFrame } = render(<Harness feed={feed} />);
    dispatchUpdate(feed, 'aircraft:new', makeAircraft('A0B1C2'));
    await flush();
    dispatchLost(feed, 'A0B1C2');
    await flush();

    expect(lastFrame()).toContain('"count":0');
  });
});
