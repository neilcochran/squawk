/**
 * @packageDocumentation
 * Pure logic library for querying US instrument procedure data (SIDs,
 * STARs, and Instrument Approach Procedures) sourced from FAA CIFP.
 */
export type { MatchRange } from '@squawk/search';
export { createProcedureResolver } from './resolver.js';
export type {
  ProcedureResolver,
  ProcedureResolverOptions,
  ProcedureExpansionResult,
  ProcedureSearchField,
  ProcedureSearchQuery,
  ProcedureSearchResult,
} from './resolver.js';
