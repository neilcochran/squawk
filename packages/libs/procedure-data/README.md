<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/procedure-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/procedure-data)](https://www.npmjs.com/package/@squawk/procedure-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed snapshot of US instrument procedure data from the **2026-05-14** FAA CIFP
cycle. Covers Standard Instrument Departures (SIDs), Standard Terminal Arrival Routes
(STARs), and Instrument Approach Procedures (IAPs) in the unified ARINC 424 leg model.
Data only - no query logic, no dependency on `@squawk/procedures`.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_procedure-data.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Coverage

- Standard Instrument Departures (SIDs)
- Standard Terminal Arrival Routes (STARs)
- Instrument Approach Procedures (IAPs): ILS, LOC, LOC-BC, RNAV, RNAV (RNP), VOR, VOR/DME, NDB, NDB/DME, TACAN, GLS, IGS, LDA, SDF, GPS, FMS, MLS
- Full ARINC 424 leg model per procedure: path terminators (IF, TF, CF, DF, CA, CI, CR, FA, FC, FD, FM, HA, HF, HM, PI, RF, AF, VA, VD, VI, VM, VR)
- Altitude constraints (at / at-or-above / at-or-below / between / glide-slope / step-down descriptors) with primary and secondary altitudes
- Speed constraints with descriptor
- Recommended navaid, RNP value, turn direction, arc radius, center fix (for RF legs)
- Approach-role flags: IAF, IF (intermediate), FAF, FACF, MAP, fly-over
- Named transitions (approach transitions for IAPs, enroute / runway transitions for SIDs and STARs)
- Missed-approach sequences for IAPs
- Resolved lat/lon for every fix, navaid, airport, and runway reference

## Installation

```bash
npm install @squawk/procedure-data
```

## Usage

```typescript
import { usBundledProcedures } from '@squawk/procedure-data';

// Inspect metadata
console.log(usBundledProcedures.properties.cifpCycleDate); // "2026-05-14"
console.log(usBundledProcedures.properties.recordCount);
console.log(usBundledProcedures.properties.sidCount);
console.log(usBundledProcedures.properties.starCount);
console.log(usBundledProcedures.properties.iapCount);

// Use with @squawk/procedures for zero-config procedure queries
import { createProcedureResolver } from '@squawk/procedures';

const resolver = createProcedureResolver({ data: usBundledProcedures.records });
```

Consumers who have their own data pipeline can use `@squawk/procedures` alone and
pass any compatible `Procedure` array at initialization.

## Browser / SPA usage

For browsers, edge runtimes (Cloudflare Workers, Deno Deploy), and any other
environment without `node:fs`, import the async loader from the `/browser`
subpath. It fetches and decompresses the bundled `.gz` using Web Streams
(`DecompressionStream`) and the global `fetch`.

```typescript
import { loadUsBundledProcedures } from '@squawk/procedure-data/browser';
import { createProcedureResolver } from '@squawk/procedures';

const dataset = await loadUsBundledProcedures();
const resolver = createProcedureResolver({ data: dataset.records });
```

The default URL is resolved relative to this module's `import.meta.url`,
which works under any modern ESM bundler when the package is installed
normally.

To host the asset on your own CDN, to use a bundler-resolved (hashed)
asset URL, or to override the URL for any other reason, pass an explicit
`url`:

```typescript
import { loadUsBundledProcedures } from '@squawk/procedure-data/browser';

const dataset = await loadUsBundledProcedures({
  url: 'https://your-cdn.example/procedures.json.gz',
});
```

The loader also accepts a custom `fetch` implementation, which is useful in
tests or in edge environments that need a configured fetcher.

## Data format

Each record is a full `Procedure` object from `@squawk/types`. Key fields:

| Property         | Type                      | Description                                                          |
| ---------------- | ------------------------- | -------------------------------------------------------------------- |
| `name`           | string                    | Human-readable name (e.g. `AALLE4`, `ILS RWY 04L`)                   |
| `identifier`     | string                    | CIFP procedure identifier (e.g. `AALLE4`, `I04L`)                    |
| `type`           | ProcedureType             | `SID`, `STAR`, or `IAP`                                              |
| `airports`       | string[]                  | Airports served by this procedure                                    |
| `commonRoutes`   | ProcedureCommonRoute[]    | Trunk paths with legs and per-route adapted airports                 |
| `transitions`    | ProcedureTransition[]     | Named transitions (approach / enroute / runway depending on type)    |
| `approachType`   | ApproachType \| undefined | Approach classification (IAPs only)                                  |
| `runway`         | string \| undefined       | Runway served by the approach (IAPs with a runway-specific approach) |
| `missedApproach` | MissedApproachSequence    | Missed-approach climb-out (IAPs only)                                |

Each `ProcedureLeg` carries:

| Property                                                                                                                            | Type                       | Description                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------ |
| `pathTerminator`                                                                                                                    | ProcedureLegPathTerminator | ARINC 424 path terminator (e.g. `TF`, `CF`, `CA`)      |
| `fixIdentifier`, `category`, `lat`, `lon`, `icaoRegionCode`                                                                         | (see types)                | Termination fix (absent on pure heading/altitude legs) |
| `altitudeConstraint`                                                                                                                | AltitudeConstraint         | Descriptor + primary/secondary altitudes in feet       |
| `speedConstraint`                                                                                                                   | SpeedConstraint            | Descriptor + speed in knots                            |
| `courseDeg`, `courseIsTrue`                                                                                                         | number / boolean           | Outbound or intercept course                           |
| `distanceNm`, `holdTimeMin`                                                                                                         | number                     | Distance or hold time (leg-type dependent)             |
| `recommendedNavaid`, `thetaDeg`, `rhoNm`, `rnpNm`                                                                                   | (see types)                | Recommended navaid + bearing/distance/RNP reference    |
| `turnDirection`                                                                                                                     | `'L' \| 'R'`               | Commanded turn direction                               |
| `arcRadiusNm`, `centerFix`                                                                                                          | (see types)                | Populated on RF constant-radius-arc legs               |
| `isInitialApproachFix`, `isIntermediateFix`, `isFinalApproachFix`, `isFinalApproachCourseFix`, `isMissedApproachPoint`, `isFlyover` | boolean                    | Approach role flags                                    |

## Data source

Data is derived from the [FAA CIFP (Coded Instrument Flight Procedures)](https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/cifp/)
28-day cycle, which is public domain and published in ARINC 424 v18 format. The
build pipeline that produces this dataset lives in
[tools/build-procedure-data](https://github.com/neilcochran/squawk/tree/main/tools/build-procedure-data).

### A note on Obstacle Departure Procedures (ODPs)

Graphic ODPs are encoded by CIFP as SIDs (PD records) with no distinguishing
field, so they are included in this dataset labelled as `SID` alongside regular
Standard Instrument Departures. There is no reliable way to distinguish ODPs
from regular SIDs using CIFP data alone - the ODP indicator lives in the d-TPP
(Digital Terminal Procedures Publication) chart titles.

Textual ODPs (plain-English climb instructions published in the d-TPP
supplement) are not carried by CIFP at all and are therefore not included in
this dataset.
