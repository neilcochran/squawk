<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/geo</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/geo)](https://www.npmjs.com/package/@squawk/geo) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Geospatial utilities for aviation applications: great-circle distance, initial bearing, midpoint, destination point, and polygon containment.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_geo.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Installation

```bash
npm install @squawk/geo
```

## Usage

Exports are grouped by domain namespace to keep call sites self-documenting:

```ts
import { greatCircle, polygon } from '@squawk/geo';

// Great-circle calculations (WGS84 lat/lon in decimal degrees)
const distNm = greatCircle.distanceNm(40.6413, -73.7781, 33.9425, -118.4081);
const brgDeg = greatCircle.bearing(40.6413, -73.7781, 33.9425, -118.4081);
const both = greatCircle.bearingAndDistance(40.6413, -73.7781, 33.9425, -118.4081);
const mid = greatCircle.midpoint(40.6413, -73.7781, 33.9425, -118.4081);
const dest = greatCircle.destination(40.6413, -73.7781, 270, 100);

// Polygon containment with bounding-box pre-filter
const ring: number[][] = [
  [-118.42, 33.93],
  [-118.42, 33.96],
  [-118.38, 33.96],
  [-118.38, 33.93],
  [-118.42, 33.93],
];
const box = polygon.boundingBox(ring);
if (polygon.pointInBoundingBox(-118.4, 33.945, box)) {
  if (polygon.pointInPolygon(-118.4, 33.945, ring)) {
    // point is inside the polygon
  }
}
```

## Key Features

- **Great-circle distance** in nautical miles using the Haversine formula
- **Initial bearing** between two positions, degrees true
- **Midpoint** and **destination point** along a great-circle path
- **Point-in-polygon** ray casting for arbitrary closed rings
- **Axis-aligned bounding box** computation and containment test, useful as a fast rejection filter before the full polygon test

## Conventions

- Latitude and longitude inputs are WGS84 decimal degrees (positive north and east)
- Distances are nautical miles; bearings are degrees true in the range [0, 360)
- Polygons use the GeoJSON `[lon, lat]` coordinate-pair convention for each ring point
