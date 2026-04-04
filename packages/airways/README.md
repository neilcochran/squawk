# @squawk/airways

Pure logic library for querying US airway data. Look up airways by
designation, expand route segments between fixes, find airways through a
specific fix, or search by designation. Contains no bundled data - accepts
an array of Airway records at initialization. For zero-config use, pair with
`@squawk/airway-data`.

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

Looks up an airway by its designation (e.g. "V16", "J60", "Q1").
Case-insensitive. Returns `Airway | undefined`.

### `resolver.expand(designation, entryFix, exitFix)`

Expands an airway between two fixes, returning the ordered sequence of
waypoints from the entry fix to the exit fix (inclusive). This is the
primary use case for flight plan route decoding - given a route string
like `MERIT J60 MARTN`, expand J60 between MERIT and MARTN.

Returns `AirwayExpansionResult | undefined`. Returns undefined if:

- The airway designation is not found
- Either fix is not on the airway
- The entry fix does not precede the exit fix in waypoint order

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
