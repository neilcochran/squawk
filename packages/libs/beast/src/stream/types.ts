import type { BeastFrame, BeastFrameError } from '../types/index.js';

/** Options for {@link createBeastStream}. */
export interface BeastStreamOptions {
  /** Hostname or IP address of the Beast-format feed. */
  host: string;
  /** TCP port. Defaults to 30005 (dump1090-fa's default Beast output port). */
  port?: number;
  /** Delay in ms before attempting to reconnect after the connection closes or errors. Defaults to 5000. */
  reconnectDelayMs?: number;
}

/** Detail payload carried by the `beast:message` event, dispatched once per deframed frame - whether or not it decoded successfully. */
export interface BeastMessageEventDetail {
  /** The deframed frame. Check `frame.decoded` for whether the message itself decoded. */
  frame: BeastFrame;
}

/** Detail payload carried by the `beast:frameError` event. */
export interface BeastFrameErrorEventDetail {
  /** The error: malformed framing, or a well-formed frame whose message failed to decode. */
  error: BeastFrameError;
}

/** Detail payload carried by the `beast:connect` event. */
export interface BeastConnectEventDetail {
  /** Host connected to. */
  host: string;
  /** Port connected to. */
  port: number;
}

/** Detail payload carried by the `beast:disconnect` event. */
export interface BeastDisconnectEventDetail {
  /** Host that was connected. */
  host: string;
  /** Port that was connected. */
  port: number;
  /** Delay in ms before a reconnect attempt will be made. */
  reconnectDelayMs: number;
}

/**
 * A live client for a Beast-format TCP feed. Dispatches `beast:message`
 * (carrying {@link BeastMessageEventDetail}) for every deframed frame,
 * `beast:frameError` (carrying {@link BeastFrameErrorEventDetail}) for
 * framing or decode problems, and `beast:connect` /
 * `beast:disconnect` (carrying {@link BeastConnectEventDetail} /
 * {@link BeastDisconnectEventDetail}) for connection lifecycle.
 *
 * Create one with {@link createBeastStream} rather than implementing this
 * interface directly.
 */
export interface BeastStream extends EventTarget {
  /** Connects to the feed. No-op if already started. */
  start(): void;
  /** Disconnects and stops reconnecting. No-op if already stopped. */
  stop(): void;
}
