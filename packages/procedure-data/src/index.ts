/**
 * @packageDocumentation
 * Pre-processed FAA CIFP procedure snapshot (SIDs, STARs, IAPs) for use
 * with `@squawk/procedures`.
 *
 * The package root re-exports the Node entry point. Browser and edge
 * consumers should import from `@squawk/procedure-data/browser` instead,
 * which exposes an async loader (`loadUsBundledProcedures`) that uses
 * `fetch` and `DecompressionStream` rather than `node:fs`.
 */

export * from './node.js';
