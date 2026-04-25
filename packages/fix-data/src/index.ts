/**
 * @packageDocumentation
 * Pre-processed FAA NASR fix/waypoint snapshot for use with `@squawk/fixes`.
 *
 * The package root re-exports the Node entry point. Browser and edge
 * consumers should import from `@squawk/fix-data/browser` instead, which
 * exposes an async loader (`loadUsBundledFixes`) that uses `fetch` and
 * `DecompressionStream` rather than `node:fs`.
 */

export * from './node.js';
