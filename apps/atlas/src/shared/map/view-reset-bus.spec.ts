import { describe, it, expect, vi } from 'vitest';

import { dispatchViewReset, subscribeViewReset } from './view-reset-bus.ts';

describe('view reset bus', () => {
  it('invokes a registered listener on dispatch', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeViewReset(listener);
    dispatchViewReset();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('invokes every registered listener on a single dispatch', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeViewReset(a);
    const unsubB = subscribeViewReset(b);
    dispatchViewReset();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsubA();
    unsubB();
  });

  it('stops invoking a listener after its unsubscribe is called', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeViewReset(listener);
    unsubscribe();
    dispatchViewReset();
    expect(listener).not.toHaveBeenCalled();
  });

  it('iterates a snapshot so a listener unsubscribing a sibling does not skip it', () => {
    const a = vi.fn();
    const b = vi.fn();
    // The wrapper unsubscribes `a` mid-dispatch; if the iteration weren't
    // a snapshot, `a` could be skipped before its call. The dispatch
    // implementation copies the listener set before iterating to avoid
    // exactly this hazard.
    let unsubA: () => void = (): void => {};
    const wrapper = vi.fn(() => {
      unsubA();
    });
    const unsubW = subscribeViewReset(wrapper);
    unsubA = subscribeViewReset(a);
    const unsubB = subscribeViewReset(b);
    dispatchViewReset();
    expect(wrapper).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsubW();
    unsubB();
  });
});
