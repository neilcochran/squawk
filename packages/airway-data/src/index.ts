/**
 * @packageDocumentation
 * Pre-processed FAA NASR airway snapshot for use with `@squawk/airways`.
 *
 * The package root re-exports the Node entry point. Browser and edge
 * consumers should import from `@squawk/airway-data/browser` instead, which
 * exposes an async loader (`loadUsBundledAirways`) that uses `fetch` and
 * `DecompressionStream` rather than `node:fs`.
 */

export * from './node.js';
