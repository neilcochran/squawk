/**
 * @packageDocumentation
 * Pure logic library for querying US fix/waypoint data.
 */
export { createFixResolver } from './resolver.js';
export type {
  FixResolver,
  FixResolverOptions,
  NearestFixQuery,
  NearestFixResult,
  FixSearchQuery,
} from './resolver.js';
