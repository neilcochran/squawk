import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import type { RouteDistanceResult } from '@squawk/flightplan/browser';

import type { PlanRoute, PlanRouteIssue } from './plan-route.ts';
import { PlanSummaryPanel } from './plan-summary-panel.tsx';

function makeRoute(
  distance?: Partial<RouteDistanceResult>,
  issues: PlanRouteIssue[] = [],
): PlanRoute {
  return {
    parsed: { raw: '', elements: [] },
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

describe('PlanSummaryPanel', () => {
  it('shows a hint when there is no route', () => {
    render(
      <PlanSummaryPanel
        route={undefined}
        groundSpeedKt={undefined}
        onGroundSpeedChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/enter a route/i)).toBeInTheDocument();
  });

  it('renders the total distance and the leg breakdown', () => {
    render(
      <PlanSummaryPanel
        route={makeRoute()}
        groundSpeedKt={undefined}
        onGroundSpeedChange={vi.fn()}
      />,
    );
    expect(screen.getAllByText('2,030 nm').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('KJFK -> MERIT')).toBeInTheDocument();
    expect(screen.getByText('2,000 nm')).toBeInTheDocument();
  });

  it('shows the ETE when present', () => {
    render(
      <PlanSummaryPanel
        route={makeRoute({ estimatedTimeEnrouteHrs: 1.5 })}
        groundSpeedKt={450}
        onGroundSpeedChange={vi.fn()}
      />,
    );
    expect(screen.getByText('1:30')).toBeInTheDocument();
  });

  it('lists unresolved tokens', () => {
    render(
      <PlanSummaryPanel
        route={makeRoute({ unresolvedElements: [{ type: 'unresolved', raw: 'ZZZZ' }] })}
        groundSpeedKt={undefined}
        onGroundSpeedChange={vi.fn()}
      />,
    );
    expect(screen.getByText('ZZZZ')).toBeInTheDocument();
  });

  it('reports a numeric ground speed', () => {
    const onGroundSpeedChange = vi.fn();
    render(
      <PlanSummaryPanel
        route={makeRoute()}
        groundSpeedKt={undefined}
        onGroundSpeedChange={onGroundSpeedChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Ground speed (kt)'), { target: { value: '450' } });
    expect(onGroundSpeedChange).toHaveBeenCalledWith(450);
  });

  it('reports a cleared ground speed as undefined', () => {
    const onGroundSpeedChange = vi.fn();
    render(
      <PlanSummaryPanel
        route={makeRoute()}
        groundSpeedKt={450}
        onGroundSpeedChange={onGroundSpeedChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Ground speed (kt)'), { target: { value: '' } });
    expect(onGroundSpeedChange).toHaveBeenCalledWith(undefined);
  });

  it('warns that the route is not valid as filed, naming each airway and procedure problem', () => {
    render(
      <PlanSummaryPanel
        route={makeRoute(undefined, [
          { kind: 'gap', airway: 'J60', from: 'JOT', to: 'DJB' },
          { kind: 'unusable', airway: 'J108', from: 'TCS', to: 'GINGR' },
          { kind: 'airportMismatch', procedure: 'AALLE4', procedureType: 'STAR', airport: 'KBOS' },
        ])}
        groundSpeedKt={undefined}
        onGroundSpeedChange={vi.fn()}
      />,
    );
    const warning = screen.getByRole('status');
    expect(warning).toHaveTextContent('Not valid as filed');
    expect(warning).toHaveTextContent('J60 is not defined between JOT and DJB');
    expect(warning).toHaveTextContent('J108 from TCS to GINGR is unusable');
    expect(warning).toHaveTextContent('STAR AALLE4 does not serve the arrival airport KBOS');
  });

  it('shows no filing warning for a valid route', () => {
    render(
      <PlanSummaryPanel
        route={makeRoute()}
        groundSpeedKt={undefined}
        onGroundSpeedChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Not valid as filed')).toBeNull();
  });

  it('tags the legs that cross a gap or an unusable segment', () => {
    const route = makeRoute();
    const [first, second] = route.distance.legs;
    if (first === undefined || second === undefined) {
      throw new Error('fixture has two legs');
    }
    render(
      <PlanSummaryPanel
        route={{
          ...route,
          distance: {
            ...route.distance,
            legs: [
              { ...first, crossesGap: true },
              { ...second, unusable: true },
            ],
          },
        }}
        groundSpeedKt={undefined}
        onGroundSpeedChange={vi.fn()}
      />,
    );
    expect(screen.getByText('KJFK -> MERIT').closest('li')).toHaveTextContent('gap');
    expect(screen.getByText('MERIT -> KLAX').closest('li')).toHaveTextContent('unusable');
  });

  it('tags a leg along or into a procedure filed at the wrong airport', () => {
    const route = makeRoute();
    const [first, second] = route.distance.legs;
    if (first === undefined || second === undefined) {
      throw new Error('fixture has two legs');
    }
    render(
      <PlanSummaryPanel
        route={{
          ...route,
          distance: {
            ...route.distance,
            legs: [first, { ...second, procedureAirportMismatch: true }],
          },
        }}
        groundSpeedKt={undefined}
        onGroundSpeedChange={vi.fn()}
      />,
    );
    const tag = screen.getByText('wrong airport');
    expect(tag).toHaveAttribute(
      'title',
      'This SID or STAR does not serve the airport it is filed at.',
    );
    expect(screen.getByText('MERIT -> KLAX').closest('li')).toContainElement(tag);
    expect(screen.getByText('KJFK -> MERIT').closest('li')).not.toHaveTextContent('wrong airport');
  });

  it('titles each leg label with its full text, for when it truncates', () => {
    render(
      <PlanSummaryPanel
        route={makeRoute()}
        groundSpeedKt={undefined}
        onGroundSpeedChange={vi.fn()}
      />,
    );
    expect(screen.getByText('KJFK -> MERIT')).toHaveAttribute('title', 'KJFK -> MERIT');
  });

  it('handles a route that resolved to no drawable legs', () => {
    render(
      <PlanSummaryPanel
        route={makeRoute({ legs: [], totalDistanceNm: 0 })}
        groundSpeedKt={undefined}
        onGroundSpeedChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/no drawable legs/i)).toBeInTheDocument();
  });

  it('publishes the sheet occlusion as a custom property for the map controls', () => {
    render(
      <PlanSummaryPanel
        route={undefined}
        groundSpeedKt={undefined}
        onGroundSpeedChange={vi.fn()}
      />,
    );
    // The zoom / tilt controls read this off documentElement to lift above
    // the mobile bottom sheet. jsdom has no layout, so the measured height
    // is zero.
    expect(document.documentElement.style.getPropertyValue('--atlas-inspector-occlusion')).toBe(
      '0px',
    );
  });

  it('removes the occlusion property on unmount', () => {
    const { unmount } = render(
      <PlanSummaryPanel
        route={undefined}
        groundSpeedKt={undefined}
        onGroundSpeedChange={vi.fn()}
      />,
    );
    unmount();
    expect(document.documentElement.style.getPropertyValue('--atlas-inspector-occlusion')).toBe('');
  });

  it('republishes the occlusion when the measured sheet height changes', () => {
    // jsdom has no ResizeObserver. Stub one that hands its callback back to
    // the test so a layout change can be simulated, and give the aside a
    // measurable height, since jsdom reports every element as zero-height.
    let notify: (() => void) | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe;
        disconnect = disconnect;
        constructor(callback: () => void) {
          notify = callback;
        }
      },
    );
    try {
      const { unmount } = render(
        <PlanSummaryPanel
          route={undefined}
          groundSpeedKt={undefined}
          onGroundSpeedChange={vi.fn()}
        />,
      );
      const aside = screen.getByRole('complementary', { name: 'Flight plan summary' });
      expect(observe).toHaveBeenCalledWith(aside);

      Object.defineProperty(aside, 'offsetHeight', { configurable: true, value: 320 });
      act(() => notify?.());
      expect(document.documentElement.style.getPropertyValue('--atlas-inspector-occlusion')).toBe(
        '320px',
      );

      unmount();
      expect(disconnect).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
