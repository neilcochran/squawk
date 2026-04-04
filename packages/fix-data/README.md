# @squawk/fix-data

Pre-processed snapshot of US fix/waypoint data derived from the FAA NASR 28-day
subscription cycle. Data only - no query logic, no dependency on
`@squawk/fixes`.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_fix-data.html)**

## Coverage

- All non-CNF US named fixes and waypoints: waypoints, reporting points, VFR waypoints, NRS waypoints, military waypoints/reporting points, and radar fixes
- Geographic coordinates (decimal degrees)
- Usage category (WP, RP, VFR, NRS, MW, MR, RADAR)
- ARTCC assignment (low and high altitude)
- Compulsory reporting designation
- Operational flags (pitch, catch, SUA/ATCAA)
- Minimum reception altitude where published
- Chart type associations (IAP, STAR, SID, ENROUTE, etc.)
- Navaid associations with bearing and distance

## Installation

```bash
npm install @squawk/fix-data
```

## Usage

```typescript
import { usBundledFixes } from '@squawk/fix-data';

// Inspect metadata
console.log(usBundledFixes.properties.nasrCycleDate); // "2026-01-22"
console.log(usBundledFixes.properties.recordCount);

// Use with @squawk/fixes for zero-config fix queries
import { createFixResolver } from '@squawk/fixes';

const resolver = createFixResolver({ data: usBundledFixes.records });
```

Consumers who have their own data pipeline can use `@squawk/fixes` alone and
pass any compatible Fix array at initialization.

## Data format

Each record is a full `Fix` object from `@squawk/types`. Key fields:

| Property                   | Type                       | Description                                          |
| -------------------------- | -------------------------- | ---------------------------------------------------- |
| `identifier`               | string                     | Fix identifier (e.g. "MERIT", "BOSCO")               |
| `icaoRegionCode`           | string                     | ICAO region code (e.g. "K6", "K7")                   |
| `lat`, `lon`               | number                     | Decimal degrees                                      |
| `state`, `country`         | string                     | Two-letter codes                                     |
| `useCode`                  | FixUseCode                 | WP, RP, VFR, NRS, MW, MR, or RADAR                   |
| `highArtccId`              | string or undefined        | High-altitude ARTCC (e.g. "ZNY")                     |
| `lowArtccId`               | string or undefined        | Low-altitude ARTCC                                   |
| `compulsory`               | FixCompulsory or undefined | HIGH, LOW, or LOW/HIGH                               |
| `pitch`                    | boolean                    | Pitch designation                                    |
| `catch`                    | boolean                    | Catch designation                                    |
| `suaAtcaa`                 | boolean                    | Special Use Airspace / ATCAA association             |
| `minimumReceptionAltitude` | number or undefined        | MRA in feet                                          |
| `chartTypes`               | string[]                   | Charts the fix appears on (IAP, STAR, ENROUTE, etc.) |
| `navaidAssociations`       | FixNavaidAssociation[]     | Bearing/distance from nearby navaids                 |

## Data source

All data is derived from the FAA National Airspace System Resource (NASR) 28-day
subscription, which is public domain. Fix data comes from FIX_BASE.csv,
FIX_CHRT.csv, and FIX_NAV.csv. The build pipeline that produces this dataset
lives in `scripts/build-fix-data/`.
