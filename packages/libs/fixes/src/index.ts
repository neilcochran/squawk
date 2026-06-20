/**
 * @packageDocumentation
 * Pure logic library for querying US fix/waypoint data.
 */
export type { MatchRange } from '@squawk/search';
export { createFixResolver } from './resolver.js';
export type {
  FixResolver,
  FixResolverOptions,
  NearestFixQuery,
  NearestFixResult,
  FixSearchQuery,
  FixSearchField,
  FixSearchResult,
} from './resolver.js';
