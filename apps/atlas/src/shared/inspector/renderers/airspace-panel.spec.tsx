import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AirspaceFeature } from '@squawk/types';
import { AirspacePanel } from './airspace-panel.tsx';

const { setHoveredFeatureIndexMock } = vi.hoisted(() => ({
  setHoveredFeatureIndexMock: vi.fn<(index: number | undefined) => void>(),
}));

vi.mock('../../../modes/chart/highlight-context.ts', () => ({
  useSetHoveredFeatureIndex: () => setHoveredFeatureIndexMock,
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
});
