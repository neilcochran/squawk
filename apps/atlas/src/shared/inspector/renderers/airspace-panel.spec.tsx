import { fireEvent, render, screen } from '@testing-library/react';
import type { Polygon } from 'geojson';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AirspaceFeature } from '@squawk/types';

import { AirspacePanel } from './airspace-panel.tsx';

const { setHoveredFeatureIndexMock, setHoveredExclusionKeyMock } = vi.hoisted(() => ({
  setHoveredFeatureIndexMock: vi.fn<(index: number | undefined) => void>(),
  setHoveredExclusionKeyMock: vi.fn<(key: string | undefined) => void>(),
}));

vi.mock('../../../modes/chart/highlight-context.ts', () => ({
  useSetHoveredFeatureIndex: () => setHoveredFeatureIndexMock,
  useSetHoveredAirspaceExclusionKey: () => setHoveredExclusionKeyMock,
}));

function buildFeature(overrides: Partial<AirspaceFeature> = {}): AirspaceFeature {
  return {
    type: 'CLASS_B',
    identifier: 'JFK',
    name: 'NEW YORK CLASS B',
    floor: { valueFt: 0, reference: 'SFC' },
    ceiling: { valueFt: 10000, reference: 'MSL' },
    boundary: { type: 'Polygon', coordinates: [] },
    state: 'NY',
    controllingFacility: 'NY TRACON',
    scheduleDescription: null,
    artccStratum: null,
    ...overrides,
  } as AirspaceFeature;
}

describe('AirspacePanel', () => {
  beforeEach(() => {
    setHoveredFeatureIndexMock.mockClear();
    setHoveredExclusionKeyMock.mockClear();
  });

  it('renders one merged section for a single-feature airspace', () => {
    render(<AirspacePanel features={[buildFeature()]} />);
    expect(screen.getByText('Feature 1')).toBeInTheDocument();
    expect(screen.getByText('NY TRACON')).toBeInTheDocument();
  });

  it('uses the artccStratum as the section title when set', () => {
    render(
      <AirspacePanel features={[buildFeature({ artccStratum: 'HIGH', identifier: 'ZBW' })]} />,
    );
    expect(screen.getByText('Stratum: HIGH')).toBeInTheDocument();
  });

  it('renders an Overview plus per-feature sections for multi-feature groupings', () => {
    render(
      <AirspacePanel
        features={[
          buildFeature({ identifier: 'JFK', ceiling: { valueFt: 7000, reference: 'MSL' } }),
          buildFeature({ identifier: 'JFK', ceiling: { valueFt: 10000, reference: 'MSL' } }),
        ]}
      />,
    );
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Feature 1')).toBeInTheDocument();
    expect(screen.getByText('Feature 2')).toBeInTheDocument();
  });

  it('reports the hovered feature index on per-feature pointer enter / leave', () => {
    render(
      <AirspacePanel
        features={[buildFeature({ identifier: 'JFK' }), buildFeature({ identifier: 'JFK' })]}
      />,
    );
    const second = screen.getByText('Feature 2').closest('section');
    expect(second).not.toBeNull();
    if (second === null) {
      return;
    }
    fireEvent.pointerEnter(second);
    expect(setHoveredFeatureIndexMock).toHaveBeenCalledWith(1);
    fireEvent.pointerLeave(second);
    expect(setHoveredFeatureIndexMock).toHaveBeenLastCalledWith(undefined);
  });

  it('clears the hovered feature index on unmount as a defensive cleanup', () => {
    const { unmount } = render(<AirspacePanel features={[buildFeature()]} />);
    setHoveredFeatureIndexMock.mockClear();
    unmount();
    expect(setHoveredFeatureIndexMock).toHaveBeenCalledWith(undefined);
  });

  it('renders an exclusive ceiling as below its value and the unlimited sentinel as Unlimited', () => {
    render(
      <AirspacePanel
        features={[
          buildFeature({
            type: 'MOA',
            identifier: 'MEUREKAL',
            floor: { valueFt: 5000, reference: 'MSL', inclusive: false },
            ceiling: { valueFt: 18000, reference: 'MSL', inclusive: false },
          }),
          buildFeature({
            type: 'MOA',
            identifier: 'MEUREKAL',
            floor: { valueFt: 18000, reference: 'MSL' },
            ceiling: { valueFt: 99999, reference: 'MSL' },
          }),
        ]}
      />,
    );
    expect(screen.getByText('Above 5000 ft MSL')).toBeInTheDocument();
    expect(screen.getByText('Below 18000 ft MSL')).toBeInTheDocument();
    expect(screen.getByText('18000 ft MSL')).toBeInTheDocument();
    expect(screen.getByText('Unlimited')).toBeInTheDocument();
  });

  it('lists each excluded volume with its band and reports the hovered one', () => {
    const square: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };
    render(
      <AirspacePanel
        features={[
          buildFeature({
            type: 'MOA',
            identifier: 'MBIGBEAR',
            floor: { valueFt: 500, reference: 'AGL' },
            ceiling: { valueFt: 18000, reference: 'MSL', inclusive: false },
            exclusions: [
              {
                floor: { valueFt: 0, reference: 'SFC' },
                ceiling: { valueFt: 1500, reference: 'AGL' },
                boundary: square,
              },
              {
                floor: { valueFt: 0, reference: 'SFC' },
                ceiling: { valueFt: 18000, reference: 'MSL' },
                boundary: square,
              },
            ],
          }),
        ]}
      />,
    );
    const partial = screen.getByText('Excludes 1').closest('div');
    expect(partial).toHaveTextContent('SFC to 1500 ft AGL');
    expect(partial).not.toHaveTextContent('full height');
    const full = screen.getByText('Excludes 2').closest('div');
    expect(full).toHaveTextContent('SFC to 18000 ft MSL');
    expect(full).toHaveTextContent('full height');
    if (full === null) {
      return;
    }
    fireEvent.pointerEnter(full);
    expect(setHoveredExclusionKeyMock).toHaveBeenCalledWith('0:1');
    fireEvent.pointerLeave(full);
    expect(setHoveredExclusionKeyMock).toHaveBeenLastCalledWith(undefined);
  });

  it('labels a lone excluded volume without a number', () => {
    render(
      <AirspacePanel
        features={[
          buildFeature({
            type: 'MOA',
            identifier: 'MFALLONS2',
            exclusions: [
              {
                floor: { valueFt: 0, reference: 'SFC' },
                ceiling: { valueFt: 1500, reference: 'AGL' },
                boundary: { type: 'Polygon', coordinates: [] },
              },
            ],
          }),
        ]}
      />,
    );
    expect(screen.getByText('Excludes')).toBeInTheDocument();
  });

  it('renders nothing when given an empty features array (defensive single-feature path)', () => {
    const { container } = render(<AirspacePanel features={[]} />);
    expect(container.textContent).toBe('');
  });
});
