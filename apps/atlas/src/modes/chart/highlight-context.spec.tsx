import { describe, it, expect, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { useActiveHighlightRef, useSetHoveredChipSelection } from './highlight-context.ts';
import { HighlightProvider } from './highlight-provider.tsx';

function wrap(
  activeHighlight: string | undefined,
  setHoveredChipSelection: (selection: string | undefined) => void = vi.fn(),
): (props: { children: ReactNode }) => ReactElement {
  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <HighlightProvider
        activeHighlight={activeHighlight}
        setHoveredChipSelection={setHoveredChipSelection}
      >
        {children}
      </HighlightProvider>
    );
  }
  return Wrapper;
}

describe('HighlightProvider', () => {
  it('parses a string selection into an entity ref', () => {
    const { result } = renderHook(() => useActiveHighlightRef(), {
      wrapper: wrap('airport:BOS'),
    });
    expect(result.current).toEqual({ type: 'airport', id: 'BOS' });
  });

  it('returns undefined when activeHighlight is undefined', () => {
    const { result } = renderHook(() => useActiveHighlightRef(), {
      wrapper: wrap(undefined),
    });
    expect(result.current).toBeUndefined();
  });

  it('returns undefined when activeHighlight is unparseable', () => {
    const { result } = renderHook(() => useActiveHighlightRef(), {
      wrapper: wrap('not-a-valid-selection'),
    });
    expect(result.current).toBeUndefined();
  });

  it('preserves an airspace compound id in the parsed ref', () => {
    const { result } = renderHook(() => useActiveHighlightRef(), {
      wrapper: wrap('airspace:CLASS_B/JFK'),
    });
    expect(result.current).toEqual({ type: 'airspace', id: 'CLASS_B/JFK' });
  });

  it('exposes the setHoveredChipSelection callback', () => {
    const setter = vi.fn();
    const { result } = renderHook(() => useSetHoveredChipSelection(), {
      wrapper: wrap('airport:BOS', setter),
    });
    result.current('navaid:BOS');
    expect(setter).toHaveBeenCalledWith('navaid:BOS');
    result.current(undefined);
    expect(setter).toHaveBeenCalledWith(undefined);
  });
});

describe('useActiveHighlightRef without a provider', () => {
  it('returns undefined', () => {
    const { result } = renderHook(() => useActiveHighlightRef());
    expect(result.current).toBeUndefined();
  });
});

describe('useSetHoveredChipSelection without a provider', () => {
  it('returns a no-op function', () => {
    const { result } = renderHook(() => useSetHoveredChipSelection());
    // Should not throw when called outside a provider.
    expect(() => result.current('airport:BOS')).not.toThrow();
    expect(() => result.current(undefined)).not.toThrow();
  });
});

describe('HighlightProvider rendering', () => {
  it('renders children without modification', () => {
    const { getByText } = render(
      <HighlightProvider activeHighlight={undefined} setHoveredChipSelection={() => {}}>
        <span>child content</span>
      </HighlightProvider>,
    );
    expect(getByText('child content')).toBeInTheDocument();
  });
});
