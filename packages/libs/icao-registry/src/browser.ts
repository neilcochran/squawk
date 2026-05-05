/**
 * @packageDocumentation
 * Browser / edge entry point. Exposes the resolver factory and shared types
 * without pulling in `parseFaaRegistryZip`, which depends on Node's `Buffer`
 * and the `adm-zip` package and is unsuitable for browser bundles. Pair with
 * `@squawk/icao-registry-data/browser` to consume the bundled snapshot.
 *
 * Node consumers should use the default {@link "."} entry point, which also
 * exports `parseFaaRegistryZip` for parsing fresh FAA ReleasableAircraft ZIPs
 * at runtime.
 */
export { createIcaoRegistry } from './registry.js';
export type { IcaoRegistry, IcaoRegistryOptions } from './registry.js';
export type { AircraftRegistration, AircraftType, EngineType } from '@squawk/types';
