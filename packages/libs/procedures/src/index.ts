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
export { extractLegPoints, expansionToLineString } from './leg-geometry.js';
export type { ProcedureLegPoint } from './leg-geometry.js';
