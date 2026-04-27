<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/airspace</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/airspace)](https://www.npmjs.com/package/@squawk/airspace) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pure logic library for querying US airspace geometry. Given a position and altitude,
returns all applicable airspace designations. Contains no bundled data - accepts a
GeoJSON dataset at initialization. For zero-config use, pair with `@squawk/airspace-data`.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Coverage

- Class B, C, D, and E controlled airspace (E2 through E7 subtypes)
- Special Use Airspace: MOAs, restricted, prohibited, warning, alert, and national security areas
- ARTCC (Air Route Traffic Control Center) lateral boundaries for every
  US-controlled center, published per stratum: LOW/HIGH for the 20 CONUS
  centers and Anchorage (ZAN), UTA for Oakland (ZOA) only, and oceanic
  CTA/FIR strata for the Pacific (ZAK, ZAP), Atlantic (ZWY), and the
  contiguous overlays on ZAN, ZHN, ZHU, ZMA, ZSU. Within-stratum sector
  polygons and per-sector enroute frequencies are not included - the FAA
  does not publish either data set in machine-readable form.

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

// Get every ARTCC center boundary (one feature per stratum)
const ny = resolver.byArtcc('ZNY');
```

Consumers who have their own GeoJSON airspace data can use this package standalone:

```typescript
import { createAirspaceResolver } from '@squawk/airspace';

const resolver = createAirspaceResolver({ data: myGeoJson });
```

## How it works

`createAirspaceResolver` parses the GeoJSON FeatureCollection at initialization and
returns a resolver object with three methods:

- `query(AirspaceQuery)` - returns features containing the given position and
  altitude, via a ray casting point-in-polygon test combined with a vertical
  floor/ceiling comparison.
- `byAirport(identifier, types?)` - returns every non-ARTCC feature whose
  `identifier` matches (case-insensitive). For Class B/C/D/E2 this groups all
  sectors of the airspace around a given airport regardless of the point of
  interest.
- `byArtcc(identifier, stratum?)` - returns every ARTCC feature for the given
  3-letter center code (e.g. `"ZNY"`), optionally filtered to a single
  stratum (`LOW`, `HIGH`, `UTA`, `CTA`, `FIR`, or `CTA/FIR`).

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

**Returns:** `AirspaceResolver` - an object exposing `query(AirspaceQuery)`,
`byAirport(identifier, types?)`, and `byArtcc(identifier, stratum?)` methods.

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

Returns every non-ARTCC airspace feature whose `identifier` property matches. For
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

### `resolver.byArtcc(identifier, stratum?)`

Returns every ARTCC feature for the given three-letter center code
(e.g. `"ZNY"`, `"ZBW"`). Each US ARTCC is published as multiple features -
one per stratum (`LOW`, `HIGH`, plus oceanic `UTA`, `CTA`, `FIR`, or
`CTA/FIR` where applicable) - because the lateral extent can vary between
strata. Pass an optional stratum filter to narrow results.

```typescript
// Both LOW and HIGH boundaries for the New York center
const zny = resolver.byArtcc('ZNY');

// Just the high-altitude boundary for the Boston center
const zbwHigh = resolver.byArtcc('ZBW', 'HIGH');
```

### ARTCC altitude bounds

ARTCC features carry stratum-aligned floor/ceiling values for use with
`query()`:

| Stratum   | Floor         | Ceiling       |
| --------- | ------------- | ------------- |
| `LOW`     | SFC           | 18,000 ft MSL |
| `HIGH`    | 18,000 ft MSL | 60,000 ft MSL |
| `UTA`     | 60,000 ft MSL | 99,999 ft MSL |
| `CTA`     | SFC           | 99,999 ft MSL |
| `FIR`     | SFC           | 99,999 ft MSL |
| `CTA/FIR` | SFC           | 99,999 ft MSL |

These are operational stratum approximations rather than legal limits.
The `99,999` ceiling is a sentinel meaning "effectively unlimited" -
queries above FL600 will still match the relevant stratum.

Oceanic FIR boundaries that cross the 180th meridian (ZAK FIR/CTA and ZAP
FIR/CTA in the central Pacific) are split at the antimeridian during the
data build, so each emitted feature has coordinates within the standard
`[-180, 180]` range. A single source stratum produces two features in
those cases - one for the eastern sub-polygon and one for the western - but
both share the same `identifier` and `artccStratum`, so `byArtcc("ZAK")`
returns them together.
