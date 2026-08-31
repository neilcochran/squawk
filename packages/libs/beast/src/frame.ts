import { decodeModeAc, decodeModeSMessage } from '@squawk/mode-s';

import type { BeastFrame, BeastFrameError, BeastFrameType } from './types/index.js';

const ESCAPE_BYTE = 0x1a;

/** Beast type byte -> frame type and raw message length in bytes. */
const TYPE_BYTE_INFO: Record<number, { type: BeastFrameType; messageLength: number }> = {
  0x31: { type: 'modeAC', messageLength: 2 },
  0x32: { type: 'shortModeS', messageLength: 7 },
  0x33: { type: 'longModeS', messageLength: 14 },
};

/** Result of deframing as much of a byte buffer as currently possible. */
export interface DeframeResult {
  /** Frames successfully deframed, in stream order. */
  frames: BeastFrame[];
  /** Framing or decode errors encountered, in stream order relative to `frames`. */
  errors: BeastFrameError[];
  /**
   * Unconsumed trailing bytes - a frame that started but has not fully
   * arrived yet. Prepend this to the next chunk and call
   * {@link deframeBeastBytes} again; empty if the buffer ended exactly on
   * a frame boundary.
   */
  remainder: Uint8Array;
}

function decodeMessage(type: BeastFrameType, rawMessage: Uint8Array): BeastFrame['decoded'] {
  return type === 'modeAC' ? decodeModeAc(rawMessage) : decodeModeSMessage(rawMessage);
}

/** Reads one frame's data bytes (timestamp + signal + message), unescaping `0x1a 0x1a` as it goes. */
function readFrameData(
  buffer: Uint8Array,
  start: number,
  needed: number,
): { data: number[]; endCursor: number; status: 'complete' | 'incomplete' | 'malformed' } {
  const data: number[] = [];
  let cursor = start;
  while (data.length < needed) {
    const byte = buffer[cursor];
    if (byte === undefined) {
      return { data, endCursor: cursor, status: 'incomplete' };
    }
    if (byte === ESCAPE_BYTE) {
      const next = buffer[cursor + 1];
      if (next === ESCAPE_BYTE) {
        data.push(ESCAPE_BYTE);
        cursor += 2;
      } else if (next === undefined) {
        return { data, endCursor: cursor, status: 'incomplete' };
      } else {
        // An unescaped 0x1a inside frame data - malformed. The stray byte
        // may itself be the start of the next real frame.
        return { data, endCursor: cursor, status: 'malformed' };
      }
    } else {
      data.push(byte);
      cursor += 1;
    }
  }
  return { data, endCursor: cursor, status: 'complete' };
}

/**
 * Deframes as many complete Beast frames as are present in `buffer`,
 * unescaping `0x1a 0x1a` byte-stuffing and decoding each message via
 * `@squawk/mode-s`. Pure and stateless - safe to call repeatedly as more
 * bytes arrive, as long as the caller prepends the previous call's
 * `remainder` to the next chunk (a frame routinely arrives split across
 * two calls when fed from a live socket).
 *
 * ```typescript
 * import { deframeBeastBytes } from '@squawk/beast';
 *
 * let pending = new Uint8Array(0);
 * function onChunk(chunk: Uint8Array): void {
 *   const combined = new Uint8Array(pending.length + chunk.length);
 *   combined.set(pending);
 *   combined.set(chunk, pending.length);
 *   const result = deframeBeastBytes(combined);
 *   pending = result.remainder;
 *   for (const frame of result.frames) {
 *     console.log(frame.type, frame.decoded);
 *   }
 * }
 * ```
 *
 * @param buffer - Raw bytes from a Beast feed, possibly including a partial frame left over from a previous call.
 * @returns The frames and errors found, plus any trailing incomplete frame.
 */
export function deframeBeastBytes(buffer: Uint8Array): DeframeResult {
  const frames: BeastFrame[] = [];
  const errors: BeastFrameError[] = [];

  let cursor = 0;
  let skippedStart = -1;

  function flushSkipped(endExclusive: number): void {
    if (skippedStart !== -1) {
      errors.push({ reason: 'malformedFraming', bytes: buffer.slice(skippedStart, endExclusive) });
      skippedStart = -1;
    }
  }

  while (cursor < buffer.length) {
    if (buffer[cursor] !== ESCAPE_BYTE) {
      if (skippedStart === -1) {
        skippedStart = cursor;
      }
      cursor += 1;
      continue;
    }

    if (cursor + 1 >= buffer.length) {
      // Only the escape byte has arrived so far - wait for the type byte.
      flushSkipped(cursor);
      return { frames, errors, remainder: buffer.slice(cursor) };
    }

    const typeByte = buffer[cursor + 1];
    const typeInfo = typeByte === undefined ? undefined : TYPE_BYTE_INFO[typeByte];
    if (typeInfo === undefined) {
      if (skippedStart === -1) {
        skippedStart = cursor;
      }
      cursor += 1;
      continue;
    }

    flushSkipped(cursor);

    const needed = 6 + 1 + typeInfo.messageLength; // timestamp(6) + signal(1) + message
    const { data, endCursor, status } = readFrameData(buffer, cursor + 2, needed);

    if (status === 'incomplete') {
      return { frames, errors, remainder: buffer.slice(cursor) };
    }

    if (status === 'malformed') {
      errors.push({ reason: 'malformedFraming', bytes: buffer.slice(cursor, endCursor) });
      cursor = endCursor;
      continue;
    }

    let timestamp = 0n;
    for (let i = 0; i < 6; i++) {
      timestamp = (timestamp << 8n) | BigInt(data[i] ?? 0);
    }
    const signalLevel = data[6] ?? 0;
    const rawMessage = Uint8Array.from(data.slice(7));
    const decoded = decodeMessage(typeInfo.type, rawMessage);
    if (decoded === undefined) {
      errors.push({ reason: 'undecodedMessage', bytes: rawMessage });
    }

    frames.push({ type: typeInfo.type, timestamp, signalLevel, rawMessage, decoded });
    cursor = endCursor;
  }

  flushSkipped(cursor);
  return { frames, errors, remainder: new Uint8Array(0) };
}
