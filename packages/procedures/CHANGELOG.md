# @squawk/procedures

## 0.2.4

### Patch Changes

- 51a9ddc: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [51a9ddc]
  - @squawk/types@0.3.1

## 0.2.3

### Patch Changes

- fd8f93a: - Resolve dotted `PROCCODE.TRANSITION` tokens (e.g. `NUBLE4.JJIMY`) in flight plan routes; previously the parser marked them as unresolved and `compute_route_distance` skipped the procedure entirely.
  - Order SID transition expansions in departure order (common route then transition) so `procedures.expand()` and downstream route-distance calculations no longer backtrack through the procedure or duplicate the connecting fix.
  - Split multi-station TAF responses correctly when AWC separates records with a single newline; previously the second station's forecast groups were attributed to the first station, leaving its own `forecast` array empty.
- Updated dependencies [6fe3325]
  - @squawk/types@0.3.0

## 0.2.2

### Patch Changes

- d52b90b: Update internal npm dependencies
- Updated dependencies [d52b90b]
  - @squawk/types@0.2.2

## 0.2.1

### Patch Changes

- 16d7bf1: Correct READMEs and TSDoc
- Updated dependencies [16d7bf1]
  - @squawk/types@0.2.1

## 0.2.0

### Minor Changes

- 95863cd: Add squawk/procedures and squawk/procedure-data packages

### Patch Changes

- Updated dependencies [fc890a7]
- Updated dependencies [896ce8a]
- Updated dependencies [58a8dec]
- Updated dependencies [feaa9ab]
- Updated dependencies [a41e8da]
- Updated dependencies [b28de20]
- Updated dependencies [ec14992]
- Updated dependencies [005c963]
- Updated dependencies [893af47]
- Updated dependencies [5999218]
- Updated dependencies [f9cb361]
- Updated dependencies [303997a]
- Updated dependencies [53b25b2]
- Updated dependencies [2bdf6be]
- Updated dependencies [c7edad0]
- Updated dependencies [c4b7790]
- Updated dependencies [a76df6f]
- Updated dependencies [062f661]
  - @squawk/types@0.2.0
