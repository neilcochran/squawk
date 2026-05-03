import { describe, it, expect, vi } from 'vitest';

import { dispatchChartViewReset, subscribeChartViewReset } from './view-reset-bus.ts';

describe('chart-view reset bus', () => {
  it('invokes a registered listener on dispatch', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeChartViewReset(listener);
    dispatchChartViewReset();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('invokes every registered listener on a single dispatch', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeChartViewReset(a);
    const unsubB = subscribeChartViewReset(b);
    dispatchChartViewReset();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsubA();
    unsubB();
  });

  it('stops invoking a listener after its unsubscribe is called', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeChartViewReset(listener);
    unsubscribe();
    dispatchChartViewReset();
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
    const unsubW = subscribeChartViewReset(wrapper);
    unsubA = subscribeChartViewReset(a);
    const unsubB = subscribeChartViewReset(b);
    dispatchChartViewReset();
    expect(wrapper).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsubW();
    unsubB();
  });
});
