<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/airspace</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/airspace)](https://www.npmjs.com/package/@squawk/airspace) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pure logic library for querying US airspace geometry. Given a position and altitude,
returns all applicable airspace designations. Contains no bundled data - accepts a
GeoJSON dataset at initialization. For zero-config use, pair with `@squawk/airspace-data`.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Coverage

- Class B, C, D, and E controlled airspace (E2 through E7 subtypes)
- Special Use Airspace: MOAs, restricted, prohibited, warning, alert, and national security areas

## Usage

```typescript
import { usBundledAirspace } from '@squawk/airspace-data';
import { createAirspaceResolver } from '@squawk/airspace';

const resolver = createAirspaceResolver({ data: usBundledAirspace });

// Query a position and altitude
const overhead = resolver.query({ lat: 33.9425, lon: -118.4081, altitudeFt: 3000 });

for (const f of overhead) {
  console.log(f.type, f.name, f.identifier);
}

// Get every shell associated with an airport (for drawing the full wedding cake)
const laxShells = resolver.byAirport('LAX');
```

Consumers who have their own GeoJSON airspace data can use this package standalone:

```typescript
import { createAirspaceResolver } from '@squawk/airspace';

const resolver = createAirspaceResolver({ data: myGeoJson });
```

## How it works

`createAirspaceResolver` parses the GeoJSON FeatureCollection at initialization and
returns a resolver object with two methods:

- `query(AirspaceQuery)` - returns features containing the given position and
  altitude, via a ray casting point-in-polygon test combined with a vertical
  floor/ceiling comparison.
- `byAirport(identifier, types?)` - returns every feature whose `identifier`
  matches (case-insensitive). For Class B/C/D/E2 this groups all sectors of the
  airspace around a given airport regardless of the point of interest.

All matching features are returned as `AirspaceFeature` objects (from `@squawk/types`),
including the full polygon boundary coordinates.

## AGL altitude handling

Some airspace features have floor or ceiling bounds referenced to AGL (above ground
level) rather than MSL. Converting AGL to MSL requires terrain elevation data that
this library does not include.

The resolver handles AGL bounds conservatively: when it cannot determine the MSL
equivalent, it **includes** the feature rather than silently excluding it. This means
the resolver may return features whose AGL bounds do not actually contain the
queried altitude.

Consumers can inspect the `reference` field on the returned `AltitudeBound` objects
and apply their own terrain lookup if needed:

```typescript
for (const f of features) {
  if (f.floor.reference === 'AGL') {
    // This feature's floor is AGL - apply terrain data if available
  }
}
```

## API

### `createAirspaceResolver(options)`

Creates a resolver from a GeoJSON dataset.

**Parameters:**

- `options.data` - a GeoJSON `FeatureCollection` with airspace features

**Returns:** `AirspaceResolver` - an object exposing `query(AirspaceQuery)` and
`byAirport(identifier, types?)` methods.

### `AirspaceQuery`

| Property     | Type                       | Description                                                        |
| ------------ | -------------------------- | ------------------------------------------------------------------ |
| `lat`        | number                     | Latitude in decimal degrees (WGS84)                                |
| `lon`        | number                     | Longitude in decimal degrees (WGS84)                               |
| `altitudeFt` | number                     | Altitude in feet MSL                                               |
| `types`      | ReadonlySet\<AirspaceType> | Optional. When provided, only features of these types are returned |

```typescript
// Only query tower-controlled airspace (exclude Class E and SUA)
const controlled = resolver.query({
  lat: 33.9425,
  lon: -118.4081,
  altitudeFt: 3000,
  types: new Set(['CLASS_B', 'CLASS_C', 'CLASS_D']),
});
```

### `resolver.byAirport(identifier, types?)`

Returns every airspace feature whose `identifier` property matches. For
Class B/C/D/E2 this is the associated airport's FAA location identifier
(e.g. "JFK" for the NY Class B). For Special Use Airspace this is the NASR
designator (e.g. "R-2508"). Lookup is case-insensitive. ICAO-prefixed codes
like "KJFK" will not match - resolve to an FAA ID first via `@squawk/airports`.

```typescript
// Every sector of the NY Class B around JFK, with full polygon boundaries
const jfkShells = resolver.byAirport('JFK');

// Only the Class D for a towered field
const safClassD = resolver.byAirport('SAF', new Set(['CLASS_D']));
```
