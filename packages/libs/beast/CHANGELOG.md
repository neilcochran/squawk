# @squawk/beast

## 0.1.2

### Patch Changes

- Updated dependencies [9015223]
  - @squawk/mode-s@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [65a8c9b]
  - @squawk/mode-s@0.2.0

## 0.1.0

### Minor Changes

- 871a15d: **@squawk/beast** parses the Beast binary format - the framing dump1090-fa, readsb, and other decoders use to carry raw Mode-S/Mode-A/C messages. Decoding of the messages themselves is delegated to `@squawk/mode-s`; this package's own job is the wire framing (escape/unescape byte-stuffing, the three Beast message types). An opt-in `@squawk/beast/stream` subpath adds a ready-made Node TCP client for connecting to a live Beast feed.

### Patch Changes

- Updated dependencies [871a15d]
  - @squawk/mode-s@0.1.0
