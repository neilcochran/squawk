/**
 * @packageDocumentation
 * Node-only opt-in live client for a Beast-format TCP feed. Isolated from
 * the main entry so browser/edge consumers of the pure frame parser never
 * pull in Node's `net` module.
 */
export { createBeastStream } from './stream.js';
export type {
  BeastConnectEventDetail,
  BeastDisconnectEventDetail,
  BeastFrameErrorEventDetail,
  BeastMessageEventDetail,
  BeastStream,
  BeastStreamOptions,
} from './types.js';
export type { BeastFrame, BeastFrameError, BeastFrameType } from '../types/index.js';
