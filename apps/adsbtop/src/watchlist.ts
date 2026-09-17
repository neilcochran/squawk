import type { Aircraft } from '@squawk/types';

/** A `parseWatchlist` failure: what was wrong with the list. */
export interface WatchlistError {
  /** Human-readable message describing the problem, suitable for printing to stderr. */
  message: string;
}

/**
 * Parses a `--watch` value: comma-separated terms, each an ICAO hex, an
 * N-number, or a callsign prefix. Terms are trimmed and upper-cased, since
 * every field they match against is upper-case on the wire, and duplicates
 * are dropped. Which kind each term is never has to be declared - see
 * {@link matchesWatchlist}.
 *
 * @param raw - The raw `--watch` value.
 * @returns The normalized terms, or a {@link WatchlistError} when the list is empty.
 */
export function parseWatchlist(raw: string): { terms: readonly string[] } | WatchlistError {
  const terms = [
    ...new Set(
      raw
        .split(',')
        .map((term) => term.trim().toUpperCase())
        .filter((term) => term !== ''),
    ),
  ];
  if (terms.length === 0) {
    return { message: '--watch needs at least one ICAO hex, N-number, or callsign prefix.' };
  }
  return { terms };
}

/**
 * Whether `aircraft` is on the watchlist: some term equals its ICAO hex,
 * equals its resolved N-number, or is a prefix of its callsign, ignoring
 * case. One rule for every term avoids having to guess whether `N12345`
 * means a registration or a callsign - it matches either.
 *
 * @param aircraft - The aircraft to test.
 * @param terms - Normalized watch terms from {@link parseWatchlist}.
 * @returns True if any term matches.
 */
export function matchesWatchlist(aircraft: Aircraft, terms: readonly string[]): boolean {
  if (terms.length === 0) {
    return false;
  }
  const hex = aircraft.icaoHex.toUpperCase();
  const registration = aircraft.registration?.registration.toUpperCase();
  const callsign = aircraft.callsign?.toUpperCase();
  return terms.some(
    (term) =>
      term === hex ||
      term === registration ||
      (callsign !== undefined && callsign.startsWith(term)),
  );
}
