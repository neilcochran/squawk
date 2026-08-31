/**
 * @packageDocumentation
 * Parse dump1090-fa's Beast binary format (and the format's original
 * Mode-S Beast USB dongle, and readsb/other decoders that emulate it) into
 * decoded Mode-S/Mode-A/C messages via `@squawk/mode-s`. Pure - no I/O, no
 * Node dependency, safe in a browser given bytes from any source. For a
 * ready-made TCP client, see the `/stream` subpath (Node-only).
 */
export { deframeBeastBytes } from './frame.js';
export type { DeframeResult } from './frame.js';
export type { BeastFrame, BeastFrameError, BeastFrameType } from './types/index.js';
