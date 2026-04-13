<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/icao-registry-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/icao-registry-data)](https://www.npmjs.com/package/@squawk/icao-registry-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed snapshot of US aircraft registrations derived from the FAA ReleasableAircraft database. Data only - no dependency on `@squawk/icao-registry`. Versioned and released independently;

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_icao-registry-data.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Installation

```bash
npm install @squawk/icao-registry-data
```

## Usage

Pair with `@squawk/icao-registry` for zero-config lookups:

```typescript
import { usBundledRegistry } from '@squawk/icao-registry-data';
import { createIcaoRegistry } from '@squawk/icao-registry';

const registry = createIcaoRegistry({ data: usBundledRegistry.records });
const aircraft = registry.lookup('A004B3');
```

## Data source

The bundled snapshot is built from the **2026-04-13** FAA ReleasableAircraft
database. The FAA updates this database periodically. To update, re-run the build
pipeline with a newer download.

All data is derived from the [FAA ReleasableAircraft](https://registry.faa.gov/database/ReleasableAircraft.zip) database, which is public
domain. The build pipeline that produces this dataset lives in
[tools/build-icao-registry-data](https://github.com/neilcochran/squawk/tree/main/tools/build-icao-registry-data).
