<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/navaids</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/navaids)](https://www.npmjs.com/package/@squawk/navaids) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pure logic library for querying US navaid data. Look up navaids by identifier,
frequency, geographic proximity, type, or name search. Contains no bundled data -
accepts an array of Navaid records at initialization. For zero-config use, pair
with `@squawk/navaid-data`.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Usage

```typescript
import { usBundledNavaids } from '@squawk/navaid-data';
import { createNavaidResolver } from '@squawk/navaids';

const resolver = createNavaidResolver({ data: usBundledNavaids.records });

// Look up by identifier
const bos = resolver.byIdent('BOS');

// Find by frequency (MHz for VOR-family, kHz for NDB-family)
const onFreq = resolver.byFrequency({ frequency: 113.7 });

// Find nearest navaids to a position
const nearby = resolver.nearest({ lat: 42.3656, lon: -71.0096 });
for (const result of nearby) {
  console.log(result.navaid.name, result.distanceNm, 'nm');
}

// Get all navaids of a type
const vors = resolver.byType(new Set(['VOR', 'VORTAC', 'VOR/DME']));

// Search by name or identifier
const results = resolver.search({ text: 'boston' });
```

Consumers who have their own navaid data can use this package standalone:

```typescript
import { createNavaidResolver } from '@squawk/navaids';

const resolver = createNavaidResolver({ data: myNavaids });
```

## API

### `createNavaidResolver(options)`

Creates a resolver object from an array of Navaid records.

**Parameters:**

- `options.data` - an array of `Navaid` objects (from `@squawk/types`)

**Returns:** `NavaidResolver` - an object with the lookup methods described below.

### `resolver.byIdent(ident)`

Looks up navaids by identifier (e.g. "BOS", "JFK"). Multiple navaids can share
the same identifier (e.g. an NDB and a VOR at different locations).
Case-insensitive. Returns `Navaid[]`.

### `resolver.byFrequency(query)`

Finds navaids operating on a given frequency. For VOR-family navaids the
frequency is in MHz; for NDB-family navaids it is in kHz.

| Property    | Type                     | Description                                                       |
| ----------- | ------------------------ | ----------------------------------------------------------------- |
| `frequency` | number                   | Frequency value to match (MHz for VOR-family, kHz for NDB-family) |
| `types`     | ReadonlySet\<NavaidType> | Optional. When provided, only navaids of these types are returned |
| `limit`     | number                   | Optional. Maximum number of results. Defaults to 20               |

Returns `Navaid[]`, sorted alphabetically by identifier.

### `resolver.nearest(query)`

Finds navaids nearest to a geographic position, sorted by distance ascending.

| Property        | Type                     | Description                                                       |
| --------------- | ------------------------ | ----------------------------------------------------------------- |
| `lat`           | number                   | Latitude in decimal degrees (WGS84)                               |
| `lon`           | number                   | Longitude in decimal degrees (WGS84)                              |
| `maxDistanceNm` | number                   | Optional. Maximum distance in nautical miles. Defaults to 30      |
| `limit`         | number                   | Optional. Maximum number of results. Defaults to 10               |
| `types`         | ReadonlySet\<NavaidType> | Optional. When provided, only navaids of these types are returned |

Returns `NearestNavaidResult[]`, each containing:

- `navaid` - the matched Navaid record
- `distanceNm` - great-circle distance in nautical miles (rounded to 2 decimal places)

```typescript
// Find the 5 nearest VORTACs within 50 nm
const nearby = resolver.nearest({
  lat: 42.3656,
  lon: -71.0096,
  maxDistanceNm: 50,
  limit: 5,
  types: new Set(['VORTAC']),
});
```

### `resolver.byType(types)`

Returns all navaids matching the given type(s), sorted alphabetically by identifier.

```typescript
const ndbs = resolver.byType(new Set(['NDB', 'NDB/DME']));
```

### `resolver.search(query)`

Searches navaids by name or identifier using case-insensitive substring matching.
Results are returned in alphabetical order by name.

| Property | Type                     | Description                                                       |
| -------- | ------------------------ | ----------------------------------------------------------------- |
| `text`   | string                   | Case-insensitive substring to match against name or identifier    |
| `limit`  | number                   | Optional. Maximum number of results. Defaults to 20               |
| `types`  | ReadonlySet\<NavaidType> | Optional. When provided, only navaids of these types are returned |

Returns `Navaid[]`.
