/**
 * @packageDocumentation
 * Shared resolver accessors used across the squawk MCP tool modules. Every
 * bundled FAA snapshot loads on demand: the first accessor call dynamically
 * imports its data package, decompresses and indexes the snapshot, and caches
 * the result for the life of the process. A session that only asks about
 * airports never decompresses the CIFP procedure snapshot, and a session that
 * asks nothing pays nothing beyond process start.
 *
 * Each accessor memoizes the in-flight load rather than the finished
 * resolver, so concurrent tool calls needing the same dataset share one
 * import and one index build instead of racing to build two.
 *
 * The ICAO registry follows the same shape with one extra wrinkle: its data
 * package (`@squawk/icao-registry-data`) is declared as an optional peer
 * dependency rather than a required dep, so a failed import is an expected
 * outcome rather than a broken install. When the peer is absent the import
 * throws `ERR_MODULE_NOT_FOUND` and {@link getIcaoRegistry} surfaces a
 * {@link MissingDataPackageError} for the tool handler to format.
 */

import { createAirportResolver, type AirportResolver } from '@squawk/airports';
import { createAirspaceResolver, type AirspaceResolver } from '@squawk/airspace';
import { createAirwayResolver, type AirwayResolver } from '@squawk/airways';
import { createFixResolver, type FixResolver } from '@squawk/fixes';
import { createIcaoRegistry, type IcaoRegistry } from '@squawk/icao-registry';
import { createNavaidResolver, type NavaidResolver } from '@squawk/navaids';
import { createProcedureResolver, type ProcedureResolver } from '@squawk/procedures';

/**
 * Accessors over one bundled snapshot that is imported, decompressed, and
 * indexed the first time something reads it.
 *
 * @typeParam TResolver - Resolver type built over the dataset records.
 */
interface LazyDataset<TResolver> {
  /**
   * Returns the resolver, importing and indexing the snapshot on the first
   * call and reusing the cached instance on every call after that.
   */
  getResolver: () => Promise<TResolver>;
  /**
   * Reports whether the snapshot has finished loading in this process.
   * Never triggers a load.
   */
  isLoaded: () => boolean;
}

/**
 * Builds a {@link LazyDataset} around a data package's dynamic import.
 *
 * The in-flight promise is what gets memoized, not the finished resolver, so
 * two tool calls arriving before the first load settles share a single import
 * and a single index build. A rejected load clears the memo so a later call
 * retries rather than inheriting a permanently poisoned cache.
 *
 * @typeParam TDataset - Dataset object exported by the data package.
 * @typeParam TResolver - Resolver type built over the dataset records.
 * @param importDataset - Dynamic import resolving to the bundled dataset.
 * @param buildResolver - Builds the resolver from the imported dataset.
 * @returns Accessors over the lazily-loaded dataset.
 */
function createLazyDataset<TDataset, TResolver>(
  importDataset: () => Promise<TDataset>,
  buildResolver: (dataset: TDataset) => TResolver,
): LazyDataset<TResolver> {
  let loaded: TResolver | undefined;
  let pending: Promise<TResolver> | undefined;

  return {
    getResolver: (): Promise<TResolver> => {
      if (loaded !== undefined) {
        return Promise.resolve(loaded);
      }
      pending ??= importDataset().then(
        (dataset) => {
          loaded = buildResolver(dataset);
          return loaded;
        },
        (err: unknown) => {
          pending = undefined;
          throw err;
        },
      );
      return pending;
    },
    isLoaded: (): boolean => loaded !== undefined,
  };
}

/** Lazily-loaded airport dataset backed by the US NASR snapshot. */
const airportDataset = createLazyDataset(
  async () => (await import('@squawk/airport-data')).usBundledAirports,
  (dataset) => createAirportResolver({ data: dataset.records }),
);

/** Lazily-loaded airspace dataset backed by the US NASR airspace GeoJSON snapshot. */
const airspaceDataset = createLazyDataset(
  async () => (await import('@squawk/airspace-data')).usBundledAirspace,
  (dataset) => createAirspaceResolver({ data: dataset }),
);

/** Lazily-loaded airway dataset backed by the US NASR snapshot. */
const airwayDataset = createLazyDataset(
  async () => (await import('@squawk/airway-data')).usBundledAirways,
  (dataset) => createAirwayResolver({ data: dataset.records }),
);

/** Lazily-loaded fix dataset backed by the US NASR snapshot. */
const fixDataset = createLazyDataset(
  async () => (await import('@squawk/fix-data')).usBundledFixes,
  (dataset) => createFixResolver({ data: dataset.records }),
);

/** Lazily-loaded navaid dataset backed by the US NASR snapshot. */
const navaidDataset = createLazyDataset(
  async () => (await import('@squawk/navaid-data')).usBundledNavaids,
  (dataset) => createNavaidResolver({ data: dataset.records }),
);

/** Lazily-loaded procedure dataset backed by the FAA CIFP snapshot. */
const procedureDataset = createLazyDataset(
  async () => (await import('@squawk/procedure-data')).usBundledProcedures,
  (dataset) => createProcedureResolver({ data: dataset.records }),
);

/**
 * Returns the shared airport resolver, importing and indexing the bundled US
 * NASR airport snapshot on the first call.
 *
 * @returns The shared airport resolver.
 */
