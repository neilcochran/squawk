/**
 * @packageDocumentation
 * Pre-processed FAA ReleasableAircraft snapshot for use with
 * `@squawk/icao-registry`.
 *
 * The package root re-exports the Node entry point. Browser and edge
 * consumers should import from `@squawk/icao-registry-data/browser` instead,
 * which exposes an async loader (`loadUsBundledRegistry`) that uses `fetch`
 * and `DecompressionStream` rather than `node:fs`.
 */

export * from './node.js';
