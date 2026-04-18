/**
 * @packageDocumentation
 * Shared resolver instances used across the squawk MCP tool modules. Each
 * resolver is constructed once at module load time so the bundled FAA data
 * snapshots are decoded and indexed exactly once per server process.
 *
 * The ICAO registry is the only resolver that loads lazily: its bundled data
 * package decompresses ~40 MB of records on import, which is wasted work for
 * sessions that never call the tail-number lookup. The registry is built on
 * the first {@link getIcaoRegistry} call and cached for subsequent calls.
 */

import { usBundledAirports } from '@squawk/airport-data';
import { usBundledAirspace } from '@squawk/airspace-data';
import { usBundledAirways } from '@squawk/airway-data';
import { usBundledFixes } from '@squawk/fix-data';
import { usBundledNavaids } from '@squawk/navaid-data';
import { usBundledProcedures } from '@squawk/procedure-data';
import { createAirportResolver, type AirportResolver } from '@squawk/airports';
import { createAirspaceResolver, type AirspaceResolver } from '@squawk/airspace';
import { createAirwayResolver, type AirwayResolver } from '@squawk/airways';
import { createFixResolver, type FixResolver } from '@squawk/fixes';
import { createNavaidResolver, type NavaidResolver } from '@squawk/navaids';
import { createProcedureResolver, type ProcedureResolver } from '@squawk/procedures';
import { createIcaoRegistry, type IcaoRegistry } from '@squawk/icao-registry';

/** Eagerly-built airport resolver backed by the US NASR snapshot. */
export const airportResolver: AirportResolver = createAirportResolver({
  data: usBundledAirports.records,
});

/** Eagerly-built airspace resolver backed by the US NASR airspace GeoJSON snapshot. */
export const airspaceResolver: AirspaceResolver = createAirspaceResolver({
  data: usBundledAirspace,
});

/** Eagerly-built airway resolver backed by the US NASR snapshot. */
export const airwayResolver: AirwayResolver = createAirwayResolver({
  data: usBundledAirways.records,
});

/** Eagerly-built fix resolver backed by the US NASR snapshot. */
export const fixResolver: FixResolver = createFixResolver({ data: usBundledFixes.records });

/** Eagerly-built navaid resolver backed by the US NASR snapshot. */
export const navaidResolver: NavaidResolver = createNavaidResolver({
  data: usBundledNavaids.records,
});

/** Eagerly-built procedure resolver backed by the US NASR snapshot. */
export const procedureResolver: ProcedureResolver = createProcedureResolver({
  data: usBundledProcedures.records,
});

/** Cached ICAO registry instance, populated on the first {@link getIcaoRegistry} call. */
let icaoRegistryInstance: IcaoRegistry | undefined;

/**
 * Returns the shared {@link IcaoRegistry} instance, decompressing and indexing
 * the bundled FAA aircraft registration snapshot on the first call. Subsequent
 * calls reuse the cached instance.
 *
 * The registry is initialized lazily because the underlying bundled data
 * package is the largest snapshot in the suite (roughly 40 MB raw). Sessions
 * that never look up an aircraft by ICAO hex avoid the cost entirely.
 *
 * @returns The shared registry instance.
 */
export async function getIcaoRegistry(): Promise<IcaoRegistry> {
  if (icaoRegistryInstance === undefined) {
    const { usBundledRegistry } = await import('@squawk/icao-registry-data');
    icaoRegistryInstance = createIcaoRegistry({ data: usBundledRegistry.records });
  }
  return icaoRegistryInstance;
}
