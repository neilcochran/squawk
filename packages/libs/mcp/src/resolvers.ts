/**
 * @packageDocumentation
 * Shared resolver instances used across the squawk MCP tool modules. Each
 * resolver is constructed once at module load time so the bundled FAA data
 * snapshots are decoded and indexed exactly once per server process.
 *
 * The ICAO registry is the only resolver that loads lazily, and its data
 * package (`@squawk/icao-registry-data`) is declared as an optional peer
 * dependency rather than a required dep. The registry is built on the first
 * {@link getIcaoRegistry} call (decompressing ~40 MB on first access) and
 * cached for subsequent calls. When the peer is not installed, the import
 * throws `ERR_MODULE_NOT_FOUND` and {@link getIcaoRegistry} surfaces a
 * {@link MissingDataPackageError} for the tool handler to format.
 */

import { usBundledAirports } from '@squawk/airport-data';
import { createAirportResolver, type AirportResolver } from '@squawk/airports';
import { createAirspaceResolver, type AirspaceResolver } from '@squawk/airspace';
import { usBundledAirspace } from '@squawk/airspace-data';
import { usBundledAirways } from '@squawk/airway-data';
import { createAirwayResolver, type AirwayResolver } from '@squawk/airways';
import { usBundledFixes } from '@squawk/fix-data';
import { createFixResolver, type FixResolver } from '@squawk/fixes';
import { createIcaoRegistry, type IcaoRegistry } from '@squawk/icao-registry';
import { usBundledNavaids } from '@squawk/navaid-data';
import { createNavaidResolver, type NavaidResolver } from '@squawk/navaids';
import { usBundledProcedures } from '@squawk/procedure-data';
import { createProcedureResolver, type ProcedureResolver } from '@squawk/procedures';

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

/**
 * Error thrown when a tool tries to load an optional data package peer that
 * has not been installed alongside `@squawk/mcp`. Tool handlers catch this
 * and surface the install command to the MCP client so the user can resolve
 * the missing dependency without inspecting the server logs.
 */
export class MissingDataPackageError extends Error {
  /** Short dataset name shown to users (e.g. `"icao-registry"`). */
  readonly datasetName: string;
  /** npm package name the user must install (e.g. `"@squawk/icao-registry-data"`). */
  readonly packageName: string;
  /** Suggested install command, e.g. `"npm install @squawk/icao-registry-data"`. */
  readonly installCommand: string;

  /**
   * Constructs a new error describing a missing optional data peer.
   *
   * @param datasetName - Short dataset name for the user-facing message.
   * @param packageName - npm package name that needs to be installed.
   */
  constructor(datasetName: string, packageName: string) {
    const installCommand = `npm install ${packageName}`;
    super(`${datasetName} data is not installed. Run: ${installCommand}`);
    this.name = 'MissingDataPackageError';
    this.datasetName = datasetName;
    this.packageName = packageName;
    this.installCommand = installCommand;
  }
}

/** Cached ICAO registry instance, populated on the first {@link getIcaoRegistry} call. */
let icaoRegistryInstance: IcaoRegistry | undefined;

/**
 * Cached metadata captured the first time the registry is loaded. Held
 * separately from the registry instance so {@link getIcaoRegistryMetadata}
 * can return it without forcing another import.
 */
let icaoRegistryMetadata: { generatedAt: string; recordCount: number } | undefined;

/**
 * Sticky flag set once the optional `@squawk/icao-registry-data` peer is
 * confirmed missing. Subsequent {@link getIcaoRegistry} calls short-circuit
 * to a {@link MissingDataPackageError} without retrying the import; running
 * `npm install` while the server is live is not a supported workflow.
 */
let icaoRegistryMissing = false;

/** Loader signature for the optional `@squawk/icao-registry-data` peer. */
type IcaoRegistryDataLoader = () => Promise<typeof import('@squawk/icao-registry-data')>;

/** Default loader: a dynamic import of the actual peer package. */
const defaultIcaoRegistryDataLoader: IcaoRegistryDataLoader = () =>
  import('@squawk/icao-registry-data');

