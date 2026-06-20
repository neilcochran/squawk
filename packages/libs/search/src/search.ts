/**
 * Multi-item, multi-field ranked search built on top of the single-candidate
 * {@link fuzzyScore} scorer. Given a list of arbitrary items and a query, it
 * scores each item across its searchable fields, keeps the best-matching field,
 * filters, ranks by descending score, and returns the top results.
 */

import type { FuzzyScore, MatchRange } from './score.js';
import { fuzzyScore } from './score.js';

/** Default maximum number of results returned by {@link fuzzySearch}. */
const DEFAULT_LIMIT = 20;

/**
 * One searchable field extracted from an item: a label identifying the field
 * and the text to match against.
 *
 * @typeParam F - The field-name type. Defaults to `string`, but callers that
 *   pass a string-literal union get that union narrowed through to
 *   {@link FuzzyMatch.field}.
 */
export interface SearchField<F extends string = string> {
  /**
   * Stable identifier for the field (for example `'name'` or `'identifier'`).
   * Reported back as {@link FuzzyMatch.field} so callers know which field
   * produced the match.
   */
  name: F;
  /** The field's text value to score the query against. */
  text: string;
}

/**
 * Options controlling a {@link fuzzySearch} run.
 *
 * @typeParam T - The item type being searched.
 * @typeParam F - The field-name type, inferred from the fields returned by
 *   {@link FuzzySearchOptions.keys}.
 */
export interface FuzzySearchOptions<T, F extends string = string> {
  /**
   * Extracts the searchable fields from an item. Every returned field is
   * scored; the highest-scoring one determines the item's rank.
   *
   * @param item - The item to extract fields from.
   * @returns The fields to score for this item.
   */
  keys: (item: T) => readonly SearchField<F>[];
  /**
   * Optional predicate applied before scoring. Items for which it returns
   * `false` are excluded entirely, letting callers honour visibility or type
   * filters without the engine knowing anything about the domain.
   *
   * @param item - The item to test.
   * @returns `true` to keep the item, `false` to drop it.
   */
  filter?: (item: T) => boolean;
  /**
   * Maximum number of results to return. Defaults to `20`.
   */
  limit?: number;
  /**
   * Minimum score (exclusive) an item must reach to be included. Defaults to
   * `0`, which keeps every item that matches at all and drops only true
   * non-matches. Raise it to suppress weak (subsequence or typo) matches.
   */
  minScore?: number;
}

/**
 * A single ranked search result.
 *
 * @typeParam T - The item type being searched.
 * @typeParam F - The field-name type, inferred from the search fields.
 */
export interface FuzzyMatch<T, F extends string = string> {
  /** The matched item. */
  item: T;
  /** The item's match score in `[0, 1]`; see {@link FuzzyScore.score}. */
  score: number;
  /** The {@link SearchField.name} of the field that produced the best score. */
  field: F;
  /**
   * The matched character ranges within the best-matching field's text, ordered
   * by start offset. Ready for highlight rendering.
   */
  ranges: MatchRange[];
}

/**
 * Ranks `items` against `query` using fuzzy matching across each item's
 * searchable fields.
 *
 * Each item is scored by taking the best {@link fuzzyScore} across the fields
 * returned by {@link FuzzySearchOptions.keys}. Results are sorted by descending
 * score; items that tie keep their original input order. A blank query returns
 * an empty array.
 *
 * @typeParam T - The item type being searched.
 * @typeParam F - The field-name type, inferred from the search fields.
 * @param items - The items to search.
 * @param query - The user-entered search text.
 * @param options - Field extraction and result-shaping options.
 * @returns The ranked matches, best first, capped at {@link FuzzySearchOptions.limit}.
 */
export function fuzzySearch<T, F extends string = string>(
  items: readonly T[],
  query: string,
  options: FuzzySearchOptions<T, F>,
): FuzzyMatch<T, F>[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const { keys, filter } = options;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const minScore = options.minScore ?? 0;

  const matches: FuzzyMatch<T, F>[] = [];
  for (const item of items) {
    if (filter !== undefined && !filter(item)) {
      continue;
    }

    let bestScore = 0;
    let bestField: SearchField<F> | undefined;
    let bestResult: FuzzyScore | undefined;
    for (const field of keys(item)) {
      const result = fuzzyScore(trimmed, field.text);
      if (result.score > bestScore) {
        bestScore = result.score;
        bestField = field;
        bestResult = result;
      }
    }

    if (bestField === undefined || bestResult === undefined || bestScore <= minScore) {
      continue;
    }
    matches.push({
      item,
      score: bestScore,
      field: bestField.name,
      ranges: bestResult.ranges,
    });
  }

  // Array.prototype.sort is stable, so equal-scoring items keep input order.
  matches.sort((a, b) => b.score - a.score);
  return matches.length > limit ? matches.slice(0, limit) : matches;
}
