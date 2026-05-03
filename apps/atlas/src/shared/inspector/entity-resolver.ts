import { useMemo } from 'react';

import { polygonGeoJson } from '@squawk/geo';
import type { Airport, Airway, AirspaceFeature, Fix, Navaid } from '@squawk/types';

import { useAirportDataset } from '../data/airport-dataset.ts';
import type { AirportDatasetState } from '../data/airport-dataset.ts';
import { useAirspaceDataset } from '../data/airspace-dataset.ts';
import type { AirspaceDatasetState } from '../data/airspace-dataset.ts';
import { useAirwayDataset } from '../data/airway-dataset.ts';
import type { AirwayDatasetState } from '../data/airway-dataset.ts';
import { useFixDataset } from '../data/fix-dataset.ts';
import type { FixDatasetState } from '../data/fix-dataset.ts';
import { useNavaidDataset } from '../data/navaid-dataset.ts';
import type { NavaidDatasetState } from '../data/navaid-dataset.ts';

import { compareAirspaceByAltitudeDesc, isAirspacePolygonFeature } from './airspace-feature.ts';
import type { AirspacePolygonFeature } from './airspace-feature.ts';
import { parseSelected } from './entity.ts';
import type { EntityRef } from './entity.ts';

/**
 * A successfully resolved entity. The discriminator `kind` mirrors the URL
 * `EntityType` literal so renderers can dispatch on a single field.
 *
 * Airspace is special: a single `(type, identifier)` key matches multiple
 * features (Class B has separate ring features, ARTCC has per-stratum
 * features, antimeridian-crossing oceanic boundaries are split). The
 * inspector renders all matching features as a single grouped panel.
 */
export type ResolvedEntity =
  | {
      /** Discriminator: airport entity. */
      kind: 'airport';
      /** Underlying dataset record. */
      record: Airport;
    }
  | {
      /** Discriminator: navaid entity. */
      kind: 'navaid';
      /** Underlying dataset record. */
      record: Navaid;
    }
  | {
      /** Discriminator: fix entity. */
      kind: 'fix';
      /** Underlying dataset record. */
      record: Fix;
    }
  | {
      /** Discriminator: airway entity. */
      kind: 'airway';
      /** Underlying dataset record. */
      record: Airway;
    }
  | {
      /** Discriminator: airspace grouping (one or more features sharing a `(type, identifier)` key). */
      kind: 'airspace';
      /**
       * AirspaceType literal (e.g. `CLASS_B`, `ARTCC`) shared by every
       * feature in `features`. Hoisted out of the array so renderers can
       * branch on it without inspecting feature[0].
       */
      airspaceType: AirspaceFeature['type'];
      /** Identifier shared by every feature in `features` (e.g. `JFK`, `ZNY`). */
      identifier: string;
      /** Every dataset feature whose properties match the compound key. */
      features: AirspaceFeature[];
    };

/**
 * Reactive state of the entity resolution. Discriminated by `status`:
 *
 * - `idle` - no `selected` URL value present, or it failed to parse.
 * - `loading` - the relevant dataset is still streaming.
 * - `not-found` - dataset is loaded but no record matches the id.
 * - `resolved` - the entity record was found.
 */
export type ResolvedEntityState =
  | {
      /** No selection or unparseable URL value. */
      status: 'idle';
    }
  | {
      /** The dataset that owns this entity type is still loading. */
      status: 'loading';
      /** The parsed reference being looked up. */
      ref: EntityRef;
    }
  | {
      /** Dataset is loaded but no matching entity exists. */
      status: 'not-found';
      /** The parsed reference that failed to resolve. */
      ref: EntityRef;
    }
  | {
      /** A matching entity was found in the dataset. */
      status: 'resolved';
      /** The resolved entity, ready for rendering. */
      entity: ResolvedEntity;
    };

/**
 * Combined fetch state of every chart-mode dataset, gathered in a single
 * structure so callers that need to resolve more than one entity (e.g. the
 * inspector resolving the main selection plus one resolution per "Also
 * here" sibling chip) can compute results without re-running React hooks.
 *
 * Returned by {@link useDatasetStates}; consumed by
 * {@link resolveSelectionFromState}.
 */
export interface ChartDatasetStates {
  /** Airport dataset fetch state. */
  airport: AirportDatasetState;
  /** Navaid dataset fetch state. */
  navaid: NavaidDatasetState;
  /** Fix dataset fetch state. */
  fix: FixDatasetState;
  /** Airway dataset fetch state. */
  airway: AirwayDatasetState;
  /** Airspace dataset fetch state. */
  airspace: AirspaceDatasetState;
}

