/**
 * Tracks codes already warned about, keyed by map name, so that each
 * unknown value produces a single warning per build rather than one per
 * record.
 */
const warnedCodes = new Map<string, Set<string>>();

/**
 * Looks up a value in a classification map and logs a one-time warning
 * if the code is absent.
 *
 * NASR code values expand over time as the FAA adds new types, statuses,
 * or use categories. A silent `undefined` return from a map lookup drops
 * every record that carries the new code. Warning on the first occurrence
 * surfaces the regression early without flooding stderr for repeat hits.
 *
 * @param map - The classification map to look up the code in.
 * @param code - The code value read from a NASR record.
 * @param mapName - Human-readable name of the map, used as a dedup key and
 *   in the warning message (e.g. `"SITE_TYPE_CODE"`).
 * @param context - Log prefix identifying the caller (e.g. `"parse-airports"`).
 * @returns The mapped value, or `undefined` if the code is unknown.
 */
export function lookupCode<T>(
  map: Record<string, T>,
  code: string,
  mapName: string,
  context: string,
): T | undefined {
  const result = map[code];
  if (result === undefined) {
    let seen = warnedCodes.get(mapName);
    if (!seen) {
      seen = new Set<string>();
      warnedCodes.set(mapName, seen);
    }
    if (!seen.has(code)) {
      seen.add(code);
      console.warn(`[${context}] Unknown ${mapName} value "${code}" - dropping matching records.`);
    }
  }
  return result;
}
