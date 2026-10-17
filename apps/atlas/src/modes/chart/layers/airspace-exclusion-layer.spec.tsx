import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AirspaceFeature } from '@squawk/types';

import type { ResolvedEntityState } from '../../../shared/inspector/entity-resolver.ts';
import type { EntityRef } from '../../../shared/inspector/entity.ts';

import {
  AIRSPACE_EXCLUSION_FOCUS_LAYER_ID,
  AIRSPACE_EXCLUSION_KEY_PROPERTY,
} from './airspace-exclusion-features.ts';
import { AirspaceExclusionLayer } from './airspace-exclusion-layer.tsx';

const {
  useActiveHighlightRefMock,
  useHoveredAirspaceExclusionKeyMock,
  useResolvedEntityMock,
  layerPropsLog,
} = vi.hoisted(() => ({
  useActiveHighlightRefMock: vi.fn<() => EntityRef | undefined>(),
  useHoveredAirspaceExclusionKeyMock: vi.fn<() => string | undefined>(),
  useResolvedEntityMock: vi.fn<(selected: string | undefined) => ResolvedEntityState>(),
  layerPropsLog: [] as Array<Record<string, unknown>>,
}));

vi.mock('../highlight-context.ts', () => ({
  useActiveHighlightRef: useActiveHighlightRefMock,
  useHoveredAirspaceExclusionKey: useHoveredAirspaceExclusionKeyMock,
}));

vi.mock('../../../shared/inspector/entity-resolver.ts', () => ({
  useResolvedEntity: useResolvedEntityMock,
}));

vi.mock('@vis.gl/react-maplibre', () => ({
  Source: ({ children }: { children?: ReactNode }): ReactElement => (
    <div data-testid="maplibre-source">{children}</div>
  ),
  Layer: (props: Record<string, unknown>): null => {
    layerPropsLog.push(props);
    return null;
  },
}));

const MOA: AirspaceFeature = {
  type: 'MOA',
  name: 'BIG BEAR MOA',
  identifier: 'MBIGBEAR',
  floor: { valueFt: 500, reference: 'AGL' },
  ceiling: { valueFt: 18000, reference: 'MSL' },
  boundary: { type: 'Polygon', coordinates: [] },
  state: 'MI',
  controllingFacility: null,
  scheduleDescription: null,
  artccStratum: null,
  exclusions: [
    {
      floor: { valueFt: 0, reference: 'SFC' },
      ceiling: { valueFt: 1500, reference: 'AGL' },
      boundary: { type: 'Polygon', coordinates: [] },
    },
  ],
};

function resolvedAirspace(features: AirspaceFeature[]): ResolvedEntityState {
  return {
    status: 'resolved',
    entity: { kind: 'airspace', airspaceType: 'MOA', identifier: 'MBIGBEAR', features },
  };
}

describe('AirspaceExclusionLayer', () => {
  beforeEach(() => {
    layerPropsLog.length = 0;
    useHoveredAirspaceExclusionKeyMock.mockReturnValue(undefined);
    useActiveHighlightRefMock.mockReturnValue({ type: 'airspace', id: 'MOA/MBIGBEAR' });
    useResolvedEntityMock.mockReturnValue(resolvedAirspace([MOA]));
  });

  it('draws the highlighted airspace exclusions as wash, outline and focus layers', () => {
    const { getByTestId } = render(<AirspaceExclusionLayer />);
    expect(getByTestId('maplibre-source')).toBeInTheDocument();
    expect(useResolvedEntityMock).toHaveBeenCalledWith('airspace:MOA/MBIGBEAR');
    expect(layerPropsLog).toHaveLength(3);
  });

  it('focuses the excluded volume whose inspector row is hovered', () => {
    useHoveredAirspaceExclusionKeyMock.mockReturnValue('0:0');
    render(<AirspaceExclusionLayer />);
    const focus = layerPropsLog.find((props) => props.id === AIRSPACE_EXCLUSION_FOCUS_LAYER_ID);
    expect(focus?.filter).toEqual(['==', ['get', AIRSPACE_EXCLUSION_KEY_PROPERTY], '0:0']);
  });

  it('draws nothing when the highlighted airspace has no exclusions', () => {
    useResolvedEntityMock.mockReturnValue(resolvedAirspace([{ ...MOA, exclusions: [] }]));
    const { container } = render(<AirspaceExclusionLayer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('draws nothing when the highlight is not an airspace', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'airport', id: 'BOS' });
    useResolvedEntityMock.mockReturnValue({ status: 'idle' });
    const { container } = render(<AirspaceExclusionLayer />);
    expect(container).toBeEmptyDOMElement();
    expect(useResolvedEntityMock).toHaveBeenCalledWith(undefined);
  });
});
