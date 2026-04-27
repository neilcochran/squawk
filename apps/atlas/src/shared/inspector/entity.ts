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
 * Type-guard checking whether an arbitrary string is a known entity type
 * literal. Used by {@link parseSelected} to reject unknown type prefixes
 * before constructing a typed reference.
 */
function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}
