<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/navaid-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/navaid-data)](https://www.npmjs.com/package/@squawk/navaid-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed snapshot of navaid data from the **2026-10-29** FAA NASR
cycle. Data only - no query logic, no dependency on
`@squawk/navaids`.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_navaid-data.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Coverage

- All non-shutdown navigational aids the FAA publishes: US-domestic VOR, VORTAC, VOR/DME, TACAN, DME, NDB, NDB/DME, fan markers, marine NDBs, and VOTs, plus selected Canadian, Mexican, and Caribbean navaids that participate in US operations
- Frequencies (MHz for VOR-family, kHz for NDB-family) and TACAN channels
- Elevation, magnetic variation, and service volume classification
- ARTCC assignment (low and high altitude)
- Power output, NDB class, operating hours, and simultaneous voice capability
- DME/TACAN component position when different from the main navaid, and the
  DME's own operational status where the FAA publishes one
- FAA remarks, including the radials, distances and altitudes where a navaid's
  signal is unusable
- VOR receiver checkpoints

## Installation

```bash
npm install @squawk/navaid-data
```

## Usage

```typescript
import { usBundledNavaids } from '@squawk/navaid-data';

// Inspect metadata
console.log(usBundledNavaids.properties.nasrCycleDate); // YYYY-MM-DD
console.log(usBundledNavaids.properties.recordCount);

// Use with @squawk/navaids for zero-config navaid queries
import { createNavaidResolver } from '@squawk/navaids';

const resolver = createNavaidResolver({ data: usBundledNavaids.records });
```

Consumers who have their own data pipeline can use `@squawk/navaids` alone and
pass any compatible Navaid array at initialization.

## Browser / SPA usage

For browsers, edge runtimes (Cloudflare Workers, Deno Deploy), and any other
environment without `node:fs`, import the async loader from the `/browser`
subpath. It fetches and decompresses the bundled `.gz` using Web Streams
(`DecompressionStream`) and the global `fetch`.

```typescript
import { loadUsBundledNavaids } from '@squawk/navaid-data/browser';
import { createNavaidResolver } from '@squawk/navaids/browser';

const dataset = await loadUsBundledNavaids();
const resolver = createNavaidResolver({ data: dataset.records });
```

The default URL is resolved relative to this module's `import.meta.url`,
which works under any modern ESM bundler when the package is installed
normally.

To host the asset on your own CDN, to use a bundler-resolved (hashed)
asset URL, or to override the URL for any other reason, pass an explicit
`url`:

```typescript
import { loadUsBundledNavaids } from '@squawk/navaid-data/browser';

const dataset = await loadUsBundledNavaids({
  url: 'https://your-cdn.example/navaids.json.gz',
});
```

The loader also accepts a custom `fetch` implementation, which is useful in
tests or in edge environments that need a configured fetcher.

## Reading the metadata without loading the data

Importing the package decompresses and parses the whole navaid snapshot. When all
you need is the data's vintage - to show which cycle you are serving, or to decide
whether to refresh - import the `/meta` subpath instead. It is a plain constant with
no file access, so it costs nothing and works the same in Node and the browser.

```typescript
import { usBundledNavaidsProperties } from '@squawk/navaid-data/meta';

console.log(usBundledNavaidsProperties.nasrCycleDate); // YYYY-MM-DD
console.log(usBundledNavaidsProperties.recordCount);
```

The values are identical to `usBundledNavaids.properties`; the difference is only
that reading them this way does not pull the records into memory.

## Data format

Each record is a full `Navaid` object from `@squawk/types`. Key fields:

| Property                     | Type                            | Description                                                 |
| ---------------------------- | ------------------------------- | ----------------------------------------------------------- |
| `identifier`                 | string                          | Navaid identifier (e.g. "BOS", "JFK")                       |
| `name`                       | string                          | Official facility name (e.g. "BOSTON")                      |
| `type`                       | NavaidType                      | VOR, VORTAC, VOR/DME, TACAN, DME, NDB, NDB/DME, etc.        |
| `status`                     | NavaidStatus                    | OPERATIONAL_IFR, OPERATIONAL_RESTRICTED, or OPERATIONAL_VFR |
| `dmeStatus`                  | NavaidStatus or undefined       | Status of the DME component, where published separately     |
| `lat`, `lon`                 | number                          | Decimal degrees                                             |
| `country`                    | string                          | Two-letter country code                                     |
| `state`                      | string or undefined             | Two-letter code for US navaids, absent for foreign          |
| `city`                       | string or undefined             | Associated city                                             |
| `elevationFt`                | number or undefined             | Elevation in feet MSL                                       |
| `frequencyMhz`               | number or undefined             | VOR, TACAN, DME and VOT frequency in MHz                    |
| `frequencyKhz`               | number or undefined             | NDB-family frequency in kHz                                 |
| `tacanChannel`               | string or undefined             | TACAN/DME channel (e.g. "84X")                              |
| `magneticVariationDeg`       | number or undefined             | Magnetic variation in degrees                               |
| `magneticVariationDirection` | string or undefined             | "E" or "W"                                                  |
| `lowArtccId`                 | string or undefined             | Low-altitude ARTCC (e.g. "ZBW")                             |
| `highArtccId`                | string or undefined             | High-altitude ARTCC                                         |
| `navaidClass`                | string or undefined             | Service volume class (e.g. "VH", "VL", "H", "L", "T")       |
| `dmeServiceVolume`           | string or undefined             | DME service volume class                                    |
| `powerOutputWatts`           | number or undefined             | Transmitter power in watts                                  |
| `simultaneousVoice`          | boolean or undefined            | Whether voice is carried on the frequency                   |
| `publicUse`                  | boolean                         | Whether the navaid is open to public use                    |
| `ndbClass`                   | string or undefined             | NDB classification (e.g. "HH", "MHW", "LOM")                |
| `remarks`                    | string[] or undefined           | FAA remarks, mostly unusable radials and altitudes          |
| `checkpoints`                | NavaidCheckpoint[] or undefined | VOR receiver checkpoints (see below)                        |

Each `checkpoints` entry is a published spot for checking a VOR receiver:

| Property             | Type                | Description                                              |
| -------------------- | ------------------- | -------------------------------------------------------- |
| `type`               | string              | GROUND or AIRBORNE                                       |
| `magneticBearingDeg` | number              | Radial the receiver should indicate at the checkpoint    |
| `altitudeFt`         | number or undefined | Altitude in feet MSL for an airborne checkpoint          |
| `airportId`          | string or undefined | FAA identifier of the airport the checkpoint is at       |
| `description`        | string              | Where the checkpoint is, usually with its distance in NM |

## Coverage limits and known issues

- Shutdown navaids are left out, so `status` is never `SHUTDOWN`.
- Identifiers are not unique. About 70 are shared by two or more navaids (four
  NDBs use `IL`), so a look-up by identifier can return several records;
  tell them apart by type, state or position.
- `frequencyMhz` is in the VOR band, 108.0 to 117.95, except on a TACAN whose
  channel has no VOR-band pairing. Nine TACANs on channels 10 to 12 and 63 to
  65 publish their paired frequency of 133.6 to 135.5 MHz. Fan markers publish
  no frequency.
- The magnetic variation of a VOR, VORTAC, VOR/DME or TACAN is the variation
  the station is aligned to, which is what its radials are measured against.
  It is not the present-day variation at the station: about 400 navaids carry
  an alignment from 1975 or earlier, and three carry the year 2030. Use the
  published value to turn a radial into a true bearing, and a current magnetic
  model for anything else.
- A DME, VOT or fan marker has no magnetic variation. The FAA's files carry a
  value on ten fan markers and say to ignore it; it is left out.
- `markerIdentifier` is the identification a fan marker transmits, written as
  its keying ("DOT DASH DOT", "CONT DASHES"), not a facility identifier.
- `remarks` are the FAA's free text, abbreviations included. An unusable
  sector reads "VOR UNUSBL 163-236 BYD 40 NM BLW 18000 FT": radials 163 to
  236, beyond 40 NM, below 18,000 ft. Radials are magnetic, except that a
  stand-alone DME's are against true north and marked with a T ("080T-125T").
  Notes on how a position or elevation was surveyed are not carried.
- `dmeStatus` is published for DME, VOR/DME and NDB/DME facilities only. A
  VORTAC or TACAN has the single `status`.
- Every bundled checkpoint is a ground checkpoint; the FAA publishes no
  airborne ones in this cycle.
- Not carried: the owner and operator, the monitoring category, the FAA
  region and flight service station tie-in, the survey accuracy code, and the
  charting and routing flags (low facility on high chart, pitch, catch, Z
  marker, restriction). The restriction flag marks only 25 navaids while more
  than 900 publish an unusable sector; rely on `remarks`.
- The FAA's CSV gives the Thedford VOR/DME (`TDD`) the position of its DME in
  the decimal coordinate columns. The snapshot carries the VOR position from
  the same record's degree, minute and second columns, which agrees with the
  FAA's airway and procedure data, and the DME position in `dmeLat` / `dmeLon`.

## Data source

All data is derived from the [FAA National Airspace System Resource (NASR)](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/) 28-day
subscription, which is public domain. Navaid data comes from NAV_BASE.csv,
NAV_RMK.csv, and NAV_CKPT.csv. The
build pipeline that produces this dataset lives in [tools/build-navaid-data](https://github.com/neilcochran/squawk/tree/main/tools/build-navaid-data).
