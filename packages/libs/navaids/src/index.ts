/**
 * @packageDocumentation
 * Pure logic library for querying US navaid data.
 */
export type { MatchRange } from '@squawk/search';
export { createNavaidResolver } from './resolver.js';
export type {
  NavaidResolver,
  NavaidResolverOptions,
  NearestNavaidQuery,
  NearestNavaidResult,
  NavaidFrequencyQuery,
  NavaidSearchQuery,
  NavaidSearchField,
  NavaidSearchResult,
} from './resolver.js';
