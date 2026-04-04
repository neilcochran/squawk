# @squawk/fixes

Pure logic library for querying US fix/waypoint data. Look up fixes by
identifier, geographic proximity, or identifier search. Contains no bundled
data - accepts an array of Fix records at initialization. For zero-config use,
pair with `@squawk/fix-data`.

## Usage

```typescript
import { usBundledFixes } from '@squawk/fix-data';
import { createFixResolver } from '@squawk/fixes';

const resolver = createFixResolver({ data: usBundledFixes.records });

// Look up by identifier
const merit = resolver.byIdent('MERIT');

// Find nearest fixes to a position
const nearby = resolver.nearest({ lat: 40.6413, lon: -73.7781 });
for (const result of nearby) {
  console.log(result.fix.identifier, result.distanceNm, 'nm');
}

// Search by identifier
const results = resolver.search({ text: 'BOS' });
```

Consumers who have their own fix data can use this package standalone:

```typescript
import { createFixResolver } from '@squawk/fixes';

const resolver = createFixResolver({ data: myFixes });
```

## API

### `createFixResolver(options)`

Creates a resolver object from an array of Fix records.

**Parameters:**

- `options.data` - an array of `Fix` objects (from `@squawk/types`)

**Returns:** `FixResolver` - an object with the lookup methods described below.

### `resolver.byIdent(ident)`

Looks up fixes by identifier (e.g. "MERIT", "BOSCO"). Multiple fixes can share
the same identifier in different ICAO regions. Case-insensitive.
Returns `Fix[]`.

### `resolver.nearest(query)`

Finds fixes nearest to a geographic position, sorted by distance ascending.

| Property        | Type                     | Description                                                           |
| --------------- | ------------------------ | --------------------------------------------------------------------- |
| `lat`           | number                   | Latitude in decimal degrees (WGS84)                                   |
| `lon`           | number                   | Longitude in decimal degrees (WGS84)                                  |
| `maxDistanceNm` | number                   | Optional. Maximum distance in nautical miles. Defaults to 30          |
| `limit`         | number                   | Optional. Maximum number of results. Defaults to 10                   |
| `useCodes`      | ReadonlySet\<FixUseCode> | Optional. When provided, only fixes with these use codes are returned |

Returns `NearestFixResult[]`, each containing:

- `fix` - the matched Fix record
- `distanceNm` - great-circle distance in nautical miles (rounded to 2 decimal places)

```typescript
// Find the 5 nearest waypoints within 50 nm
const nearby = resolver.nearest({
  lat: 40.6413,
  lon: -73.7781,
  maxDistanceNm: 50,
  limit: 5,
  useCodes: new Set(['WP']),
});
```

### `resolver.search(query)`

Searches fixes by identifier using case-insensitive substring matching.
Results are returned in alphabetical order by identifier.

| Property   | Type                     | Description                                                           |
| ---------- | ------------------------ | --------------------------------------------------------------------- |
| `text`     | string                   | Case-insensitive substring to match against fix identifier            |
| `limit`    | number                   | Optional. Maximum number of results. Defaults to 20                   |
| `useCodes` | ReadonlySet\<FixUseCode> | Optional. When provided, only fixes with these use codes are returned |

Returns `Fix[]`.
