<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/procedures</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/procedures)](https://www.npmjs.com/package/@squawk/procedures) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pure logic library for querying US instrument procedure data. Look up SIDs
and STARs by computer code, find procedures by airport, filter by type, expand
route segments with transitions, or search by name. Contains no bundled data -
accepts an array of Procedure records at initialization. For zero-config use,
pair with `@squawk/procedure-data`.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Usage

```typescript
import { usBundledProcedures } from '@squawk/procedure-data';
import { createProcedureResolver } from '@squawk/procedures';

const resolver = createProcedureResolver({ data: usBundledProcedures.records });

// Look up by computer code
const aalle = resolver.byName('AALLE4');

// Find all procedures for an airport
const denProcedures = resolver.byAirport('DEN');

// Get all STARs
const stars = resolver.byType('STAR');

// Expand a procedure (common route only)
const route = resolver.expand('AALLE4');
if (route) {
  for (const wp of route.waypoints) {
    console.log(wp.fixIdentifier, wp.lat, wp.lon);
  }
}

// Expand with a named transition
const withTransition = resolver.expand('AALLE4', 'BBOTL');

// Search by name or code
const results = resolver.search({ text: 'AALLE' });
```

Consumers who have their own procedure data can use this package standalone:

```typescript
import { createProcedureResolver } from '@squawk/procedures';

const resolver = createProcedureResolver({ data: myProcedures });
```

## API

### `createProcedureResolver(options)`

Creates a resolver object from an array of Procedure records.

**Parameters:**

- `options.data` - an array of `Procedure` objects (from `@squawk/types`)

**Returns:** `ProcedureResolver` - an object with the lookup methods described below.

### `resolver.byName(computerCode)`

Looks up a procedure by its FAA computer code (e.g. "AALLE4", "ACCRA5").
Case-insensitive. Returns `Procedure | undefined`.

### `resolver.byAirport(airportId)`

Finds all procedures associated with a given airport identifier.
Case-insensitive. Returns `Procedure[]`.

### `resolver.byType(type)`

Returns all procedures of a given type. Pass `'SID'` or `'STAR'`.
Returns `Procedure[]`.

### `resolver.expand(computerCode, transitionName?)`

Expands a procedure into an ordered waypoint sequence.

- Without a transition: returns the first common route's waypoints
- With a transition: returns the transition waypoints merged with the first
  common route, deduplicating the connecting fix

Returns `ProcedureExpansionResult | undefined`. The result contains:

- `procedure` - the full Procedure record
- `waypoints` - the ordered waypoint sequence

### `resolver.search(query)`

Searches procedures by name or computer code using case-insensitive substring
matching. Results are returned in alphabetical order by computer code.

| Property | Type          | Description                                                       |
| -------- | ------------- | ----------------------------------------------------------------- |
| `text`   | string        | Case-insensitive substring to match against name or computer code |
| `limit`  | number        | Optional. Maximum number of results. Defaults to 20               |
| `type`   | ProcedureType | Optional. When provided, only this procedure type is returned     |

Returns `Procedure[]`.
