import type { ReactElement } from 'react';
import type { AirspaceFeature, AltitudeBound } from '@squawk/types';
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
 * Per-type renderer for an `airspace` entity. Each section corresponds to
 * one underlying feature - a Class B ring, an ARTCC stratum, or a single
 * SUA polygon - so the user can read floor / ceiling / state separately
 * for each piece of the grouping. The grouping label (type + identifier)
 * is rendered in the inspector header above; this body shows the per-feature
 * detail.
 */
export function AirspacePanel({ features }: AirspacePanelProps): ReactElement {
  return (
    <>
      {features.map((feature, idx) => (
        <InspectorSection key={featureKey(feature, idx)} title={sectionTitle(feature, idx)}>
          <InspectorRow label="Floor">{formatAltitudeBound(feature.floor)}</InspectorRow>
          <InspectorRow label="Ceiling">{formatAltitudeBound(feature.ceiling)}</InspectorRow>
          <InspectorRow label="Name">{feature.name}</InspectorRow>
          <InspectorRow label="State">{feature.state}</InspectorRow>
          <InspectorRow label="Controlling">{feature.controllingFacility}</InspectorRow>
          <InspectorRow label="Stratum">{feature.artccStratum}</InspectorRow>
          <InspectorRow label="Schedule">{feature.scheduleDescription}</InspectorRow>
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

/**
 * Formats an `AltitudeBound` for display. The reference datum matters for
 * pilots reading the panel: an SFC floor and a 700 ft AGL floor are very
 * different things. SFC features show as "SFC" alone; AGL / MSL show their
 * value plus the reference suffix.
 */
function formatAltitudeBound(bound: AltitudeBound): string {
  if (bound.reference === 'SFC') {
    return 'SFC';
  }
  return `${bound.valueFt} ft ${bound.reference}`;
}
