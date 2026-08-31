<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/beast</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/beast)](https://www.npmjs.com/package/@squawk/beast) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Parses the Beast binary format - the framing dump1090-fa, readsb, and other
decoders use to carry raw Mode-S/Mode-A/C messages, originally built for the
Mode-S Beast USB dongle. Decoding of the messages themselves is delegated to
[`@squawk/mode-s`](../mode-s); this package's own job is the wire framing -
the `0x1a` escape/unescape byte-stuffing and the three Beast message types
(Mode A/C, short Mode-S, long Mode-S).

The core `@squawk/beast` export is a pure frame parser with no I/O - it
takes a byte buffer (from a live socket, a replayed capture file, or
anywhere else) and returns decoded frames. An opt-in `@squawk/beast/stream`
subpath adds a ready-made Node TCP client for consumers who want to point
it at a live Beast feed without writing their own socket handling.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Installation

```bash
npm install @squawk/beast
```

## Usage

### Parsing a byte stream

`deframeBeastBytes` is pure and stateless - call it repeatedly as bytes
arrive, feeding back its `remainder` (a frame that hasn't fully arrived yet)
as the start of the next chunk:

```typescript
import { deframeBeastBytes } from '@squawk/beast';

let pending = new Uint8Array(0);

function onChunk(chunk: Uint8Array): void {
  const combined = new Uint8Array(pending.length + chunk.length);
  combined.set(pending);
  combined.set(chunk, pending.length);

  const result = deframeBeastBytes(combined);
  pending = result.remainder;

  for (const frame of result.frames) {
    console.log(frame.type, frame.decoded); // decoded via @squawk/mode-s
  }
  for (const error of result.errors) {
    console.warn(error.reason, error.bytes); // malformed framing, or a message that failed to decode
  }
}
```

### Live TCP stream (Node-only)

```typescript
import { createBeastStream } from '@squawk/beast/stream';

const stream = createBeastStream({ host: '192.168.1.50' }); // port defaults to 30005

stream.addEventListener('beast:message', (event) => {
  console.log((event as CustomEvent).detail.frame);
});
stream.addEventListener('beast:frameError', (event) => {
  console.warn((event as CustomEvent).detail.error);
});
stream.addEventListener('beast:connect', (event) => {
  console.log('connected', (event as CustomEvent).detail);
});
stream.addEventListener('beast:disconnect', (event) => {
  console.log('disconnected, reconnecting', (event as CustomEvent).detail);
});

stream.start();
// later: stream.stop();
```

`createBeastStream` reconnects automatically (after `reconnectDelayMs`,
default 5000ms) if the connection closes or errors, until `stop()` is
called.

## Browser / SPA usage

Import `deframeBeastBytes` from the `/browser` subpath - it's a pure parser
with no Node dependency, so it aliases the main entry. `createBeastStream`
depends on Node's `net` module (raw TCP sockets have no browser API) and is
only available from `/stream`.

```typescript
import { deframeBeastBytes } from '@squawk/beast/browser';
```

## API

- `deframeBeastBytes(buffer)` - parses as many complete frames as are present in `buffer`, returning `{ frames, errors, remainder }`.
- `createBeastStream({ host, port?, reconnectDelayMs? })` (from `/stream`, Node-only) - creates a live client, returning a `BeastStream` (an `EventTarget`) with `start()` / `stop()`.
- Events (via `addEventListener`, read off `CustomEvent.detail`): `beast:message` (`{ frame: BeastFrame }`, dispatched for every deframed frame whether or not it decoded), `beast:frameError` (`{ error: BeastFrameError }`), `beast:connect` (`{ host, port }`), `beast:disconnect` (`{ host, port, reconnectDelayMs }`).

A `BeastFrame`'s `decoded` field is a `@squawk/mode-s` `DecodedModeSMessage`
for Mode-S frames, a `ModeAcReply` for Mode A/C frames, or `undefined` if
the message didn't decode (an unsupported downlink format/type code, or a
failed CRC) - `rawMessage` is always populated regardless, so a consumer
that wants the bytes anyway still has them.
