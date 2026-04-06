/**
 * @packageDocumentation
 * Aviation flight computer calculations - the programmatic equivalent of an E6B
 * flight computer. Pure functions grouped by namespace for deterministic,
 * stateless computations.
 *
 * This package complements `@squawk/units` (which handles unit conversions,
 * formatting, and the ISA atmosphere model) by providing computed results that
 * combine multiple inputs: wind triangles, density altitude from field
 * observations, descent planning, and more.
 */
export * as atmosphere from './atmosphere.js';
export * as airspeed from './airspeed.js';
export * as wind from './wind.js';
