/**
 * @packageDocumentation
 * Node entry point. Exposes the resolver factory plus `parseFaaRegistryZip`
 * for parsing fresh FAA ReleasableAircraft ZIPs at runtime.
 *
 * Browser and edge consumers should use the `./browser` entry point instead,
 * which omits `parseFaaRegistryZip` (it depends on Node's `Buffer` and the
 * `adm-zip` package and is unsuitable for browser bundles).
 */
export { createIcaoRegistry } from './registry.js';
export type { IcaoRegistry, IcaoRegistryOptions } from './registry.js';
export { parseFaaRegistryZip } from './parse-faa-zip.js';
export type { AircraftRegistration, AircraftType, EngineType } from '@squawk/types';
