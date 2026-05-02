# @squawk/notams

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

- 7bac924: **@squawk/notams**
  - Fix ReDoS in `parseNotam` Q-line extraction. A NOTAM containing many slashes after the Q-line could cause exponential regex backtracking (a 129-byte input previously hung the event loop for ~4s; now linear in input length).

  **@squawk/weather**
  - Fix polynomial-time slowdown in international SIGMET header stripping (used by `parseSigmet` and `parseSigmetBulletin`). Bulletins with many leading 4-letter tokens and no trailing dash on the SIGMET line previously took O(N²) time; now linear.
  - When a SIGMET prefix contains multiple FIR codes that survive WMO/AWIPS header stripping, all of them are now preserved in the body for downstream FIR parsing instead of only the FIR closest to `SIGMET`.

## 0.2.1

### Patch Changes

- fe66cec: Correct READMEs and TSDoc
- Updated dependencies [fe66cec]
  - @squawk/types@0.2.1

## 0.2.0

### Minor Changes

- 3f23773: Add NOTAM parsing for legacy FAA format to squawk/notam
- 875fc8b: Move package specific types from squawk/types to their respective packages

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
