# Conventions

The patterns and rules that PR review enforces in the squawk monorepo. Code-style, naming, TSDoc, test, and changeset conventions live here. For the architectural decisions and processes that shape the codebase as a whole, see [ARCHITECTURE.md](ARCHITECTURE.md).

The cross-cutting rules in this file (TSDoc, naming, unit suffixes, code style, ESLint) apply to atlas as well; for atlas-specific framework patterns (React, Vite, Tailwind v4, MapLibre, Vitest with jsdom), see [`apps/atlas/README.md`](apps/atlas/README.md) and the **Atlas at a glance** section of [ARCHITECTURE.md](ARCHITECTURE.md#atlas-at-a-glance).

---

## Package structure

Every published library has the same outer shell - `package.json`, `tsconfig.json`, `README.md`, and a `src/` directory with colocated `*.spec.ts` tests. The internal layout of `src/` depends on what the package does.

The most common shape is a **query library** (`@squawk/airports`, `@squawk/navaids`, `@squawk/fixes`, `@squawk/airways`, `@squawk/airspace`, `@squawk/procedures`, `@squawk/icao-registry`, `@squawk/flightplan`):

```
packages/libs/<name>/
  src/
    index.ts            # Public API re-exports only
    resolver.ts         # Main factory function + interfaces (or registry.ts)
    resolver.spec.ts    # Tests colocated with source
    <utility>.ts        # Helper modules (e.g., geo.ts)
    <utility>.spec.ts   # Helper tests
  package.json
  tsconfig.json
  README.md
```

Other shapes:

- **Utility libraries** (`@squawk/units`, `@squawk/geo`, `@squawk/flight-math`) export namespace-grouped pure functions, not resolvers. `src/` is a flat set of topic files (`speed.ts`, `distance.ts`, etc.) re-exported as namespaces from `index.ts`.
- **Parser libraries** (`@squawk/weather`, `@squawk/notams`) export `parse*` functions plus the types they produce. Typically include a `src/types/` subdirectory with package-local types (see [Package-local types](#package-local-types) below).
- **Shared types** (`@squawk/types`) just re-exports interface declarations from per-domain files.
- **Data packages** add a `data/` directory at the package root (sibling to `src/`) and split entries into `src/node.ts` + `src/browser.ts` (see [Data package pattern](#data-package-pattern) below).
- **Aggregator** (`@squawk/mcp`) has a `src/tools/<domain>.ts` per exposed library and a `src/resolvers.ts` that wires them up.

Apps live under `apps/<name>/` and follow their own conventions - see [`apps/atlas/README.md`](apps/atlas/README.md).

---

## package.json shape

Use any existing published library (e.g. `packages/libs/airports/package.json`) as the canonical reference. The shape: ES module, Node `>=22`, `dist/` as the only published artifact, the standard `build` / `test` / `test:coverage` / `lint` script set, `publishConfig.access: public`.

Workspace-dep range conventions:

- **Published packages** use caret ranges pinned to the dep's current version: `"@squawk/types": "^0.3.0"`. Do not use `"*"` - npm ships the wildcard literally and downstream installs can reuse stale cached versions. Bump the caret floor whenever you reach for a new feature in the dependency (the Version Packages bot owns floor bumps inside Version Packages PRs; in feature PRs, bump only when actually needed).
- **Private workspaces** (everything in `tools/` and `apps/atlas/`) use `"*"` since they're never published. Why not `"workspace:*"`: the npm version pinned by this repo (`packageManager` is npm 11) returns `EUNSUPPORTEDPROTOCOL` on the `workspace:` protocol; that idiom is yarn / pnpm.

Other notes:

- Data packages include `"data"` in the `files` array alongside `"dist"`.
- Query libraries list their companion data package as a `devDependency` (for testing only).
- Tools workspaces declare `"lint": "tsc --noEmit && eslint src"` so `turbo run lint` covers them. Tools that use `import.meta.dirname` declare `"engines": { "node": ">=22.16" }` (the rest stay at `>=22`).

---

## tsconfig.json

Every published library extends `../../../tsconfig.base.json` (three levels up from `packages/libs/<name>/tsconfig.json`) and only sets `rootDir: src` / `outDir: dist` plus the `include` glob. Use any existing lib's `tsconfig.json` as the reference.

Apps under `apps/<name>/` do **not** extend `tsconfig.base.json` - they have framework-specific settings (jsx, DOM lib, Bundler resolution, noEmit) that the lib base does not carry.

---

## Resolver / factory pattern

This pattern applies to query libraries that take data as input and expose lookup operations. It does not apply to utility libraries (`@squawk/units`, `@squawk/geo`, `@squawk/flight-math`), parser libraries (`@squawk/weather`, `@squawk/notams`), or shared types (`@squawk/types`) - those take whatever shape fits their task.

For query libraries: expose a `create*Resolver({ data })` factory that accepts the raw record array and returns a stateless resolver. The factory builds internal `Map` indexes at creation time; query methods do no I/O. Resolver is stateless after creation. See `packages/libs/airports/src/resolver.ts` for the canonical shape.

Type conventions:

- Options interface: `<Name>ResolverOptions` with a `data` field accepting the raw record array.
- Resolver interface: `<Name>Resolver` describing the query methods.
- Factory function: `create<Name>Resolver(options): <Name>Resolver`.

The factory's TSDoc block includes a usage example showing the data-package import + factory call (see TSDoc below).

---

## index.ts conventions

`src/index.ts` is purely re-exports. No logic. Conventions:

- Import paths use the `.js` extension (NodeNext module resolution).
- Separate `export` (values) from `export type` (types).
- Main factory function listed first, then helpers, then any re-exports from `@squawk/types`.
- The file's top-level TSDoc block uses `@packageDocumentation` so TypeDoc picks it up as the package summary.

See any existing lib's `src/index.ts` for the canonical shape.

---

## Data package pattern

Each data package bundles a single gzipped JSON snapshot under `data/<name>.json.gz`. The JSON wire format is `{ meta: {...}, records: FullRecord[] }` - records are stored in their full typed shape, no compaction or expansion step. Two entry points expose the same `<Name>Dataset` shape:

- **`src/node.ts`** (re-exported by `src/index.ts`): synchronous read at module load via `node:fs` + `node:zlib`, exposed as a single eager constant `usBundled<X>`. This is the default entry consumed by Node lib tests, mcp tool modules, and any Node consumer.
- **`src/browser.ts`** (exposed via the `/browser` exports subpath): async function `loadUsBundled<X>(options?)` that uses `fetch` + `DecompressionStream('gzip')`. Returns the same `<Name>Dataset` shape. Handles servers that advertise `Content-Encoding: gzip` (fetch decodes automatically) as well as servers that serve `.gz` as opaque bytes.

The browser entry's `LoadOptions` accepts an explicit `url` (override the default `import.meta.url`-relative path - useful for hosting on a CDN or for test fixtures) and a `fetch` (for tests or non-standard runtimes). See `packages/libs/airport-data/src/node.ts` and `.../browser.ts` for the canonical shape.

Each data package's metadata includes at least `generatedAt` (ISO timestamp), `recordCount`, and a source-specific cycle field (`nasrCycleDate` / `cifpCycleDate` for the cycle-product datasets). The cycle date is what `scripts/check-readme-dates.js` compares against the date embedded in the data package README.

---

## TSDoc

Every exported symbol (interface, type, function, const, enum) must have a `/** */` TSDoc comment. Every property and parameter must have its own inline `/** */` comment.

```typescript
/**
 * Represents a geographic position with optional altitude data.
 */
export interface Position {
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
  /** Barometric altitude in feet MSL, if available. */
  baroAltitudeFt?: number;
}
```

Factory functions include a usage example in the TSDoc block:

````typescript
/**
 * Creates a resolver for querying airport records.
 *
 * ```typescript
 * import { usBundledAirports } from '@squawk/airport-data';
 * import { createAirportResolver } from '@squawk/airports';
 *
 * const resolver = createAirportResolver({ data: usBundledAirports.records });
 * const jfk = resolver.byFaaId('JFK');
 * ```
 */
````

---

## Test conventions

Tests use Vitest. Vitest runs `.spec.ts` files directly from `src/` via Vite / esbuild, so no `tsc` build is needed before tests. Each lib / tool package owns a tiny `vitest.config.ts` that extends the shared base at the repo root (`vitest.shared.ts`); the only field most packages set is `test.name`. See any existing lib's spec files for the canonical shape.

Conventions:

- File naming: `<module>.spec.ts` colocated with source.
- One `describe` block per method or function; one `it` per behavior or edge case.
- Use `beforeAll()` to initialize shared resolver instances. Import data packages dynamically in `beforeAll()` since they're `devDependencies`.
- `globals: false` is on by default - import `describe` / `it` / `expect` / `assert` / `beforeAll` / `vi` from `vitest` explicitly.
- Use `expect(...).<matcher>(...)` for value assertions (`toBe`, `toEqual`, `toMatch`, `toThrow`, `.rejects.toThrow`, etc.) and Vitest's `assert(expression, msg?)` for narrowing-style checks where TypeScript needs the `asserts expression` predicate (e.g. `assert(value !== undefined)` before reading `value.field`).
- Vitest's `assert(Array.isArray(x))` does NOT propagate the inner type guard - if you need discriminated-union narrowing (e.g. `geometry.type === 'Polygon'` to access `.coordinates`), use a plain `if (...) throw new Error(...)` block instead.
- For floating-point comparisons, use a tolerance helper (see `@squawk/units` `test-utils.ts`).
- Type-only assertions (`expectTypeOf`, `assertType`) work inline in any spec or in dedicated `*.test-d.ts` files - vitest typecheck is enabled globally in `vitest.shared.ts`, no per-package opt-in needed.
- Data packages include sanity tests (`index.spec.ts`) that verify: record count is reasonable, metadata is present and consistent, required fields have the expected types, excluded records are absent, optional fields are populated on at least some records, and a known record can be found by scanning. Both `node.ts` and `browser.ts` should have spec coverage.

---

## Naming conventions

### Files

- `resolver.ts` / `registry.ts` - main factory and query logic
- `index.ts` - public API re-exports
- `*.spec.ts` - tests (colocated)
- Kebab-case for multi-word files: `faa-parser.ts`, `point-in-polygon.ts`

### Functions

- `create[Name]` - factory functions: `createAirportResolver`, `createIcaoRegistry`
- `parse[Format]` - data parsing: `parseFaaRegistryZip`, `parseMasterCsv`

Note: `expand` survives as a method name on resolvers that expand compound entities into their components (`airways.expand()`, `procedures.expand()`, `flightplan.expand()` all expand identifiers into ordered fix / leg / waypoint sequences) - that's a different pattern from a naming convention.

### Interfaces and types

- `[Name]Options` - factory configuration: `AirportResolverOptions`
- `[Name]Query` - query input: `NearestAirportQuery`, `AirspaceQuery`
- `[Name]Result` - result with metadata: `NearestAirportResult`
- `[Name]Resolver` / `[Name]Registry` - main API interface
- `[Name]Dataset` / `[Name]DatasetProperties` - data package exports

### Constants

- `UPPER_SNAKE_CASE` for map constants: `AIRCRAFT_TYPE_MAP`, `ENGINE_TYPE_MAP`

---

## Package-local types

When a package owns domain-specific types (per dependency rule 8), they live in a `src/types/` directory with one file per logical group and a barrel `index.ts`:

```
packages/libs/<name>/
  src/
    types/
      index.ts          # Barrel re-exports all type files
      <group>.ts        # One file per logical group of types
      <group>.ts
    index.ts            # Re-exports types via: export * from './types/index.js';
```

Conventions:

- Each type file has a module-level TSDoc comment describing the group
- File names match the source module that consumes them (e.g. `wind.ts` types in `types/wind.ts`)
- The barrel `index.ts` uses `export * from './<file>.js'` for each type file
- Source modules import directly from the specific type file, not the barrel (e.g. `import type { Foo } from './types/wind.js'`)
- The package `index.ts` re-exports all types via the barrel so consumers get them from the package root

Examples: `@squawk/weather` (`types/metar.ts`, `types/taf.ts`, etc.), `@squawk/notams` (`types/notam.ts`, `types/faa-notam.ts`), `@squawk/flight-math` (`types/wind.ts`, `types/navigation.ts`, `types/solar.ts`)

---

## Dependency rules

1. `@squawk/types` has no runtime dependencies (except `@types/geojson` for type-only use).
2. `@squawk/units` has no dependencies at all (fully standalone).
3. Library packages depend on `@squawk/types` (when they touch the shared domain models) and optionally `@squawk/units` (when unit work is involved).
4. Data packages depend on `@squawk/types` only.
5. Query libraries that pair with a data package list that data package as a `devDependency` for testing.
6. Query libraries and their companion data packages never depend on each other at runtime.
7. Library packages may depend on other library packages when there is a clear logical dependency (e.g. `@squawk/airports` depending on `@squawk/flight-math` for wind component calculations). Avoid circular or gratuitous cross-dependencies.
8. Types that are shared across multiple packages (3+ consumers across the library / data / build-script boundary) belong in `@squawk/types`. Domain-specific types that are produced and consumed by a single package belong in that package (e.g. weather types in `@squawk/weather`, NOTAM types in `@squawk/notams`). This keeps `@squawk/types` focused on genuinely shared domain models and avoids unnecessary coupling when domain-specific types change.

---

## Adding a new package

1. Create `packages/libs/<name>/` with `src/index.ts`, `package.json`, `tsconfig.json`, `README.md`. Copy the shape from an existing lib (e.g. `packages/libs/airports/`).
2. The `tsconfig.json` `extends` path must be `../../../tsconfig.base.json`.
3. Verify the workspace is picked up - the root `package.json` `packages/libs/*` glob handles it; no edit needed unless the new package lives outside that bucket.
4. Add the package to the Packages table in the root [README](README.md).
5. Add the package to [ARCHITECTURE.md](ARCHITECTURE.md) if it introduces a new architectural pattern or design decision.
6. Ensure all exports have TSDoc comments.
7. Add tests using Vitest (see **Test conventions** above).
8. Run `npm install` to link the workspace.
9. Verify `npm run build`, `npm run test`, `npm run lint` all pass.
10. If the package should be exposed through MCP, update `packages/libs/mcp/` in the same change: add the tool module under `src/tools/<domain>.ts`, wire the resolver in `src/resolvers.ts`, update the README, and add the dep to `package.json`. See the **MCP as the aggregator** section of [ARCHITECTURE.md](ARCHITECTURE.md#mcp-as-the-aggregator) for the full sync rule.

---

## ESLint configuration

The actual config lives in `eslint.config.mjs` (root, covers libs / tools / scripts) plus `eslint.shared.mjs` (shared rule blocks). Atlas has its own `apps/atlas/eslint.config.js` that imports from `eslint.shared.mjs` to stay aligned. Plugins in use:

- `@eslint/js` recommended rules
- `typescript-eslint` recommended rules
- `eslint-config-prettier` to disable formatting conflicts
- `eslint-plugin-import` (shared via `eslint.shared.mjs`): `import/order`, `import/no-cycle`, `import/no-duplicates`, `import/no-self-import`, plus typescript / node resolver settings
- `eslint-plugin-n` (root only - Node-specific, not applied to atlas browser code): `n/no-deprecated-api`, `n/no-process-exit` (warn, not error - build tools and the mcp `bin.ts` legitimately exit), `n/no-unsupported-features/{es,node}-builtins`, `n/prefer-node-protocol`
- Ignores: `**/dist/**`, `**/node_modules/**`, `scripts/*.js`

Cross-config rule blocks (rules that apply to both libs/tools and atlas) live in `eslint.shared.mjs`. New rules that apply to both surfaces go there to prevent drift; atlas-only or libs/tools-only rules stay in their respective config files.

Source-level dead-export detection (`import/no-unused-modules`) is not currently in the gate set due to a known flat-config incompatibility upstream ([eslint-plugin-import #3079](https://github.com/import-js/eslint-plugin-import/issues/3079) - the rule requires a legacy `.eslintrc` file). Knip handles package-level dead deps and orphaned files; the source-level dead-export axis is uncovered for now.

---

## Unit suffixes and measurement naming

Properties and parameters that carry a unit use a short standard abbreviation as a suffix:

| Unit           | Suffix | Example                           |
| -------------- | ------ | --------------------------------- |
| Feet           | `Ft`   | `altitudeFt`, `elevationFt`       |
| Knots          | `Kt`   | `groundSpeedKt`, `trueAirspeedKt` |
| Nautical miles | `Nm`   | `distanceNm`, `arcRadiusNm`       |
| Degrees        | `Deg`  | `headingDeg`, `bearingDeg`        |
| Kilometers     | `Km`   | `distanceKm`                      |
| Statute miles  | `Sm`   | `visibilitySm`                    |

Compound units spell out the relationship: `FtPerMin`, `DegPerSec`, `KmPerHr`.

### Measurement concepts

Always use full words for measurement concepts in exported names. Do not use aviation abbreviations (`ias`, `tas`, `cas`, `gs`, `vs`) in identifiers:

- `indicatedAirspeedKt` not `iasKt`
- `trueAirspeedKt` not `tasKt`
- `groundSpeedKt` not `gsKt`
- `pressureAltitudeFt` not `pressureAltFt`

Multi-word concepts use standard camelCase: `groundSpeed` not `groundspeed`.

### Altitude datum

`Ft` with no qualifier means MSL (the aviation default). Annotate only when the datum is not MSL:

- `altitudeFt` - MSL implied
- `baseFtAgl` - AGL explicit
- When both MSL and AGL appear on the same type, use `FtMsl` and `FtAgl` to distinguish

### Coordinates

Use `lat` and `lon` (not `latitude` / `longitude`). These are standard in aviation and geo libraries, already universal across the codebase, and concise enough to be unambiguous.

### Angle datum (true vs magnetic)

Use a prefix qualifier, not a suffix:

- `trueHeadingDeg`, `magneticHeadingDeg`
- `trueBearingDeg`, `magneticBearingDeg`

Bare `Deg` (no qualifier) is acceptable when there is no true / magnetic distinction (e.g. `bankAngleDeg`).

### Unit type values

Unit type string literals use the same short abbreviations as property suffixes:

- `SpeedUnit = 'kt' | 'km/h' | 'mph' | 'm/s'`
- `DistanceUnit = 'nm' | 'sm' | 'km' | 'm' | 'ft'`
- `AltitudeUnit = 'ft' | 'm'`
- `AngleUnit = 'deg' | 'rad'`

### Conversion function names

Conversion functions in `@squawk/units` use full words: `knotsToKilometersPerHour`, `feetToMeters`, `nauticalMilesToKilometers`.

---

## Code style

- Always use curly braces for `if` / `else` (no inline single-line ifs).
- Use `function` declarations for named / exported functions, not `const` arrow functions.
- Always provide explicit return types on exported functions.
- Always use strict equality (`===` / `!==`), never loose equality.
- Use `import type` for type-only imports, separate from value imports.
- Avoid type assertions (`as`). Prefer optional chaining (`?.`), nullish coalescing (`??`), and type narrowing.
- Prefer `undefined` for optional values; use `null` only when explicit absence is semantically meaningful.
- Prefer returning `undefined` or a result type over throwing for expected failure cases. Reserve `throw` for truly exceptional / programmer-error scenarios.
- Prefix intentionally-unused identifiers with `_` (covered by ESLint's `no-unused-vars` config).
- Remove debug logging before considering work complete.

---

## Changeset format

Changesets live in `.changeset/*.md`. Format conventions:

- YAML frontmatter listing each affected package and bump type: `'@squawk/<pkg>': <patch|minor|major>`.
- Body grouped by `### Added`, `### Changed`, `### Fixed`, `### Removed` subheaders. Omit ones that don't apply.
- Bullets describe the user-visible effect with the why, not a description of the diff.
- When a single change touches multiple packages with related but distinct bodies, use `**@squawk/<pkg>**` bold package headers within one changeset to split the body.
- When the impacts across multiple packages are independent enough that a shared changelog entry wouldn't naturally describe them all, use multiple separate changesets instead - one per package or per logical change.

Example:

```markdown
---
'@squawk/airports': minor
'@squawk/airport-data': patch
---

### Added

- `byNearestRunway()` resolver method for fast nearest-runway lookups by position.

### Changed

- Bumped `@squawk/airport-data` snapshot to NASR cycle 2604.
```

Notes:

- Don't hand-edit `CHANGELOG.md` - changesets/action generates and overwrites it during the Version Packages PR.
- Don't manually bump caret floors on workspace deps in feature PRs. The Version Packages bot owns floor bumps inside Version Packages PRs (`updateInternalDependencies: patch` in `.changeset/config.json`); touching them in a feature PR creates merge conflicts.
- Tools workspaces (`@squawk/build-*` and `@squawk/build-shared`) are listed under `ignore` in `.changeset/config.json` and don't get changesets.
