import { useEffect } from 'react';
import type { ReactElement } from 'react';

import type { Airway } from '@squawk/types';

import { useSetHoveredAirwayWaypointIndex } from '../../../modes/chart/highlight-context.ts';
import { useCanHover } from '../../styles/use-can-hover.ts';
import {
  formatAirwayRegion,
  formatAirwayType,
  formatAirwayWaypointAltitudes,
} from '../formatters.ts';

import { InspectorRemarks } from './inspector-remarks.tsx';
import { InspectorRow, InspectorSection } from './inspector-row.tsx';

/**
 * Props for {@link AirwayPanel}.
 */
export interface AirwayPanelProps {
  /** The airway record to render. */
  record: Airway;
}

/**
 * Per-type renderer for an `airway` entity. Shows the route classification,
 * any route-wide FAA remarks, and the ordered waypoint list. Each waypoint
 * row lists every altitude the FAA publishes for it, one labeled line each
 * (conventional, GNSS and DME/DME/IRU MEA, MOCA, MAA and MCA, with the
 * bound direction where an altitude applies one way only), so the user can
 * scan the altitude profile at a glance. A segment the FAA marks unusable
 * is flagged on its row, and the waypoint's own remarks follow its
 * altitudes.
 *
 * On hover-capable devices, every waypoint row wires into the highlight
 * context's `hoveredAirwayWaypointIndex` so a complementary map layer
 * can brighten the matching waypoint dot AND, when the row is not the
 * last, the outgoing leg to the next waypoint - the segment the row's
 * altitudes and unusable flag describe. The last row is still
 * hoverable - the user gets a "where on the map is this
 * fix/navaid/airport?" affordance for the route's end point even
 * though it has no outgoing leg.
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
      <InspectorRemarks title="Remarks" remarks={record.remarks ?? []} />
      {record.waypoints.length > 0 ? (
        <InspectorSection title="Route">
          {record.waypoints.map((waypoint, idx) => {
            const altitudes = formatAirwayWaypointAltitudes(waypoint);
            const remarks = waypoint.remarks ?? [];
            const unusable = waypoint.unusable === true;
            return (
              <InspectorRow
                key={`${waypoint.identifier ?? waypoint.name}-${idx}`}
                label={waypoint.identifier ?? waypoint.name}
                {...(canHover && {
                  onPointerEnter: (): void => setHoveredAirwayWaypointIndex(idx),
                  onPointerLeave: (): void => setHoveredAirwayWaypointIndex(undefined),
                })}
              >
                {altitudes.length === 0 && !unusable && remarks.length === 0 ? (
                  '-'
                ) : (
                  <>
                    {unusable ? (
                      <span className="block font-medium text-amber-600 dark:text-amber-500">
                        Unusable
                      </span>
                    ) : null}
                    {altitudes.map((line) => (
                      <span key={line} className="block tabular-nums">
                        {line}
                      </span>
                    ))}
                    {remarks.map((remark, remarkIdx) => (
                      <span
                        key={remarkIdx}
                        className="block text-xs text-slate-500 dark:text-slate-400"
                      >
                        {remark}
                      </span>
                    ))}
                  </>
                )}
              </InspectorRow>
            );
          })}
        </InspectorSection>
      ) : null}
    </>
  );
}
