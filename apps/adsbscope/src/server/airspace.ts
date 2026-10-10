import { isAirspaceType } from '@squawk/types';
import type { AirspaceFeature, AirspaceType, Coordinates } from '@squawk/types';

import { SCOPE_AIRSPACE_KINDS } from '../shared/protocol.js';
import type { ScopeAirspace, ScopeAirspaceKind } from '../shared/protocol.js';

/** Looks up the airspace an aircraft at a position and altitude in feet MSL is inside. Undefined while there is no airspace data to look in. */
export type AirspaceLookup = (
  position: Coordinates,
  altitudeFt: number,
) => ScopeAirspace[] | undefined;

/** A point an {@link AirspaceSource} is asked about. */
export interface AirspacePoint extends Coordinates {
  /** Altitude in feet MSL. */
  altitudeFt: number;
}

/** The part of an airspace resolver the lookup reads. */
export interface AirspaceSource {
  /**
   * Finds every feature whose boundary, floor, and ceiling contain a point.
   *
   * @param point - The point.
   * @returns The features, in no particular order.
   */
  query(point: AirspacePoint): AirspaceFeature[];
}

/** Options for {@link createAirspaceProvider}. */
export interface AirspaceProviderOptions {
  /** Loads the airspace. Defaults to {@link loadBundledAirspace}; specs substitute a small one. */
  loadAirspace?: () => Promise<AirspaceSource>;
}

/** A source of the airspace aircraft are in, that answers nothing until its data has loaded. */
export interface AirspaceProvider {
  /** Loads the airspace. Until it resolves, and if it rejects, {@link AirspaceProvider.lookup} answers nothing. */
  load(): Promise<void>;
  /** Looks up the airspace an aircraft is in. Safe to call at any time. */
  lookup: AirspaceLookup;
}

/**
 * The kind the scope reports each feature type as. Types left out are never
 * reported: Class E, whose floors are mostly given above ground level, which
 * the scope has no terrain to place an aircraft against; and the ARTCC
 * boundaries, which every aircraft is always inside one of.
 */
const KIND_BY_TYPE: Readonly<Partial<Record<AirspaceType, ScopeAirspaceKind>>> = {
  CLASS_A: 'classA',
  CLASS_B: 'classB',
  CLASS_C: 'classC',
  CLASS_D: 'classD',
  PROHIBITED: 'prohibited',
  RESTRICTED: 'restricted',
  WARNING: 'warning',
  ALERT: 'alert',
  MOA: 'moa',
  NSA: 'nationalSecurity',
};

const CLASS_KINDS: ReadonlySet<ScopeAirspaceKind> = new Set(['classB', 'classC', 'classD']);

/**
 * Decides whether a feature is of a type the scope reports, from its `type`
 * property as the data carries it.
 *
 * @param type - The feature's `type` property, of whatever shape the data has.
 * @returns True if features of that type are reported.
 */
export function isReportedAirspaceType(type: unknown): boolean {
  return typeof type === 'string' && isAirspaceType(type) && KIND_BY_TYPE[type] !== undefined;
}

/**
 * Names a feature as the scope shows it. A Class B, C, or D is named by its
 * airport, which is what it is called. A special-use area is named as
 * charted - its designator and place - which the data carries with the state
 * after a comma: `R-4001A BRUNSWICK, ME`. Class A has no identifier and is
 * named `CLASS A` in the data, one piece per center, so every piece ends up
 * with the same name and they collapse to one entry.
 */
function nameOf(feature: AirspaceFeature, kind: ScopeAirspaceKind): string {
  if (CLASS_KINDS.has(kind) && feature.identifier !== '') {
    return feature.identifier;
  }
  const [name = ''] = feature.name.split(',');
  return name.trim();
}

/**
 * Reduces the features containing a point to the airspace the scope
 * reports: one entry per airspace, since a Class B or C is stored as nested
 * shells and an aircraft is usually inside several of them at once, in the
 * order of {@link SCOPE_AIRSPACE_KINDS} and then by name.
 *
 * @param features - The features containing the point.
 * @returns The airspace, special-use first.
 */
export function toScopeAirspace(features: readonly AirspaceFeature[]): ScopeAirspace[] {
  const byKey = new Map<string, ScopeAirspace>();
  for (const feature of features) {
    const kind = KIND_BY_TYPE[feature.type];
    if (kind === undefined) {
      continue;
    }
    const name = nameOf(feature, kind);
    byKey.set(`${kind}:${name}`, { kind, name });
  }
  return [...byKey.values()].sort(
    (a, b) =>
      SCOPE_AIRSPACE_KINDS.indexOf(a.kind) - SCOPE_AIRSPACE_KINDS.indexOf(b.kind) ||
      a.name.localeCompare(b.name),
  );
}

/**
 * Loads the bundled FAA airspace and indexes the part of it the scope
 * reports. The data package parses its snapshot as it is imported, so it is
 * imported here, on demand, rather than at the top of a module the CLI loads
 * at startup; the video map imports the same module, and the two share one
 * parse. Only the reported types are indexed: the Class E surfaces are half
 * the data, and leaving them out means they are not tested for every
 * aircraft on every snapshot.
 *
 * @returns The resolver over the reported airspace.
 */
export async function loadBundledAirspace(): Promise<AirspaceSource> {
  const [{ createAirspaceResolver }, { usBundledAirspace }] = await Promise.all([
    import('@squawk/airspace'),
    import('@squawk/airspace-data'),
  ]);
  return createAirspaceResolver({
    data: {
      ...usBundledAirspace,
      features: usBundledAirspace.features.filter((feature) =>
        isReportedAirspaceType(feature.properties?.type),
      ),
    },
  });
}

/**
 * Creates the scope's source of the airspace aircraft are in. Nothing is
 * loaded until {@link AirspaceProvider.load} is called; until then, and if
 * the load fails, lookups answer nothing, and the scope carries on without
 * the airspace.
 *
 * @param options - Injectable airspace loading.
 * @returns The provider.
 */
export function createAirspaceProvider(options: AirspaceProviderOptions = {}): AirspaceProvider {
  const loadAirspace = options.loadAirspace ?? loadBundledAirspace;
  let source: AirspaceSource | undefined;
  return {
    async load(): Promise<void> {
      source = await loadAirspace();
    },
    lookup(position: Coordinates, altitudeFt: number): ScopeAirspace[] | undefined {
      if (source === undefined) {
        return undefined;
      }
      return toScopeAirspace(source.query({ lat: position.lat, lon: position.lon, altitudeFt }));
    },
  };
}
