<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/procedures</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/procedures)](https://www.npmjs.com/package/@squawk/procedures) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pure logic library for querying US instrument procedure data sourced from FAA
CIFP (Coded Instrument Flight Procedures). Covers SIDs, STARs, and Instrument
Approach Procedures (IAPs) in a unified ARINC 424 leg model. Look up by
identifier, by airport, by runway, by approach type; expand a procedure into
an ordered leg sequence; or fuzzy-search by identifier and name. Contains no bundled data - accepts
an array of `Procedure` records at initialization. For zero-config use, pair
with `@squawk/procedure-data`.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Usage

```typescript
import { usBundledProcedures } from '@squawk/procedure-data';
import {
  createProcedureResolver,
  expansionToLineString,
  extractLegPoints,
} from '@squawk/procedures';

const resolver = createProcedureResolver({ data: usBundledProcedures.records });

// Look up every adaptation of an identifier across airports
const allSardi = resolver.byIdentifier('SARDI1');

// Resolve a specific procedure at an airport
const aalleAtDen = resolver.byAirportAndIdentifier('KDEN', 'AALLE4');
const ilsAtJfk = resolver.byAirportAndIdentifier('KJFK', 'I04L');

// Find every procedure for an airport
const jfkProcedures = resolver.byAirport('KJFK');

// Find procedures that serve a specific runway
const jfk04LApproaches = resolver.byAirportAndRunway('KJFK', '04L');

// Filter by type or approach classification
const allStars = resolver.byType('STAR');
const allIls = resolver.byApproachType('ILS');

// Expand a procedure into an ordered leg sequence (common route only)
const expansion = resolver.expand('KDEN', 'AALLE4');
if (expansion) {
  for (const leg of expansion.legs) {
    console.log(leg.pathTerminator, leg.fixIdentifier ?? '(no fix)');
  }
}

// Expand with a named transition (transition + common route merged in flying order)
const withTransition = resolver.expand('KDEN', 'AALLE4', 'BBOTL');

// Fuzzy-search by identifier or name (scored, best match first)
const results = resolver.search({ text: 'AALLE', type: 'STAR' });
console.log(results[0]?.procedure.identifier, results[0]?.score);

// Turn an expansion into renderable map geometry (non-positional legs are skipped)
if (withTransition) {
  const points = extractLegPoints(withTransition.legs);
  const line = expansionToLineString(withTransition.legs);
  // `line` is a GeoJSON LineString, or undefined when fewer than two fixes are drawable
}
```

Consumers who have their own procedure data can use this package standalone:

```typescript
import { createProcedureResolver } from '@squawk/procedures';

const resolver = createProcedureResolver({ data: myProcedures });
```

## Browser / SPA usage

The resolver factory has no Node-specific imports and ships an explicit `/browser` subpath for SPAs and edge runtimes. Pair it with `@squawk/procedure-data/browser`:

```typescript
import { loadUsBundledProcedures } from '@squawk/procedure-data/browser';
import { createProcedureResolver } from '@squawk/procedures/browser';

const dataset = await loadUsBundledProcedures();
const resolver = createProcedureResolver({ data: dataset.records });
```

The `/browser` entry is identical to the main entry; the separate subpath exists so browser support is an explicit, `publint`-verified part of the public API surface.

## API

### `createProcedureResolver(options)`

Creates a resolver object from an array of `Procedure` records.

**Parameters:**

- `options.data` - an array of `Procedure` objects (from `@squawk/types`).

**Returns:** `ProcedureResolver` - an object with the lookup methods described below.

### `resolver.byIdentifier(identifier)`

Looks up every procedure matching a CIFP identifier (case-insensitive). CIFP
identifiers are not globally unique - the same identifier (for example
`SARDI1` or `I04L`) is published separately for each adapted airport, so this
returns all matches. Returns `Procedure[]`.

### `resolver.byAirportAndIdentifier(airportId, identifier)`

Resolves a single procedure by (airport, identifier). Case-insensitive for
both arguments. Returns `Procedure | undefined`.

### `resolver.byAirport(airportId)`

Returns every procedure (SID, STAR, or IAP) adapted at the given airport.
Case-insensitive. Returns `Procedure[]`.

### `resolver.byAirportAndRunway(airportId, runway)`

Returns procedures at an airport that serve a specific runway. For IAPs, the
match is on the `runway` field directly. For SIDs and STARs, the match is on a
runway transition named `RW<runway>` (for example `RW04L`). Case-insensitive.
Returns `Procedure[]`.

### `resolver.byType(type)`

Returns every procedure of a given type. Pass `'SID'`, `'STAR'`, or `'IAP'`.
Returns `Procedure[]`.

### `resolver.byApproachType(approachType)`

Returns every IAP of a given approach classification (`'ILS'`, `'LOC'`,
`'LOC_BC'`, `'RNAV'`, `'RNAV_RNP'`, `'VOR'`, `'VOR_DME'`, `'NDB'`, `'NDB_DME'`,
`'TACAN'`, `'GLS'`, `'IGS'`, `'LDA'`, `'SDF'`, `'GPS'`, `'FMS'`, `'MLS'`).
Returns `Procedure[]`.

### `resolver.expand(airportId, identifier, transitionName?)`

Expands a procedure into an ordered leg sequence. Without a transition name,
returns the procedure's first common route. With a transition name, merges the
named transition's legs with the common route in flying order:

- **SID + enroute exit transition** - common route first, then transition.
- **SID + runway transition** (`RW*` name) - transition first, then common route.
- **STAR + enroute entry transition** - transition first, then common route.
- **STAR + runway transition** - common route first, then transition.
- **IAP + approach transition** - transition first, then final approach segment.

The connecting fix between transition and common route is deduplicated when
both segments reference it.

Returns `ProcedureExpansionResult | undefined`, containing:

- `procedure` - the full `Procedure` record.
- `legs` - the ordered `ProcedureLeg` sequence.

### `resolver.search(query)`

Fuzzy-searches procedures across identifier and name. Matching is case-insensitive
and tolerant of prefixes, substrings, subsequences, and small typos. Results are
scored and returned best-match first.

| Property       | Type          | Description                                                                              |
| -------------- | ------------- | ---------------------------------------------------------------------------------------- |
| `text`         | string        | Search text, matched fuzzily against each procedure's identifier and name                |
| `limit`        | number        | Optional. Maximum number of results. Defaults to 20                                      |
| `type`         | ProcedureType | Optional. Restrict to `'SID'`, `'STAR'`, or `'IAP'` only                                 |
| `approachType` | ApproachType  | Optional. Restrict to IAPs of a given approach classification                            |
| `minScore`     | number        | Optional. Minimum match score (exclusive) in `[0, 1]` a result must reach. Defaults to 0 |

Returns `ProcedureSearchResult[]`, sorted by descending score, each containing:

- `procedure` - the matched Procedure record
- `score` - match strength in `[0, 1]`, where 1 is an exact identifier or name match
- `matchedField` - which field produced the best match: `'identifier'` or `'name'`
- `ranges` - matched character ranges within the best-matching field's text, for highlighting

```typescript
const results = resolver.search({ text: 'AALLE', type: 'STAR' });
for (const { procedure, score, matchedField } of results) {
  console.log(procedure.identifier, score, `(matched ${matchedField})`);
}
```

### `extractLegPoints(legs)`

Extracts the ordered drawable points from an expanded leg sequence (the `legs`
array of a `ProcedureExpansionResult`). Only legs that terminate at a known fix
contribute a point; legs whose ARINC 424 path terminator ends at an altitude,
DME distance, radial, intercept, or manual event (`CA`, `FA`, `VA`, `CD`, `FD`,
`VD`, `CR`, `VR`, `CI`, `VI`, `FM`, `VM`, and the `HA`/`HM` holds) carry no
coordinate and are skipped, so a non-positional leg in the middle of a sequence
leaves a gap. Consecutive duplicate points are suppressed. Returns
`ProcedureLegPoint[]`, each with `label`, `lat`, and `lon`.

### `expansionToLineString(legs)`

Builds a GeoJSON `LineString` from an expanded leg sequence, ready to render as a
polyline on a map (for example MapLibre or Leaflet). Coordinates follow the
GeoJSON `[lon, lat]` ordering. Because non-positional legs are skipped (see
`extractLegPoints`), the line connects only the fix-terminated legs and is an
approximation that omits the non-drawable segments rather than a precise flyable
track. Returns `LineString | undefined` - `undefined` when the legs yield fewer
than two drawable points, since a `LineString` requires at least two positions.
