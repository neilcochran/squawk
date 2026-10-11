import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import type { FlightplanResolver, ParsedRoute } from '@squawk/flightplan/browser';

import { usePlanRoute } from './use-plan-route.ts';

const PARSED: ParsedRoute = {
  raw: 'A B',
  elements: [
    { type: 'coordinate', raw: 'A', lat: 40, lon: -74 },
    { type: 'coordinate', raw: 'B', lat: 41, lon: -73 },
  ],
};

const resolver: FlightplanResolver = { parse: vi.fn(() => PARSED) };

describe('usePlanRoute', () => {
  it('returns undefined when the resolver is not ready', () => {
    const { result } = renderHook(() => usePlanRoute(undefined, 'A B', undefined));
    expect(result.current).toBeUndefined();
  });

  it('builds the plan route when the resolver is ready', () => {
    const { result } = renderHook(() => usePlanRoute(resolver, 'A B', 120));
    expect(result.current?.points).toHaveLength(2);
    expect(result.current?.distance.estimatedTimeEnrouteHrs).toBeGreaterThan(0);
  });

  it('memoizes across re-renders with unchanged inputs', () => {
    const { result, rerender } = renderHook(
      ({ s }: { s: string }) => usePlanRoute(resolver, s, undefined),
      { initialProps: { s: 'A B' } },
    );
    const first = result.current;
    rerender({ s: 'A B' });
    expect(result.current).toBe(first);
  });
});
