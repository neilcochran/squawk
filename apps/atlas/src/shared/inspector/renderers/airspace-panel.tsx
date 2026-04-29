import { useEffect } from 'react';
import type { ReactElement } from 'react';
import type { AirspaceFeature } from '@squawk/types';
import { useSetHoveredFeatureIndex } from '../../../modes/chart/highlight-context.ts';
import { formatAltitudeBoundVerbose } from '../airspace-feature.ts';
import { InspectorRow, InspectorSection } from './inspector-row.tsx';

/**
 * Props for {@link AirspacePanel}.
 */
export interface AirspacePanelProps {
  /**
   * Every dataset feature whose properties match the compound airspace key
   * `{type}/{identifier}`. A single real-world airspace produces multiple
   * features (Class B has separate concentric rings; ARTCC has separate
   * strata such as LOW / HIGH / UTA). The panel renders one section per
   * feature so each ring or stratum keeps its own floor / ceiling and
   * controlling-facility metadata.
   */
  features: AirspaceFeature[];
}

/**
 * Per-type renderer for an `airspace` entity. Layout depends on grouping
 * size:
 *
 * - **Single feature**: one merged section with every detail row, since
 *   there is no overview-vs-per-feature distinction worth making for a
 *   single polygon.
 * - **Multi feature** (Class B rings, ARTCC strata, antimeridian-split
 *   oceanic boundaries): an "Overview" section at the top with the
 *   fields that are shared across every feature in the grouping (Name,
 *   State, Controlling, Schedule), followed by one per-feature section
 *   showing only the fields that genuinely vary - Floor, Ceiling, and
 *   Stratum. The split mirrors the FAA NASR data shape: a
 *   `(type, identifier)` group is one airspace whose lateral extent has
 *   been broken into multiple polygons; every polygon shares its parent
 *   metadata.
 *
 * Per-feature sections are interactive: hovering one drives the
 * airspace layer's feature-focus filter to brighten the matching
 * polygon on the map, mirroring the inspector "Feature N" / "Stratum:
 * X" badges.
 */
export function AirspacePanel({ features }: AirspacePanelProps): ReactElement {
  const setHoveredFeatureIndex = useSetHoveredFeatureIndex();
  // Defensive cleanup: when the panel unmounts (e.g. the user clicks
  // away or switches to a non-airspace selection) any in-flight hover
  // index would otherwise stick and leave a phantom polygon brightened.
  // Pointer-leave handlers cover the common path; this effect catches
  // the unmount-without-leave case.
  useEffect(
    () => (): void => {
      setHoveredFeatureIndex(undefined);
    },
    [setHoveredFeatureIndex],
  );
  if (features.length === 1) {
    const feature = features[0];
    if (feature === undefined) {
      return <></>;
    }
    return (
      <InspectorSection title={sectionTitle(feature, 0)}>
        <InspectorRow label="Floor">{formatAltitudeBoundVerbose(feature.floor)}</InspectorRow>
        <InspectorRow label="Ceiling">{formatAltitudeBoundVerbose(feature.ceiling)}</InspectorRow>
        <InspectorRow label="Name">{feature.name}</InspectorRow>
        <InspectorRow label="State">{feature.state}</InspectorRow>
        <InspectorRow label="Controlling">{feature.controllingFacility}</InspectorRow>
        <InspectorRow label="Stratum">{feature.artccStratum}</InspectorRow>
        <InspectorRow label="Schedule">{feature.scheduleDescription}</InspectorRow>
      </InspectorSection>
    );
  }
  // Multi-feature: lift shared fields into an Overview section. We
  // read them off the first feature; the FAA data model guarantees
  // these are identical across every feature in a `(type, identifier)`
  // group, so this is not a "first wins" hack - they are always the
  // same value.
  const first = features[0];
  if (first === undefined) {
    return <></>;
  }
  return (
    <>
      <InspectorSection title="Overview">
        <InspectorRow label="Name">{first.name}</InspectorRow>
        <InspectorRow label="State">{first.state}</InspectorRow>
        <InspectorRow label="Controlling">{first.controllingFacility}</InspectorRow>
        <InspectorRow label="Schedule">{first.scheduleDescription}</InspectorRow>
      </InspectorSection>
      {features.map((feature, idx) => (
        <InspectorSection
          key={featureKey(feature, idx)}
          title={sectionTitle(feature, idx)}
          onPointerEnter={(): void => setHoveredFeatureIndex(idx)}
          onPointerLeave={(): void => setHoveredFeatureIndex(undefined)}
        >
          <InspectorRow label="Floor">{formatAltitudeBoundVerbose(feature.floor)}</InspectorRow>
          <InspectorRow label="Ceiling">{formatAltitudeBoundVerbose(feature.ceiling)}</InspectorRow>
          <InspectorRow label="Stratum">{feature.artccStratum}</InspectorRow>
        </InspectorSection>
      ))}
    </>
  );
}

/**
 * Builds a stable React key for one feature's section. Combines the
 * identifier with the index since multiple features in a single grouping
 * share the identifier (the index disambiguates).
 */
function featureKey(feature: AirspaceFeature, idx: number): string {
  return `${feature.identifier}-${idx}`;
}

/**
 * Title for one feature's section. Class B has multiple rings without
 * stable per-ring labels in the source, so they fall back to "Feature N".
 * ARTCC features carry a stratum label that disambiguates cleanly.
 */
function sectionTitle(feature: AirspaceFeature, idx: number): string {
  if (feature.artccStratum !== null) {
    return `Stratum: ${feature.artccStratum}`;
  }
  return `Feature ${idx + 1}`;
}
