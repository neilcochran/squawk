# @squawk/icao-registry

## 0.4.0

### Minor Changes

- e62a291: ### Removed
  - Removed undocumented lower-level FAA parsing internals from the public entrypoint: `parseMasterCsv`, `parseAcftRefCsv`, `joinRegistryRecords`, the `MasterRecord` and `AcftRefRecord` types, and the `AIRCRAFT_TYPE_MAP` and `ENGINE_TYPE_MAP` constants. These were never documented as supported API; the documented `parseFaaRegistryZip` parser is unchanged and remains the path for consumers that want to fetch fresh FAA registry data.

## 0.3.4

### Patch Changes

- b9ff30c: ### Fixed
  - Fix the broken MIT license badge link in every package README. The relative path was one level too shallow, so on GitHub (and on npm renderers that resolve relative paths against the repo) the badge landed on a non-existent `packages/LICENSE.md` instead of the repo's `LICENSE.md`. The badge now resolves correctly.
  - Fix the broken `Documentation` link in `@squawk/flight-math`'s README. The typedoc URL slug used an underscore (`_squawk_flight_math.html`) instead of the dash form every sibling README uses (`_squawk_flight-math.html`), returning 404. Now points at the live docs page.

- Updated dependencies [b9ff30c]
  - @squawk/types@0.7.2

## 0.3.3

### Patch Changes

- b47b118: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

- Updated dependencies [b47b118]
  - @squawk/types@0.7.1

## 0.3.2

### Patch Changes

- Updated dependencies [32f4925]
  - @squawk/types@0.7.0

## 0.3.1

### Patch Changes

- Updated dependencies [15fa9cf]
  - @squawk/types@0.6.0

## 0.3.0

### Minor Changes

- ff22bd5: Bump `@squawk/types` peer dependency to `^0.4.0` for the procedures CIFP migration. No behavioral changes.

### Patch Changes

- Updated dependencies [ff22bd5]
  - @squawk/types@0.5.0

## 0.2.3

### Patch Changes

- a4ba760: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [a4ba760]
  - @squawk/types@0.3.1

## 0.2.2

### Patch Changes

- 9b4c21b: Update internal npm dependencies
- Updated dependencies [9b4c21b]
  - @squawk/types@0.2.2

## 0.2.1

### Patch Changes

- fe66cec: Correct READMEs and TSDoc
- Updated dependencies [fe66cec]
  - @squawk/types@0.2.1

## 0.2.0

### Minor Changes

- d7ac351: Add @squawk/icon-registry and @squawk/icao-registry-data
- a409b07: Add @squawk/airport-data package

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
- Updated dependencies [d7ac351]
- Updated dependencies [a409b07]
- Updated dependencies [746447f]
- Updated dependencies [ffe41f2]
- Updated dependencies [875fc8b]
  - @squawk/types@0.2.0

## 0.1.1

### Patch Changes

- a8026d4: Update minimum Node.js requirement to v22
- Updated dependencies [a8026d4]
  - @squawk/types@0.1.1
