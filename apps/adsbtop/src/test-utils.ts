import type { AircraftFeed, PositionHistoryEntry } from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

/** A fake {@link AircraftFeed} for tests: a real `EventTarget` so production code can dispatch events on it normally, with `start`/`stop` call counts and stubbed query methods. */
export interface FakeAircraftFeed extends AircraftFeed {
  /** Number of times `start()` has been called. */
  startCalls: number;
  /** Number of times `stop()` has been called. */
  stopCalls: number;
}

/**
 * Creates a {@link FakeAircraftFeed} with no real socket/HTTP behavior, for
 * tests that need to dispatch `aircraft:new`/`aircraft:update`/`aircraft:lost`
 * events without a live dump1090-fa station.
 */
export function createFakeAircraftFeed(): FakeAircraftFeed {
  const feed = Object.assign(new EventTarget(), {
    startCalls: 0,
    stopCalls: 0,
    start(): void {
      feed.startCalls += 1;
    },
    stop(): void {
      feed.stopCalls += 1;
    },
    getAircraft(): Aircraft | undefined {
      return undefined;
    },
    getAllAircraft(): Aircraft[] {
      return [];
    },
    getPositionHistory(): PositionHistoryEntry[] {
      return [];
    },
  });
  return feed;
}
