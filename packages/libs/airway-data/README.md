<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/airway-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/airway-data)](https://www.npmjs.com/package/@squawk/airway-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed snapshot of US airway data from the **2026-10-29** FAA NASR
cycle. Data only - no query logic, no dependency on
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
- Special routes (`SPZK214`, etc.) - the FAA's non-regulatory `ZK` helicopter
  air ambulance routes, which are not on public charts and may be filed only
  with FAA Flight Standards approval
- Full waypoint sequences with ordered fix/navaid references
- MEA, MOCA, MAA, GNSS MEA and DME/DME/IRU MEA per segment, each with the
  direction of travel it applies to
- Minimum crossing altitudes at the waypoint they apply to
- Distance, magnetic course and changeover point data per segment
- Published gaps, unusable segments, signal gap and US airspace-only indicators
- Magnetic variation at navaid waypoints and RNP where published
- FAA remarks per waypoint and per route

## Installation

```bash
npm install @squawk/airway-data
```

## Usage

```typescript
import { usBundledAirways } from '@squawk/airway-data';

// Inspect metadata
console.log(usBundledAirways.properties.nasrCycleDate); // YYYY-MM-DD
console.log(usBundledAirways.properties.recordCount);
console.log(usBundledAirways.properties.waypointCount);

// Use with @squawk/airways for zero-config airway queries
import { createAirwayResolver } from '@squawk/airways';

const resolver = createAirwayResolver({ data: usBundledAirways.records });
```

Consumers who have their own data pipeline can use `@squawk/airways` alone and
pass any compatible Airway array at initialization.

## Browser / SPA usage

For browsers, edge runtimes (Cloudflare Workers, Deno Deploy), and any other
environment without `node:fs`, import the async loader from the `/browser`
subpath. It fetches and decompresses the bundled `.gz` using Web Streams
(`DecompressionStream`) and the global `fetch`.

```typescript
import { loadUsBundledAirways } from '@squawk/airway-data/browser';
import { createAirwayResolver } from '@squawk/airways/browser';

const dataset = await loadUsBundledAirways();
const resolver = createAirwayResolver({ data: dataset.records });
```

The default URL is resolved relative to this module's `import.meta.url`,
which works under any modern ESM bundler when the package is installed
normally.

To host the asset on your own CDN, to use a bundler-resolved (hashed)
asset URL, or to override the URL for any other reason, pass an explicit
`url`:

```typescript
import { loadUsBundledAirways } from '@squawk/airway-data/browser';

const dataset = await loadUsBundledAirways({
  url: 'https://your-cdn.example/airways.json.gz',
});
```

The loader also accepts a custom `fetch` implementation, which is useful in
tests or in edge environments that need a configured fetcher.

## Reading the metadata without loading the data

Importing the package decompresses and parses the whole airway snapshot. When all
you need is the data's vintage - to show which cycle you are serving, or to decide
whether to refresh - import the `/meta` subpath instead. It is a plain constant with
no file access, so it costs nothing and works the same in Node and the browser.

```typescript
import { usBundledAirwaysProperties } from '@squawk/airway-data/meta';

console.log(usBundledAirwaysProperties.nasrCycleDate); // YYYY-MM-DD
console.log(usBundledAirwaysProperties.recordCount);
```

The values are identical to `usBundledAirways.properties`; the difference is only
that reading them this way does not pull the records into memory.

## Data format

Each record is a full `Airway` object from `@squawk/types`. Key fields:

| Property      | Type                  | Description                                                       |
| ------------- | --------------------- | ----------------------------------------------------------------- |
| `designation` | string                | Airway designation (e.g. "V16", "J60", "Q1", "ATA315", "SPZK214") |
| `type`        | AirwayType            | VICTOR, JET, RNAV_Q, RNAV_T, GREEN, RED, ATLANTIC, SPECIAL, etc.  |
| `region`      | AirwayRegion          | US, ALASKA, or HAWAII                                             |
| `waypoints`   | AirwayWaypoint[]      | Ordered waypoint sequence (west-to-east / south-to-north)         |
| `remarks`     | string[] or undefined | FAA remarks about the whole route (e.g. "HF COMM REQUIRED")       |

Oceanic and special route designations carry the NASR route category as a
prefix: Atlantic route A315 is `ATA315`, special route ZK214 is `SPZK214`.

Each `AirwayWaypoint` contains:

| Property                                | Type                         | Description                                            |
| --------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| `name`                                  | string                       | Waypoint name                                          |
| `identifier`                            | string or undefined          | Short identifier (e.g. "BOS", "MERIT")                 |
| `waypointType`                          | AirwayWaypointType           | NAVAID, FIX, WAYPOINT, or OTHER                        |
| `lat`, `lon`                            | number                       | Decimal degrees                                        |
| `minimumEnrouteAltitudeFt`              | number or undefined          | MEA in feet for the segment starting here              |
| `minimumEnrouteAltitudeDirection`       | AirwayDirection or undefined | Direction the MEA applies to (e.g. "E BND")            |
| `maximumAuthorizedAltitudeFt`           | number or undefined          | Maximum Authorized Altitude in feet                    |
| `minimumObstructionClearanceAltitudeFt` | number or undefined          | Minimum Obstruction Clearance Altitude                 |
| `gnssMinimumEnrouteAltitudeFt`          | number or undefined          | GNSS MEA in feet                                       |
| `dmeDmeIruMinimumEnrouteAltitudeFt`     | number or undefined          | DME/DME/IRU MEA in feet                                |
| `minimumCrossingAltitudeFt`             | number or undefined          | MCA in feet at this waypoint                           |
| `distanceToNextNm`                      | number or undefined          | Distance to next waypoint in NM                        |
| `magneticCourseDeg`                     | number or undefined          | Magnetic course to next waypoint                       |
| `magneticVariationDeg`                  | number or undefined          | Magnetic variation at a navaid waypoint, whole degrees |
| `rnpNm`                                 | number or undefined          | Required navigation performance in NM                  |
| `discontinued`                          | boolean or undefined         | The airway is discontinued after this waypoint         |
| `unusable`                              | boolean or undefined         | The segment starting here is unusable                  |
| `remarks`                               | string[] or undefined        | FAA remarks about this waypoint                        |

Every altitude that applies in one direction only carries a companion
direction field (`minimumEnrouteAltitudeDirection`, `gnssMinimumEnrouteAltitudeDirection`,
and so on) holding one of the eight compass forms the FAA publishes, from `N BND`
to `NW BND`. A direction is present only together with its altitude; an altitude
without a direction applies in both directions.

A minimum crossing altitude sits on the waypoint it applies at. NASR publishes
each MCA on a segment record together with the name of the point it applies at,
which is usually the next waypoint and can be several waypoints further along, so
the bundled data attaches the MCA fields to that named waypoint.

`unusable` marks a segment the FAA publishes but does not allow to be flown,
from the MEA GAP column of the source or from an `UNUSABLE` remark on the point.
Such a segment keeps its waypoints and distance and has no MEA. `discontinued`
marks a published gap, after which the airway does not exist until the next
waypoint; `@squawk/airways` reports both on an expansion.

`distanceToNextNm` is set only where the FAA publishes a distance to the next
waypoint in the sequence. It is unset on the last waypoint of an airway, on a
waypoint after which the airway is discontinued, and on a waypoint whose
successor in the NASR file is a border crossing without coordinates (those
points are not included).

## Coverage limits and known issues

- Border crossing points ("U.S. CANADIAN BORDER", "U.S. MEXICAN BORDER") are
  published without coordinates and are not included, so no waypoint carries
  the `BORDER` type and the leg into a border crossing has no distance. Ten
  legs between two included waypoints also have no published distance (for
  example `J1` TIJ to TEYON and `T719` MOCKA to EEVER); `@squawk/flightplan`
  measures those legs by great circle.
- The `state` of a waypoint can be one of NASR's pseudo-codes: `OA`, `OP` and
  `OG` for oceanic points in the Atlantic, the Pacific and the Gulf of Mexico,
  and `59` for Canada. The ICAO region codes `K` and `P` are the FAA's
  convention for offshore fixes. `artccId` can name a Canadian centre (`ZYZ`,
  `ZVR`, `ZWG`, `ZQM`, `ZUL`) on a point next to the border.
- Forty-nine designations exist twice, once in the contiguous US and once in
  Hawaii (`V1` to `V24`, `V301` and others); both are included with their own
  `region`, and `@squawk/airways` returns both from a designation lookup.
- The MEA GAP column's `N` value (no MEA established) is not carried as a
  field: the MEA fields are simply absent, as they are on the oceanic routes
  the FAA publishes without MEAs. About thirty domestic segments have no MEA
  and no gap or unusable flag, several of them around the WINK VORTAC, and
  are included as published.
- The changeover point navaid records (AWY3) and changeover exception text
  (AWY5) are not modelled; `changeoverDistanceNm` is.
- One source correction is applied before the build: the FAA publishes the
  `T291` MCA of 3,800 ft NE BND at MORTO without naming its point. Part 95
  Amendment 580 raises the T291 MEA from 3,300 to 3,800 at Selinsgrove
  northeast-bound and the record's own Part 95 next-MEA-point column names
  SEG, so the MCA is attached to Selinsgrove.
- Special routes are included because the FAA publishes them, with the same
  fields as other routes. They are non-regulatory, not on public charts, and
  may be filed only with FAA Flight Standards approval.

## Data source

All data is derived from the [FAA National Airspace System Resource (NASR)](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/) 28-day
subscription, which is public domain. Airway data comes from AWY.txt
(Victor, Jet, RNAV Q/T, colored airways) and ATS.txt (Atlantic, Bahama, Pacific,
Puerto Rico oceanic routes and special routes). The build pipeline that produces this dataset
lives in [tools/build-airway-data](https://github.com/neilcochran/squawk/tree/main/tools/build-airway-data).
