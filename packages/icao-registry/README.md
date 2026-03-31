# @squawk/icao-registry

Resolves a 24-bit ICAO hex address to its aircraft registration and info. Pure logic library - contains no bundled data. Accepts an array of AircraftRegistration records at initialization. For zero-config use, pair with `@squawk/icao-registry-data`. Includes FAA ReleasableAircraft ZIP parsing utilities for consumers who want to fetch their own fresh data.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_icao-registry.html)**

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
