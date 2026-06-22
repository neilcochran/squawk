/**
 * Entity-type identifiers exposed by the chart-mode inspector. The string
 * literals are the URL-stable type prefix used in the `selected` search
 * param (`{type}:{id}`); changing one is a breaking URL change.
 */
export const ENTITY_TYPES = ['airport', 'navaid', 'fix', 'airway', 'airspace'] as const;

/**
 * Discriminated string-literal type for a single inspectable entity kind.
 */
export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * The parsed shape of the URL `selected` search param. The `id` is whatever
 * follows the first colon, with no further interpretation - the airspace
 * compound key `{airspaceType}/{identifier}` lives inside `id` as a single
 * string and is split by the resolver, not here.
 */
export interface EntityRef {
  /** Discriminator picking which dataset to look the entity up in. */
  type: EntityType;
  /** Entity identifier within its dataset. Type-specific - see `parseSelected` for the encoding rules. */
  id: string;
}

/**
 * Parses a raw `selected` URL value into a typed entity reference. Returns
 * `undefined` when the value is absent, missing the `:` separator, has an
 * empty id, or has a type prefix that is not a known {@link EntityType}.
 *
 * Splits on the *first* colon so airspace compound ids like
 * `airspace:CLASS_B/JFK` round-trip cleanly even if future identifiers grow
 * more colons inside the id portion.
 *
 * @param raw - Raw URL value from `chartSearchSchema.selected`, or undefined.
 * @returns Parsed reference, or undefined if the value cannot be parsed.
 */
export function parseSelected(raw: string | undefined): EntityRef | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const colonIdx = raw.indexOf(':');
  if (colonIdx <= 0) {
    return undefined;
  }
  const typeStr = raw.slice(0, colonIdx);
  const id = raw.slice(colonIdx + 1);
  if (id.length === 0) {
    return undefined;
  }
  if (!isEntityType(typeStr)) {
    return undefined;
  }
  return { type: typeStr, id };
}

/**
 * Encodes an entity reference into the `{type}:{id}` URL string form
 * consumed by `chartSearchSchema.selected`.
 *
 * @param ref - Entity reference to encode.
 * @returns The URL-stable string representation.
 */
export function encodeSelected(ref: EntityRef): string {
  return `${ref.type}:${ref.id}`;
}

/**
 * A geographic point used to disambiguate a navaid or fix selection whose
 * bare identifier is shared by more than one dataset record. Encoded into
 * the URL `selected` value as a `/c:LON,LAT` suffix on the id and resolved
 * back through the navaid / fix resolver's `byIdentAtPosition` lookup.
 */
export interface PointPosition {
  /** Latitude in decimal degrees (WGS84). */
  lat: number;
  /** Longitude in decimal degrees (WGS84). */
  lon: number;
}

/**
 * The result of decoding a navaid or fix {@link EntityRef} `id` into its
 * bare identifier and optional disambiguating position.
 */
export interface DecodedPointId {
  /** Bare navaid / fix identifier with any position suffix stripped. */
  ident: string;
  /** Decoded disambiguating position, or undefined for a bare id. */
  position: PointPosition | undefined;
}

/**
 * The sets of navaid and fix identifiers that more than one dataset record
 * shares. Consumed at selection-encode time to decide whether a navaid /
 * fix URL value needs a disambiguating position suffix: identifiers absent
 * from these sets are unique and encode as the bare `navaid:IDENT` /
 * `fix:IDENT` form, keeping the common case short.
 */
export interface AmbiguousPointIdentifiers {
  /** Navaid identifiers published on two or more records. */
  navaids: ReadonlySet<string>;
  /** Fix identifiers published on two or more records. */
  fixes: ReadonlySet<string>;
}

/**
 * Encodes the `id` portion of a navaid or fix {@link EntityRef}. Returns the
 * bare identifier when `position` is undefined; when a position is supplied
 * (the identifier is shared by multiple records) it appends a `/c:LON,LAT`
 * suffix - the same `c:` convention the airspace centroid encoding uses - so
 * the value round-trips through {@link parseSelected}'s first-colon split and
 * resolves via the navaid / fix resolver's position-aware lookup.
 *
 * @param ident - Bare navaid / fix identifier (e.g. `BOS`, `MERIT`).
 * @param position - Optional disambiguating position; omit for unique identifiers.
 * @returns The encoded id, bare or position-suffixed.
 */
export function encodePointId(ident: string, position?: PointPosition): string {
  if (position === undefined) {
    return ident;
  }
  return `${ident}/c:${position.lon.toFixed(5)},${position.lat.toFixed(5)}`;
}

/**
 * Splits a navaid or fix {@link EntityRef} `id` into its bare identifier and
 * an optional disambiguating position. Ids in the bare `IDENT` form return
 * just the identifier; ids carrying the `IDENT/c:LON,LAT` suffix return both.
 * A malformed or non-finite suffix is treated as absent so a stale share-link
 * still resolves to the first identifier match rather than failing.
 *
 * @param id - The `id` field of a parsed navaid / fix reference.
 * @returns The bare identifier and the optional decoded position.
 */
export function decodePointId(id: string): DecodedPointId {
  const markerIndex = id.indexOf('/c:');
  if (markerIndex < 0) {
    return { ident: id, position: undefined };
  }
  const ident = id.slice(0, markerIndex);
  const parts = id.slice(markerIndex + '/c:'.length).split(',');
  if (parts.length !== 2) {
    return { ident, position: undefined };
  }
  const lon = Number(parts[0]);
  const lat = Number(parts[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return { ident, position: undefined };
  }
  return { ident, position: { lat, lon } };
}

/**
 * Type-guard checking whether an arbitrary string is a known entity type
 * literal. Used by {@link parseSelected} to reject unknown type prefixes
 * before constructing a typed reference.
 */
function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}
