<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/procedure-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/procedure-data)](https://www.npmjs.com/package/@squawk/procedure-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed snapshot of US instrument procedure data from the **2026-04-16** FAA NASR
cycle. Data only - no query logic, no dependency on
`@squawk/procedures`.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_procedure-data.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Coverage

- Standard Instrument Departures (SIDs/DPs)
- Standard Terminal Arrival Routes (STARs)
- Full waypoint sequences with fix identifiers and coordinates
- Named enroute transitions for each procedure
- Multiple common route variants for different runway configurations
- Adapted airport associations per procedure and per route
- Waypoint type classification (fix, navaid, airport)

## Installation

```bash
npm install @squawk/procedure-data
```

## Usage

```typescript
import { usBundledProcedures } from '@squawk/procedure-data';

// Inspect metadata
console.log(usBundledProcedures.properties.nasrCycleDate); // "2026-01-22"
console.log(usBundledProcedures.properties.recordCount);
console.log(usBundledProcedures.properties.sidCount);
console.log(usBundledProcedures.properties.starCount);

// Use with @squawk/procedures for zero-config procedure queries
import { createProcedureResolver } from '@squawk/procedures';

const resolver = createProcedureResolver({ data: usBundledProcedures.records });
```

Consumers who have their own data pipeline can use `@squawk/procedures` alone and
pass any compatible Procedure array at initialization.

## Data format

Each record is a full `Procedure` object from `@squawk/types`. Key fields:

| Property       | Type                   | Description                                               |
| -------------- | ---------------------- | --------------------------------------------------------- |
| `name`         | string                 | Human-readable name (e.g. "AALLE FOUR")                   |
| `computerCode` | string                 | FAA computer code (e.g. "AALLE4")                         |
| `type`         | ProcedureType          | SID or STAR                                               |
| `airports`     | string[]               | All adapted airports served by this procedure             |
| `commonRoutes` | ProcedureCommonRoute[] | Trunk paths with waypoints and per-route adapted airports |
| `transitions`  | ProcedureTransition[]  | Named entry/exit transitions                              |

Each `ProcedureWaypoint` contains:

| Property         | Type                      | Description                                    |
| ---------------- | ------------------------- | ---------------------------------------------- |
| `fixIdentifier`  | string                    | Fix or navaid identifier (e.g. "AALLE", "DEN") |
| `category`       | ProcedureWaypointCategory | FIX, NAVAID, or AIRPORT                        |
| `typeCode`       | ProcedureWaypointTypeCode | Raw FAA type code (P, R, NW, ND, AA, etc.)     |
| `lat`, `lon`     | number                    | Decimal degrees                                |
| `icaoRegionCode` | string or undefined       | ICAO region code (e.g. "K2", "K5")             |

## Data source

All data is derived from the [FAA National Airspace System Resource (NASR)](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/) 28-day
subscription, which is public domain. Procedure data comes from STARDP.txt, a
fixed-width file encoding SID and STAR waypoint sequences. The build pipeline
that produces this dataset lives in [tools/build-procedure-data](https://github.com/neilcochran/squawk/tree/main/tools/build-procedure-data).
