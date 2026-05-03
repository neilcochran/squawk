<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/icao-registry</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/icao-registry)](https://www.npmjs.com/package/@squawk/icao-registry) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Resolves a 24-bit ICAO hex address to its aircraft registration and info. Pure logic library - contains no bundled data. Accepts an array of AircraftRegistration records at initialization. For zero-config use, pair with `@squawk/icao-registry-data`. Includes FAA ReleasableAircraft ZIP parsing utilities for consumers who want to fetch their own fresh data.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_icao-registry.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Installation

```bash
npm install @squawk/icao-registry
```

## Usage

### With bundled data (zero-config)

```bash
npm install @squawk/icao-registry-data
```

```typescript
import { usBundledRegistry } from '@squawk/icao-registry-data';
import { createIcaoRegistry } from '@squawk/icao-registry';

const registry = createIcaoRegistry({ data: usBundledRegistry.records });
const aircraft = registry.lookup('A004B3');
```

### With fresh FAA data

```typescript
import { createIcaoRegistry, parseFaaRegistryZip } from '@squawk/icao-registry';

const zipBuffer = await fetch('https://registry.faa.gov/database/ReleasableAircraft.zip').then(
  (r) => r.arrayBuffer(),
);
const data = parseFaaRegistryZip(Buffer.from(zipBuffer));
const registry = createIcaoRegistry({ data });
```

### With custom data

```typescript
import { createIcaoRegistry } from '@squawk/icao-registry';

const registry = createIcaoRegistry({
  data: [{ icaoHex: 'A00001', registration: 'N12345', make: 'CESSNA', model: '172S' }],
});
```

> Under active development. See the [docs](https://neilcochran.github.io/squawk/modules/_squawk_icao-registry.html) for current API status.
