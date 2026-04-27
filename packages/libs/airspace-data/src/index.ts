/**
 * @packageDocumentation
 * Pre-processed FAA NASR airspace GeoJSON snapshot for use with
 * `@squawk/airspace`.
 *
 * The package root re-exports the Node entry point. Browser and edge
 * consumers should import from `@squawk/airspace-data/browser` instead,
 * which exposes an async loader (`loadUsBundledAirspace`) that uses `fetch`
 * and `DecompressionStream` rather than `node:fs`.
 */

export * from './node.js';
