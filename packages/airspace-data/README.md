# @squawk/airspace-data

Pre-processed GeoJSON snapshot of US airspace geometry derived from the FAA NASR
28-day subscription cycle. Data only - no query logic, no dependency on
`@squawk/airspace`.

## Coverage

- Class B, C, and D controlled airspace
- Special Use Airspace: MOAs, restricted, prohibited, warning, alert, and national security areas
- Class E is excluded due to volume

## Usage

```typescript
import { usBundledAirspace } from '@squawk/airspace-data';

// Inspect metadata
console.log(usBundledAirspace.properties.nasrCycleDate); // "2026-01-22"
console.log(usBundledAirspace.properties.featureCount); // 2505

// Use with @squawk/airspace for zero-config airspace queries
import { createAirspaceResolver } from '@squawk/airspace';

const resolver = createAirspaceResolver({ data: usBundledAirspace });
```

Consumers who have their own data pipeline can use `@squawk/airspace` alone and
pass any compatible GeoJSON dataset at initialization.

## Data format

The export is a GeoJSON `FeatureCollection`. Each feature's geometry is a Polygon
representing one airspace boundary. Feature properties include:

| Property              | Type           | Description                                                      |
| --------------------- | -------------- | ---------------------------------------------------------------- |
| `type`                | string         | Airspace type (CLASS_B, CLASS_C, CLASS_D, MOA, RESTRICTED, etc.) |
| `name`                | string         | Human-readable name                                              |
| `identifier`          | string         | NASR designator or airport identifier                            |
| `floor`               | AltitudeBound  | Lower vertical bound                                             |
| `ceiling`             | AltitudeBound  | Upper vertical bound                                             |
| `state`               | string or null | Two-letter US state abbreviation                                 |
| `controllingFacility` | string or null | Controlling ARTCC or facility                                    |
| `scheduleDescription` | string or null | Operating schedule text                                          |

`AltitudeBound` is `{ valueFt: number, reference: 'MSL' | 'AGL' | 'SFC' }`.

## Data source

All geometry and metadata is derived from the FAA National Airspace System Resource
(NASR) 28-day subscription, which is public domain. Class B/C/D boundaries come
from the NASR ESRI Shapefile and SUA boundaries from the AIXM 5.0 XML files. The
build pipeline that produces this dataset lives in `scripts/build-airspace-data/`.
