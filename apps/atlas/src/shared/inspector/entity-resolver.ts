import { useMemo } from 'react';
import type { Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson';
import type { Airport, Airway, AirspaceFeature, Fix, Navaid } from '@squawk/types';
import { useAirportDataset } from '../data/airport-dataset.ts';
import { useAirspaceDataset } from '../data/airspace-dataset.ts';
import { useAirwayDataset } from '../data/airway-dataset.ts';
import { useFixDataset } from '../data/fix-dataset.ts';
import { useNavaidDataset } from '../data/navaid-dataset.ts';
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
 * Type-narrows a generic GeoJSON feature to the airspace-feature shape the
 * `@squawk/airspace-data` bundle ships. Checks the geometry kind and the
 * presence of the discriminating property fields, so subsequent reads of
 * `feature.properties.type` / `feature.properties.identifier` are typed
 * directly without `as` assertions.
 */
function isAirspacePolygonFeature(
  feature: Feature<Geometry, GeoJsonProperties>,
): feature is Feature<Polygon, AirspaceFeature> {
  if (feature.geometry.type !== 'Polygon') {
    return false;
  }
  const props = feature.properties;
  if (props === null) {
    return false;
  }
  return 'type' in props && 'identifier' in props && 'floor' in props && 'ceiling' in props;
}

/**
 * Resolves a `selected` URL value to a fully-typed entity by looking it up
 * in the appropriate dataset. Subscribes to all five entity datasets via
 * the existing `useXDataset()` hooks; the hooks share their fetches at
 * module scope, so this hook does not trigger any new network requests
 * beyond what chart-mode already initiates.
 *
 * Returns a discriminated state value the caller can pattern-match on.
 * Stale or malformed URL values resolve to `idle` (parse failed) or
 * `not-found` (no dataset match), never throwing.
 *
 * @param selected - Raw value of `chartSearchSchema.selected`.
 * @returns Reactive resolution state.
 */
export function useResolvedEntity(selected: string | undefined): ResolvedEntityState {
  const airportState = useAirportDataset();
  const navaidState = useNavaidDataset();
  const fixState = useFixDataset();
  const airwayState = useAirwayDataset();
  const airspaceState = useAirspaceDataset();

  return useMemo<ResolvedEntityState>(() => {
    const ref = parseSelected(selected);
    if (ref === undefined) {
      return { status: 'idle' };
    }

    switch (ref.type) {
      case 'airport': {
        if (airportState.status === 'loading') {
          return { status: 'loading', ref };
        }
        if (airportState.status === 'error') {
          return { status: 'not-found', ref };
        }
        const record = airportState.dataset.records.find((a) => a.faaId === ref.id);
        if (record === undefined) {
          return { status: 'not-found', ref };
        }
        return { status: 'resolved', entity: { kind: 'airport', record } };
      }
      case 'navaid': {
        if (navaidState.status === 'loading') {
          return { status: 'loading', ref };
        }
        if (navaidState.status === 'error') {
          return { status: 'not-found', ref };
        }
        const record = navaidState.dataset.records.find((n) => n.identifier === ref.id);
        if (record === undefined) {
          return { status: 'not-found', ref };
        }
        return { status: 'resolved', entity: { kind: 'navaid', record } };
      }
      case 'fix': {
        if (fixState.status === 'loading') {
          return { status: 'loading', ref };
        }
        if (fixState.status === 'error') {
          return { status: 'not-found', ref };
        }
        const record = fixState.dataset.records.find((f) => f.identifier === ref.id);
        if (record === undefined) {
          return { status: 'not-found', ref };
        }
        return { status: 'resolved', entity: { kind: 'fix', record } };
      }
      case 'airway': {
        if (airwayState.status === 'loading') {
          return { status: 'loading', ref };
        }
        if (airwayState.status === 'error') {
          return { status: 'not-found', ref };
        }
        const record = airwayState.dataset.records.find((a) => a.designation === ref.id);
        if (record === undefined) {
          return { status: 'not-found', ref };
        }
        return { status: 'resolved', entity: { kind: 'airway', record } };
      }
      case 'airspace': {
        if (airspaceState.status === 'loading') {
          return { status: 'loading', ref };
        }
        if (airspaceState.status === 'error') {
          return { status: 'not-found', ref };
        }
        const slashIdx = ref.id.indexOf('/');
        if (slashIdx <= 0 || slashIdx === ref.id.length - 1) {
          return { status: 'not-found', ref };
        }
        const airspaceTypeStr = ref.id.slice(0, slashIdx);
        const identifier = ref.id.slice(slashIdx + 1);
        const features: AirspaceFeature[] = [];
        for (const feature of airspaceState.dataset.features) {
          if (
            isAirspacePolygonFeature(feature) &&
            feature.properties.type === airspaceTypeStr &&
            feature.properties.identifier === identifier
          ) {
            features.push(feature.properties);
          }
        }
        const first = features[0];
        if (first === undefined) {
          return { status: 'not-found', ref };
        }
        return {
          status: 'resolved',
          entity: {
            kind: 'airspace',
            airspaceType: first.type,
            identifier,
            features,
          },
        };
      }
    }
  }, [selected, airportState, navaidState, fixState, airwayState, airspaceState]);
}
