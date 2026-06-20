<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/airspace</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/airspace)](https://www.npmjs.com/package/@squawk/airspace) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pure logic library for querying US airspace geometry. Given a position and altitude,
returns all applicable airspace designations, or look up and fuzzy-search features by
identifier and name. Contains no bundled data - accepts a GeoJSON dataset at
initialization. For zero-config use, pair with `@squawk/airspace-data`.

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

// Fuzzy-search features by identifier and name (scored, best match first)
const matches = resolver.search({ text: 'LAX' });
console.log(matches[0]?.feature.identifier, matches[0]?.score);
```

Consumers who have their own GeoJSON airspace data can use this package standalone:

```typescript
import { createAirspaceResolver } from '@squawk/airspace';

const resolver = createAirspaceResolver({ data: myGeoJson });
```

## Browser / SPA usage

The resolver factory has no Node-specific imports and ships an explicit `/browser` subpath for SPAs and edge runtimes. Pair it with `@squawk/airspace-data/browser`:

```typescript
import { loadUsBundledAirspace } from '@squawk/airspace-data/browser';
import { createAirspaceResolver } from '@squawk/airspace/browser';

const dataset = await loadUsBundledAirspace();
const resolver = createAirspaceResolver({ data: dataset });
```

The `/browser` entry is identical to the main entry; the separate subpath exists so browser support is an explicit, `publint`-verified part of the public API surface.

## How it works

`createAirspaceResolver` parses the GeoJSON FeatureCollection at initialization and
returns a resolver object with the following methods:

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
- `byIdentifier(identifier, options?)` - type-agnostic identifier lookup that
  spans both partitions in one call, with an optional `types` inclusion
  filter and `includeArtcc` toggle.
- `search(AirspaceSearchQuery)` - fuzzy-searches features by identifier and
  name, returning scored results best-match first with the matched field and
  highlight ranges, optionally filtered by type.
- `byCentroid({ lon, lat, toleranceDeg? })` - returns features whose polygon
  centroid lies within tolerance of the query coordinates. Useful for
  resolving features whose `identifier` is empty (some Class E5 surfaces),
  where the centroid is the only stable handle.
- `withinBbox(bbox)` - returns features whose pre-indexed bounding box
  overlaps the query bbox. Reuses the bounding box cached at init time
  rather than recomputing per call.
- `forEachIndexed(callback)` - read-only iteration over the indexed corpus
  with positional `(feature, ring, boundingBox)` arguments, for callers
  that need to filter the corpus without reparsing the source GeoJSON.

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
`byAirport(identifier, types?)`, `byArtcc(identifier, stratum?)`,
`byIdentifier(identifier, options?)`, `search(query)`, `byCentroid(query)`,
`withinBbox(bbox)`, and `forEachIndexed(callback)` methods.

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

### `resolver.byIdentifier(identifier, options?)`

Type-agnostic identifier lookup. Returns every feature whose `identifier`
matches, spanning both the ARTCC and non-ARTCC partitions in one call.
Reach for this when the airspace type is not known up-front (e.g. parsed
from a URL); for ergonomic shortcuts, the partition-specific `byAirport` /
`byArtcc` wrappers stay available.

| Option         | Type                       | Description                                                                                     |
| -------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| `types`        | ReadonlySet\<AirspaceType> | Optional. When provided, acts as the authoritative inclusion filter; `includeArtcc` is ignored. |
| `includeArtcc` | boolean                    | Defaults to `true`. When `false` and `types` is omitted, ARTCC features are excluded.           |

```typescript
// Every feature for the identifier, ARTCC included
const all = resolver.byIdentifier('ZNY');

// Only the non-ARTCC partition
const nonArtcc = resolver.byIdentifier('ZNY', { includeArtcc: false });

// Only matching types
const onlyClassB = resolver.byIdentifier('JFK', { types: new Set(['CLASS_B']) });
```

### `resolver.byCentroid(query)`

Returns every feature whose polygon centroid is within `toleranceDeg` of
`(lon, lat)`. The centroid is computed per call (not cached) so this is
O(n) over the corpus - suitable for occasional URL-driven lookups, not
hot loops. Useful for resolving features with an empty `identifier` (some
Class E5 surfaces), where the centroid is the fallback URL handle.

| Property       | Type   | Description                                                                                              |
| -------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `lon`          | number | Longitude in decimal degrees (WGS84)                                                                     |
| `lat`          | number | Latitude in decimal degrees (WGS84)                                                                      |
| `toleranceDeg` | number | Optional. Centroid match tolerance in degrees, applied independently to lon and lat. Defaults to 0.0001. |

```typescript
const matches = resolver.byCentroid({ lon: -118.4081, lat: 33.9425 });
```

### `resolver.withinBbox(bbox)`

Returns every feature whose pre-indexed bounding box overlaps the query
bbox. Reuses the bounding box cached at init time, so this is suitable
for tight loops over the corpus. Bounding-box overlap is a coarse spatial
filter: callers that need true polygon-polygon intersection should follow
up with their own geometry test on the returned features.

```typescript
const overlapping = resolver.withinBbox({
  minLon: -119,
  minLat: 33,
  maxLon: -118,
  maxLat: 35,
});
```

### `resolver.forEachIndexed(callback)`

Read-only iteration over the indexed corpus, invoking `callback` once per
feature with positional `(feature, ring, boundingBox)`. Exposes the
resolver's pre-parsed shape so callers that need to filter the corpus
themselves do not have to reparse the source GeoJSON or recompute geometry
per call. The `ring` and `boundingBox` arguments are the resolver's
internal caches and must not be mutated.

```typescript
resolver.forEachIndexed((feature, ring, boundingBox) => {
  // ring is the parsed exterior ring (number[][]).
  // boundingBox is the pre-computed axis-aligned bbox.
});
```

### `resolver.search(query)`

Fuzzy-searches airspace features across identifier and name. Matching is
case-insensitive and tolerant of prefixes, substrings, subsequences, and small
typos. Results are scored and returned best-match first.

| Property   | Type                       | Description                                                                              |
| ---------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `text`     | string                     | Search text, matched fuzzily against each feature's identifier and name                  |
| `limit`    | number                     | Optional. Maximum number of results. Defaults to 20                                      |
| `types`    | ReadonlySet\<AirspaceType> | Optional. When provided, only features of these types are returned                       |
| `minScore` | number                     | Optional. Minimum match score (exclusive) in `[0, 1]` a result must reach. Defaults to 0 |

Returns `AirspaceSearchResult[]`, sorted by descending score, each containing:

- `feature` - the matched `AirspaceFeature` record
- `score` - match strength in `[0, 1]`, where 1 is an exact identifier or name match
- `matchedField` - which field produced the best match: `'identifier'` or `'name'`
- `ranges` - matched character ranges within the best-matching field's text, for highlighting

Features with an empty identifier and name (some Class E5 surfaces) never match a
non-empty query and are simply absent from results.

```typescript
const results = resolver.search({ text: 'LAX', limit: 10 });
for (const { feature, score, matchedField } of results) {
  console.log(feature.identifier, score, `(matched ${matchedField})`);
}
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
