/**
 * @packageDocumentation
 * Domain-agnostic fuzzy string matching and ranked search scoring.
 *
 * Two entry points: {@link fuzzyScore} scores a query against a single
 * candidate string (returning a normalised `[0, 1]` score plus matched
 * character ranges), and {@link fuzzySearch} ranks a list of items across one or
 * more searchable fields. The package holds no domain knowledge; callers supply
 * the fields to search and any filtering predicate.
 *
 * @example
 * ```ts
 * import { fuzzyScore, fuzzySearch } from '@squawk/search';
 *
 * fuzzyScore('jfk', 'JFK'); // { score: 1, ranges: [{ start: 0, end: 3 }] }
 *
 * const matches = fuzzySearch(airports, 'kennedy', {
 *   keys: (a) => [
 *     { name: 'faaId', text: a.faaId },
 *     { name: 'name', text: a.name },
 *   ],
 *   limit: 10,
 * });
 * ```
 */

export type { FuzzyScore, MatchRange } from './score.js';
export { fuzzyScore } from './score.js';
export type { FuzzyMatch, FuzzySearchOptions, SearchField } from './search.js';
export { fuzzySearch } from './search.js';
