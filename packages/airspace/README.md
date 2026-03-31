# @squawk/airspace

Pure logic library for querying US airspace geometry. Given a position and altitude,
returns all applicable airspace designations. Contains no bundled data - accepts a
GeoJSON dataset at initialization. For zero-config use, pair with `@squawk/airspace-data`.

## Coverage

- Class B, C, and D controlled airspace
- Special Use Airspace: MOAs, restricted, prohibited, warning, alert, and national security areas
- Class E is excluded

## Usage

```typescript
import { usBundledAirspace } from '@squawk/airspace-data';
import { createAirspaceResolver } from '@squawk/airspace';

const resolve = createAirspaceResolver({ data: usBundledAirspace });

// Query a position and altitude
const features = resolve({ lat: 33.9425, lon: -118.4081, altitudeFt: 3000 });

for (const f of features) {
  console.log(f.type, f.name, f.identifier);
}
```

Consumers who have their own GeoJSON airspace data can use this package standalone:

```typescript
import { createAirspaceResolver } from '@squawk/airspace';

const resolve = createAirspaceResolver({ data: myGeoJson });
```

## How it works

`createAirspaceResolver` parses the GeoJSON FeatureCollection at initialization and
returns a resolver function. Each call to the resolver performs two checks per
feature:

1. **Lateral** - a ray casting point-in-polygon test against the feature boundary
2. **Vertical** - altitude comparison against floor and ceiling bounds

All matching features are returned as `AirspaceFeature` objects (from `@squawk/types`).

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

Creates a resolver function from a GeoJSON dataset.

**Parameters:**

- `options.data` - a GeoJSON `FeatureCollection` with airspace features

**Returns:** `AirspaceResolver` - a function with signature
`(query: AirspaceQuery) => AirspaceFeature[]`

### `AirspaceQuery`

| Property     | Type   | Description                          |
| ------------ | ------ | ------------------------------------ |
| `lat`        | number | Latitude in decimal degrees (WGS84)  |
| `lon`        | number | Longitude in decimal degrees (WGS84) |
| `altitudeFt` | number | Altitude in feet MSL                 |
