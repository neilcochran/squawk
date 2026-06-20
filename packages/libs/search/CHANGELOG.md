# @squawk/search

## 0.1.0

### Minor Changes

- 52c87f3: ### Added

  - New `@squawk/search` package: domain-agnostic fuzzy string matching and ranked search scoring. Exposes two pure functions - `fuzzyScore(query, candidate)` scores a single query/candidate pair, returning a normalized `[0, 1]` score plus the matched character ranges, and `fuzzySearch(items, query, options)` ranks a list of items across one or more caller-supplied searchable fields. The package holds no domain knowledge: callers supply the fields to search via a `keys` selector and any filtering predicate. Matching is case-insensitive and tolerant of prefixes, substrings, subsequences, and small typos; results carry the matched field and per-character ranges so UIs can highlight matches. This is the shared scorer the `@squawk/*` query libraries build their `search()` methods on.