export function getAirportResolver(): Promise<AirportResolver> {
  return airportDataset.getResolver();
}

/**
 * Returns the shared airspace resolver, importing and indexing the bundled US
 * NASR airspace GeoJSON snapshot on the first call.
 *
 * @returns The shared airspace resolver.
 */
export function getAirspaceResolver(): Promise<AirspaceResolver> {
  return airspaceDataset.getResolver();
}

/**
 * Returns the shared airway resolver, importing and indexing the bundled US
 * NASR airway snapshot on the first call.
 *
 * @returns The shared airway resolver.
 */
export function getAirwayResolver(): Promise<AirwayResolver> {
  return airwayDataset.getResolver();
}

/**
 * Returns the shared fix resolver, importing and indexing the bundled US NASR
 * fix snapshot on the first call.
 *
 * @returns The shared fix resolver.
 */
export function getFixResolver(): Promise<FixResolver> {
  return fixDataset.getResolver();
}

/**
 * Returns the shared navaid resolver, importing and indexing the bundled US
 * NASR navaid snapshot on the first call.
 *
 * @returns The shared navaid resolver.
 */
export function getNavaidResolver(): Promise<NavaidResolver> {
  return navaidDataset.getResolver();
}

/**
 * Returns the shared procedure resolver, importing and indexing the bundled
 * FAA CIFP procedure snapshot on the first call.
 *
 * @returns The shared procedure resolver.
 */
export function getProcedureResolver(): Promise<ProcedureResolver> {
  return procedureDataset.getResolver();
}

/**
 * Whether each required bundled snapshot has been loaded into the running
 * process. Build metadata is not part of this shape: it is available from
 * each data package's `/meta` subpath without loading anything, so only the
 * in-memory state has to be read from here.
 */
export interface BundledDatasetLoadState {
  /** Whether the airport snapshot is loaded. */
  readonly airports: boolean;
  /** Whether the airspace snapshot is loaded. */
  readonly airspace: boolean;
  /** Whether the airway snapshot is loaded. */
  readonly airways: boolean;
  /** Whether the fix snapshot is loaded. */
  readonly fixes: boolean;
  /** Whether the navaid snapshot is loaded. */
  readonly navaids: boolean;
  /** Whether the procedure snapshot is loaded. */
  readonly procedures: boolean;
}

/**
 * Reports which required bundled snapshots are currently in memory, without
 * loading any of them.
 *
 * @returns Per-dataset load state.
 */
export function getBundledDatasetLoadState(): BundledDatasetLoadState {
  return {
    airports: airportDataset.isLoaded(),
    airspace: airspaceDataset.isLoaded(),
    airways: airwayDataset.isLoaded(),
    fixes: fixDataset.isLoaded(),
    navaids: navaidDataset.isLoaded(),
    procedures: procedureDataset.isLoaded(),
  };
}

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
 * In-flight registry load, memoized so concurrent lookups share one import
 * and one index build. Cleared when the load rejects so a later call retries.
 */
let icaoRegistryPending: Promise<IcaoRegistry> | undefined;

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
 * Imports the optional registry peer and builds the registry, populating the
 * module-level caches. Split out of {@link getIcaoRegistry} so the memoized
 * in-flight promise has a single body behind it.
 *
 * @returns The newly built registry instance.
 * @throws {MissingDataPackageError} when the peer is not installed.
 */
async function loadIcaoRegistry(): Promise<IcaoRegistry> {
  let registryDataModule: typeof import('@squawk/icao-registry-data');
  try {
    registryDataModule = await icaoRegistryDataLoader();
  } catch (err) {
    icaoRegistryPending = undefined;
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
  return icaoRegistryInstance;
}

/**
 * Returns the shared {@link IcaoRegistry} instance, decompressing and indexing
 * the bundled FAA aircraft registration snapshot on the first call. Subsequent
 * calls reuse the cached instance.
 *
 * The registry's data package is the largest snapshot in the suite (roughly
 * 40 MB raw) and is declared as an optional peer dependency rather than a
 * required dep, so consumers who never install the peer see only the
 * structured missing-package error surfaced by the tool handler.
 *
 * @returns The shared registry instance.
 * @throws {MissingDataPackageError} when `@squawk/icao-registry-data` is not
 *         installed alongside `@squawk/mcp`.
 */
export async function getIcaoRegistry(): Promise<IcaoRegistry> {
  if (icaoRegistryMissing) {
    throw new MissingDataPackageError('icao-registry', '@squawk/icao-registry-data');
  }
  if (icaoRegistryInstance !== undefined) {
    return icaoRegistryInstance;
  }
  icaoRegistryPending ??= loadIcaoRegistry();
  return icaoRegistryPending;
}

/**
 * @internal
 *
 * Test-only seam for swapping the optional data package loader. Production
 * code must not call this. Pass `undefined` to restore the default loader
 * and clear all cached state (instance, in-flight load, metadata, and the
 * missing-peer sticky flag) so subsequent tests start from a clean slate.
 *
 * @param loader - Replacement loader, or `undefined` to reset.
 */
export function __setIcaoRegistryDataLoaderForTest(
  loader: IcaoRegistryDataLoader | undefined,
): void {
  icaoRegistryDataLoader = loader ?? defaultIcaoRegistryDataLoader;
  icaoRegistryInstance = undefined;
  icaoRegistryPending = undefined;
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