/**
 * Match tolerance (in degrees lon/lat) used when looking up an airspace
 * feature by polygon centroid. The chip walk encodes centroids to 5
 * decimal places (~1m precision); 0.0001 (~11m) is generous enough to
 * absorb floating-point round-trips through URL parsing.
 */
const CENTROID_MATCH_TOLERANCE = 0.0001;

/**
 * Builds a matcher that returns true iff a candidate airspace feature
 * has the given type AND its polygon centroid is within
 * {@link CENTROID_MATCH_TOLERANCE} of the target coordinates. Returns
 * undefined when the encoded coords cannot be parsed.
 */
function buildAirspaceCentroidMatcher(
  encoded: string,
  airspaceTypeStr: string,
): ((feature: AirspacePolygonFeature) => boolean) | undefined {
  const parts = encoded.split(',');
  if (parts.length !== 2) {
    return undefined;
  }
  const targetLon = Number(parts[0]);
  const targetLat = Number(parts[1]);
  if (!Number.isFinite(targetLon) || !Number.isFinite(targetLat)) {
    return undefined;
  }
  return (feature) => {
    if (feature.properties.type !== airspaceTypeStr) {
      return false;
    }
    const centroid = polygonGeoJson.polygonCentroid(feature.geometry);
    if (centroid === undefined) {
      return false;
    }
    return (
      Math.abs(centroid[0] - targetLon) < CENTROID_MATCH_TOLERANCE &&
      Math.abs(centroid[1] - targetLat) < CENTROID_MATCH_TOLERANCE
    );
  };
}

/**
 * Builds a matcher that returns true iff a candidate airspace feature
 * has the given type and identifier. The classic compound-key path,
 * used when the URL remainder is not a centroid encoding.
 */
function buildAirspaceIdentifierMatcher(
  identifier: string,
  airspaceTypeStr: string,
): (feature: AirspacePolygonFeature) => boolean {
  return (feature) =>
    feature.properties.type === airspaceTypeStr && feature.properties.identifier === identifier;
}

/**
 * Subscribes to all five entity datasets via the existing `useXDataset()`
 * hooks and returns their combined fetch state. The hooks share their
 * fetches at module scope, so calling this hook does not trigger any new
 * network requests beyond what chart-mode already initiates.
 *
 * Pulled into its own hook so a single component can resolve multiple
 * selections (e.g. the inspector resolving the main entity plus N sibling
 * chips) by calling this once and dispatching to
 * {@link resolveSelectionFromState} per selection.
 *
 * @returns Combined dataset states, suitable for `resolveSelectionFromState`.
 */
export function useDatasetStates(): ChartDatasetStates {
  const airport = useAirportDataset();
  const navaid = useNavaidDataset();
  const fix = useFixDataset();
  const airway = useAirwayDataset();
  const airspace = useAirspaceDataset();

  return useMemo(
    () => ({ airport, navaid, fix, airway, airspace }),
    [airport, navaid, fix, airway, airspace],
  );
}

/**
 * Pure resolver: looks up a `selected` URL value against pre-fetched
 * dataset states. No React hooks; safe to call in a loop. The chip-strip
 * filtering in `inspector.tsx` calls this once per sibling so chips that
 * cannot resolve are dropped before render rather than producing a "no
 * matching record" panel on click.
 *
 * @param selected - Raw `chartSearchSchema.selected` value.
 * @param states - Output of {@link useDatasetStates}.
 * @returns Resolution state, identical in shape to {@link useResolvedEntity}'s return.
 */
