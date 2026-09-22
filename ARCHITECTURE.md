# Architecture & Conventions

Big-picture orientation: the principles, conventions, and processes that shape the squawk monorepo and aren't obvious from reading the code or config files. For installation and the package list, see the [README](README.md). For per-package usage, see each package's own README and the published [TypeDoc site](https://neilcochran.github.io/squawk/).

---

## Contents

1. [Vision](#vision)
2. [Repository structure](#repository-structure)
3. [Architectural principles](#architectural-principles)
4. [Library conventions](#library-conventions)
5. [Data pipelines](#data-pipelines)
6. [Quality gates](#quality-gates)
7. [CI/CD overview](#cicd-overview)
8. [Release process](#release-process)
9. [Branch protection and access](#branch-protection-and-access)
10. [Dependency management](#dependency-management)
11. [Node versions](#node-versions)
12. [Security](#security)
13. [Documentation](#documentation)

---

## Vision

A monorepo of focused, well-documented TypeScript libraries covering common aviation data problems - airspace geometry, weather parsing, flight planning, and more - plus the apps that compose them. Libraries publish to npm under `@squawk/*`; each app independently decides whether it publishes too, based on its own audience.

Six guiding principles shape every decision in this repo:

- **Focused scope per package.** Each library does one thing well. Pull in another `@squawk/*` library - including one domain library depending on another - when that is the clearest way to avoid duplicating logic, and keep dependencies purposeful rather than incidental. The foundational libraries (`@squawk/types`, `@squawk/units`, `@squawk/geo`, `@squawk/search`) are the shared substrate most packages build on.
- **Real-world data.** Libraries work against actual FAA datasets and live aviation weather feeds, not mocked or synthetic data.
- **Designed for composition.** Libraries fit together naturally when building an application, and compose with each other directly when that is the cleanest design.
- **Published quality from day one.** Every library ships with a README, TypeScript types, unit tests, and a changelog.
- **Runtime-pure libraries.** Libraries are written to run in any modern JS runtime. Node-only surface is isolated to opt-in entries; server-only packages (`@squawk/mcp`, build tools) are explicitly Node-only.
- **Complete data models.** Models capture all reasonable, distinct fields for a concept, even fields not currently consumed. The libraries are published for others to build on; completeness and correctness of the data model is a primary goal.

---

## Repository structure

Three top-level buckets:

- [`apps/`](apps/) - applications built on the libraries ([`apps/atlas/`](apps/atlas/), [`apps/adsbtop/`](apps/adsbtop/), [`apps/adsbscope/`](apps/adsbscope/)); each is independently private or published to npm, and each documents the patterns specific to it in a `CONVENTIONS.md` beside its README. A new app gets one too.
- [`packages/libs/`](packages/libs/) - the published `@squawk/*` libraries. See the [README](README.md) for the full list.
- [`tools/`](tools/) - private workspaces that produce the FAA-data snapshots shipped inside the `*-data` libraries.

The workspaces themselves are declared in the root [`package.json`](package.json). Anything outside those globs (root scripts, configs, `.github/`, `.changeset/`, `assets/`) is repo-level infrastructure.

---

## Architectural principles

The decisions below explain _why_ the codebase looks the way it does. They're load-bearing - changing them affects every package.

### Publish status is a per-package decision, not a per-directory one

Whether a workspace publishes to npm is decided by that package's own `package.json` (`private: true` or omitted, plus `publishConfig`), never by whether it lives under `apps/` or `packages/libs/`. Changesets skips private packages automatically; the `ignore` list in [.changeset/config.json](.changeset/config.json) is reserved for workspaces that are never publish candidates (the `tools/build-*` data builders). Turbo runs whatever scripts a package defines for itself, so quality gates like `lint:pack` and `api:check` apply only to packages that opt into them by defining those scripts.

Why: `apps/` groups applications built on the libraries together for discoverability, but an app's audience - and therefore whether it ships to npm - is a property of that specific app, not of the directory. [`apps/atlas/`](apps/atlas/) is a private SPA meant to be run locally or self-deployed; other apps under `apps/` may publish to npm as standalone installable tools when that better serves their audience.

The corollary is that release tooling must not assume publishable packages live under one directory, in either direction: it has to reach a publishable app under `apps/`, and it must not sweep up a private one. So the Publish workflow derives the set of packages to collect from the workspace metadata via [scripts/check-publishable-dist.js](scripts/check-publishable-dist.js), rather than from directory globs that would need editing every time a workspace is added or flips its publish status.

### Logic / data separation (for dataset-backed query libraries)

For libraries that query an FAA dataset (airports, navaids, fixes, airways, airspace, procedures, icao-registry), logic and data live in separate packages. The query library contains pure query functions that take data as input via a factory function; the companion `*-data` package ships the pre-processed snapshot. **Query libraries never import data packages at runtime** (only as devDependencies, for tests).

Why: consumers can bring their own data or use the bundled snapshots. Logic stays testable without filesystem access. Data updates don't force a re-publish of the query library, and vice versa.

**Exception: icao-registry exposes a runtime parser.** [`@squawk/icao-registry`](packages/libs/icao-registry/) intentionally re-exports `parseFaaRegistryZip` from its package entrypoint, letting external consumers fetch and parse a fresh FAA ReleasableAircraft ZIP at runtime instead of (or in addition to) using the bundled `@squawk/icao-registry-data` snapshot.

Why: aircraft registration data changes daily (registrations are created, transferred, and cancelled continuously), so the gap between the bundled snapshot's publish cadence and "now" can be material for consumers building real-time tracking surfaces. The other NASR-derived datasets (airports, navaids, fixes, airways, airspace, procedures) update on the FAA's 28-day cycle, where a few weeks of staleness is rarely meaningful and the bundled-data path is sufficient. New domains should default to the build-tool-only parser pattern; expose a runtime parser only when there is a concrete data-freshness gap that the bundled cadence cannot close.

Other library shapes (utility libraries like `@squawk/units` / `@squawk/geo` / `@squawk/flight-math`, parser libraries like `@squawk/weather` / `@squawk/notams`, and `@squawk/types`) aren't data-querying and don't follow this pattern.

### Stateful, event-driven packages (for live data sources)

Every pattern in this document otherwise assumes a stateless package: a resolver queries an in-memory dataset, a parser transforms one string into one object, `@squawk/weather`'s `/fetch` layer issues one request and returns one result. [`@squawk/adsb-feed`](packages/libs/adsb-feed/) is the first package that has to stay alive, hold state, and push updates out over time rather than answer one call at a time.

The shape: a `create*Feed`-style factory returns an object that `extends EventTarget`, built by attaching plain methods directly onto a `new EventTarget()` instance (`Object.assign(new EventTarget(), { start, stop, ... })`) rather than subclassing - keeping the factory-function convention used everywhere else in the repo instead of introducing classes. Internal per-item state lives in `Map`s closed over by the factory; a periodic sweep (a plain `setInterval`) detects staleness for sources whose wire format has no explicit "removed" signal, emitting a dedicated lost/expired event rather than requiring consumers to diff snapshots themselves.

Why `EventTarget`/`CustomEvent` and not Node's `events.EventEmitter`: `EventTarget` is a global in both Node and browsers, unlike `EventEmitter`, which is Node-only. Building the engine on `EventTarget` lets a live-feed package's core logic stay browser-safe and earn a `/browser` entry like any other logic package; `EventEmitter` would quietly make the whole package Node-only. Reach for this pattern only when a package genuinely needs to represent an ongoing stream of updates over time, not for anything expressible as a one-shot call.

### Resolver / factory pattern (for query libraries)

Libraries that expose data querying or lookup operations follow a uniform shape: a `create*Resolver({ data })` factory that accepts the raw record array, builds internal `Map` indexes once at creation time, and returns a stateless query object. No network calls or filesystem access at query time. The factory shape is uniform across every query library, so once you know one resolver you know them all.

Why: indexes are built once and shared across all queries. Simpler than class hierarchies for stateless lookups.

This pattern only applies to query / lookup libraries. Utility libraries (`@squawk/units`, `@squawk/geo`, `@squawk/flight-math`) and parser libraries (`@squawk/weather`, `@squawk/notams`) don't have resolvers - they take whatever shape fits their task (typically namespace-grouped pure functions; see [Namespace exports for utility packages](#namespace-exports-for-utility-packages) below).

### Bundled snapshots loaded eagerly

Each data package bundles a gzipped snapshot (JSON or GeoJSON) containing the full typed records plus build metadata. Two entry points expose the same shape:

- The default (Node) entry reads, decompresses, and parses synchronously at module load via `node:fs` + `node:zlib`, exposing a single eager constant (`usBundled<X>`).
- The `/browser` entry exposes an async loader (`loadUsBundled<X>`) that uses `fetch` + `DecompressionStream('gzip')` so SPAs and edge runtimes consume the same shape without Node-only APIs.

Why: gzip keeps the on-disk and on-wire footprint down. Eager loading keeps query-time fast with no lazy-access overhead. The shared shape across both entries means resolver code is identical regardless of runtime.

Eagerness is a property of the data package, not of its consumers. Because importing the module decodes the whole snapshot, a consumer that wants to defer the cost defers the `import()` itself rather than reaching for a lazier accessor - which is what [`@squawk/mcp`](packages/libs/mcp/) does.

The one thing that has to stay readable without paying that cost is the snapshot's provenance, since `properties` and `records` otherwise come out of the same parse. Each data package therefore also ships a `./meta` subpath: a generated `src/meta.ts` exporting the build metadata as a plain constant, written by the same build step that writes the `.gz`. Reporting which cycle a dataset is on then costs nothing and stays isomorphic, because there is no file to read. A per-package test asserts the constant still equals the snapshot's own `properties`, so a refresh that regenerates one without the other fails in the package rather than misinforming a consumer.

### Type ownership

Types shared across multiple packages live in `@squawk/types` - position, aircraft, airport, navaid, fix, airway, procedure, airspace, registry. The default suggestion is to consider promotion to `@squawk/types` once a type has 2+ consumers across the logic / data / build-script boundary, but the threshold is a guideline rather than a hard rule (judgment call on stability, domain boundaries, and the coupling cost of moving the type). Domain-specific types live in the package that produces them - weather types in `@squawk/weather`, NOTAM types in `@squawk/notams`, etc. See `CONVENTIONS.md` dependency rule 8 for the full guidance.

Why: keeping `@squawk/types` focused on genuinely shared models avoids forcing a version bump on every package whenever a single domain's types evolve.

### Browser entries on data and logic packages

Data packages ship a `/browser` subpath with async `loadUsBundled<X>()` loaders so SPAs and edge runtimes can consume the bundled snapshots. Pure-logic query libraries (`@squawk/airports`, `@squawk/airspace`, `@squawk/airways`, `@squawk/fixes`, `@squawk/flightplan`, `@squawk/navaids`, `@squawk/procedures`) and the `@squawk/weather` parser library also expose a `/browser` subpath that aliases the main entry, since their core code has no Node-specific imports. The `/browser` import is the explicit, supported way for SPAs to consume these packages; the contract is enforced by `lint:pack` (publint) so a future Node-only import would have to split the surface explicitly rather than silently breaking browsers. [`apps/atlas/`](apps/atlas/) is the contract's in-repo consumer - every dataset it draws arrives through a `loadUsBundled<X>()` loader paired with a `/browser` resolver - so a break in the browser surface shows up in this repo's own test suite rather than only in a downstream install.

`@squawk/weather` additionally ships an opt-in `/fetch` subpath that calls the AWC text API over the global `fetch`. It runs in the browser, but AWC sends no CORS headers, so browser consumers point the `baseUrl` option at a same-origin proxy they control. The main `@squawk/weather` and `/browser` entries stay pure parsers with no network calls.

`@squawk/icao-registry` is a hybrid: the main entry exposes a runtime `parseFaaRegistryZip` parser that depends on Node's `Buffer` and the `adm-zip` package, so the `/browser` entry is a strict subset that re-exports only `createIcaoRegistry` and the shared types. `@squawk/adsb-feed` follows the same hybrid shape for a different reason: its SBS and Beast sources depend on Node's `net` module (raw TCP sockets have no browser API), so the `/browser` entry omits `createSbsAircraftFeed`, `createBeastAircraftFeed`, and the `createAircraftFeedForSource` dispatcher over all three, exposing only the HTTP-polling `createJsonAircraftFeed`.

`@squawk/mcp` and the build tools under `tools/` remain Node-only.

### Namespace exports for utility packages

`@squawk/units` and `@squawk/flight-math` group exports by namespace (`speed.knotsToMph()`, `atmosphere.densityAltitude()`).

Why: self-documenting call sites without polluting the import namespace with dozens of flat function names.

### MCP as the aggregator

[`@squawk/mcp`](packages/libs/mcp/) is the Model Context Protocol server that exposes every other package as tools for LLM clients. Tool modules live under `packages/libs/mcp/src/tools/<domain>.ts`; `src/resolvers.ts` owns one lazy accessor per dataset, each of which dynamically imports its data package, builds the resolver once, and caches it for the life of the process. Tool handlers `await` their resolver at call time rather than closing over a module-load constant, so a dataset costs nothing until something reads it. `get_dataset_status` deliberately sits outside that path: it reads each data package's `./meta` subpath, so the one tool whose job is to report data currency can answer without loading the data it describes. `@squawk/icao-registry-data` is additionally declared as an optional peer dependency so default installs stay lean - the tool catalog still lists `lookup_aircraft_by_icao_hex` when the peer is absent and returns a structured "data not installed" error pointing at the install command. Live weather fetching is the only tool surface that performs network I/O at invocation time.

Each tool module is also one toggleable group, named for its filename and listed in `src/tool-groups.ts`. Users pick groups through `SQUAWK_MCP_TOOLS` / `SQUAWK_MCP_DISABLE_TOOLS` (mutually exclusive, all groups by default) or by passing `toolGroups` to `createSquawkMcpServer`; unregistered groups never reach the client's catalog.

Why: the full catalog is 79 tools and roughly 18k tokens of context in every session, and most users want a fraction of it. Splitting the server into several npm packages would solve the same problem at a much worse cost in setup, READMEs, and version streams. A router-style `discover_tool` / `call_tool` pair was also rejected: the catalog just reappears in the discovery result, the model loses SDK schema validation and the steering that tool descriptions provide from system context, and clients that let users tick individual tools stop working. Group toggling keeps every native MCP affordance.

Toggling gates registration, and demand-driven loading makes that gate bite: a group nobody registers is a group whose tools are never called, so its snapshot is never imported. A trimmed catalog is therefore a smaller and faster process as well as a shorter tool list. A group that reads another group's data still keeps working when that other group is disabled - it loads what it needs through the same accessors.

Three non-obvious maintenance patterns hold here:

- **MCP stays in sync with its dependencies.** Any change to a package mcp consumes (or a new package that should be exposed through mcp) lands together with updates to the matching tool module, resolver wiring, README, and `packages/libs/mcp/package.json` in the same change. Intentional non-propagation is called out explicitly rather than silently skipped.
- **The pinned-version README snippet tracks the upcoming release.** When a change bumps `@squawk/mcp` to a new published version (even transitively), the pinned-version snippet in [packages/libs/mcp/README.md](packages/libs/mcp/README.md) under "Picking an install version" reflects the version that will publish from that change.
- **A new tool module is a new tool group.** Adding `src/tools/<domain>.ts` means adding `<domain>` to `TOOL_GROUP_NAMES` and wiring its registrar into `TOOL_GROUP_REGISTRARS`, which is a compile error to forget, plus a row in the README's group table. Group names track module filenames so there is nothing to look up.
- **Every dataset loads on demand; optional peers add a structured error on top.** No data package is imported at mcp module load. Each one gets an accessor in `src/resolvers.ts` that `await import(...)`s the package on first use and memoizes the in-flight promise, so concurrent handlers share one decode and one index build rather than racing to produce two. On top of that, a data package may be declared `optional: true` under `peerDependenciesMeta` when its size is disproportionate to the audience that needs it; its accessor catches `ERR_MODULE_NOT_FOUND` and surfaces a structured `MissingDataPackageError` carrying the dataset name, package name, and install command. The tool stays listed in the catalog so the LLM can offer the install instructions to the user; the rest of the server keeps running. `@squawk/icao-registry-data` is the only dataset on the optional-peer path.

---

## Library conventions

The architectural patterns for what libraries look like and how they relate to each other are above in [Architectural principles](#architectural-principles). The concrete rules - file layout, package.json shape, workspace dependency ranges, dependency rules, naming, TSDoc requirements, code style, test conventions, and changeset format - live in [CONVENTIONS.md](CONVENTIONS.md), which is the source of truth that PR review enforces.

---

## Data pipelines

The `*-data` packages each ship a gzipped snapshot (JSON or GeoJSON) derived from FAA source data. Snapshots are produced by the private workspaces under [`tools/`](tools/) and orchestrated by [`scripts/build-data.js`](scripts/build-data.js) (`npm run build:data -- --help` for usage).

Sources:

- **FAA NASR** (28-day cycle) - airports, navaids, fixes, airways, airspace.
- **FAA CIFP** (28-day cycle, ARINC 424 v18) - SID, STAR, IAP procedures.
- **FAA ReleasableAircraft** (ad-hoc) - ICAO hex to aircraft registration.

Each builder writes its output snapshot directly into the corresponding `packages/libs/<pkg>-data/data/` directory. Local copies of the source cycles live under `reference-data/` (gitignored).

The date embedded in each data package's README matches the cycle date inside the bundled JSON; [scripts/check-readme-dates.js](scripts/check-readme-dates.js) enforces this in CI, so a snapshot bump without a matching README update fails the build.

---

## Quality gates

The gates that run in [.github/workflows/ci.yml](.github/workflows/ci.yml) on every PR. They are spread across four parallel jobs - `static` (lint, knip, format), `test` (build, test + coverage), `compat` (the published packages' tests on every Node line they support), and `package` (build, pack shape, API surface, and the two README checks) - and a final `ci` job that fails unless all four succeeded:

| Gate                     | Tool                                                                                                                                    | What it covers                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint                     | typescript-eslint flat config + eslint-plugin-import + eslint-plugin-n                                                                  | Per-package `tsc --noEmit && eslint src`                                                                                                                       |
| Knip                     | knip                                                                                                                                    | Dead deps, unlisted deps, unresolved imports, orphaned files                                                                                                   |
| Format                   | prettier                                                                                                                                | `prettier --check .`                                                                                                                                           |
| Build                    | tsc (via Turborepo)                                                                                                                     | Every package compiles                                                                                                                                         |
| Test + per-file coverage | vitest                                                                                                                                  | Per-file 80% lines / functions / branches / statements                                                                                                         |
| Aggregate coverage       | [scripts/check-coverage.js](scripts/check-coverage.js)                                                                                  | Per-package and workspace-wide 90% lines / functions / branches                                                                                                |
| Pack shape               | publint + arethetypeswrong (`lint:pack`)                                                                                                | npm tarball / `exports` / types are valid (CLI-only packages run publint alone - see below)                                                                    |
| API surface              | [@microsoft/api-extractor](https://api-extractor.com/) + [scripts/check-subpath-api-coverage.js](scripts/check-subpath-api-coverage.js) | Public API surface of each tracked package matches committed `api/<pkg>.api.md`; every export subpath with a distinct `.d.ts` requires its own paired baseline |
| README data dates        | [scripts/check-readme-dates.js](scripts/check-readme-dates.js)                                                                          | Each data package README's cycle date matches its bundled snapshot                                                                                             |
| MCP pinned version       | [scripts/check-mcp-pin.js](scripts/check-mcp-pin.js)                                                                                    | `packages/libs/mcp/README.md` pin matches the projected publish version (changeset-aware)                                                                      |
| Node compatibility       | vitest, via the `compat` job matrix in [ci.yml](.github/workflows/ci.yml)                                                               | The published packages' tests pass on every Node line their `engines.node` claims                                                                              |
| Publishable build output | [scripts/check-publishable-dist.js](scripts/check-publishable-dist.js)                                                                  | Every non-private workspace has a `dist/` with JavaScript in it (Publish workflow only, both jobs)                                                             |

Four properties of the gate set:

- **The `ci` job is the required check, not the four gate jobs.** It runs with `if: always()` and compares each upstream result to `success` explicitly, because a job that is skipped when one of its `needs` fails would otherwise satisfy a required status check. Each gate job installs and builds independently; the duplicated build costs runner minutes but roughly halves wall time. Lint, build, pack, and API tasks run at `TURBO_CONCURRENCY=100%`, while `test:coverage` keeps the 50% default from [turbo.json](turbo.json) so turbo does not oversubscribe vitest's own worker pool.
- **Coverage is layered intentionally.** Vitest's `perFile: true` enforces a per-file floor; the aggregate gate is a thin post-coverage script because Vitest can't express both in one threshold block.
- **CLI-only packages run `publint` without arethetypeswrong.** [`apps/adsbtop/`](apps/adsbtop/) and [`apps/adsbscope/`](apps/adsbscope/) each ship a `bin` and no `main` / `types` / `exports`, so there is nothing for a consumer to import and attw reports every resolution as failed. publint still applies and is the part that matters for a binary - it validates the tarball and that the `bin` target exists. A package that gains an importable entrypoint should pick up the full `publint && attw` line.
- **Knip and ESLint cover different axes.** Knip handles package-level dead deps and orphaned files; ESLint handles source-level patterns. Source-level dead-export detection isn't part of the gate set.

CodeQL runs as a separate workflow; it's a required check on `main`.

---

## CI/CD overview

Seven workflows in [.github/workflows/](.github/workflows/). Every `uses:` is a full commit SHA pinned with a trailing version comment, maintained by Dependabot.

| Workflow                                     | Trigger                                                 | Purpose                                                                                |
| -------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [ci.yml](.github/workflows/ci.yml)           | PR + push to `main`                                     | The main quality gate (see above). Required check on `main`.                           |
| [codeql.yml](.github/workflows/codeql.yml)   | PR + push to `main` + weekly cron                       | Static security analysis with the `security-extended` query suite. Required on `main`. |
| [lychee.yml](.github/workflows/lychee.yml)   | PR (paths-filtered to `**/*.md`) + weekly cron + manual | Markdown link checker. Report-only; surfaces broken links in the job summary.          |
| [docs.yml](.github/workflows/docs.yml)       | After CI succeeds on `main`                             | Generate TypeDoc and deploy to GitHub Pages.                                           |
| [version.yml](.github/workflows/version.yml) | Push to `main`                                          | Open or update the "Version Packages" PR when changesets are pending.                  |
| [publish.yml](.github/workflows/publish.yml) | After CI succeeds on `main` + manual                    | Publish to npm once no changesets are pending (see next section).                      |
| [mirror.yml](.github/workflows/mirror.yml)   | Every push + daily cron + manual                        | Mirror all branches and tags to the GitLab backup mirror. Uses no marketplace actions. |

A few non-obvious properties of these workflows that the YAML doesn't make immediately clear:

- **Workflows gated on `workflow_run` check out `${{ github.event.workflow_run.head_sha }}`**, not the current HEAD of `main`. The deploy / publish operates on the exact commit CI validated, not a slightly later commit. For workflows that also support `workflow_dispatch`, the fallback is `github.sha`.
- **The publish job is gated by the `production-publish` GitHub Environment.** After the build job uploads dist artifacts, the publish job pauses for one-tap manual approval from a required reviewer before running `changesets/action`. The build job is not gated, so a stuck approval does not waste a runner re-running the build later. The environment also restricts deployments to protected branches, so a `workflow_dispatch` from an unprotected branch cannot bypass the gate.
- **Opening the "Version Packages" PR does not wait on CI or on approval.** [version.yml](.github/workflows/version.yml) runs on the push to `main`, in parallel with CI, because opening a PR releases nothing: the PR still has to pass the required checks and review. Its job runs in the `release-pr` environment, which has no required reviewers but restricts deployments to protected branches, and it holds no `id-token` permission, so it cannot publish. Both release workflows start with a `pending` job that looks for `.changeset/*.md` files: version.yml proceeds only when there are some, publish.yml only when there are none.
- **Lychee is intentionally not a required check.** Broken links from upstream reorganization shouldn't block PRs. Findings are visible in the job summary.
- **The lychee cron runs at Mon 06:37 UTC, just after CodeQL's 05:17 slot**, to avoid runner contention.
- **Excludes for the link checker live in [lychee.toml](lychee.toml)**, not in the workflow's args, so they apply to local `lychee` runs too.

---

## Release process

Releases are driven by [Changesets](https://github.com/changesets/changesets) and a custom GitHub App (`squawk-release-bot`). The flow has more moving parts than a typical "tag and push" pipeline.

### Why a custom GitHub App

Two reasons the publish flow uses `squawk-release-bot` instead of the default `GITHUB_TOKEN`:

1. **Downstream workflow triggering.** PRs opened by the default `github-actions[bot]` don't retrigger workflows when merged - GitHub blocks that path to prevent recursion. PRs opened with a custom App's installation token do. The App's token is what allows the merged "Version Packages" PR to retrigger CI, which then retriggers Publish, which then runs `npm publish`.
2. **Auditable scoped permissions.** App permissions (read/write on contents, pull-requests, etc.) are explicit in the App settings and easy to audit, vs. the broader umbrella permission of the default token.

The App's credentials are split between a repo variable and an environment secret: `RELEASE_APP_CLIENT_ID` (variable, since the Client ID is the public half of the OAuth pair) and `RELEASE_APP_PRIVATE_KEY` (secret). The private key is stored on the `release-pr` and `production-publish` environments rather than at repo level, so only a job that declares one of those environments - both restricted to protected branches - can read it. The Version Packages and Publish workflows each mint a short-lived installation token from the pair via [actions/create-github-app-token](https://github.com/actions/create-github-app-token).

Commits inside the "Version Packages" PR, and the release commits and tags changesets/action pushes after publish, are attributed to the App: changesets/action pushes via the GitHub API by default (`push-with-git-cli: false`), signing with GitHub's GPG key and attributing to whichever identity owns the `github-token` input passed to it - the App's installation token, not the default `GITHUB_TOKEN`.

### End-to-end flow

```
[1] Dev opens a feature PR
        |- Adds a .changeset/<some-name>.md describing the change
        |- CI runs (lint, build, test, coverage, etc.)
        '- Reviewer merges to main

[2] The push to main starts two workflows side by side
        |- ci.yml runs the quality gates on the merge commit
        '- version.yml finds pending changesets in .changeset/
             (squawk-release-bot, release-pr env, no approval, no OIDC)
             |- Mints an App installation token
             |- npm install -g npm@11.12, npm ci --ignore-scripts
             '- changesets/action opens or updates a "Version Packages"
                PR on branch changeset-release/main, consuming the
                changesets and bumping versions + writing CHANGELOG.md
                entries. PR author: app/squawk-release-bot.

[3] CI succeeds on main and triggers publish.yml via workflow_run
        '- Its pending job sees the changesets are still there and
           skips the build and publish jobs. Nothing to approve.

[4] Reviewer merges the Version Packages PR once its checks pass
        '- The push starts ci.yml and version.yml again; version.yml
           finds no pending changesets and stops after its pending job.

[5] CI succeeds on main and triggers publish.yml via workflow_run
        '- Its pending job finds no changesets, so the release proceeds

[6] publish.yml build job runs (no secrets)
        |- Checks out workflow_run.head_sha
        |- npm ci --ignore-scripts, npm run build
        |- Verifies every publishable workspace has build output
        '- Tars each publishable workspace's dist into one artifact

[7] publish.yml publish job runs (squawk-release-bot, production-publish env)
        |- Pauses for one-tap approval
        |- Mints an App installation token
        |- Checks out workflow_run.head_sha
        |- npm install -g npm@11.12, npm ci --ignore-scripts
        |- Downloads dist artifact
        |- Re-verifies every publishable workspace has build output
        '- changesets/action runs `npm run publish` (`changeset publish`)
           -> publishes every bumped package to npm with provenance
              (npm Trusted Publisher OIDC + NPM_CONFIG_PROVENANCE=true env)
```

A merge to `main` that carries no changeset (docs, tooling) also reaches steps 5-7: `changeset publish` finds every version already on npm and publishes nothing.

The Publish workflow also has `workflow_dispatch` for manual triggering when needed. A manual run while changesets are pending skips the release the same way step 3 does.

### Authoring a changeset

`npx changeset` is the interactive entry point. The format and tone conventions live in [CONVENTIONS.md](CONVENTIONS.md#changeset-format); existing entries in [.changeset/](.changeset/) show real examples.

The full configuration is in [.changeset/config.json](.changeset/config.json). A few non-obvious settings:

- `access: public` - all `@squawk/*` libraries publish publicly to npm.
- `updateInternalDependencies: patch` - when a workspace bumps, its internal dependents get a patch bump automatically and their caret floors get bumped during the version step.
- `ignore: [...]` - the private `tools/build-*` workspaces are excluded from versioning since they're not published.

### CHANGELOG.md is generated

`CHANGELOG.md` files are not edited manually - changesets/action owns them.

---

## Branch protection and access

Two GitHub Rulesets target `main`:

- **"Main - PR + Approval"** - PR required + 1 approval, code-owner review required ([CODEOWNERS](.github/CODEOWNERS) routes everything to `@neilcochran`), dismiss stale reviews on push, conversation resolution required. Bypass: `Repository admin` role with `pull_request` mode (closest available human-bypasser on personal repos; per-username actors are org-only).
- **"Main - Required Checks"** - blocks force pushes, restricts deletions, requires two status checks to pass, with branches up to date before merging: `ci` (the final job in [ci.yml](.github/workflows/ci.yml), reported by GitHub Actions) and `CodeQL` (the code scanning result, reported by GitHub Advanced Security and shown in the PR UI as "Code scanning results / CodeQL"). The `Analyze` job in [codeql.yml](.github/workflows/codeql.yml) is not required directly, but the `CodeQL` result only appears once that job uploads its analysis. Lychee is intentionally not on the list.

---

## Dependency management

[Dependabot](.github/dependabot.yml) runs daily on two ecosystems:

- **npm** - patch and minor updates grouped into `dev-dependencies` and `production-dependencies` PRs; majors open per package. `open-pull-requests-limit: 20` so backlog flushes (e.g. after a `dependabot.yml` edit) don't get truncated to the default cap of 5.
- **github-actions** - all action SHA bumps grouped into one PR, since dribbling them out individually is noise.

Both ecosystems carry a 7-day `cooldown`: Dependabot withholds an update until the release is at least a week old, giving a malicious publish time to be detected and yanked before it can reach a PR. Security updates are exempt from the cooldown and still open immediately.

The same window is enforced at install time by `min-release-age=7` in the root [.npmrc](.npmrc): npm 11.10+ refuses to resolve onto a dependency version published less than a week ago, covering the manual `npm install` path on a developer machine that the Dependabot cooldown does not reach. It is a no-op for `npm ci` (which installs the locked tree without resolving) and is silently ignored by older npm, so CI and the publish flow are unaffected. A single install can opt out with `npm install <pkg> --min-release-age=0`.

Every workflow `uses:` is a full commit SHA followed by a trailing `# v<x.y.z>` comment. Dependabot keeps both in sync; manual edits to one without the other drift the comment from the SHA.

---

## Node versions

Two floors, moved for different reasons:

| Floor           | Declared in                                                                                                              | Now    | Moves when                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| **Published**   | `engines.node` of the 28 published packages                                                                              | `>=22` | A library needs a newer API, or the floor reaches EOL. Not when a new LTS ships - that breaks consumers for nothing |
| **Development** | `engines.node` of the root, every `tools/*` (what `scripts/*` resolves against), and `apps/atlas`, plus [.nvmrc](.nvmrc) | `>=24` | A newer line reaches Active LTS. Never the Current line                                                             |

[.nvmrc](.nvmrc) is the single source of truth for the development floor: every CI job except the `compat` matrix reads it through `node-version-file`.

Ranges are open-ended (`">=24"`), never enumerated (`"^22 || ^24"`), which would mark the Current releases unsupported where the code runs fine and mean editing every manifest each time a major lands.

Neither floor is taken on trust. `n/no-unsupported-features/node-builtins` fails the build when code reaches past its own package's `engines.node`, and the `compat` matrix in [ci.yml](.github/workflows/ci.yml) runs the published packages' tests on every line they claim. Move a floor, move the matrix.

---

## Security

Findings reach the repo through three channels:

- **CodeQL** - PR + push to `main` + weekly cron (`.github/workflows/codeql.yml`). Required check on `main`.
- **Dependabot vulnerability alerts** - native GitHub feature, opens PRs for vulnerable transitive deps alongside the regular daily update cycle.
- **Manual issue tracking** - the security-finding template at [.github/ISSUE_TEMPLATE/security-finding.md](.github/ISSUE_TEMPLATE/security-finding.md).

Published packages ship with npm provenance attestations: the Publish workflow sets `NPM_CONFIG_PROVENANCE: true` and grants `id-token: write`, so each tarball on npm carries a verifiable link back to the GitHub Actions run that produced it.

Beyond provenance, the publish flow is hardened against supply-chain compromise:

- **npm Trusted Publisher (OIDC).** No long-lived `NPM_TOKEN` exists. The publish job exchanges a short-lived GitHub OIDC token (`id-token: write` + `npm@11.12`) for a per-run publish credential scoped to packages whose Trusted Publisher config matches this repo + workflow filename. Every `@squawk/*` package additionally has "Require two-factor authentication and disallow tokens" set on npm.
- **`--ignore-scripts` on every `npm ci`.** All five workflows that install dependencies (ci, codeql, docs, version, publish) pass `--ignore-scripts` to neutralise prepare/postinstall script vectors.
- **Build/publish job split.** The build job (`contents: read`, no secrets) produces the dist artifact; the publish job downloads the artifact and is the only job that holds OIDC permissions. The App token is also minted by the version job in [version.yml](.github/workflows/version.yml), which can open a PR but has no `id-token` permission and no path to npm. The publish job deliberately never runs `npm run build`, so the dist artifact is the sole source of build output at publish time - any publishable workspace missing from it would otherwise publish as a tarball containing nothing but `package.json` and `README.md`. The artifact is therefore built from the publishable-workspace list rather than directory globs, and [scripts/check-publishable-dist.js](scripts/check-publishable-dist.js) re-runs after the download to make that failure loud instead of silent. Bundling through `tar` also keeps the `bin` entry's executable bit, which the artifact upload's zip step would drop.
- **Curated Actions allowlist + SHA pinning.** Repo Actions settings allow only `actions/*` (via the GitHub-authored toggle), `changesets/action@*`, and `lycheeverse/lychee-action@*`. "Require actions to be pinned to a full-length commit SHA" is enforced; Dependabot keeps the trailing version comments in sync.

The disclosure process for vulnerability reports lives in [SECURITY.md](SECURITY.md). The repo is a one-maintainer project, so response times are measured in days rather than hours.

---

## Documentation

The public docs site is generated by [TypeDoc](https://typedoc.org/) directly from the libraries' TSDoc comments and deployed to GitHub Pages by [docs.yml](.github/workflows/docs.yml) on every successful CI run on `main`. Configuration is in [typedoc.json](typedoc.json).

Live site: <https://neilcochran.github.io/squawk/>.

Design rationale for notable decisions is captured in the [Design notes category of Discussions](https://github.com/neilcochran/squawk/discussions/categories/design-notes) - the audit trail for "why" context that the codebase and this document do not preserve on their own.

---
