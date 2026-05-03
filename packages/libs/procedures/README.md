<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/procedures</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/procedures)](https://www.npmjs.com/package/@squawk/procedures) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pure logic library for querying US instrument procedure data sourced from FAA
CIFP (Coded Instrument Flight Procedures). Covers SIDs, STARs, and Instrument
Approach Procedures (IAPs) in a unified ARINC 424 leg model. Look up by
identifier, by airport, by runway, by approach type; expand a procedure into
an ordered leg sequence; or search by name. Contains no bundled data - accepts
an array of `Procedure` records at initialization. For zero-config use, pair
with `@squawk/procedure-data`.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Usage

```typescript
import { usBundledProcedures } from '@squawk/procedure-data';
import { createProcedureResolver } from '@squawk/procedures';

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

// Search by name or identifier
const results = resolver.search({ text: 'AALLE', type: 'STAR' });
```

Consumers who have their own procedure data can use this package standalone:

```typescript
import { createProcedureResolver } from '@squawk/procedures';

const resolver = createProcedureResolver({ data: myProcedures });
```

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

Searches procedures by name or identifier using case-insensitive substring
matching. Results are sorted by airport then identifier.

| Property       | Type          | Description                                                    |
| -------------- | ------------- | -------------------------------------------------------------- |
| `text`         | string        | Case-insensitive substring to match against name or identifier |
| `limit`        | number        | Optional. Maximum number of results. Defaults to 20            |
| `type`         | ProcedureType | Optional. Restrict to `'SID'`, `'STAR'`, or `'IAP'` only       |
| `approachType` | ApproachType  | Optional. Restrict to IAPs of a given approach classification  |

Returns `Procedure[]`.
