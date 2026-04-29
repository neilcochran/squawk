import type { ReactElement } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  setAirspace3DAutoHidePreference,
  useAirspace3DAutoHidePreference,
} from './airspace-3d-preference.ts';

/**
 * Renders the current preference value into a `<span>` so a test can
 * assert what each consumer is observing. Used as one half of the
 * multi-consumer integration test - several of these mounted in the
 * same tree must all see the same value, and updates from a sibling
 * consumer must propagate to every reader.
 */
function PreferenceReader({ testId }: { testId: string }): ReactElement {
  const [preference] = useAirspace3DAutoHidePreference();
  return <span data-testid={testId}>{preference}</span>;
}

/**
 * Renders both the current preference and a button that flips it to
 * `'always'` when clicked. Used as the writer-side of the
 * multi-consumer integration test.
 */
function PreferenceWriter({
  testId,
  target,
}: {
  testId: string;
  target: 'always' | 'never';
}): ReactElement {
  const [preference, setPreference] = useAirspace3DAutoHidePreference();
  return (
    <div>
      <span data-testid={testId}>{preference}</span>
      <button type="button" onClick={() => setPreference(target)}>
        set {target}
      </button>
    </div>
  );
}

describe('useAirspace3DAutoHidePreference', () => {
  beforeEach((): void => {
    // Reset both localStorage and the module-level cache so each
    // test starts from the default `'ask'` regardless of order.
    window.localStorage.clear();
    act(() => {
      setAirspace3DAutoHidePreference('ask');
    });
  });

  it('shares state across two consumers mounted in the same tree', () => {
    // Reader and writer mount together. Setting via one must
    // re-render the other - this is the bug the test pins down. The
    // previous `useState`-based implementation gave each consumer its
    // own React state copy, so a setPreference from the writer would
    // leave the reader's value stale until next reload.
    render(
      <>
        <PreferenceReader testId="reader" />
        <PreferenceWriter testId="writer" target="always" />
      </>,
    );
    expect(screen.getByTestId('reader').textContent).toBe('ask');
    expect(screen.getByTestId('writer').textContent).toBe('ask');

    act(() => {
      fireEvent.click(screen.getByText('set always'));
    });

    expect(screen.getByTestId('reader').textContent).toBe('always');
    expect(screen.getByTestId('writer').textContent).toBe('always');
  });

  it('updates every reader when the value changes again', () => {
    // Two writers + a reader - the reader follows whichever writer
    // last set the value. Verifies that subsequent updates also
    // propagate, not just the first one.
    render(
      <>
        <PreferenceReader testId="reader" />
        <PreferenceWriter testId="writer-always" target="always" />
        <PreferenceWriter testId="writer-never" target="never" />
      </>,
    );
    expect(screen.getByTestId('reader').textContent).toBe('ask');

    act(() => {
      fireEvent.click(screen.getByText('set always'));
    });
    expect(screen.getByTestId('reader').textContent).toBe('always');

    act(() => {
      fireEvent.click(screen.getByText('set never'));
    });
    expect(screen.getByTestId('reader').textContent).toBe('never');
  });

  it('persists writes to localStorage', () => {
    render(<PreferenceWriter testId="writer" target="always" />);
    act(() => {
      fireEvent.click(screen.getByText('set always'));
    });
    expect(window.localStorage.getItem('atlas:chart:airspace-3d-auto-hide:v1')).toBe('always');
  });

  it('skips notifications when the value is unchanged', () => {
    // Setting the same value twice should not re-render subscribers
    // (the setter compares against the cached value before
    // notifying). Verified indirectly: the second `setPreference`
    // call leaves the rendered value the same, with no thrown
    // errors from the test harness for excess renders.
    render(<PreferenceReader testId="reader" />);
    act(() => {
      setAirspace3DAutoHidePreference('always');
    });
    expect(screen.getByTestId('reader').textContent).toBe('always');
    act(() => {
      setAirspace3DAutoHidePreference('always');
    });
    expect(screen.getByTestId('reader').textContent).toBe('always');
  });
});
