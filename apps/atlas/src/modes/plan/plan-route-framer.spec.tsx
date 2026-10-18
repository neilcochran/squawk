import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlanRouteFramer } from './plan-route-framer.tsx';
import type { PlanFrameRequest, PlanRouteFramerProps } from './plan-route-framer.tsx';
import { ROUTE_FRAME_BASE_PADDING_PX } from './plan-route-framing.ts';
import type { PlanRoute } from './plan-route.ts';

const { useMapMock, fitBoundsMock } = vi.hoisted(() => ({
  useMapMock: vi.fn(),
  fitBoundsMock: vi.fn(),
}));

vi.mock('@vis.gl/react-maplibre', () => ({ useMap: useMapMock }));

function makeRoute(raw: string, points: PlanRoute['points']): PlanRoute {
  return {
    parsed: { raw, elements: [] },
    points,
    distance: {
      legs: [],
      totalDistanceNm: 0,
      estimatedTimeEnrouteHrs: undefined,
      unresolvedElements: [],
    },
    issues: [],
  };
}

const ROUTE = makeRoute('KBOS DCT KJFK', [
  { label: 'KBOS', lat: 42.36, lon: -71.01 },
  { label: 'KJFK', lat: 40.64, lon: -73.78 },
]);

/** A route input bar whose bottom edge sits `bottomPx` from the top of the viewport. */
function inputRefAt(bottomPx: number): { current: HTMLElement } {
  const element = document.createElement('form');
  element.getBoundingClientRect = (): DOMRect => DOMRect.fromRect({ x: 0, y: 0, height: bottomPx });
  return { current: element };
}

/** A summary panel whose layout height is `heightPx`. */
function sheetRefOf(heightPx: number): { current: HTMLElement } {
  const element = document.createElement('aside');
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value: heightPx });
  return { current: element };
}

const INPUT_REF = inputRefAt(104);
const SHEET_REF = sheetRefOf(280);

function framer(props: Partial<PlanRouteFramerProps> = {}): ReactElement {
  return (
    <PlanRouteFramer
      route={ROUTE}
      request={{ route: 'KBOS DCT KJFK' }}
      routeInputRef={INPUT_REF}
      sheetRef={SHEET_REF}
      {...props}
    />
  );
}

function renderFramer(props: Partial<PlanRouteFramerProps> = {}): RenderResult {
  return render(framer(props));
}

function lastFitOptions(): {
  padding: { top: number; right: number; bottom: number; left: number };
  maxZoom: number;
} {
  return fitBoundsMock.mock.lastCall?.[1];
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

describe('PlanRouteFramer', () => {
  beforeEach(() => {
    fitBoundsMock.mockReset();
    const container = document.createElement('div');
    container.getBoundingClientRect = (): DOMRect => DOMRect.fromRect({ x: 0, y: 48 });
    useMapMock.mockReturnValue({
      current: { getMap: () => ({ fitBounds: fitBoundsMock, getContainer: () => container }) },
    });
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--atlas-side-panel-width');
    vi.unstubAllGlobals();
  });

  it('frames the route once the resolved route matches the request', () => {
    renderFramer();
    expect(fitBoundsMock).toHaveBeenCalledTimes(1);
    expect(fitBoundsMock.mock.lastCall?.[0]).toEqual([
      [-73.78, 40.64],
      [-71.01, 42.36],
    ]);
    expect(lastFitOptions().maxZoom).toBe(11);
  });

  it('keeps the route below the input bar, measured from the top of the map', () => {
    renderFramer();
    expect(lastFitOptions().padding.top).toBe(104 - 48 + ROUTE_FRAME_BASE_PADDING_PX);
  });

  it('clears the side panel at its published width on the desktop layout', () => {
    document.documentElement.style.setProperty('--atlas-side-panel-width', '420px');
    renderFramer();
    expect(lastFitOptions().padding.right).toBe(420 + ROUTE_FRAME_BASE_PADDING_PX);
    expect(lastFitOptions().padding.bottom).toBe(ROUTE_FRAME_BASE_PADDING_PX);
  });

  it('keeps the route above the sheet at its laid-out height on a phone', () => {
    stubPhoneLayout();
    renderFramer();
    expect(lastFitOptions().padding.bottom).toBe(280 + ROUTE_FRAME_BASE_PADDING_PX);
    expect(lastFitOptions().padding.right).toBe(ROUTE_FRAME_BASE_PADDING_PX);
  });

  it('pads only the base margin below on a phone before the sheet mounts', () => {
    stubPhoneLayout();
    renderFramer({ sheetRef: { current: null } });
    expect(lastFitOptions().padding.bottom).toBe(ROUTE_FRAME_BASE_PADDING_PX);
  });

  it('waits while the resolved route is still the previous one', () => {
    const request = { route: 'KLAX DCT KSFO' };
    const { rerender } = renderFramer({ request });
    expect(fitBoundsMock).not.toHaveBeenCalled();
    rerender(
      framer({
        request,
        route: makeRoute('KLAX DCT KSFO', [
          { label: 'KLAX', lat: 33.94, lon: -118.41 },
          { label: 'KSFO', lat: 37.62, lon: -122.38 },
        ]),
      }),
    );
    expect(fitBoundsMock).toHaveBeenCalledTimes(1);
  });

  it('waits while the data loads', () => {
    const request = { route: 'KBOS DCT KJFK' };
    const { rerender } = renderFramer({ request, route: undefined });
    expect(fitBoundsMock).not.toHaveBeenCalled();
    rerender(framer({ request }));
    expect(fitBoundsMock).toHaveBeenCalledTimes(1);
  });

  it('frames a request only once, so a recomputed route does not re-frame', () => {
    const request = { route: 'KBOS DCT KJFK' };
    const { rerender } = renderFramer({ request });
    rerender(framer({ request, route: { ...ROUTE } }));
    expect(fitBoundsMock).toHaveBeenCalledTimes(1);
  });

  it('frames the same route again for a fresh request', () => {
    const { rerender } = renderFramer();
    const again: PlanFrameRequest = { route: 'KBOS DCT KJFK' };
    rerender(framer({ request: again }));
    expect(fitBoundsMock).toHaveBeenCalledTimes(2);
  });

  it('does nothing without a request', () => {
    renderFramer({ request: undefined });
    expect(fitBoundsMock).not.toHaveBeenCalled();
  });

  it('does nothing for a route that resolved to no points', () => {
    renderFramer({ route: makeRoute('ZZZZ', []), request: { route: 'ZZZZ' } });
    expect(fitBoundsMock).not.toHaveBeenCalled();
  });

  it('does nothing before a map is available', () => {
    useMapMock.mockReturnValue({});
    renderFramer();
    expect(fitBoundsMock).not.toHaveBeenCalled();
  });

  it('pads only the base margin on top before the input bar mounts', () => {
    renderFramer({ routeInputRef: { current: null } });
    expect(lastFitOptions().padding.top).toBe(ROUTE_FRAME_BASE_PADDING_PX);
  });
});
