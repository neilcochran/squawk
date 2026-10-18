import type { ReactElement } from 'react';

import type { AirspaceFeature } from '@squawk/types';

import { useSetHoveredAirspaceExclusionKey } from '../../../modes/chart/highlight-context.ts';
import { useCanHover } from '../../styles/use-can-hover.ts';
import {
  airspaceExclusionKey,
  exclusionSpansFullHeight,
  formatAltitudeBand,
} from '../airspace-feature.ts';

import { InspectorDetailLine } from './inspector-detail-line.tsx';
import { InspectorRow } from './inspector-row.tsx';

/**
 * Props for {@link AirspaceExclusionRows}.
 */
export interface AirspaceExclusionRowsProps {
  /** The airspace feature whose excluded volumes to list. */
  feature: AirspaceFeature;
  /** The feature's position in presentation order, the N of the panel's "Feature N". */
  featureIndex: number;
}

/**
 * One inspector row per volume carved out of an airspace feature: where
 * the airspace does not apply, between the volume's floor and ceiling over
 * its footprint. Each row gives the volume's altitude band and notes when
 * it spans the feature's whole height. Most exclusions cover only part of
 * the height (typically the airspace below 1,500 ft AGL around an airport),
 * so the footprint alone does not say where the airspace stops applying.
 *
 * On hover-capable devices, hovering a row focuses that volume's outline
 * on the map through the highlight context. Renders nothing for a feature
 * without exclusions.
 */
export function AirspaceExclusionRows({
  feature,
  featureIndex,
}: AirspaceExclusionRowsProps): ReactElement | null {
  const setHoveredExclusionKey = useSetHoveredAirspaceExclusionKey();
  const canHover = useCanHover();
  const exclusions = feature.exclusions ?? [];
  if (exclusions.length === 0) {
    return null;
  }
  return (
    <>
      {exclusions.map((exclusion, exclusionIndex) => {
        const key = airspaceExclusionKey(featureIndex, exclusionIndex);
        return (
          <InspectorRow
            key={key}
            label={exclusions.length === 1 ? 'Excludes' : `Excludes ${exclusionIndex + 1}`}
            {...(canHover && {
              onPointerEnter: (): void => setHoveredExclusionKey(key),
              onPointerLeave: (): void => setHoveredExclusionKey(undefined),
            })}
          >
            <span className="block">{formatAltitudeBand(exclusion.floor, exclusion.ceiling)}</span>
            {exclusionSpansFullHeight(exclusion, feature) ? (
              <InspectorDetailLine>full height</InspectorDetailLine>
            ) : null}
          </InspectorRow>
        );
      })}
    </>
  );
}
