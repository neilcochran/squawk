<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/icao-registry-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/icao-registry-data)](https://www.npmjs.com/package/@squawk/icao-registry-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed snapshot of US aircraft registrations from the **2026-10-13** FAA ReleasableAircraft database. Data only - no dependency on `@squawk/icao-registry`. Versioned and released independently.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_icao-registry-data.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Coverage

- Every aircraft in the FAA registry that has a Mode S (24-bit ICAO) address,
  about 317,000 records
- Registration (N-number), make, model, registrant, aircraft type, engine type
  and year of manufacture
- Registration status and expiration date. The registry is not limited to
  current registrations: it also lists pending, sale-reported, expired and
  revoked registrations and N-numbers assigned but never registered, and each
  record says which it is

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

## Browser / SPA usage

For browsers, edge runtimes (Cloudflare Workers, Deno Deploy), and any other
environment without `node:fs`, import the async loader from the `/browser`
subpath. It fetches and decompresses the bundled `.gz` using Web Streams
(`DecompressionStream`) and the global `fetch`.

```typescript
import { loadUsBundledRegistry } from '@squawk/icao-registry-data/browser';
import { createIcaoRegistry } from '@squawk/icao-registry/browser';

const dataset = await loadUsBundledRegistry();
const registry = createIcaoRegistry({ data: dataset.records });
```

The default URL is resolved relative to this module's `import.meta.url`,
which works under any modern ESM bundler when the package is installed
normally.

To host the asset on your own CDN, to use a bundler-resolved (hashed)
asset URL, or to override the URL for any other reason, pass an explicit
`url`:

```typescript
import { loadUsBundledRegistry } from '@squawk/icao-registry-data/browser';

const dataset = await loadUsBundledRegistry({
  url: 'https://your-cdn.example/icao-registry.json.gz',
});
```

The loader also accepts a custom `fetch` implementation, which is useful in
tests or in edge environments that need a configured fetcher.

## Data format

Each record is an `AircraftRegistration` object from `@squawk/types`:

| Property                     | Type                            | Description                                                          |
| ---------------------------- | ------------------------------- | -------------------------------------------------------------------- |
| `icaoHex`                    | string                          | 24-bit ICAO address, uppercase hex (e.g. "A004B3")                   |
| `registration`               | string                          | N-number (e.g. "N100")                                               |
| `registrationStatus`         | RegistrationStatus or undefined | `valid`, `registrationPending`, `saleReported`, `revoked`, and so on |
| `registrationExpirationDate` | string or undefined             | Expiration date as `YYYY-MM-DD`                                      |
| `make`                       | string or undefined             | Manufacturer name                                                    |
| `model`                      | string or undefined             | Model designation                                                    |
| `operator`                   | string or undefined             | Registrant name                                                      |
| `aircraftType`               | AircraftType or undefined       | `fixedWingSingleEngine`, `rotorcraft`, `glider`, and so on           |
| `engineType`                 | EngineType or undefined         | `reciprocating`, `turboFan`, `electric`, and so on                   |
| `yearManufactured`           | number or undefined             | Year of manufacture                                                  |

## Coverage limits and known issues

- A record is not necessarily a current registration. About 2% carry a status
  other than `valid`: pending, sale reported, assigned but never registered,
  expired, revoked or canceled. Check `registrationStatus` before presenting a
  record as the aircraft's current registration. The FAA describes `valid`,
  `validManufacturerDealer` and `validTrainee` as valid registrations.
- `operator` is absent on about 8,600 records: those where the FAA publishes
  no registrant name, and the pending and sale-reported registrations where
  it publishes `REGISTRATION PENDING` or `SALE REPORTED` in place of one.
- `registrationExpirationDate` is published for valid registrations and
  rarely for any other status. A few dates lie in the past.
- `yearManufactured` is absent on about a fifth of records, where the FAA
  publishes no year or 0.
- Aircraft with no Mode S address on record are left out, and deregistered
  aircraft are not part of the FAA's registered-aircraft file.

## Data source

All data is derived from the [FAA ReleasableAircraft](https://registry.faa.gov/database/ReleasableAircraft.zip) database, which is public
domain. The build pipeline that produces this dataset lives in
[tools/build-icao-registry-data](https://github.com/neilcochran/squawk/tree/main/tools/build-icao-registry-data).
