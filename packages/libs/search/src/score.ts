/**
 * Single-candidate fuzzy scoring. Compares a query string against one candidate
 * string and produces a normalised match score in `[0, 1]` together with the
 * matched character ranges, suitable for ranking and highlight rendering.
 *
 * The scorer is tiered: an exact match scores 1, a prefix match scores just
 * below that, and progressively looser matches (word-boundary prefix,
 * substring, subsequence, and bounded typo) occupy lower, non-overlapping or
 * adjacent bands so that scores remain comparable across different fields and
 * data sets.
 */

/**
 * A contiguous run of matched characters within a candidate string, expressed
 * as a half-open interval `[start, end)` of UTF-16 code-unit offsets into the
 * original (un-lowercased) candidate.
 */
export interface MatchRange {
  /** Offset of the first matched character (inclusive). */
  start: number;
  /** Offset just past the last matched character (exclusive). */
  end: number;
}

/**
 * The result of scoring a query against a single candidate.
 */
export interface FuzzyScore {
  /**
   * Normalised match strength in `[0, 1]`: `1` is an exact (case-insensitive)
   * match and `0` means no match. Intermediate values are tiered so that a
   * prefix match always outranks a substring match, which outranks a
   * subsequence or typo match.
   */
  score: number;
  /**
   * The matched character ranges within the original candidate, ordered by
   * `start`. Empty when {@link FuzzyScore.score} is `0`.
   */
  ranges: MatchRange[];
}

/** Lower bound of the prefix-match band. */
const PREFIX_BASE = 0.9;
/** Lower bound of the word-boundary-prefix band. */
const WORD_PREFIX_BASE = 0.8;
/** Lower bound of the substring band. */
const SUBSTRING_BASE = 0.65;
/** Lower bound of the subsequence band. */
const SUBSEQUENCE_BASE = 0.4;
/** Lower bound of the bounded-typo band. */
const TYPO_BASE = 0.3;

/** A non-match result, reused to avoid allocation. */
const NO_MATCH: FuzzyScore = { score: 0, ranges: [] };

/**
 * Scores how well `query` matches `candidate`, case-insensitively.
 *
 * The returned {@link FuzzyScore.ranges} index into the original `candidate`
 * string (not the lowercased form), so they can be applied directly to
 * highlight the source text. A blank query, a blank candidate, or no match at
 * all yields a score of `0` and no ranges.
 *
 * @param query - The user-entered search text. Leading and trailing whitespace
 *   is ignored.
 * @param candidate - The string to score the query against.
 * @returns The match score and the matched ranges.
 */
export function fuzzyScore(query: string, candidate: string): FuzzyScore {
  const q = query.trim().toLowerCase();
  const lc = candidate.toLowerCase();
  if (q.length === 0 || lc.length === 0) {
    return NO_MATCH;
  }

  // Exact match.
  if (lc === q) {
    return { score: 1, ranges: [{ start: 0, end: candidate.length }] };
  }

  const coverage = q.length / lc.length;

  // Prefix match (candidate starts with the query).
  if (lc.startsWith(q)) {
    return {
      score: PREFIX_BASE + 0.09 * coverage,
      ranges: [{ start: 0, end: q.length }],
    };
  }

  // Substring match. Prefer an occurrence that begins at a word boundary
  // (scores in the word-prefix band) over a mid-word occurrence.
  let firstIdx = -1;
  let boundaryIdx = -1;
  for (let i = lc.indexOf(q); i !== -1; i = lc.indexOf(q, i + 1)) {
    if (firstIdx === -1) {
      firstIdx = i;
    }
    if (!isWordChar(lc.charCodeAt(i - 1))) {
      boundaryIdx = i;
      break;
    }
  }
  if (boundaryIdx !== -1) {
    return {
      score: WORD_PREFIX_BASE + 0.09 * coverage,
      ranges: [{ start: boundaryIdx, end: boundaryIdx + q.length }],
    };
  }
  if (firstIdx !== -1) {
    return {
      score: SUBSTRING_BASE + 0.1 * coverage,
      ranges: [{ start: firstIdx, end: firstIdx + q.length }],
    };
  }

  // Subsequence match (all query characters appear in order, with gaps).
  const subsequence = scoreSubsequence(q, lc);
  if (subsequence !== undefined) {
    return subsequence;
  }

  // Bounded typo match (a small number of edits away from a word or the whole
  // candidate).
  return scoreTypo(q, lc);
}

/**
 * Scores `q` as an in-order subsequence of `lc`. Returns `undefined` when not
 * every query character can be matched in order.
 */
