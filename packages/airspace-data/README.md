<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/airspace-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/airspace-data)](https://www.npmjs.com/package/@squawk/airspace-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed GeoJSON snapshot of US airspace geometry derived from the FAA NASR
28-day subscription cycle. Data only - no query logic, no dependency on
`@squawk/airspace`.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Coverage

- Class B, C, D, and E controlled airspace (E2 through E7 subtypes)
- Special Use Airspace: MOAs, restricted, prohibited, warning, alert, and national security areas

## Usage

```typescript
import { usBundledAirspace } from '@squawk/airspace-data';

// Inspect metadata
console.log(usBundledAirspace.properties.nasrCycleDate); // "2026-01-22"
console.log(usBundledAirspace.properties.featureCount); // 6842

// Use with @squawk/airspace for zero-config airspace queries
import { createAirspaceResolver } from '@squawk/airspace';

const resolver = createAirspaceResolver({ data: usBundledAirspace });
```

Consumers who have their own data pipeline can use `@squawk/airspace` alone and
pass any compatible GeoJSON dataset at initialization.

## Data format

The export is a GeoJSON `FeatureCollection`. Each feature's geometry is a Polygon
representing one airspace boundary. Feature properties include:

| Property              | Type           | Description                                                                   |
| --------------------- | -------------- | ----------------------------------------------------------------------------- |
| `type`                | string         | Airspace type (CLASS_B, CLASS_C, CLASS_D, CLASS_E2-E7, MOA, RESTRICTED, etc.) |
| `name`                | string         | Human-readable name                                                           |
| `identifier`          | string         | NASR designator or airport identifier                                         |
| `floor`               | AltitudeBound  | Lower vertical bound                                                          |
| `ceiling`             | AltitudeBound  | Upper vertical bound                                                          |
| `state`               | string or null | Two-letter US state abbreviation                                              |
| `controllingFacility` | string or null | Controlling ARTCC or facility                                                 |
| `scheduleDescription` | string or null | Operating schedule text                                                       |

`AltitudeBound` is `{ valueFt: number, reference: 'MSL' | 'AGL' | 'SFC' }`.

## Data source

The bundled snapshot is built from the **2026-01-22** NASR cycle. The FAA publishes
updated NASR data every 28 days. To update, re-run the build pipeline below against
a newer cycle.

All geometry and metadata is derived from the FAA National Airspace System Resource
(NASR) 28-day subscription, which is public domain. Class B/C/D/E boundaries come
from the NASR ESRI Shapefile and SUA boundaries from the AIXM 5.0 XML files. The
build pipeline that produces this dataset lives in `scripts/build-airspace-data/`.
