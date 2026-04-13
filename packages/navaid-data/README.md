<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/navaid-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/navaid-data)](https://www.npmjs.com/package/@squawk/navaid-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed snapshot of US navaid data derived from the FAA NASR 28-day
subscription cycle. Data only - no query logic, no dependency on
`@squawk/navaids`.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_navaid-data.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Coverage

- All non-shutdown US navigational aids: VOR, VORTAC, VOR/DME, TACAN, DME, NDB, NDB/DME, fan markers, marine NDBs, and VOTs
- Frequencies (MHz for VOR-family, kHz for NDB-family) and TACAN channels
- Elevation, magnetic variation, and service volume classification
- ARTCC assignment (low and high altitude)
- Power output, NDB class, operating hours, and simultaneous voice capability
- DME/TACAN component position when different from the main navaid

## Installation

```bash
npm install @squawk/navaid-data
```

## Usage

```typescript
import { usBundledNavaids } from '@squawk/navaid-data';

// Inspect metadata
console.log(usBundledNavaids.properties.nasrCycleDate); // "2026-01-22"
console.log(usBundledNavaids.properties.recordCount);

// Use with @squawk/navaids for zero-config navaid queries
import { createNavaidResolver } from '@squawk/navaids';

const resolver = createNavaidResolver({ data: usBundledNavaids.records });
```

Consumers who have their own data pipeline can use `@squawk/navaids` alone and
pass any compatible Navaid array at initialization.

## Data format

Each record is a full `Navaid` object from `@squawk/types`. Key fields:

| Property                     | Type                 | Description                                                 |
| ---------------------------- | -------------------- | ----------------------------------------------------------- |
| `identifier`                 | string               | Navaid identifier (e.g. "BOS", "JFK")                       |
| `name`                       | string               | Official facility name (e.g. "BOSTON")                      |
| `type`                       | NavaidType           | VOR, VORTAC, VOR/DME, TACAN, DME, NDB, NDB/DME, etc.        |
| `status`                     | NavaidStatus         | OPERATIONAL_IFR, OPERATIONAL_RESTRICTED, or OPERATIONAL_VFR |
| `lat`, `lon`                 | number               | Decimal degrees                                             |
| `state`, `country`           | string               | Two-letter codes                                            |
| `city`                       | string or undefined  | Associated city                                             |
| `elevationFt`                | number or undefined  | Elevation in feet MSL                                       |
| `frequencyMhz`               | number or undefined  | VOR-family frequency in MHz (108.0-117.95)                  |
| `frequencyKhz`               | number or undefined  | NDB-family frequency in kHz                                 |
| `tacanChannel`               | string or undefined  | TACAN/DME channel (e.g. "84X")                              |
| `magneticVariationDeg`       | number or undefined  | Magnetic variation in degrees                               |
| `magneticVariationDirection` | string or undefined  | "E" or "W"                                                  |
| `lowArtccId`                 | string or undefined  | Low-altitude ARTCC (e.g. "ZBW")                             |
| `highArtccId`                | string or undefined  | High-altitude ARTCC                                         |
| `navaidClass`                | string or undefined  | Service volume class (e.g. "VH", "VL", "H", "L", "T")       |
| `dmeServiceVolume`           | string or undefined  | DME service volume class                                    |
| `powerOutputWatts`           | number or undefined  | Transmitter power in watts                                  |
| `simultaneousVoice`          | boolean or undefined | Whether voice is carried on the frequency                   |
| `ndbClass`                   | string or undefined  | NDB classification (e.g. "HH", "MHW", "LOM")                |

## Data source

The bundled snapshot is built from the **2026-04-16** NASR cycle. The FAA publishes
updated NASR data every 28 days. To update, re-run the build pipeline below against
a newer cycle.

All data is derived from the [FAA National Airspace System Resource (NASR)](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/) 28-day
subscription, which is public domain. Navaid data comes from NAV_BASE.csv. The
build pipeline that produces this dataset lives in [tools/build-navaid-data](https://github.com/neilcochran/squawk/tree/main/tools/build-navaid-data).
