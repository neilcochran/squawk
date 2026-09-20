// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeSnapshot, makeTarget } from '../scope/test-utils.js';
import { FakeEventSource } from '../test-utils.js';

import { parseSnapshot, useScopeStream } from './use-scope-stream.js';

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseSnapshot', () => {
  it('decodes a snapshot', () => {
    const snapshot = makeSnapshot([makeTarget({ callsign: 'UAL123' })]);

    expect(parseSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('accepts either connection state', () => {
    const snapshot = makeSnapshot([], { connection: 'reconnecting' });

    expect(parseSnapshot(JSON.stringify(snapshot))?.connection).toBe('reconnecting');
  });

  it('returns undefined for anything that is not a snapshot', () => {
    expect(parseSnapshot('{broken')).toBeUndefined();
    expect(parseSnapshot('null')).toBeUndefined();
    expect(parseSnapshot('[]')).toBeUndefined();
    expect(parseSnapshot(JSON.stringify({ connection: 'connected', targets: [] }))).toBeUndefined();
    expect(parseSnapshot(JSON.stringify({ at: 1, connection: 'up', targets: [] }))).toBeUndefined();
    expect(parseSnapshot(JSON.stringify({ at: 1, connection: 'connected' }))).toBeUndefined();
  });
});

describe('useScopeStream', () => {
  it('subscribes to the stream endpoint and starts out connecting with no snapshot', () => {
    const { result } = renderHook(() => useScopeStream());

    expect(FakeEventSource.latest().url).toBe('/api/stream');
    expect(result.current).toEqual({ snapshot: undefined, state: 'connecting' });
  });

  it('tracks the link state as the stream opens and drops', () => {
    const { result } = renderHook(() => useScopeStream());

    act(() => FakeEventSource.latest().emitOpen());
    expect(result.current.state).toBe('open');

    act(() => FakeEventSource.latest().emitError());
    expect(result.current.state).toBe('lost');

    act(() => FakeEventSource.latest().emitOpen());
    expect(result.current.state).toBe('open');
  });

  it('publishes each snapshot and keeps the last one across a dropped link', () => {
    const { result } = renderHook(() => useScopeStream());
    const first = makeSnapshot([makeTarget()]);
    const second = makeSnapshot([], { at: 1_001_000 });

    act(() => FakeEventSource.latest().emit('snapshot', JSON.stringify(first)));
    expect(result.current.snapshot).toEqual(first);

    act(() => FakeEventSource.latest().emit('snapshot', JSON.stringify(second)));
    act(() => FakeEventSource.latest().emitError());
    expect(result.current.snapshot).toEqual(second);
  });

  it('ignores a snapshot event it cannot decode', () => {
    const { result } = renderHook(() => useScopeStream());
    const snapshot = makeSnapshot();

    act(() => FakeEventSource.latest().emit('snapshot', JSON.stringify(snapshot)));
    act(() => FakeEventSource.latest().emit('snapshot', '{broken'));

    expect(result.current.snapshot).toEqual(snapshot);
  });

  it('closes the stream and stops listening on unmount', () => {
    const { result, unmount } = renderHook(() => useScopeStream());
    const source = FakeEventSource.latest();

    unmount();
    source.emitOpen();

    expect(source.closed).toBe(true);
    expect(result.current.state).toBe('connecting');
  });
});