export function resolveSelectionFromState(
  selected: string | undefined,
  states: ChartDatasetStates,
): ResolvedEntityState {
  const ref = parseSelected(selected);
  if (ref === undefined) {
    return { status: 'idle' };
  }

  switch (ref.type) {
    case 'airport': {
      if (states.airport.status === 'loading') {
        return { status: 'loading', ref };
      }
      if (states.airport.status === 'error') {
        return { status: 'not-found', ref };
      }
      const record = states.airport.dataset.records.find((a) => a.faaId === ref.id);
      if (record === undefined) {
        return { status: 'not-found', ref };
      }
      return { status: 'resolved', entity: { kind: 'airport', record } };
    }
    case 'navaid': {
      if (states.navaid.status === 'loading') {
        return { status: 'loading', ref };
      }
      if (states.navaid.status === 'error') {
        return { status: 'not-found', ref };
      }
      const record = states.navaid.dataset.records.find((n) => n.identifier === ref.id);
      if (record === undefined) {
        return { status: 'not-found', ref };
      }
      return { status: 'resolved', entity: { kind: 'navaid', record } };
    }
    case 'fix': {
      if (states.fix.status === 'loading') {
        return { status: 'loading', ref };
      }
      if (states.fix.status === 'error') {
        return { status: 'not-found', ref };
      }
      const record = states.fix.dataset.records.find((f) => f.identifier === ref.id);
      if (record === undefined) {
        return { status: 'not-found', ref };
      }
      return { status: 'resolved', entity: { kind: 'fix', record } };
    }
    case 'airway': {
      if (states.airway.status === 'loading') {
        return { status: 'loading', ref };
      }
      if (states.airway.status === 'error') {
        return { status: 'not-found', ref };
      }
      const record = states.airway.dataset.records.find((a) => a.designation === ref.id);
      if (record === undefined) {
        return { status: 'not-found', ref };
      }
      return { status: 'resolved', entity: { kind: 'airway', record } };
    }
    case 'airspace': {
      if (states.airspace.status === 'loading') {
        return { status: 'loading', ref };
      }
      if (states.airspace.status === 'error') {
        return { status: 'not-found', ref };
      }
      const slashIdx = ref.id.indexOf('/');
      if (slashIdx <= 0 || slashIdx === ref.id.length - 1) {
        return { status: 'not-found', ref };
      }
      const airspaceTypeStr = ref.id.slice(0, slashIdx);
      const remainder = ref.id.slice(slashIdx + 1);
      // Two encoding forms: a real `IDENTIFIER`, or `c:LON,LAT` for
      // empty-identifier airspaces whose only stable URL handle is the
      // polygon centroid (chip-build uses this in `inspector.tsx`).
      const matcher = remainder.startsWith('c:')
        ? buildAirspaceCentroidMatcher(remainder.slice(2), airspaceTypeStr)
        : buildAirspaceIdentifierMatcher(remainder, airspaceTypeStr);
      if (matcher === undefined) {
        return { status: 'not-found', ref };
      }
      const features: AirspaceFeature[] = [];
      for (const feature of states.airspace.dataset.features) {
        if (isAirspacePolygonFeature(feature) && matcher(feature)) {
          // The dataset write step puts the boundary on the GeoJSON
          // geometry, not the properties bag. Re-attach it here so the
          // resolved AirspaceFeature carries the polygon downstream
          // (the inspector reads it for bbox-overlap chip computation).
          features.push({ ...feature.properties, boundary: feature.geometry });
        }
      }
      // Sort the matched features so the highest "vertical layer" is
      // first. Without this the panel's per-feature sub-sections render
      // in dataset order, which is essentially random for stacked
      // airspaces (ARTCC LOW/HIGH, MOA altitude bands, Class B
      // concentric rings) and forces the user to scan to find the
      // section they care about.
      features.sort((a, b) =>
        compareAirspaceByAltitudeDesc(
          { ceilingFt: a.ceiling.valueFt, floorFt: a.floor.valueFt },
          { ceilingFt: b.ceiling.valueFt, floorFt: b.floor.valueFt },
        ),
      );
      const first = features[0];
      if (first === undefined) {
        return { status: 'not-found', ref };
      }
      // Use the matched feature's actual identifier (which may be empty
      // for centroid-encoded selections) so the panel can render the
      // correct label.
      return {
        status: 'resolved',
        entity: {
          kind: 'airspace',
          airspaceType: first.type,
          identifier: first.identifier,
          features,
        },
      };
    }
  }
}

/**
 * Resolves a `selected` URL value to a fully-typed entity by looking it up
 * in the appropriate dataset. Returns a discriminated state value the
 * caller can pattern-match on. Stale or malformed URL values resolve to
 * `idle` (parse failed) or `not-found` (no dataset match), never throwing.
 *
 * Thin wrapper over {@link useDatasetStates} +
 * {@link resolveSelectionFromState} so single-selection callers do not
 * need to know about the underlying split.
 *
 * @param selected - Raw value of `chartSearchSchema.selected`.
 * @returns Reactive resolution state.
 */
export function useResolvedEntity(selected: string | undefined): ResolvedEntityState {
  const states = useDatasetStates();
  return useMemo(() => resolveSelectionFromState(selected, states), [selected, states]);
}