function scoreSubsequence(q: string, lc: string): FuzzyScore | undefined {
  const matched: number[] = [];
  let qi = 0;
  for (let ci = 0; ci < lc.length && qi < q.length; ci++) {
    if (lc.charCodeAt(ci) === q.charCodeAt(qi)) {
      matched.push(ci);
      qi++;
    }
  }
  if (qi < q.length) {
    return undefined;
  }
  const first = matched[0]!;
  const last = matched[matched.length - 1]!;
  const compactness = q.length / (last - first + 1);
  return {
    score: SUBSEQUENCE_BASE + 0.15 * compactness,
    ranges: mergeIndices(matched),
  };
}

/**
 * Scores `q` against `lc` using a bounded edit distance, comparing the query to
 * the whole candidate and to each whitespace/punctuation-delimited word, and
 * keeping the closest segment. Returns {@link NO_MATCH} when nothing is within
 * the allowed number of edits.
 */
function scoreTypo(q: string, lc: string): FuzzyScore {
  const maxDist = maxTypos(q.length);
  if (maxDist === 0) {
    return NO_MATCH;
  }

  let bestDist = maxDist + 1;
  let bestStart = 0;
  let bestLen = lc.length;

  const whole = osaDistance(q, lc, maxDist);
  if (whole < bestDist) {
    bestDist = whole;
    bestStart = 0;
    bestLen = lc.length;
  }

  let wordStart = -1;
  for (let i = 0; i <= lc.length; i++) {
    const inWord = i < lc.length && isWordChar(lc.charCodeAt(i));
    if (inWord && wordStart === -1) {
      wordStart = i;
    } else if (!inWord && wordStart !== -1) {
      const word = lc.slice(wordStart, i);
      const dist = osaDistance(q, word, maxDist);
      if (dist < bestDist) {
        bestDist = dist;
        bestStart = wordStart;
        bestLen = word.length;
      }
      wordStart = -1;
    }
  }

  if (bestDist > maxDist) {
    return NO_MATCH;
  }
  return {
    score: TYPO_BASE + (1 - bestDist / (maxDist + 1)) * 0.2,
    ranges: [{ start: bestStart, end: bestStart + bestLen }],
  };
}

/**
 * Maximum number of edits tolerated for a typo match, scaled by query length so
 * that short queries do not match unrelated strings. Queries shorter than three
 * characters tolerate no typos at all.
 */
function maxTypos(length: number): number {
  if (length < 3) {
    return 0;
  }
  if (length < 7) {
    return 1;
  }
  return 2;
}

/**
 * Optimal string alignment distance (Levenshtein plus adjacent transposition),
 * bounded by `maxDist`. Returns `maxDist + 1` as soon as it is certain the true
 * distance exceeds the bound.
 */
function osaDistance(a: string, b: string, maxDist: number): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > maxDist) {
    return maxDist + 1;
  }

  const rows: number[][] = [];
  for (let i = 0; i <= m; i++) {
    const row = new Array<number>(n + 1).fill(0);
    row[0] = i;
    rows.push(row);
  }
  const firstRow = rows[0]!;
  for (let j = 0; j <= n; j++) {
    firstRow[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    const row = rows[i]!;
    const prev = rows[i - 1]!;
    const prevPrev = i > 1 ? rows[i - 2]! : undefined;
    let rowMin = Infinity;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let val = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      if (
        prevPrev !== undefined &&
        j > 1 &&
        a.charCodeAt(i - 1) === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
      ) {
        val = Math.min(val, prevPrev[j - 2]! + 1);
      }
      row[j] = val;
      if (val < rowMin) {
        rowMin = val;
      }
    }
    if (rowMin > maxDist) {
      return maxDist + 1;
    }
  }

  return rows[m]![n]!;
}

/**
 * Merges a sorted, ascending list of matched character indices into contiguous
 * half-open ranges.
 */
function mergeIndices(indices: number[]): MatchRange[] {
  const ranges: MatchRange[] = [];
  let start = indices[0]!;
  let prev = start;
  for (let k = 1; k < indices.length; k++) {
    const idx = indices[k]!;
    if (idx === prev + 1) {
      prev = idx;
    } else {
      ranges.push({ start, end: prev + 1 });
      start = idx;
      prev = idx;
    }
  }
  ranges.push({ start, end: prev + 1 });
  return ranges;
}

/**
 * Whether a UTF-16 code unit is an ASCII alphanumeric "word" character. Used to
 * detect word boundaries; the scorer lowercases candidates first, so only
 * lowercase letters and digits need to be recognised.
 */
function isWordChar(code: number): boolean {
  return (code >= 48 && code <= 57) || (code >= 97 && code <= 122);
}
