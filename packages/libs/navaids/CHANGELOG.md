# @squawk/navaids

## 0.4.0

### Minor Changes

- 504124c: ### Added
  - `/browser` exports subpath on every query logic package. SPAs and edge runtimes can now `import { create<X>Resolver } from '@squawk/<pkg>/browser'` and pair it with the matching `@squawk/<pkg>-data/browser` async loader for zero-config browser usage. Browser support was already implicit since the resolver factories have no Node-specific imports; the new entry makes it an explicit, `publint`-verified part of the public API surface, so a future Node-only import would have to split the surface intentionally rather than silently breaking SPA bundles.
  - For `@squawk/icao-registry`, the `/browser` entry is a strict subset that re-exports `createIcaoRegistry` and the shared types but omits `parseFaaRegistryZip`. The parser depends on Node's `Buffer` and the `adm-zip` package and remains exported from the default entry for Node consumers that want fresh FAA registry data.
  - The default (Node) entry on every package is unchanged; existing imports keep working.

## 0.3.5

### Patch Changes

- b9ff30c: ### Fixed
  - Fix the broken MIT license badge link in every package README. The relative path was one level too shallow, so on GitHub (and on npm renderers that resolve relative paths against the repo) the badge landed on a non-existent `packages/LICENSE.md` instead of the repo's `LICENSE.md`. The badge now resolves correctly.
  - Fix the broken `Documentation` link in `@squawk/flight-math`'s README. The typedoc URL slug used an underscore (`_squawk_flight_math.html`) instead of the dash form every sibling README uses (`_squawk_flight-math.html`), returning 404. Now points at the live docs page.

- Updated dependencies [b9ff30c]
  - @squawk/geo@0.4.2
  - @squawk/types@0.7.2

## 0.3.4

### Patch Changes

- Updated dependencies [2ac2985]
  - @squawk/geo@0.4.0

## 0.3.3

### Patch Changes

- b47b118: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

- Updated dependencies [b47b118]
  - @squawk/geo@0.3.3
  - @squawk/types@0.7.1

## 0.3.2

### Patch Changes

- Updated dependencies [32f4925]
  - @squawk/types@0.7.0
  - @squawk/geo@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [15fa9cf]
  - @squawk/types@0.6.0
  - @squawk/geo@0.3.1

## 0.3.0

### Minor Changes

- ff22bd5: Bump `@squawk/types` peer dependency to `^0.4.0` for the procedures CIFP migration. No behavioral changes.

### Patch Changes

- Updated dependencies [ff22bd5]
- Updated dependencies [ff22bd5]
  - @squawk/geo@0.3.0
  - @squawk/types@0.5.0

## 0.2.4

### Patch Changes

- a4ba760: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [a4ba760]
  - @squawk/types@0.3.1
  - @squawk/geo@0.2.1

## 0.2.3

### Patch Changes

- 58257db: ### Added
  - `@squawk/geo` package for shared geospatial utilities, grouping exports into `greatCircle` (`distanceNm`, `bearing`, `bearingAndDistance`, `midpoint`, `destination`) and `polygon` (`pointInPolygon`, `boundingBox`, `pointInBoundingBox`) namespaces. `greatCircle.midpoint` and `greatCircle.destination` are new capabilities; the rest are consolidated from existing packages.

  ### Removed
  - `distance.greatCircleDistanceNm` from `@squawk/units`. Moved to `@squawk/geo` as `greatCircle.distanceNm`.
  - `navigation.greatCircleBearing` and `navigation.greatCircleBearingAndDistance` from `@squawk/flight-math`. Moved to `@squawk/geo` as `greatCircle.bearing` and `greatCircle.bearingAndDistance`.

  ### Changed
  - `@squawk/airspace`, `@squawk/airports`, `@squawk/fixes`, `@squawk/navaids`, and `@squawk/flightplan` now import great-circle distance and polygon primitives from `@squawk/geo` instead of from `@squawk/units`/`@squawk/flight-math` or private internal helpers. Public APIs are unchanged.

- Updated dependencies [58257db]
  - @squawk/geo@0.2.0

## 0.2.2

### Patch Changes

- 9b4c21b: Update internal npm dependencies
- Updated dependencies [9b4c21b]
  - @squawk/types@0.2.2
  - @squawk/units@0.2.2

## 0.2.1

### Patch Changes

- fe66cec: Correct READMEs and TSDoc
- Updated dependencies [fe66cec]
  - @squawk/types@0.2.1
  - @squawk/units@0.2.1

## 0.2.0

### Minor Changes

- 40f0b9d: Add squawk/fixes and squawk/fix-data
- c1e728c: Add squawk Navaid packages

### Patch Changes

- Updated dependencies [7d0383e]
- Updated dependencies [8edfb9b]
- Updated dependencies [df74bd6]
- Updated dependencies [f92d3e2]
- Updated dependencies [3f23773]
- Updated dependencies [1be39b2]
- Updated dependencies [40f0b9d]
- Updated dependencies [cac443c]
- Updated dependencies [c1e728c]
- Updated dependencies [985f0a8]
- Updated dependencies [4711295]
- Updated dependencies [6af10db]
- Updated dependencies [d554f7c]
- Updated dependencies [ba098bd]
- Updated dependencies [d7ac351]
- Updated dependencies [a409b07]
- Updated dependencies [746447f]
- Updated dependencies [ffe41f2]
- Updated dependencies [875fc8b]
- Updated dependencies [51c15dd]
  - @squawk/types@0.2.0
  - @squawk/units@0.2.0
