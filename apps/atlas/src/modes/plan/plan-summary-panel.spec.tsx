import { render, screen, fireEvent, act } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

import type { RouteDistanceResult } from '@squawk/flightplan/browser';

import type { PlanRoute, PlanRouteIssue } from './plan-route.ts';
import { PlanSummaryPanel } from './plan-summary-panel.tsx';
import type { PlanSummaryPanelProps } from './plan-summary-panel.tsx';

function makeRoute(
  distance?: Partial<RouteDistanceResult>,
  issues: PlanRouteIssue[] = [],
  raw = 'KJFK DCT MERIT DCT KLAX',
): PlanRoute {
  return {
    parsed: { raw, elements: [] },
    points: [],
    issues,
    distance: {
      legs: [
        {
          from: 'KJFK',
          to: 'MERIT',
          fromLat: 0,
          fromLon: 0,
          toLat: 0,
          toLon: 0,
          distanceNm: 30,
          cumulativeDistanceNm: 30,
          crossesGap: false,
          unusable: false,
          procedureAirportMismatch: false,
        },
        {
          from: 'MERIT',
          to: 'KLAX',
          fromLat: 0,
          fromLon: 0,
          toLat: 0,
          toLon: 0,
          distanceNm: 2000,
          cumulativeDistanceNm: 2030,
          crossesGap: false,
          unusable: false,
          procedureAirportMismatch: false,
        },
      ],
      totalDistanceNm: 2030,
      estimatedTimeEnrouteHrs: undefined,
      unresolvedElements: [],
      ...distance,
    },
  };
}

const DEFAULT_PROPS: PlanSummaryPanelProps = {
  route: undefined,
  loading: false,
  groundSpeedKt: undefined,
  onGroundSpeedChange: () => {},
};

function renderPanel(props: Partial<PlanSummaryPanelProps> = {}): RenderResult {
  return render(<PlanSummaryPanel {...DEFAULT_PROPS} {...props} />);
}

/** Answers the desktop-layout query `false`, as a phone below `md:` would. */
function stubPhoneLayout(): void {
  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => ({
    matches: query !== '(min-width: 48rem)' && query !== '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: (): void => {},
    removeListener: (): void => {},
    addEventListener: (): void => {},
    removeEventListener: (): void => {},
    dispatchEvent: (): boolean => false,
  }));
}

/**
 * Installs a ResizeObserver stub that hands its callback back to the test so
 * a layout change can be simulated; jsdom has none and reports every element
 * as zero-height.
 */
function stubResizeObserver(): {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  notify: () => void;
} {
  let callback: (() => void) | undefined;
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = observe;
      disconnect = disconnect;
      constructor(next: () => void) {
        callback = next;
      }
    },
  );
  return { observe, disconnect, notify: () => callback?.() };
}

function setHeights(asidePx: number, peekPx: number): void {
  const aside = screen.getByRole('complementary', { name: 'Flight plan summary' });
  Object.defineProperty(aside, 'offsetHeight', { configurable: true, value: asidePx });
  const peek = screen.getByRole('heading', { name: 'Flight plan' }).closest('.sticky');
  if (!(peek instanceof HTMLElement)) {
    throw new Error('peek region not found');
  }
  Object.defineProperty(peek, 'offsetHeight', { configurable: true, value: peekPx });
}

