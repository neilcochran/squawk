<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/fix-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/fix-data)](https://www.npmjs.com/package/@squawk/fix-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed snapshot of fix/waypoint data from the **2026-04-16** FAA NASR
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

## Browser / SPA usage

For browsers, edge runtimes (Cloudflare Workers, Deno Deploy), and any other
environment without `node:fs`, import the async loader from the `/browser`
subpath. It fetches and decompresses the bundled `.gz` using Web Streams
(`DecompressionStream`) and the global `fetch`.

```typescript
import { loadUsBundledFixes } from '@squawk/fix-data/browser';
import { createFixResolver } from '@squawk/fixes';

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
| `navaidAssociations`         | FixNavaidAssociation[]     | Bearing/distance from nearby navaids                 |

## Data source

All data is derived from the [FAA National Airspace System Resource (NASR)](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/) 28-day
subscription, which is public domain. Fix data comes from FIX_BASE.csv,
FIX_CHRT.csv, and FIX_NAV.csv. The build pipeline that produces this dataset
lives in [tools/build-fix-data](https://github.com/neilcochran/squawk/tree/main/tools/build-fix-data).
