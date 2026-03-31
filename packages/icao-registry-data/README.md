# @squawk/icao-registry-data

Pre-processed snapshot of US aircraft registrations derived from the FAA ReleasableAircraft database. Data only - no dependency on `@squawk/icao-registry`. Versioned and released independently; its release cadence follows the FAA 28-day update cycle.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_icao-registry-data.html)**

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

> Under active development. See the [docs](https://neilcochran.github.io/squawk/modules/_squawk_icao-registry-data.html) for current API status.
