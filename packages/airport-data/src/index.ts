/**
 * @packageDocumentation
 * Pre-processed FAA NASR airport snapshot for use with `@squawk/airports`.
 *
 * The package root re-exports the Node entry point. Browser and edge
 * consumers should import from `@squawk/airport-data/browser` instead, which
 * exposes an async loader (`loadUsBundledAirports`) that uses `fetch` and
 * `DecompressionStream` rather than `node:fs`.
 */

export * from './node.js';
