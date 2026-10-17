<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/fix-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/fix-data)](https://www.npmjs.com/package/@squawk/fix-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed snapshot of fix/waypoint data from the **2026-10-29** FAA NASR
cycle. Data only - no query logic, no dependency on
`@squawk/fixes`.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_fix-data.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Coverage

- All non-CNF named fixes and waypoints the FAA publishes: US-domestic waypoints, reporting points, VFR waypoints, NRS waypoints, military waypoints/reporting points, and radar fixes, plus selected Canadian, Mexican, Caribbean, and Pacific fixes that participate in US operations
- Geographic coordinates (decimal degrees)
- Usage category (WP, RP, VFR, NRS, MW, MR, RADAR)
- ARTCC assignment (low and high altitude)
- Compulsory reporting designation
- Operational flags (pitch, catch, SUA/ATCAA)
- Minimum reception altitude where published
- Chart type associations (IAP, STAR, SID, ENROUTE, etc.)
- The facilities that define each fix (navaids, localizers and marker beacons), with the magnetic bearing and the distance from each where the FAA publishes them

## Installation

```bash
npm install @squawk/fix-data
```

## Usage

```typescript
import { usBundledFixes } from '@squawk/fix-data';

// Inspect metadata
console.log(usBundledFixes.properties.nasrCycleDate); // YYYY-MM-DD
console.log(usBundledFixes.properties.recordCount);

// Use with @squawk/fixes for zero-config fix queries
import { createFixResolver } from '@squawk/fixes';

const resolver = createFixResolver({ data: usBundledFixes.records });
```

Consumers who have their own data pipeline can use `@squawk/fixes` alone and
pass any compatible Fix array at initialization.

## Browser / SPA usage

For browsers, edge runtimes (Cloudflare Workers, Deno Deploy), and any other
environment without `node:fs`, import the async loader from the `/browser`
subpath. It fetches and decompresses the bundled `.gz` using Web Streams
(`DecompressionStream`) and the global `fetch`.

```typescript
import { loadUsBundledFixes } from '@squawk/fix-data/browser';
import { createFixResolver } from '@squawk/fixes/browser';

const dataset = await loadUsBundledFixes();
const resolver = createFixResolver({ data: dataset.records });
```

The default URL is resolved relative to this module's `import.meta.url`,
which works under any modern ESM bundler when the package is installed
normally.

To host the asset on your own CDN, to use a bundler-resolved (hashed)
asset URL, or to override the URL for any other reason, pass an explicit
`url`:

```typescript
import { loadUsBundledFixes } from '@squawk/fix-data/browser';

const dataset = await loadUsBundledFixes({
  url: 'https://your-cdn.example/fixes.json.gz',
});
```

The loader also accepts a custom `fetch` implementation, which is useful in
tests or in edge environments that need a configured fetcher.

## Reading the metadata without loading the data

Importing the package decompresses and parses the whole fix snapshot. When all
you need is the data's vintage - to show which cycle you are serving, or to decide
whether to refresh - import the `/meta` subpath instead. It is a plain constant with
no file access, so it costs nothing and works the same in Node and the browser.

```typescript
import { usBundledFixesProperties } from '@squawk/fix-data/meta';

console.log(usBundledFixesProperties.nasrCycleDate); // YYYY-MM-DD
console.log(usBundledFixesProperties.recordCount);
```

The values are identical to `usBundledFixes.properties`; the difference is only
that reading them this way does not pull the records into memory.

## Data format

Each record is a full `Fix` object from `@squawk/types`. Key fields:

| Property                     | Type                       | Description                                          |
| ---------------------------- | -------------------------- | ---------------------------------------------------- |
| `identifier`                 | string                     | Fix identifier (e.g. "MERIT", "BOSCO")               |
| `icaoRegionCode`             | string                     | ICAO region code (e.g. "K6", "K7", "CY" for Canada)  |
| `lat`, `lon`                 | number                     | Decimal degrees                                      |
| `country`                    | string                     | Two-letter country code                              |
| `state`                      | string or undefined        | Two-letter code for US fixes, absent for foreign     |
| `useCode`                    | FixUseCode                 | WP, RP, VFR, NRS, MW, MR, or RADAR                   |
| `highArtccId`                | string or undefined        | High-altitude ARTCC (e.g. "ZNY")                     |
| `lowArtccId`                 | string or undefined        | Low-altitude ARTCC                                   |
| `compulsory`                 | FixCompulsory or undefined | HIGH, LOW, or LOW/HIGH                               |
| `pitch`                      | boolean                    | Pitch designation                                    |
| `catch`                      | boolean                    | Catch designation                                    |
| `suaAtcaa`                   | boolean                    | Special Use Airspace / ATCAA association             |
| `minimumReceptionAltitudeFt` | number or undefined        | MRA in feet                                          |
| `chartTypes`                 | string[]                   | Charts the fix appears on (IAP, STAR, ENROUTE, etc.) |
| `navaidAssociations`         | FixNavaidAssociation[]     | Facilities that define the fix (see below)           |

Each `navaidAssociations` entry is a facility that defines the fix:

| Property             | Type                | Description                                                       |
| -------------------- | ------------------- | ----------------------------------------------------------------- |
| `navaidId`           | string              | Facility identifier (e.g. "BOS"; "PDK" for the localizer "I-PDK") |
| `navaidType`         | string              | VOR, VORTAC, VOR/DME, TACAN, DME, NDB, NDB/DME, LOC, OM, or MM    |
| `magneticBearingDeg` | number or undefined | Magnetic bearing from the facility to the fix                     |
| `distanceNm`         | number or undefined | Distance from the facility to the fix, in nautical miles          |

## Coverage limits and known issues

- Computer navigation fixes (use code `CN`) are FAA automation points and are
  left out.
- A navaid association carries a bearing, a distance, both or neither, as the
  FAA publishes it. About a quarter give a bearing alone (a localizer course,
  or a radial from a VOR without DME), a few a distance alone, and a fix at a
  marker beacon usually neither. Check each for `undefined` before use.
- Association bearings are magnetic, and north is published as both 0 and 360.
  A localizer's distance is measured from the localizer antenna or, where the
  ILS has a DME sited elsewhere, from that DME.
- `navaidType` values `LOC`, `OM` and `MM` are localizers and marker beacons,
  which `@squawk/navaid-data` does not carry. A localizer's `navaidId` is the
  ILS identifier in `@squawk/airport-data` without its `I-` prefix.
- On 21 associations the published bearing or distance disagrees with the
  positions of the fix and the facility by 2 nm or more: `BRINA` sits on the
  `VTU` VOR but is published 9.5 nm from it, `LANBY` is off from both of its
  navaids, `IZERU` publishes a distance of 0, and five fixes defined from the
  `GSB` TACAN are each about 2.4 nm off. The intended values are not known, so
  they are carried as published; work from the coordinates where the geometry
  matters.
- A fix whose ICAO region is `K` or `P` alone is an offshore fix. Its `state`
  holds the FAA's offshore area code (`OA` Atlantic, `OG` Gulf, `OP` Pacific)
  rather than a US state, and Pacific island fixes use `QM` (Midway) and `QW`
  (Wake). Country `IB` is the FAA's code for the British West Indies, not an
  ISO code.
- Fixes at exactly 90 degrees north (`NOPOL`), on the antimeridian at 180 or
  -180, and on the equator at 0 are real positions, not placeholders.

## Data source

All data is derived from the [FAA National Airspace System Resource (NASR)](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/) 28-day
subscription, which is public domain. Fix data comes from FIX_BASE.csv,
FIX_CHRT.csv, and FIX_NAV.csv. The build pipeline that produces this dataset
lives in [tools/build-fix-data](https://github.com/neilcochran/squawk/tree/main/tools/build-fix-data).
