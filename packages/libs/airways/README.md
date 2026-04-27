<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/airways</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/airways)](https://www.npmjs.com/package/@squawk/airways) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pure logic library for querying US airway data. Look up airways by
designation, expand route segments between fixes, find airways through a
specific fix, or search by designation. Contains no bundled data - accepts
an array of Airway records at initialization. For zero-config use, pair with
`@squawk/airway-data`.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Usage

```typescript
import { usBundledAirways } from '@squawk/airway-data';
import { createAirwayResolver } from '@squawk/airways';

const resolver = createAirwayResolver({ data: usBundledAirways.records });

// Look up by designation
const v16 = resolver.byDesignation('V16');

// Expand an airway between two fixes
const segment = resolver.expand('J60', 'MERIT', 'MARTN');
if (segment) {
  for (const wp of segment.waypoints) {
    console.log(wp.identifier, wp.mea, 'ft MEA');
  }
}

// Find all airways through a fix
const throughBos = resolver.byFix('BOS');
for (const result of throughBos) {
  console.log(result.airway.designation);
}

// Search by designation
const results = resolver.search({ text: 'V1' });
```

Consumers who have their own airway data can use this package standalone:

```typescript
import { createAirwayResolver } from '@squawk/airways';

const resolver = createAirwayResolver({ data: myAirways });
```

## API

### `createAirwayResolver(options)`

Creates a resolver object from an array of Airway records.

**Parameters:**

- `options.data` - an array of `Airway` objects (from `@squawk/types`)

**Returns:** `AirwayResolver` - an object with the lookup methods described below.

### `resolver.byDesignation(designation)`

Looks up airways by designation (e.g. "V16", "J60", "Q1"). Multiple airways
can share the same designation in different regions (e.g. V16 exists in both
the contiguous US and Hawaii). Case-insensitive. Returns `Airway[]`.

### `resolver.expand(designation, entryFix, exitFix)`

Expands an airway between two fixes, returning the ordered sequence of
waypoints from the entry fix to the exit fix (inclusive). This is the
primary use case for flight plan route decoding - given a route string
like `MERIT J60 MARTN`, expand J60 between MERIT and MARTN.

Airways can be traversed in either direction. When the entry fix appears
after the exit fix in the stored waypoint order, the returned waypoints
are reversed so they always run entry-to-exit.

Returns `AirwayExpansionResult | undefined`. Returns undefined if:

- The airway designation is not found
- Either fix is not on the airway

The result contains:

- `airway` - the full Airway record
- `waypoints` - the ordered slice of waypoints between the two fixes

### `resolver.byFix(ident)`

Finds all airways that pass through a given fix or navaid identifier.
Case-insensitive. Returns `AirwayByFixResult[]`, each containing:

- `airway` - the Airway record
- `waypointIndex` - the index of the matching waypoint in the airway

### `resolver.search(query)`

Searches airways by designation using case-insensitive substring matching.
Results are returned in alphabetical order by designation.

| Property | Type                      | Description                                                    |
| -------- | ------------------------- | -------------------------------------------------------------- |
| `text`   | string                    | Case-insensitive substring to match against airway designation |
| `limit`  | number                    | Optional. Maximum number of results. Defaults to 20            |
| `types`  | ReadonlySet\<AirwayType\> | Optional. When provided, only these airway types are returned  |

Returns `Airway[]`.