function occlusion(): string {
  return document.documentElement.style.getPropertyValue('--atlas-inspector-occlusion');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlanSummaryPanel', () => {
  it('shows a hint when there is no route', () => {
    renderPanel();
    expect(screen.getByText(/enter a route/i)).toBeInTheDocument();
  });

  it('shows a loading line instead of the hint when a route is waiting on the data', () => {
    renderPanel({ loading: true });
    expect(
      screen.getByText(/loading aeronautical data to resolve this route/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/enter a route/i)).not.toBeInTheDocument();
  });

  it('renders the total distance and the leg breakdown', () => {
    renderPanel({ route: makeRoute() });
    expect(screen.getAllByText('2,030 nm').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('KJFK -> MERIT')).toBeInTheDocument();
    expect(screen.getByText('2,000 nm')).toBeInTheDocument();
  });

  it('shows the ETE when present', () => {
    renderPanel({ route: makeRoute({ estimatedTimeEnrouteHrs: 1.5 }), groundSpeedKt: 450 });
    expect(screen.getByText('1:30')).toBeInTheDocument();
  });

  it('lists unresolved tokens', () => {
    renderPanel({
      route: makeRoute({ unresolvedElements: [{ type: 'unresolved', raw: 'ZZZZ' }] }),
    });
    expect(screen.getByText('ZZZZ')).toBeInTheDocument();
  });

  it('commits the ground speed through the field', () => {
    const onGroundSpeedChange = vi.fn();
    renderPanel({ route: makeRoute(), onGroundSpeedChange });
    const field = screen.getByLabelText('Ground speed (kt)');
    fireEvent.change(field, { target: { value: '450' } });
    expect(onGroundSpeedChange).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(onGroundSpeedChange).toHaveBeenCalledWith(450);
  });

  it('warns that the route is not valid as filed, naming each airway and procedure problem', () => {
    renderPanel({
      route: makeRoute(undefined, [
        { kind: 'gap', airway: 'J60', from: 'JOT', to: 'DJB' },
        { kind: 'unusable', airway: 'J108', from: 'TCS', to: 'GINGR' },
        { kind: 'airportMismatch', procedure: 'AALLE4', procedureType: 'STAR', airport: 'KBOS' },
      ]),
    });
    const warning = screen.getByRole('status');
    expect(warning).toHaveTextContent('Not valid as filed');
    expect(warning).toHaveTextContent('J60 is not defined between JOT and DJB');
    expect(warning).toHaveTextContent('J108 from TCS to GINGR is unusable');
    expect(warning).toHaveTextContent('STAR AALLE4 does not serve the arrival airport KBOS');
  });

  it('shows no filing warning for a valid route', () => {
    renderPanel({ route: makeRoute() });
    expect(screen.queryByText('Not valid as filed')).toBeNull();
  });

  it('tags the legs that cross a gap or an unusable segment', () => {
    const route = makeRoute();
    const [first, second] = route.distance.legs;
    if (first === undefined || second === undefined) {
      throw new Error('fixture has two legs');
    }
    renderPanel({
      route: {
        ...route,
        distance: {
          ...route.distance,
          legs: [
            { ...first, crossesGap: true },
            { ...second, unusable: true },
          ],
        },
      },
    });
    expect(screen.getByText('KJFK -> MERIT').closest('li')).toHaveTextContent('gap');
    expect(screen.getByText('MERIT -> KLAX').closest('li')).toHaveTextContent('unusable');
  });

  it('tags a leg along or into a procedure filed at the wrong airport', () => {
    const route = makeRoute();
    const [first, second] = route.distance.legs;
    if (first === undefined || second === undefined) {
      throw new Error('fixture has two legs');
    }
    renderPanel({
      route: {
        ...route,
        distance: {
          ...route.distance,
          legs: [first, { ...second, procedureAirportMismatch: true }],
        },
      },
    });
    const tag = screen.getByText('wrong airport');
    expect(tag).toHaveAttribute(
      'title',
      'This SID or STAR does not serve the airport it is filed at.',
    );
    expect(screen.getByText('MERIT -> KLAX').closest('li')).toContainElement(tag);
    expect(screen.getByText('KJFK -> MERIT').closest('li')).not.toHaveTextContent('wrong airport');
  });

  it('titles each leg label with its full text, for when it truncates', () => {
    renderPanel({ route: makeRoute() });
    expect(screen.getByText('KJFK -> MERIT')).toHaveAttribute('title', 'KJFK -> MERIT');
  });

  it('offers a separator that resizes the desktop panel', () => {
    renderPanel();
    const separator = screen.getByRole('separator', { name: 'Resize flight plan panel' });
    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(document.documentElement.style.getPropertyValue('--atlas-side-panel-width')).toBe(
      '376px',
    );
    expect(window.localStorage.getItem('atlas:plan:summary-width:v1')).toBe('376');
    window.localStorage.removeItem('atlas:plan:summary-width:v1');
  });

  it('handles a route that resolved to no drawable legs', () => {
    renderPanel({ route: makeRoute({ legs: [], totalDistanceNm: 0 }) });
    expect(screen.getByText(/no drawable legs/i)).toBeInTheDocument();
  });

  describe('bottom sheet visibility', () => {
    it('hides the sheet below md until there is a route, keeping the desktop panel', () => {
      renderPanel();
      const aside = screen.getByRole('complementary', { name: 'Flight plan summary' });
      expect(aside).toHaveClass('hidden', 'md:block');
    });

    it('shows the sheet once a route resolves', () => {
      renderPanel({ route: makeRoute() });
      const aside = screen.getByRole('complementary', { name: 'Flight plan summary' });
      expect(aside).not.toHaveClass('hidden');
    });

    it('shows the sheet while a route in the URL waits on the data', () => {
      renderPanel({ loading: true });
      const aside = screen.getByRole('complementary', { name: 'Flight plan summary' });
      expect(aside).not.toHaveClass('hidden');
    });
  });

  describe('occlusion', () => {
    it('publishes zero occlusion with no route, whatever the measured height', () => {
      const observer = stubResizeObserver();
      renderPanel();
      setHeights(320, 60);
      act(() => observer.notify());
      expect(occlusion()).toBe('0px');
    });

    it('publishes the measured sheet height while a route is shown', () => {
      const observer = stubResizeObserver();
      const { unmount } = renderPanel({ route: makeRoute() });
      const aside = screen.getByRole('complementary', { name: 'Flight plan summary' });
      expect(observer.observe).toHaveBeenCalledWith(aside);
      setHeights(320, 60);
      act(() => observer.notify());
      expect(occlusion()).toBe('320px');
      unmount();
      expect(observer.disconnect).toHaveBeenCalled();
    });

    it('removes the occlusion properties on unmount', () => {
      const { unmount } = renderPanel({ route: makeRoute() });
      unmount();
      expect(occlusion()).toBe('');
      expect(document.documentElement.style.getPropertyValue('--atlas-inspector-anim')).toBe('');
    });
  });

  describe('minimizing the bottom sheet', () => {
    it('collapses to the header from the grab handle and publishes the peek height', () => {
      stubPhoneLayout();
      const observer = stubResizeObserver();
      renderPanel({ route: makeRoute() });
      setHeights(320, 60);
      act(() => observer.notify());
      fireEvent.click(screen.getByRole('button', { name: 'Minimize flight plan' }));
      const handle = screen.getByRole('button', { name: 'Expand flight plan' });
      expect(handle).toHaveAttribute('aria-expanded', 'false');
      expect(occlusion()).toBe('60px');
      expect(screen.getByLabelText('Ground speed (kt)').closest('[inert]')).not.toBeNull();
    });

    it('restores from the grab handle', () => {
      stubPhoneLayout();
      renderPanel({ route: makeRoute() });
      fireEvent.click(screen.getByRole('button', { name: 'Minimize flight plan' }));
      fireEvent.click(screen.getByRole('button', { name: 'Expand flight plan' }));
      expect(screen.getByRole('button', { name: 'Minimize flight plan' })).toBeInTheDocument();
      expect(screen.getByLabelText('Ground speed (kt)').closest('[inert]')).toBeNull();
    });

    it('restores when a different route is committed', () => {
      stubPhoneLayout();
      const { rerender } = renderPanel({ route: makeRoute() });
      fireEvent.click(screen.getByRole('button', { name: 'Minimize flight plan' }));
      rerender(
        <PlanSummaryPanel {...DEFAULT_PROPS} route={makeRoute(undefined, [], 'KBOS DCT KJFK')} />,
      );
      expect(screen.getByRole('button', { name: 'Minimize flight plan' })).toBeInTheDocument();
    });

    it('stays minimized when only the ground speed changes', () => {
      stubPhoneLayout();
      const { rerender } = renderPanel({ route: makeRoute() });
      fireEvent.click(screen.getByRole('button', { name: 'Minimize flight plan' }));
      rerender(
        <PlanSummaryPanel
          {...DEFAULT_PROPS}
          route={makeRoute({ estimatedTimeEnrouteHrs: 4.5 })}
          groundSpeedKt={450}
        />,
      );
      expect(screen.getByRole('button', { name: 'Expand flight plan' })).toBeInTheDocument();
    });

    it('never minimizes the desktop panel, which has no control to restore it', () => {
      renderPanel({ route: makeRoute() });
      fireEvent.click(screen.getByRole('button', { name: 'Minimize flight plan' }));
      expect(screen.getByRole('button', { name: 'Minimize flight plan' })).toBeInTheDocument();
      expect(screen.getByLabelText('Ground speed (kt)').closest('[inert]')).toBeNull();
    });
  });
});
