<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/adsb-feed</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/adsb-feed)](https://www.npmjs.com/package/@squawk/adsb-feed) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Live ADS-B aircraft feed from a local [dump1090-fa](https://github.com/flightaware/dump1090) station, normalized into the shared `Aircraft` type and emitted as `aircraft:new` / `aircraft:update` / `aircraft:lost` events. Three sources are provided against the same station: polling its `aircraft.json` HTTP output, a persistent connection to its SBS/BaseStation output, or a persistent connection to its raw Beast binary output.

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

### Beast source (raw binary stream)

Connects to dump1090-fa's Beast binary output (default port 30005) and decodes the raw Mode-S/ADS-B messages itself via [`@squawk/beast`](../beast)/[`@squawk/mode-s`](../mode-s) - unlike the JSON and SBS sources, dump1090-fa has not done any decode work on this output. Node-only; reconnects automatically if the connection drops.

```typescript
import { createBeastAircraftFeed } from '@squawk/adsb-feed';

const feed = createBeastAircraftFeed({ host: '192.168.1.50' }); // port defaults to 30005

feed.addEventListener('aircraft:update', (event) => {
  console.log((event as CustomEvent).detail.aircraft);
});

feed.start();
```

Beast frames carry raw CPR-encoded positions rather than decoded coordinates. An airborne position resolves on its own once a paired even/odd frame has arrived (typically within a couple of seconds), but on-ground/surface position messages can only be decoded against a known-nearby reference position - there is no pair-only path for surface CPR. Pass `receiverPosition` (your station's own lat/lon) to enable surface position decoding and to speed up a new aircraft's first airborne fix; without it, surface aircraft are still tracked (squawk, callsign, ground speed, etc.) but carry no position:

```typescript
const feed = createBeastAircraftFeed({
  host: '192.168.1.50',
  receiverPosition: { lat: 40.6413, lon: -73.7781 },
});
```

DF0/4/5/16/20/21 replies (ACAS/TCAS and Mode-S surveillance replies) carry an ICAO address recovered from a CRC-XOR rather than a direct field, so this source only accepts them for aircraft already known from a squitter - an unmatched candidate address is dropped rather than risking a phantom or misattributed aircraft. Mode A/C replies are also dropped; they carry no ICAO address at all.

All three factories return the same `AircraftFeed` shape, so switching sources for a given consumer is a one-line change - `getAircraft`, `getAllAircraft`, `getPositionHistory`, and the event names are identical either way.

### Choosing the source at runtime

When the source comes from a CLI flag or a config value, `createAircraftFeedForSource` dispatches to the matching factory so there is one call site instead of a switch. Node-only, since the SBS and Beast sources are.

```typescript
import { createAircraftFeedForSource } from '@squawk/adsb-feed';
import type { FeedSource } from '@squawk/adsb-feed';

const source: FeedSource = 'beast'; // or 'json' / 'sbs', e.g. from a --source flag

const feed = createAircraftFeedForSource({
  source,
  host: '192.168.1.50',
  receiverPosition: { lat: 40.6413, lon: -73.7781 },
});

feed.start();
```

`port` defaults per source from the exported `DEFAULT_PORT_BY_SOURCE` (`8080` json, `30003` sbs, `30005` beast), matching dump1090-fa's own defaults. For the `json` source the endpoint is dump1090-fa's standard `http://<host>:<port>/data/aircraft.json`, or `url` when given. Options that do not apply to the selected source (`receiverPosition` for anything but `beast`, `url` for anything but `json`, and so on) are ignored, so the same options object works whichever source is chosen.

## Browser / SPA usage

Import `createJsonAircraftFeed` from the `/browser` subpath. `createSbsAircraftFeed`, `createBeastAircraftFeed`, and `createAircraftFeedForSource` depend on Node's `net` module (raw TCP sockets have no browser API) and are not exported there.

```typescript
import { createJsonAircraftFeed } from '@squawk/adsb-feed/browser';
```

dump1090-fa does not send CORS headers, so a browser fetching `aircraft.json` directly from another origin is blocked. Point `url` at a same-origin reverse proxy that forwards to your station - the same pattern `@squawk/weather`'s `/fetch` layer documents for the Aviation Weather Center API.

## API

- `createJsonAircraftFeed({ url, pollIntervalMs?, fetch?, staleAfterMs?, sweepIntervalMs?, positionHistoryRetention? })` - creates a feed backed by HTTP-polled `aircraft.json`.
- `createSbsAircraftFeed({ host, port?, reconnectDelayMs?, staleAfterMs?, sweepIntervalMs?, positionHistoryRetention? })` - creates a feed backed by a persistent SBS/BaseStation socket connection. Node-only.
- `createBeastAircraftFeed({ host, port?, reconnectDelayMs?, receiverPosition?, staleAfterMs?, sweepIntervalMs?, positionHistoryRetention? })` - creates a feed backed by a persistent Beast binary socket connection, decoding raw Mode-S/ADS-B messages itself. Node-only.
- `createAircraftFeedForSource({ source, host, port?, url?, pollIntervalMs?, fetch?, reconnectDelayMs?, receiverPosition?, staleAfterMs?, sweepIntervalMs?, positionHistoryRetention? })` - creates a feed for a `FeedSource` (`'json' | 'sbs' | 'beast'`) chosen at runtime, dispatching to one of the three factories above. Node-only.
- `DEFAULT_PORT_BY_SOURCE` - dump1090-fa's default port for each `FeedSource`.

All factories accept `staleAfterMs` (how long an aircraft may go without an update before `aircraft:lost`, default 60000) and `sweepIntervalMs` (how often the staleness sweep runs, default 1000). An aircraft is dropped on the first sweep after its window elapses, so `aircraft:lost` can fire up to one sweep interval late; the one-second default keeps that negligible, and the sweep is a single pass over the tracked aircraft, so it costs next to nothing. Lengthen it only if you would rather sweep less often.

- `feed.start()` / `feed.stop()` - begin or end polling/connecting. `stop()` clears all tracked state.
- `feed.getAircraft(icaoHex)` / `feed.getAllAircraft()` - current normalized `Aircraft` state.
- `feed.getPositionHistory(icaoHex)` - retained position samples for one aircraft, oldest first.
- `feed.getConnectionState()` - current connection state, `'connected' | 'reconnecting'`.
- Events (via `addEventListener`, read off `CustomEvent.detail`): `aircraft:new` and `aircraft:update` (`{ aircraft: Aircraft }`), `aircraft:lost` (`{ icaoHex: string, lastAircraft: Aircraft }`), `connection:connect` and `connection:disconnect` (`{ state: 'connected' | 'reconnecting' }`).

## Connection state

All three sources expose the same connection lifecycle. For SBS and Beast, `getConnectionState()` and the `connection:connect`/`connection:disconnect` events reflect the underlying TCP socket's own connect/close lifecycle. The JSON source has no persistent connection to track, so it uses the most recent poll's outcome instead: `'connected'` once a poll successfully parses, `'reconnecting'` after a non-ok response or a network/parse failure.

```typescript
feed.addEventListener('connection:disconnect', () => {
  console.log('lost connection, reconnecting...');
});
console.log(feed.getConnectionState()); // 'connected' | 'reconnecting'
```

## Field population by source

Beyond the baseline fields all three sources populate, coverage differs:

- **JSON** additionally populates `category` (from `aircraft.json`'s `category` code) and `emergencyState` (from its `emergency` field). It has no equivalent for `identActive`/`squawkAlert`/`resolutionAdvisory`/`targetState` - `aircraft.json` carries no such fields.
- **SBS** additionally populates `identActive`/`squawkAlert` (from the BaseStation `SPI`/`Alert` fields). It has no equivalent for `category`, `emergencyState`, `resolutionAdvisory`, or `targetState` - the BaseStation format carries none of them.
- **Beast** populates all of the above - `category` (from type-code 1-4 identification messages), `emergencyState`, `identActive`, `squawkAlert`, `resolutionAdvisory` (from either a DF16 reply or a type-code-28 subtype-2 broadcast), and `targetState` (from a type-code-29 message) - since it decodes the raw Mode-S/ADS-B messages itself rather than relying on dump1090-fa's own JSON/SBS summaries.

`Aircraft.origin` / `Aircraft.destination` are never populated by any source - ADS-B data carries no flight-schedule information, so resolving a live aircraft's actual origin or destination needs a data source outside this package.
