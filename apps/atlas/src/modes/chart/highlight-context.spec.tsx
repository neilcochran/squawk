import { describe, it, expect, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import {
  useActiveHighlightRef,
  useHoveredFeatureIndex,
  useSetHoveredChipSelection,
  useSetHoveredFeatureIndex,
} from './highlight-context.ts';
import { HighlightProvider } from './highlight-provider.tsx';

function wrap(
  activeHighlight: string | undefined,
  setHoveredChipSelection: (selection: string | undefined) => void = vi.fn(),
  hoveredFeatureIndex: number | undefined = undefined,
  setHoveredFeatureIndex: (index: number | undefined) => void = vi.fn(),
): (props: { children: ReactNode }) => ReactElement {
  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <HighlightProvider
        activeHighlight={activeHighlight}
        setHoveredChipSelection={setHoveredChipSelection}
        hoveredFeatureIndex={hoveredFeatureIndex}
        setHoveredFeatureIndex={setHoveredFeatureIndex}
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
      <HighlightProvider
        activeHighlight={undefined}
        setHoveredChipSelection={() => {}}
        hoveredFeatureIndex={undefined}
        setHoveredFeatureIndex={() => {}}
      >
        <span>child content</span>
      </HighlightProvider>,
    );
    expect(getByText('child content')).toBeInTheDocument();
  });
});

describe('useHoveredFeatureIndex', () => {
  it('returns the provider-supplied index', () => {
    const { result } = renderHook(() => useHoveredFeatureIndex(), {
      wrapper: wrap(undefined, vi.fn(), 2, vi.fn()),
    });
    expect(result.current).toBe(2);
  });

  it('returns undefined when no provider is mounted', () => {
    const { result } = renderHook(() => useHoveredFeatureIndex());
    expect(result.current).toBeUndefined();
  });
});

describe('useSetHoveredFeatureIndex', () => {
  it('forwards the supplied setter', () => {
    const setter = vi.fn();
    const { result } = renderHook(() => useSetHoveredFeatureIndex(), {
      wrapper: wrap(undefined, vi.fn(), undefined, setter),
    });
    result.current(3);
    expect(setter).toHaveBeenCalledWith(3);
    result.current(undefined);
    expect(setter).toHaveBeenLastCalledWith(undefined);
  });

  it('returns a no-op when no provider is mounted', () => {
    const { result } = renderHook(() => useSetHoveredFeatureIndex());
    expect(() => result.current(0)).not.toThrow();
    expect(() => result.current(undefined)).not.toThrow();
  });
});
