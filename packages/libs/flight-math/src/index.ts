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
export * from './types/index.js';
export * as atmosphere from './atmosphere.js';
export * as airspeed from './airspeed.js';
export * as wind from './wind.js';
export * as descent from './descent.js';
export * as navigation from './navigation.js';
export * as turn from './turn.js';
export * as glide from './glide.js';
export * as pivotal from './pivotal.js';
export * as solar from './solar.js';
export * as magnetic from './magnetic.js';
export * as planning from './planning.js';
