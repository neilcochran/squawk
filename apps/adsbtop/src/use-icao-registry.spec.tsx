import { Text } from 'ink';
import { render } from 'ink-testing-library';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { AircraftRegistration } from '@squawk/types';

import { useIcaoRegistry } from './use-icao-registry.js';
import type { RegistryDataLoader } from './use-icao-registry.js';

function makeLoader(records: AircraftRegistration[] = []): RegistryDataLoader {
  return () => Promise.resolve({ usBundledRegistry: { records } });
}

function Harness({ loadData }: { loadData: RegistryDataLoader }): ReactElement {
  const registry = useIcaoRegistry(loadData);
  return (
    <Text>
      {JSON.stringify({ ready: registry !== undefined, count: registry?.recordCount ?? 0 })}
    </Text>
  );
}

function flush(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mirrors use-aircraft-feed.spec.tsx's cleanup - without it, an earlier
// test's pending load effect can still be in flight during a later test.
let activeUnmount: (() => void) | undefined;

afterEach(() => {
  activeUnmount?.();
  activeUnmount = undefined;
});

function renderHarness(loadData: RegistryDataLoader): ReturnType<typeof render> {
  const instance = render(<Harness loadData={loadData} />);
  activeUnmount = instance.unmount;
  return instance;
}

describe('useIcaoRegistry', () => {
  it('starts undefined before the dataset has loaded', () => {
    const { lastFrame } = renderHarness(makeLoader());
    expect(lastFrame()).toContain('"ready":false');
  });

  it('builds a queryable registry once the dataset resolves', async () => {
    const { lastFrame } = renderHarness(
      makeLoader([{ icaoHex: 'A0B1C2', registration: 'N12345' }]),
    );
    await flush();

    expect(lastFrame()).toContain('"ready":true');
    expect(lastFrame()).toContain('"count":1');
  });

  it('stays undefined if the loader rejects, rather than throwing', async () => {
    const failingLoader: RegistryDataLoader = () => Promise.reject(new Error('boom'));
    const { lastFrame } = renderHarness(failingLoader);
    await flush();

    expect(lastFrame()).toContain('"ready":false');
  });

  it('does not update state after unmount', async () => {
    const { unmount } = renderHarness(makeLoader([{ icaoHex: 'A0B1C2', registration: 'N12345' }]));
    unmount();
    activeUnmount = undefined;

    // No assertion beyond "this doesn't throw" - the cancelled-flag guard
    // exists specifically to avoid a set-state-after-unmount warning here.
    await flush();
  });
});
