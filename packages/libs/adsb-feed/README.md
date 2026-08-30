<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/adsb-feed</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/adsb-feed)](https://www.npmjs.com/package/@squawk/adsb-feed) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Live ADS-B aircraft feed from a local [dump1090-fa](https://github.com/flightaware/dump1090) station, normalized into the shared `Aircraft` type and emitted as `aircraft:new` / `aircraft:update` / `aircraft:lost` events. Two sources are provided against the same station: polling its `aircraft.json` HTTP output, or a persistent connection to its SBS/BaseStation output.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_adsb-feed.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Installation

```bash
npm install @squawk/adsb-feed
```

## Usage

### JSON source (HTTP polling)

Polls dump1090-fa's `aircraft.json` endpoint on an interval. Works in both Node and the browser (subject to CORS - see below).

```typescript
import { createJsonAircraftFeed } from '@squawk/adsb-feed';

const feed = createJsonAircraftFeed({
  url: 'http://192.168.1.50:8080/data/aircraft.json',
});

feed.addEventListener('aircraft:new', (event) => {
  console.log((event as CustomEvent).detail.aircraft);
});
feed.addEventListener('aircraft:lost', (event) => {
  console.log('lost', (event as CustomEvent).detail.icaoHex);
});

feed.start();
// later: feed.stop();
```

### SBS source (persistent socket)

Connects to dump1090-fa's SBS/BaseStation TCP output. Lower latency than polling - a new line arrives the instant dump1090-fa decodes a message, rather than waiting for the next snapshot. Node-only; reconnects automatically if the connection drops.

```typescript
import { createSbsAircraftFeed } from '@squawk/adsb-feed';

const feed = createSbsAircraftFeed({ host: '192.168.1.50' }); // port defaults to 30003

feed.addEventListener('aircraft:update', (event) => {
  console.log((event as CustomEvent).detail.aircraft);
});

feed.start();
```

Both factories return the same `AircraftFeed` shape, so switching sources for a given consumer is a one-line change - `getAircraft`, `getAllAircraft`, `getPositionHistory`, and the event names are identical either way.

## Browser / SPA usage

Import `createJsonAircraftFeed` from the `/browser` subpath. `createSbsAircraftFeed` depends on Node's `net` module (raw TCP sockets have no browser API) and is not exported there.

```typescript
import { createJsonAircraftFeed } from '@squawk/adsb-feed/browser';
```

dump1090-fa does not send CORS headers, so a browser fetching `aircraft.json` directly from another origin is blocked. Point `url` at a same-origin reverse proxy that forwards to your station - the same pattern `@squawk/weather`'s `/fetch` layer documents for the Aviation Weather Center API.

## API

- `createJsonAircraftFeed({ url, pollIntervalMs?, fetch?, staleAfterMs?, positionHistoryRetention? })` - creates a feed backed by HTTP-polled `aircraft.json`.
- `createSbsAircraftFeed({ host, port?, reconnectDelayMs?, staleAfterMs?, positionHistoryRetention? })` - creates a feed backed by a persistent SBS/BaseStation socket connection. Node-only.
- `feed.start()` / `feed.stop()` - begin or end polling/connecting. `stop()` clears all tracked state.
- `feed.getAircraft(icaoHex)` / `feed.getAllAircraft()` - current normalized `Aircraft` state.
- `feed.getPositionHistory(icaoHex)` - retained position samples for one aircraft, oldest first.
- Events (via `addEventListener`, read off `CustomEvent.detail`): `aircraft:new` and `aircraft:update` (`{ aircraft: Aircraft }`), `aircraft:lost` (`{ icaoHex: string, lastAircraft: Aircraft }`).

`Aircraft.origin` / `Aircraft.destination` are never populated - ADS-B data carries no flight-schedule information, so resolving a live aircraft's actual origin or destination needs a data source outside this package.
