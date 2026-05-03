import { useEffect } from 'react';
import type { ReactElement } from 'react';

import type { Airway } from '@squawk/types';

import { useSetHoveredAirwayWaypointIndex } from '../../../modes/chart/highlight-context.ts';
import { useCanHover } from '../../styles/use-can-hover.ts';
import {
  formatAirwayRegion,
  formatAirwayType,
  formatAirwayWaypointAltitude,
} from '../formatters.ts';

import { InspectorRow, InspectorSection } from './inspector-row.tsx';

/**
 * Props for {@link AirwayPanel}.
 */
export interface AirwayPanelProps {
  /** The airway record to render. */
  record: Airway;
}

/**
 * Per-type renderer for an `airway` entity. Shows the route classification
 * plus the ordered waypoint list. Each waypoint row carries the segment MEA
 * when the dataset has it (most enroute segments do; some oceanic routes
 * leave it null), so the user can scan the altitude profile at a glance.
 *
 * On hover-capable devices, every waypoint row wires into the highlight
 * context's `hoveredAirwayWaypointIndex` so a complementary map layer
 * can brighten the matching waypoint dot AND, when the row is not the
 * first, the incoming leg ending at that waypoint. The first row is
 * still hoverable - the user gets a "where on the map is this
 * fix/navaid/airport?" affordance for the route's starting point even
 * though it has no incoming leg.
 */
export function AirwayPanel({ record }: AirwayPanelProps): ReactElement {
  const setHoveredAirwayWaypointIndex = useSetHoveredAirwayWaypointIndex();
  const canHover = useCanHover();
  // Defensive cleanup so a hovered waypoint index does not stick when
  // the panel unmounts (selection change, inspector close). PointerLeave
  // on each row covers the common path; the unmount-without-leave case
  // would otherwise leave a phantom waypoint / leg brightened on the map.
  useEffect(
    () => (): void => {
      setHoveredAirwayWaypointIndex(undefined);
    },
    [setHoveredAirwayWaypointIndex],
  );
  return (
    <>
      <InspectorSection title="Classification">
        <InspectorRow label="Type">{formatAirwayType(record.type)}</InspectorRow>
        <InspectorRow label="Region">{formatAirwayRegion(record.region)}</InspectorRow>
        <InspectorRow label="Waypoints">{record.waypoints.length}</InspectorRow>
      </InspectorSection>
      {record.waypoints.length > 0 ? (
        <InspectorSection title="Route">
          {record.waypoints.map((waypoint, idx) => (
            <InspectorRow
              key={`${waypoint.identifier ?? waypoint.name}-${idx}`}
              label={waypoint.identifier ?? waypoint.name}
              {...(canHover && {
                onPointerEnter: (): void => setHoveredAirwayWaypointIndex(idx),
                onPointerLeave: (): void => setHoveredAirwayWaypointIndex(undefined),
              })}
            >
              {formatAirwayWaypointAltitude(waypoint)}
            </InspectorRow>
          ))}
        </InspectorSection>
      ) : null}
    </>
  );
}
