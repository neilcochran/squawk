<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/airway-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/airway-data)](https://www.npmjs.com/package/@squawk/airway-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed snapshot of US airway data derived from the FAA NASR 28-day
subscription cycle. Data only - no query logic, no dependency on
`@squawk/airways`.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_airway-data.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Coverage

- Victor airways (V1, V16, etc.) - VOR-based low-altitude routes
- Jet routes (J1, J60, etc.) - high-altitude IFR routes
- RNAV Q-routes (Q1, Q102, etc.) - GPS-based high-altitude routes
- RNAV T-routes (T238, T270, etc.) - GPS-based low-altitude routes
- Colored airways (Green, Red, Amber, Blue) - Alaska and other regions
- Oceanic routes (Atlantic, Bahama, Pacific, Puerto Rico)
- Full waypoint sequences with ordered fix/navaid references
- MEA, MOCA, MAA, MCA, and GNSS MEA altitude restrictions per segment
- Distance to next waypoint in nautical miles
- Magnetic course and changeover point data
- Signal gap and US airspace-only indicators

## Installation

```bash
npm install @squawk/airway-data
```

## Usage

```typescript
import { usBundledAirways } from '@squawk/airway-data';

// Inspect metadata
console.log(usBundledAirways.properties.nasrCycleDate); // "2026-01-22"
console.log(usBundledAirways.properties.recordCount);
console.log(usBundledAirways.properties.waypointCount);

// Use with @squawk/airways for zero-config airway queries
import { createAirwayResolver } from '@squawk/airways';

const resolver = createAirwayResolver({ data: usBundledAirways.records });
```

Consumers who have their own data pipeline can use `@squawk/airways` alone and
pass any compatible Airway array at initialization.

## Data format

Each record is a full `Airway` object from `@squawk/types`. Key fields:

| Property      | Type             | Description                                               |
| ------------- | ---------------- | --------------------------------------------------------- |
| `designation` | string           | Airway designation (e.g. "V16", "J60", "Q1", "ATA315")    |
| `type`        | AirwayType       | VICTOR, JET, RNAV_Q, RNAV_T, GREEN, RED, ATLANTIC, etc.   |
| `region`      | AirwayRegion     | US, ALASKA, or HAWAII                                     |
| `waypoints`   | AirwayWaypoint[] | Ordered waypoint sequence (west-to-east / south-to-north) |

Each `AirwayWaypoint` contains:

| Property                                | Type                | Description                             |
| --------------------------------------- | ------------------- | --------------------------------------- |
| `name`                                  | string              | Waypoint name                           |
| `identifier`                            | string or undefined | Short identifier (e.g. "BOS", "MERIT")  |
| `waypointType`                          | AirwayWaypointType  | NAVAID, FIX, WAYPOINT, BORDER, or OTHER |
| `lat`, `lon`                            | number              | Decimal degrees                         |
| `minimumEnrouteAltitudeFt`              | number or undefined | Minimum Enroute Altitude in feet        |
| `maximumAuthorizedAltitudeFt`           | number or undefined | Maximum Authorized Altitude in feet     |
| `minimumObstructionClearanceAltitudeFt` | number or undefined | Minimum Obstruction Clearance Altitude  |
| `distanceToNextNm`                      | number or undefined | Distance to next waypoint in NM         |
| `magneticCourseDeg`                     | number or undefined | Magnetic course to next waypoint        |

## Data source

The bundled snapshot is built from the **2026-04-16** NASR cycle. The FAA publishes
updated NASR data every 28 days. To update, re-run the build pipeline below against
a newer cycle.

All data is derived from the FAA National Airspace System Resource (NASR) 28-day
subscription, which is public domain. Airway data comes from AWY.txt
(Victor, Jet, RNAV Q/T, colored airways) and ATS.txt (Atlantic, Bahama, Pacific,
Puerto Rico oceanic routes). The build pipeline that produces this dataset
lives in [tools/build-airway-data](https://github.com/neilcochran/squawk/tree/main/tools/build-airway-data).
