<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/search</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/search)](https://www.npmjs.com/package/@squawk/search) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Domain-agnostic fuzzy string matching and ranked search scoring. A small, dependency-free engine that scores how well a query matches a candidate string (exact, prefix, substring, subsequence, and bounded typo tiers), returns a normalised `[0, 1]` score plus the matched character ranges for UI highlighting, and ranks a list of items across one or more searchable fields.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_search.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

This package holds no aviation domain knowledge. It is the shared scoring substrate used by the `@squawk/*` resolvers (airports, navaids, fixes, airways, airspace) to power their `search()` methods, and can be used standalone for any fuzzy-matching need.

## Installation

```bash
npm install @squawk/search
```

## Usage

### Score a single candidate

`fuzzyScore` compares a query against one candidate string and returns a normalised score in `[0, 1]` (1 = exact, 0 = no match) along with the matched character ranges:

```ts
import { fuzzyScore } from '@squawk/search';

fuzzyScore('jfk', 'JFK'); // { score: 1, ranges: [{ start: 0, end: 3 }] }
fuzzyScore('ken', 'Kennedy'); // strong prefix match, ranges cover "Ken"
fuzzyScore('kndy', 'Kennedy'); // subsequence match, lower score
fuzzyScore('jfx', 'JFK'); // bounded typo match, lower score still
fuzzyScore('xyz', 'JFK'); // { score: 0, ranges: [] }
```

### Rank a list of items

`fuzzySearch` ranks a list of arbitrary items against a query. You describe how to extract the searchable fields from each item; the engine scores every field, keeps the best per item, filters, sorts by descending score, and slices to `limit`:

```ts
import { fuzzySearch } from '@squawk/search';

interface Station {
  id: string;
  name: string;
}

const stations: Station[] = [
  { id: 'JFK', name: 'John F Kennedy Intl' },
  { id: 'EWR', name: 'Newark Liberty Intl' },
  { id: 'LGA', name: 'LaGuardia' },
];

const matches = fuzzySearch(stations, 'kennedy', {
  keys: (s) => [
    { name: 'id', text: s.id },
    { name: 'name', text: s.name },
  ],
  limit: 10,
});

// matches[0] => { item: { id: 'JFK', ... }, score, field: 'name', ranges: [...] }
```

## Key Features

- **Tiered scoring:** Exact, prefix, word-boundary prefix, substring, subsequence, and bounded Damerau-Levenshtein typo tiers, collapsed into a single normalised `[0, 1]` score so results are comparable across fields and data sets.
- **Match ranges:** Every score carries the matched character ranges, ready for highlight rendering in a UI.
- **Multi-field ranking:** Score an item across several fields and keep the best-matching one, with the matched field name reported on each result.
- **Caller-supplied filtering:** Pass a predicate to exclude items before scoring (e.g. respecting visibility or type filters) without the engine knowing anything about the domain.
- **Zero dependencies:** Pure string logic with no runtime dependencies.
