<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/airports</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/airports)](https://www.npmjs.com/package/@squawk/airports) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pure logic library for querying US airport data. Look up airports by FAA ID, ICAO code,
geographic proximity, or fuzzy text search. Contains no bundled data - accepts an array of
Airport records at initialization. For zero-config use, pair with `@squawk/airport-data`.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Usage

```typescript
import { usBundledAirports } from '@squawk/airport-data';
import { createAirportResolver } from '@squawk/airports';

const resolver = createAirportResolver({ data: usBundledAirports.records });

// Look up by FAA ID
const jfk = resolver.byFaaId('JFK');

// Look up by ICAO code
const ord = resolver.byIcao('KORD');

// Find nearest airports to a position
const nearby = resolver.nearest({ lat: 40.6413, lon: -73.7781 });
for (const result of nearby) {
  console.log(result.airport.name, result.distanceNm, 'nm');
}

// Fuzzy-search across FAA ID, ICAO, name, and city (scored, best match first)
const results = resolver.search({ text: 'chicago' });
console.log(results[0]?.airport.name, results[0]?.score);
```

Consumers who have their own airport data can use this package standalone:

```typescript
import { createAirportResolver } from '@squawk/airports';

const resolver = createAirportResolver({ data: myAirports });
```

## Browser / SPA usage

The resolver factory has no Node-specific imports and ships an explicit `/browser` subpath for SPAs and edge runtimes. Pair it with `@squawk/airport-data/browser`:

```typescript
import { loadUsBundledAirports } from '@squawk/airport-data/browser';
import { createAirportResolver } from '@squawk/airports/browser';

const dataset = await loadUsBundledAirports();
const resolver = createAirportResolver({ data: dataset.records });
```

The `/browser` entry is identical to the main entry; the separate subpath exists so browser support is an explicit, `publint`-verified part of the public API surface.

## API

### `createAirportResolver(options)`

Creates a resolver object from an array of Airport records.

**Parameters:**

- `options.data` - an array of `Airport` objects (from `@squawk/types`)

**Returns:** `AirportResolver` - an object with the lookup methods described below.

### `resolver.byFaaId(faaId)`

Looks up an airport by its FAA location identifier (e.g. "JFK", "LAX", "3N6").
Case-insensitive. Returns `Airport | undefined`.

### `resolver.byIcao(icao)`

Looks up an airport by its ICAO code (e.g. "KJFK", "KLAX").
Case-insensitive. Returns `Airport | undefined`.

### `resolver.nearest(query)`

Finds airports nearest to a geographic position, sorted by distance ascending.

| Property        | Type                       | Description                                                          |
| --------------- | -------------------------- | -------------------------------------------------------------------- |
| `lat`           | number                     | Latitude in decimal degrees (WGS84)                                  |
| `lon`           | number                     | Longitude in decimal degrees (WGS84)                                 |
| `maxDistanceNm` | number                     | Optional. Maximum distance in nautical miles. Defaults to 30         |
| `limit`         | number                     | Optional. Maximum number of results. Defaults to 10                  |
| `types`         | ReadonlySet\<FacilityType> | Optional. When provided, only facilities of these types are returned |

Returns `NearestAirportResult[]`, each containing:

- `airport` - the matched Airport record
- `distanceNm` - great-circle distance in nautical miles (rounded to 2 decimal places)

```typescript
// Find the 5 nearest airports within 50 nm
const nearby = resolver.nearest({
  lat: 40.6413,
  lon: -73.7781,
  maxDistanceNm: 50,
  limit: 5,
});

// Find only nearby heliports
const heliports = resolver.nearest({
  lat: 40.6413,
  lon: -73.7781,
  types: new Set(['HELIPORT']),
});
```

### `resolver.search(query)`

Fuzzy-searches airports across FAA ID, ICAO code, name, and city. Matching is
case-insensitive and tolerant of prefixes, substrings, subsequences, and small typos.
Results are scored and returned best-match first.

| Property   | Type                       | Description                                                                              |
| ---------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `text`     | string                     | Search text, matched fuzzily against each airport's FAA ID, ICAO code, name, and city    |
| `limit`    | number                     | Optional. Maximum number of results. Defaults to 20                                      |
| `types`    | ReadonlySet\<FacilityType> | Optional. When provided, only facilities of these types are returned                     |
| `minScore` | number                     | Optional. Minimum match score (exclusive) in `[0, 1]` a result must reach. Defaults to 0 |

Returns `AirportSearchResult[]`, sorted by descending score, each containing:

- `airport` - the matched Airport record
- `score` - match strength in `[0, 1]`, where 1 is an exact identifier or name match
- `matchedField` - which field produced the best match: `'faaId'`, `'icao'`, `'name'`, or `'city'`
- `ranges` - matched character ranges within the best-matching field's text, for highlighting

```typescript
const results = resolver.search({ text: 'san francisco', limit: 10 });
for (const { airport, score, matchedField } of results) {
  console.log(airport.faaId, score, `(matched ${matchedField})`);
}

// Raise minScore to drop weak fuzzy matches
const strong = resolver.search({ text: 'kennedy', minScore: 0.5 });
```

## Local time at an airport

Every airport record carries an IANA `timezone` field (e.g. `America/New_York`) resolved
from the airport's lat/lon at build time. Combine it with the standard
`Intl.DateTimeFormat` API to format a timestamp in the airport's local time without
pulling in a timezone library at runtime:

```typescript
const jfk = resolver.byIcao('KJFK');
if (jfk) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: jfk.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  console.log(formatter.format(new Date())); // e.g. "Apr 23, 2026, 3:42 PM"
}
```

The same field works anywhere an IANA zone is accepted - `Temporal`, `date-fns-tz`,
`luxon`, `moment-timezone`, etc.
