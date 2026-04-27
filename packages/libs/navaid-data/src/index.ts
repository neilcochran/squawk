/**
 * @packageDocumentation
 * Pre-processed FAA NASR navaid snapshot for use with `@squawk/navaids`.
 *
 * The package root re-exports the Node entry point. Browser and edge
 * consumers should import from `@squawk/navaid-data/browser` instead, which
 * exposes an async loader (`loadUsBundledNavaids`) that uses `fetch` and
 * `DecompressionStream` rather than `node:fs`.
 */

export * from './node.js';
