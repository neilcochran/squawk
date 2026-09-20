// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ScopeAircraftDetails } from '../../shared/protocol.js';

import { useAircraftDetails } from './use-aircraft-details.js';

function detailsFor(icaoHex: string): ScopeAircraftDetails {
  return { icaoHex, registration: `N-${icaoHex}` };
}

type Loader = (icaoHex: string) => Promise<ScopeAircraftDetails | undefined>;

describe('useAircraftDetails', () => {
  it('loads nothing while no aircraft is selected', () => {
    const load = vi.fn<Loader>();

    const { result } = renderHook(() => useAircraftDetails(undefined, load));

    expect(result.current).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });

  it('loads the details of the selected aircraft, once', async () => {
    const load = vi.fn<Loader>((icaoHex) => Promise.resolve(detailsFor(icaoHex)));

    const { result, rerender } = renderHook(() => useAircraftDetails('aaaaaa', load));
    await waitFor(() => expect(result.current).toEqual(detailsFor('aaaaaa')));
    rerender();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("never shows one aircraft's details for another: they clear as soon as the selection moves", async () => {
    let releaseNext: (details: ScopeAircraftDetails) => void = () => undefined;
    const load = vi
      .fn<Loader>()
      .mockResolvedValueOnce(detailsFor('aaaaaa'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseNext = resolve;
          }),
      );
    const { result, rerender } = renderHook(({ icaoHex }) => useAircraftDetails(icaoHex, load), {
      initialProps: { icaoHex: 'aaaaaa' as string | undefined },
    });
    await waitFor(() => expect(result.current).toEqual(detailsFor('aaaaaa')));

    rerender({ icaoHex: 'bbbbbb' });
    expect(result.current).toBeUndefined();

    act(() => {
      releaseNext(detailsFor('bbbbbb'));
    });
    await waitFor(() => expect(result.current).toEqual(detailsFor('bbbbbb')));

    rerender({ icaoHex: undefined });
    expect(result.current).toBeUndefined();
  });

  it('stays empty for an aircraft the registry does not know', async () => {
    const load = vi.fn<Loader>(() => Promise.resolve(undefined));

    const { result } = renderHook(() => useAircraftDetails('c0ffee', load));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    expect(result.current).toBeUndefined();
  });

  it('ignores details that arrive after the selection has moved on', async () => {
    let releaseFirst: (details: ScopeAircraftDetails) => void = () => undefined;
    const load = vi
      .fn<Loader>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(detailsFor('bbbbbb'));
    const { result, rerender } = renderHook(({ icaoHex }) => useAircraftDetails(icaoHex, load), {
      initialProps: { icaoHex: 'aaaaaa' },
    });

    rerender({ icaoHex: 'bbbbbb' });
    await waitFor(() => expect(result.current).toEqual(detailsFor('bbbbbb')));
    act(() => {
      releaseFirst(detailsFor('aaaaaa'));
    });

    expect(result.current).toEqual(detailsFor('bbbbbb'));
  });
});
