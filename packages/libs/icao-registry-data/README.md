<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/icao-registry-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/icao-registry-data)](https://www.npmjs.com/package/@squawk/icao-registry-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed snapshot of US aircraft registrations from the **2026-05-03** FAA ReleasableAircraft database. Data only - no dependency on `@squawk/icao-registry`. Versioned and released independently.

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

## Data source

All data is derived from the [FAA ReleasableAircraft](https://registry.faa.gov/database/ReleasableAircraft.zip) database, which is public
domain. The build pipeline that produces this dataset lives in
[tools/build-icao-registry-data](https://github.com/neilcochran/squawk/tree/main/tools/build-icao-registry-data).
