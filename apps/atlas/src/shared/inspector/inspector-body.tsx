import type { ReactElement } from 'react';

import type { ResolvedEntityState } from './entity-resolver.ts';
import { AirportPanel } from './renderers/airport-panel.tsx';
import { AirspacePanel } from './renderers/airspace-panel.tsx';
import { AirwayPanel } from './renderers/airway-panel.tsx';
import { FixPanel } from './renderers/fix-panel.tsx';
import { NavaidPanel } from './renderers/navaid-panel.tsx';

/**
 * Props for {@link InspectorBody}.
 */
export interface InspectorBodyProps {
  /** Resolution state - the body renders only when status is `resolved`. */
  state: ResolvedEntityState;
  /**
   * Selects another entity by its `selected` value, panning to it first.
   * Handed to renderers whose rows link to other entities (the fix
   * panel's navaid associations).
   */
  onSelectEntity: (selection: string) => void;
}

/**
 * Body of the inspector panel below the header. For loading / not-found
 * states the body is empty (the header carries the status); for
 * resolved entities, dispatches to a per-type renderer.
 */
export function InspectorBody({ state, onSelectEntity }: InspectorBodyProps): ReactElement | null {
  if (state.status !== 'resolved') {
    return null;
  }
  const entity = state.entity;
  switch (entity.kind) {
    case 'airport':
      return <AirportPanel record={entity.record} />;
    case 'navaid':
      return <NavaidPanel record={entity.record} />;
    case 'fix':
      return <FixPanel record={entity.record} onSelectEntity={onSelectEntity} />;
    case 'airway':
      return <AirwayPanel record={entity.record} />;
    case 'airspace':
      return <AirspacePanel features={entity.features} />;
  }
}
