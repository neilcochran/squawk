import { useMemo } from 'react';

import type { Airport, Airway, AirspaceFeature, Fix, Navaid } from '@squawk/types';

import { getAirportResolver, useAirportDataset } from '../data/airport-dataset.ts';
import type { AirportDatasetState } from '../data/airport-dataset.ts';
import { getAirspaceResolver, useAirspaceDataset } from '../data/airspace-dataset.ts';
import type { AirspaceDatasetState } from '../data/airspace-dataset.ts';
import { getAirwayResolver, useAirwayDataset } from '../data/airway-dataset.ts';
import type { AirwayDatasetState } from '../data/airway-dataset.ts';
import { getFixResolver, useFixDataset } from '../data/fix-dataset.ts';
import type { FixDatasetState } from '../data/fix-dataset.ts';
import { getNavaidResolver, useNavaidDataset } from '../data/navaid-dataset.ts';
import type { NavaidDatasetState } from '../data/navaid-dataset.ts';

import { compareAirspaceByAltitudeDesc } from './airspace-feature.ts';
import { decodePointId, parseSelected } from './entity.ts';
import type { AmbiguousPointIdentifiers, EntityRef } from './entity.ts';

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
 * Stable empty set reused while a dataset is loading or errored, so the
 * ambiguity hook's memoized value only changes on a real data transition.
 */
const EMPTY_IDENTIFIER_SET: ReadonlySet<string> = new Set<string>();

/**
 * Computes the set of identifiers that appear on two or more records via a
 * single linear pass: an identifier seen a second time is promoted to the
 * ambiguous set. Pure and dataset-agnostic so it is unit-testable with
 * plain string inputs; {@link useAmbiguousPointIdentifiers} feeds it the
 * navaid and fix record identifiers.
 *
 * @param identifiers - Every record identifier in a dataset, duplicates included.
 * @returns The identifiers shared by two or more records.
 */
export function computeAmbiguousIdentifiers(identifiers: Iterable<string>): Set<string> {
  const seen = new Set<string>();
  const ambiguous = new Set<string>();
  for (const identifier of identifiers) {
    if (seen.has(identifier)) {
      ambiguous.add(identifier);
    } else {
      seen.add(identifier);
    }
  }
  return ambiguous;
}

/**
 * Subscribes to the navaid and fix datasets and returns the identifiers
 * each publishes on more than one record. Memoized on the two dataset
 * states so the linear ambiguity scan runs once per load rather than per
 * render. Consumed by the selection-encode paths (map click, sibling
 * chips, disambiguation popover, feature search) to decide when a navaid /
 * fix URL value needs a `/c:LON,LAT` disambiguator; an identifier absent
 * from these sets encodes bare.
 *
 * @returns The ambiguous navaid and fix identifier sets (empty while a dataset is loading or errored).
 */
export function useAmbiguousPointIdentifiers(): AmbiguousPointIdentifiers {
  const navaid = useNavaidDataset();
  const fix = useFixDataset();
  return useMemo(
    () => ({
      navaids:
        navaid.status === 'loaded'
          ? computeAmbiguousIdentifiers(navaid.dataset.records.map((record) => record.identifier))
          : EMPTY_IDENTIFIER_SET,
      fixes:
        fix.status === 'loaded'
          ? computeAmbiguousIdentifiers(fix.dataset.records.map((record) => record.identifier))
          : EMPTY_IDENTIFIER_SET,
    }),
    [navaid, fix],
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
      const record = getAirportResolver(states.airport.dataset).byFaaId(ref.id);
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
      const { ident, position } = decodePointId(ref.id);
      const resolver = getNavaidResolver(states.navaid.dataset);
      // A position suffix means the identifier is shared by multiple
      // records; resolve to the one nearest the encoded point. A bare id
      // keeps the first-match behavior, so unchanged and stale share-links
      // resolve exactly as before.
      const record =
        position === undefined
          ? resolver.byIdent(ident)[0]
          : resolver.byIdentAtPosition(ident, position.lat, position.lon);
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
      const { ident, position } = decodePointId(ref.id);
      const resolver = getFixResolver(states.fix.dataset);
      const record =
        position === undefined
          ? resolver.byIdent(ident)[0]
          : resolver.byIdentAtPosition(ident, position.lat, position.lon);
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
      const record = getAirwayResolver(states.airway.dataset).byDesignation(ref.id)[0];
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
      const features = remainder.startsWith('c:')
        ? // Centroid encoding (`c:LON,LAT`) is the only stable URL handle
          // for airspaces with an empty `identifier` (some Class E5
          // surfaces). The resolver indexes by identifier only, so this
          // path still iterates the source dataset and matches by
          // centroid distance.
          resolveAirspaceByCentroid(states.airspace, airspaceTypeStr, remainder.slice(2))
        : resolveAirspaceByIdentifier(states.airspace, airspaceTypeStr, remainder);
      if (features === undefined) {
        return { status: 'not-found', ref };
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
 * Resolves an `(airspaceType, identifier)` URL key via the airspace
 * resolver's type-agnostic identifier lookup, then post-filters to the
 * exact `airspaceType` requested so a single identifier shared across
 * types (rare but possible) only returns the URL-pinned one.
 *
 * Returns undefined when the airspace dataset is not loaded; otherwise
 * returns the matched features (possibly empty - the caller treats
 * empty as `not-found`).
 */
function resolveAirspaceByIdentifier(
  state: AirspaceDatasetState,
  airspaceTypeStr: string,
  identifier: string,
): AirspaceFeature[] | undefined {
  if (state.status !== 'loaded') {
    return undefined;
  }
  const resolver = getAirspaceResolver(state.dataset);
  return resolver.byIdentifier(identifier).filter((feature) => feature.type === airspaceTypeStr);
}

/**
 * Resolves an `airspace:TYPE/c:LON,LAT` URL by parsing the centroid encoding
 * and delegating to the resolver's `byCentroid` query. Post-filters the
 * matches to the exact `airspaceType` requested so distinct features whose
 * centroids happen to coincide only return the URL-pinned type. Returns
 * undefined when the dataset is not loaded or the encoded coordinates
 * cannot be parsed.
 */
function resolveAirspaceByCentroid(
  state: AirspaceDatasetState,
  airspaceTypeStr: string,
  encoded: string,
): AirspaceFeature[] | undefined {
  if (state.status !== 'loaded') {
    return undefined;
  }
  const parts = encoded.split(',');
  if (parts.length !== 2) {
    return undefined;
  }
  const lon = Number(parts[0]);
  const lat = Number(parts[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return undefined;
  }
  const resolver = getAirspaceResolver(state.dataset);
  return resolver.byCentroid({ lon, lat }).filter((feature) => feature.type === airspaceTypeStr);
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
