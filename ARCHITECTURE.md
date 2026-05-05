# Architecture & Conventions

Big-picture orientation: the principles, conventions, and processes that shape the squawk monorepo and aren't obvious from reading the code or config files. For installation and the package list, see the [README](README.md). For per-package usage, see each package's own README and the published [TypeDoc site](https://neilcochran.github.io/squawk/).

---

## Contents

1. [Vision](#vision)
2. [Repository structure](#repository-structure)
3. [Architectural principles](#architectural-principles)
4. [Library conventions](#library-conventions)
5. [Atlas at a glance](#atlas-at-a-glance)
6. [Data pipelines](#data-pipelines)
7. [Quality gates](#quality-gates)
8. [CI/CD overview](#cicd-overview)
9. [Release process](#release-process)
10. [Branch protection and access](#branch-protection-and-access)
11. [Dependency management](#dependency-management)
12. [Security](#security)
13. [Documentation](#documentation)

---

## Vision

A monorepo of focused, well-documented Node.js / TypeScript libraries covering common aviation data problems - airspace geometry, weather parsing, flight planning, and more - plus the apps that compose them. Libraries publish to npm under `@squawk/*`; apps are private.

Five guiding principles shape every decision in this repo:

- **Focused scope per package.** Each library does one thing well. No library should have to know about another to function. Shared types are the only acceptable cross-dependency.
- **Real-world data, not toy examples.** Libraries work against actual FAA datasets and live aviation weather feeds, not mocked or synthetic data.
- **Designed for composition.** Libraries fit together naturally when building an application, but never require each other.
- **Published quality from day one.** Every library ships with a README, TypeScript types, unit tests, and a changelog. No "I'll clean this up before publishing."
- **Backend-first for libraries; data packages and most logic packages also ship browser entries.** Libraries target Node first and stay pure. Data packages expose a `/browser` async loader so SPAs and edge runtimes can consume them, and pure-logic query libraries (airports, airspace, airways, fixes, navaids, procedures) expose a `/browser` resolver entry that mirrors the main entry. Packages that include a Node-only surface ship a slim `/browser` entry that excludes it (`@squawk/icao-registry/browser` omits `parseFaaRegistryZip`). Server-only packages like `@squawk/mcp` and the build tools remain Node-only.
- **Complete data models.** Models capture all reasonable, distinct fields for a concept, even fields not currently consumed. The libraries are published for others to build on; completeness and correctness of the data model is a primary goal.

---

## Repository structure

Three top-level buckets:

- [`apps/`](apps/) - private applications built on the libraries (currently just [`apps/atlas/`](apps/atlas/)).
- [`packages/libs/`](packages/libs/) - the published `@squawk/*` libraries. See the [README](README.md) for the full list.
- [`tools/`](tools/) - private workspaces that produce the FAA-data snapshots shipped inside the `*-data` libraries.

The workspaces themselves are declared in the root [`package.json`](package.json). Anything outside those globs (root scripts, configs, `.github/`, `.changeset/`, `assets/`) is repo-level infrastructure.

---

## Architectural principles

The decisions below explain _why_ the codebase looks the way it does. They're load-bearing - changing them affects every package.

### Logic / data separation (for dataset-backed query libraries)

For libraries that query an FAA dataset (airports, navaids, fixes, airways, airspace, procedures, icao-registry), logic and data live in separate packages. The query library contains pure query functions that take data as input via a factory function; the companion `*-data` package ships the pre-processed snapshot. **Query libraries never import data packages at runtime** (only as devDependencies, for tests).

Why: consumers can bring their own data or use the bundled snapshots. Logic stays testable without filesystem access. Data updates don't force a re-publish of the query library, and vice versa.

**Exception: icao-registry exposes a runtime parser.** [`@squawk/icao-registry`](packages/libs/icao-registry/) intentionally re-exports `parseFaaRegistryZip` from its package entrypoint, letting external consumers fetch and parse a fresh FAA ReleasableAircraft ZIP at runtime instead of (or in addition to) using the bundled `@squawk/icao-registry-data` snapshot.

Why: aircraft registration data changes daily (registrations are created, transferred, and cancelled continuously), so the gap between the bundled snapshot's publish cadence and "now" can be material for consumers building real-time tracking surfaces. The other NASR-derived datasets (airports, navaids, fixes, airways, airspace, procedures) update on the FAA's 28-day cycle, where a few weeks of staleness is rarely meaningful and the bundled-data path is sufficient. New domains should default to the build-tool-only parser pattern; expose a runtime parser only when there is a concrete data-freshness gap that the bundled cadence cannot close.

Other library shapes (utility libraries like `@squawk/units` / `@squawk/geo` / `@squawk/flight-math`, parser libraries like `@squawk/weather` / `@squawk/notams`, and `@squawk/types`) aren't data-querying and don't follow this pattern.

### Resolver / factory pattern (for query libraries)

Libraries that expose data querying or lookup operations follow a uniform shape: a `create*Resolver({ data })` factory that accepts the raw record array, builds internal `Map` indexes once at creation time, and returns a stateless query object. No network calls or filesystem access at query time. The factory shape is uniform across every query library, so once you know one resolver you know them all.

Why: indexes are built once and shared across all queries. Simpler than class hierarchies for stateless lookups.

This pattern only applies to query / lookup libraries. Utility libraries (`@squawk/units`, `@squawk/geo`, `@squawk/flight-math`) and parser libraries (`@squawk/weather`, `@squawk/notams`) don't have resolvers - they take whatever shape fits their task (typically namespace-grouped pure functions; see [Namespace exports for utility packages](#namespace-exports-for-utility-packages) below).

### Bundled snapshots loaded eagerly

Each data package bundles a gzipped JSON snapshot containing the full typed records plus build metadata. Two entry points expose the same shape:

- The default (Node) entry reads, decompresses, and parses synchronously at module load via `node:fs` + `node:zlib`, exposing a single eager constant (`usBundled<X>`).
- The `/browser` entry exposes an async loader (`loadUsBundled<X>`) that uses `fetch` + `DecompressionStream('gzip')` so SPAs and edge runtimes consume the same shape without Node-only APIs.

Why: gzip keeps the on-disk and on-wire footprint down. Eager loading keeps query-time fast with no lazy-access overhead. The shared shape across both entries means resolver code is identical regardless of runtime.

### Type ownership

Types shared across multiple packages live in `@squawk/types` - position, aircraft, airport, navaid, fix, airway, procedure, airspace, registry. The default suggestion is to consider promotion to `@squawk/types` once a type has 2+ consumers across the logic / data / build-script boundary, but the threshold is a guideline rather than a hard rule (judgment call on stability, domain boundaries, and the coupling cost of moving the type). Domain-specific types live in the package that produces them - weather types in `@squawk/weather`, NOTAM types in `@squawk/notams`, etc. See `CONVENTIONS.md` dependency rule 8 for the full guidance.

Why: keeping `@squawk/types` focused on genuinely shared models avoids forcing a version bump on every package whenever a single domain's types evolve.

### Browser entries on data and logic packages

Data packages ship a `/browser` subpath with async `loadUsBundled<X>()` loaders so SPAs and edge runtimes can consume the bundled snapshots. Pure-logic query libraries (`@squawk/airports`, `@squawk/airspace`, `@squawk/airways`, `@squawk/fixes`, `@squawk/navaids`, `@squawk/procedures`) also expose a `/browser` subpath that aliases the main entry, since their resolver code has no Node-specific imports. The `/browser` import is the explicit, supported way for SPAs to consume these packages; the contract is enforced by `lint:pack` (publint) so a future Node-only import would have to split the surface explicitly rather than silently breaking browsers.

`@squawk/icao-registry` is a hybrid: the main entry exposes a runtime `parseFaaRegistryZip` parser that depends on Node's `Buffer` and the `adm-zip` package, so the `/browser` entry is a strict subset that re-exports only `createIcaoRegistry` and the shared types.

`@squawk/mcp` and the build tools under `tools/` remain Node-only.

### Namespace exports for utility packages

`@squawk/units` and `@squawk/flight-math` group exports by namespace (`speed.knotsToMph()`, `atmosphere.densityAltitude()`).

Why: self-documenting call sites without polluting the import namespace with dozens of flat function names.

### MCP as the aggregator

[`@squawk/mcp`](packages/libs/mcp/) is the Model Context Protocol server that exposes every other package as tools for LLM clients. Tool modules live under `packages/libs/mcp/src/tools/<domain>.ts`; resolvers are constructed once by `src/resolvers.ts` and reused. The bundled aircraft registry is loaded lazily on first lookup to keep cold-start cheap. Live weather fetching is the only tool surface that performs network I/O at invocation time.

Two non-obvious maintenance patterns hold here:

- **MCP stays in sync with its dependencies.** Any change to a package mcp consumes (or a new package that should be exposed through mcp) lands together with updates to the matching tool module, resolver wiring, README, and `packages/libs/mcp/package.json` in the same change. Intentional non-propagation is called out explicitly rather than silently skipped.
- **The pinned-version README snippet tracks the upcoming release.** When a change bumps `@squawk/mcp` to a new published version (even transitively), the pinned-version snippet in [packages/libs/mcp/README.md](packages/libs/mcp/README.md) under "Picking an install version" reflects the version that will publish from that change.

---

## Library conventions

The architectural patterns for what libraries look like and how they relate to each other are above in [Architectural principles](#architectural-principles). The concrete rules - file layout, package.json shape, workspace dependency ranges, dependency rules, naming, TSDoc requirements, code style, test conventions, and changeset format - live in [CONVENTIONS.md](CONVENTIONS.md), which is the source of truth that PR review enforces.

---

## Atlas at a glance

[`apps/atlas/`](apps/atlas/) is the chart-first SPA viewer (`squawk-atlas`, private). The atlas [README](apps/atlas/README.md) covers the user-facing surface, current feature set, stack, and known rough edges. The conventions captured here describe how the code is organized.

Atlas does not extend [tsconfig.base.json](tsconfig.base.json) - it has framework-specific TS settings (jsx, DOM lib, Bundler resolution, noEmit) the lib base doesn't carry. It has its own [eslint.config.js](apps/atlas/eslint.config.js) with React / JSX / a11y rules. The cross-cutting code conventions above still apply.

App-specific principles:

- **State-first URL design.** Every persisted piece of UI state lives in the URL, validated by zod with both `.default()` (initial value) and `.catch()` (fallback for stale share-links). Component state is reserved for genuinely transient interaction (hover, last-click snapshot). Stale share-links never error - they fall back.
- **Pure helpers separated from JSX.** Anything that doesn't return JSX or close over component state lives in a `.ts` sibling, not the `.tsx`. Keeps logic unit-testable without a render harness.
- **Module-level cached promises for shared data loads.** The data-package `/browser` loaders are wrapped in module-level cached promises, so N components subscribing to a dataset trigger one fetch.
- **Tiny pub/sub buses for cross-tree side effects.** When the shell needs to trigger something inside a mode (e.g. "reset the chart view"), the pattern is a module-level pub/sub bus + a `<Listener />` component, not a callback drilled through React props or state lifted into the shell. Decouples the shell from each mode's internal API.
- **Tailwind primitives over class-composition helpers.** Repeated UI shapes (3+ consumers) get extracted as React components in `shared/ui/`. Recurring class clusters that can't be wrapped (Radix `className` props, third-party widgets) become string constants in `shared/styles/style-tokens.ts`. No `@apply` in `index.css` - it fights Tailwind v4's IntelliSense and tree-shaking.
- **Chart colors as typed TS constants.** MapLibre paint properties can't read CSS custom properties at runtime, so chart-domain colors live in `shared/styles/chart-colors.ts` rather than as Tailwind classes or CSS variables.
- **Mobile-first responsive.** One breakpoint (`md:`, 768px) divides phone from desktop. Touch targets >= 44px on mobile. The inspector pivots to a bottom sheet on phones; hover preview is gated on `(hover: hover)` so taps don't synthesize flicker.

---

## Data pipelines

The `*-data` packages each ship a gzipped JSON snapshot derived from FAA source data. Snapshots are produced by the private workspaces under [`tools/`](tools/) and orchestrated by [`scripts/build-data.js`](scripts/build-data.js) (`npm run build:data -- --help` for usage).

Sources:

- **FAA NASR** (28-day cycle) - airports, navaids, fixes, airways, airspace.
- **FAA CIFP** (28-day cycle, ARINC 424 v18) - SID, STAR, IAP procedures.
- **FAA ReleasableAircraft** (ad-hoc) - ICAO hex to aircraft registration.

Each builder writes its output snapshot directly into the corresponding `packages/libs/<pkg>-data/data/` directory. Local copies of the source cycles live under `reference-data/` (gitignored).

The date embedded in each data package's README matches the cycle date inside the bundled JSON; [scripts/check-readme-dates.js](scripts/check-readme-dates.js) enforces this in CI, so a snapshot bump without a matching README update fails the build.

---

## Quality gates

The gates that run in [.github/workflows/ci.yml](.github/workflows/ci.yml) on every PR:

| Gate                     | Tool                                                                   | What it covers                                                     |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Lint                     | typescript-eslint flat config + eslint-plugin-import + eslint-plugin-n | Per-package `tsc --noEmit && eslint src`                           |
| Knip                     | knip                                                                   | Dead deps, unlisted deps, unresolved imports, orphaned files       |
| Format                   | prettier                                                               | `prettier --check .`                                               |
| Build                    | tsc (via Turborepo)                                                    | Every package compiles                                             |
| Test + per-file coverage | vitest                                                                 | Per-file 80% lines / functions / branches / statements             |
| Aggregate coverage       | [scripts/check-coverage.js](scripts/check-coverage.js)                 | Per-package and workspace-wide 90% lines / functions / branches    |
| Pack shape               | publint + arethetypeswrong (`lint:pack`)                               | npm tarball / `exports` / types are valid                          |
| README data dates        | [scripts/check-readme-dates.js](scripts/check-readme-dates.js)         | Each data package README's cycle date matches its bundled snapshot |

Two properties of the gate set:

- **Coverage is layered intentionally.** Vitest's `perFile: true` enforces a per-file floor; the aggregate gate is a thin post-coverage script because Vitest can't express both in one threshold block.
- **Knip and ESLint cover different axes.** Knip handles package-level dead deps and orphaned files; ESLint handles source-level patterns. Source-level dead-export detection isn't part of the gate set.

CodeQL runs as a separate workflow; it's a required check on `main`.

---

## CI/CD overview

Five workflows in [.github/workflows/](.github/workflows/). Every `uses:` is a full commit SHA pinned with a trailing version comment, maintained by Dependabot.

| Workflow                                     | Trigger                                                 | Purpose                                                                                |
| -------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [ci.yml](.github/workflows/ci.yml)           | PR + push to `main`                                     | The main quality gate (see above). Required check on `main`.                           |
| [codeql.yml](.github/workflows/codeql.yml)   | PR + push to `main` + weekly cron                       | Static security analysis with the `security-extended` query suite. Required on `main`. |
| [lychee.yml](.github/workflows/lychee.yml)   | PR (paths-filtered to `**/*.md`) + weekly cron + manual | Markdown link checker. Report-only; surfaces broken links in the job summary.          |
| [docs.yml](.github/workflows/docs.yml)       | After CI succeeds on `main`                             | Generate TypeDoc and deploy to GitHub Pages.                                           |
| [publish.yml](.github/workflows/publish.yml) | After CI succeeds on `main` + manual                    | Run the changesets-driven release flow (see next section).                             |

A few non-obvious properties of these workflows that the YAML doesn't make immediately clear:

- **Workflows gated on `workflow_run` check out `${{ github.event.workflow_run.head_sha }}`**, not the current HEAD of `main`. The deploy / publish operates on the exact commit CI validated, not a slightly later commit. For workflows that also support `workflow_dispatch`, the fallback is `github.sha`.
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

The App's credentials live in two repo secrets, `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY`. The Publish workflow mints a short-lived installation token from them via [actions/create-github-app-token](https://github.com/actions/create-github-app-token).

Even though the App opens the "Version Packages" PR, the commits inside that PR show `github-actions[bot]` as author. The changesets/action library hardcodes the commit author independent of the token used; this is cosmetic.

### End-to-end flow

```
[1] Dev opens a feature PR
        |- Adds a .changeset/<random-name>.md describing the change
        |- CI runs (lint, build, test, coverage, etc.)
        '- Reviewer merges to main

[2] CI runs on main
        '- On success, triggers publish.yml via workflow_run

[3] publish.yml runs (squawk-release-bot)
        |- Mints an App installation token
        |- Checks out workflow_run.head_sha
        |- npm ci, npm run build
        '- Hands off to changesets/action

[4] changesets/action behavior depends on whether pending changesets exist
        |- Pending changesets in .changeset/?
        |    '- Open or update a "Version Packages" PR on branch
        |       changeset-release/main, consuming the changesets
        |       and bumping versions + writing CHANGELOG.md entries.
        |       PR author: app/squawk-release-bot.
        |
        '- No pending changesets (Version Packages PR already merged)?
             '- Run `npm run publish` (`changeset publish`)
                -> publishes every bumped package to npm with provenance
                   (NPM_TOKEN secret + NPM_CONFIG_PROVENANCE=true env)

[5] Reviewer merges the Version Packages PR
        '- CI runs on the merge commit, publish.yml retriggers,
           step 4 takes the publish branch this time.
```

The Publish workflow also has `workflow_dispatch` for manual triggering when needed.

### Authoring a changeset

`npx changeset` is the interactive entry point. The format and tone conventions live in [CONVENTIONS.md](CONVENTIONS.md#changeset-format); existing entries in [.changeset/](.changeset/) show real examples.

The full configuration is in [.changeset/config.json](.changeset/config.json). A few non-obvious settings:

- `access: public` - all `@squawk/*` libraries publish publicly to npm.
- `updateInternalDependencies: patch` - when a workspace bumps, its internal dependents get a patch bump automatically and their caret floors get bumped during the version step.
- `ignore: [...]` - the private `tools/build-*` workspaces are excluded from versioning since they're not published.

### CHANGELOG.md is generated

`CHANGELOG.md` files are not edited manually - changesets/action owns them. Manual edits get overwritten on the next bot run.

---

## Branch protection and access

Two GitHub Rulesets target `main`:

- **"Main - PR + Approval"** - PR required + 1 approval, code-owner review required ([CODEOWNERS](.github/CODEOWNERS) routes everything to `@neilcochran`), dismiss stale reviews on push, conversation resolution required. Bypass: `Repository admin` role with `pull_request` mode (closest available human-bypasser on personal repos; per-username actors are org-only).
- **"Main - Required Checks"** - blocks force pushes, restricts deletions, requires `ci`, `Code scanning results / CodeQL`, and `CodeQL / Analyze (pull_request)` to pass. Lychee is intentionally not on the list.

---

## Dependency management

[Dependabot](.github/dependabot.yml) runs weekly on two ecosystems:

- **npm** - one PR per package, `open-pull-requests-limit: 20` so backlog flushes (e.g. after a `dependabot.yml` edit) don't get truncated to the default cap of 5.
- **github-actions** - all action SHA bumps grouped into one PR per week, since dribbling them out individually is noise.

Every workflow `uses:` is a full commit SHA followed by a trailing `# v<x.y.z>` comment. Dependabot keeps both in sync; manual edits to one without the other drift the comment from the SHA.

---

## Security

Findings reach the repo through three channels:

- **CodeQL** - PR + push to `main` + weekly cron (`.github/workflows/codeql.yml`). Required check on `main`.
- **Dependabot vulnerability alerts** - native GitHub feature, opens PRs for vulnerable transitive deps alongside the regular weekly update cycle.
- **Manual issue tracking** - the security-finding template at [.github/ISSUE_TEMPLATE/security-finding.md](.github/ISSUE_TEMPLATE/security-finding.md).

Published packages ship with npm provenance attestations: the Publish workflow sets `NPM_CONFIG_PROVENANCE: true` and grants `id-token: write`, so each tarball on npm carries a verifiable link back to the GitHub Actions run that produced it.

The disclosure process for vulnerability reports lives in [SECURITY.md](SECURITY.md). The repo is a one-maintainer project, so response times are measured in days rather than hours.

---

## Documentation

The public docs site is generated by [TypeDoc](https://typedoc.org/) directly from the libraries' TSDoc comments and deployed to GitHub Pages by [docs.yml](.github/workflows/docs.yml) on every successful CI run on `main`. Configuration is in [typedoc.json](typedoc.json).

Live site: <https://neilcochran.github.io/squawk/>.

---
