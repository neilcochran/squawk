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
}

/**
 * Body of the inspector panel below the header. For loading / not-found
 * states the body is empty (the header carries the status); for
 * resolved entities, dispatches to a per-type renderer.
 */
export function InspectorBody({ state }: InspectorBodyProps): ReactElement | null {
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
      return <FixPanel record={entity.record} />;
    case 'airway':
      return <AirwayPanel record={entity.record} />;
    case 'airspace':
      return <AirspacePanel features={entity.features} />;
  }
}