/**
 * Active loader used by {@link getIcaoRegistry}. Replaceable in tests via
 * {@link __setIcaoRegistryDataLoaderForTest} so the missing-peer code path
 * can be exercised without uninstalling the workspace-symlinked package.
 */
let icaoRegistryDataLoader: IcaoRegistryDataLoader = defaultIcaoRegistryDataLoader;

/**
 * Returns `true` when the given thrown value is Node's
 * `ERR_MODULE_NOT_FOUND`, which the ESM loader raises both when the package
 * specifier cannot be resolved and when a transitive resolution within the
 * package fails. The latter is rare but should still surface as the missing-
 * peer error so the user gets a single actionable message.
 *
 * @param err - The value caught from a dynamic import.
 * @returns `true` when the value is an `ERR_MODULE_NOT_FOUND` error.
 */
function isModuleNotFoundError(err: unknown): boolean {
  return err instanceof Error && 'code' in err && err.code === 'ERR_MODULE_NOT_FOUND';
}

/**
 * Returns the shared {@link IcaoRegistry} instance, decompressing and indexing
 * the bundled FAA aircraft registration snapshot on the first call. Subsequent
 * calls reuse the cached instance.
 *
 * The registry is initialized lazily because the underlying data package is
 * the largest snapshot in the suite (roughly 40 MB raw) and is declared as an
 * optional peer dependency rather than a required dep. Sessions that never
 * look up an aircraft by ICAO hex avoid the cost entirely, and consumers who
 * never install the peer see only the structured missing-package error
 * surfaced by the tool handler.
 *
 * @returns The shared registry instance.
 * @throws {MissingDataPackageError} when `@squawk/icao-registry-data` is not
 *         installed alongside `@squawk/mcp`.
 */
export async function getIcaoRegistry(): Promise<IcaoRegistry> {
  if (icaoRegistryMissing) {
    throw new MissingDataPackageError('icao-registry', '@squawk/icao-registry-data');
  }
  if (icaoRegistryInstance === undefined) {
    let registryDataModule: typeof import('@squawk/icao-registry-data');
    try {
      registryDataModule = await icaoRegistryDataLoader();
    } catch (err) {
      if (isModuleNotFoundError(err)) {
        icaoRegistryMissing = true;
        throw new MissingDataPackageError('icao-registry', '@squawk/icao-registry-data');
      }
      throw err;
    }
    const { usBundledRegistry } = registryDataModule;
    icaoRegistryInstance = createIcaoRegistry({ data: usBundledRegistry.records });
    icaoRegistryMetadata = {
      generatedAt: usBundledRegistry.properties.generatedAt,
      recordCount: usBundledRegistry.properties.recordCount,
    };
  }
  return icaoRegistryInstance;
}

/**
 * @internal
 *
 * Test-only seam for swapping the optional data package loader. Production
 * code must not call this. Pass `undefined` to restore the default loader
 * and clear all cached state (instance, metadata, and the missing-peer
 * sticky flag) so subsequent tests start from a clean slate.
 *
 * @param loader - Replacement loader, or `undefined` to reset.
 */
export function __setIcaoRegistryDataLoaderForTest(
  loader: IcaoRegistryDataLoader | undefined,
): void {
  icaoRegistryDataLoader = loader ?? defaultIcaoRegistryDataLoader;
  icaoRegistryInstance = undefined;
  icaoRegistryMetadata = undefined;
  icaoRegistryMissing = false;
}

/**
 * Reports whether the lazily-loaded ICAO aircraft registry has been
 * initialized in this process.
 *
 * @returns `true` once {@link getIcaoRegistry} has resolved at least once.
 */
export function isIcaoRegistryLoaded(): boolean {
  return icaoRegistryInstance !== undefined;
}

/**
 * Returns the cached metadata for the loaded ICAO registry, or `undefined`
 * when the registry has not been initialized yet. Does not trigger a load.
 *
 * @returns The registry metadata if loaded, otherwise `undefined`.
 */
export function getIcaoRegistryMetadata():
  { generatedAt: string; recordCount: number } | undefined {
  return icaoRegistryMetadata;
}
