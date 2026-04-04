/**
 * @packageDocumentation
 * Pure logic library for querying US instrument procedure data (SIDs and STARs).
 */
export { createProcedureResolver } from './resolver.js';
export type {
  ProcedureResolver,
  ProcedureResolverOptions,
  ProcedureExpansionResult,
  ProcedureSearchQuery,
} from './resolver.js';
