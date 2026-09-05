import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { deframeBeastBytes } from './frame.js';

/** Wraps raw message bytes in Beast escape-framing: 0x1a, type byte, a fixed timestamp/signal, then the message with 0x1a bytes doubled. */
function frameBytes(typeByte: number, message: number[]): number[] {
  const escaped: number[] = [];
  for (const byte of message) {
    escaped.push(byte);
    if (byte === 0x1a) {
      escaped.push(0x1a);
    }
  }
  const timestamp = [0, 0, 0, 0, 0, 1];
  const signal = [0x80];
  return [0x1a, typeByte, ...timestamp, ...signal, ...escaped];
}

describe('deframeBeastBytes - single frames', () => {
  it('parses a long Mode-S frame (0x33)', () => {
    // Real DF17 position message, hand-verified CRC=0 in mode-s's own tests.
    const message = [
      0x8d, 0xab, 0x09, 0x69, 0x58, 0xc9, 0x01, 0x06, 0xe9, 0x19, 0x9e, 0x88, 0xd1, 0xa5,
    ];
    const buffer = Uint8Array.from(frameBytes(0x33, message));
    const result = deframeBeastBytes(buffer);
    expect(result.frames).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.remainder).toHaveLength(0);
    const frame = result.frames[0];
    expect(frame?.type).toBe('longModeS');
    expect(frame?.signalLevel).toBe(0x80);
    expect(frame?.decoded?.kind).toBe('extendedSquitterPosition');
  });

  it('parses a short Mode-S frame (0x32)', () => {
    const message = [0x5d, 0xab, 0x09, 0x69, 0x30, 0xe6, 0x68]; // real DF11 all-call
    const buffer = Uint8Array.from(frameBytes(0x32, message));
    const result = deframeBeastBytes(buffer);
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0]?.type).toBe('shortModeS');
    expect(result.frames[0]?.decoded?.kind).toBe('allCallReply');
  });

  it('parses a Mode A/C frame (0x31)', () => {
    const message = [0x12, 0x00]; // squawk 1200
    const buffer = Uint8Array.from(frameBytes(0x31, message));
    const result = deframeBeastBytes(buffer);
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0]?.type).toBe('modeAC');
    expect(result.frames[0]?.decoded?.kind).toBe('modeAc');
  });

  it('parses multiple consecutive frames', () => {
    const df17 = frameBytes(
      0x33,
      [0x8d, 0xab, 0x09, 0x69, 0x58, 0xc9, 0x01, 0x06, 0xe9, 0x19, 0x9e, 0x88, 0xd1, 0xa5],
    );
    const df11 = frameBytes(0x32, [0x5d, 0xab, 0x09, 0x69, 0x30, 0xe6, 0x68]);
    const buffer = Uint8Array.from([...df17, ...df11]);
    const result = deframeBeastBytes(buffer);
    expect(result.frames).toHaveLength(2);
    expect(result.frames[0]?.type).toBe('longModeS');
    expect(result.frames[1]?.type).toBe('shortModeS');
  });
});

describe('deframeBeastBytes - escape/unescape', () => {
  it('unescapes a doubled 0x1a inside the message payload', () => {
    // A message whose first data byte is literally 0x1a - must appear
    // doubled (0x1a 0x1a) on the wire and collapse back to one 0x1a.
    const message = [0x1a, 0xab, 0x09, 0x69, 0x00, 0x00, 0x00]; // synthetic, CRC will fail (expected)
    const buffer = Uint8Array.from(frameBytes(0x32, message));
    const result = deframeBeastBytes(buffer);
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0]?.rawMessage[0]).toBe(0x1a);
    expect(result.remainder).toHaveLength(0);
  });
});

describe('deframeBeastBytes - chunked input', () => {
  it('treats a buffer ending on a lone 0x1a mid-frame as incomplete, not malformed', () => {
    // The buffer ends exactly on an escape byte with no following byte to
    // say whether it's a doubled escape (0x1a 0x1a) or a genuine stray one
    // - can't be decided yet, so this must wait for more data rather than
    // being reported as malformed.
    const header = [0x1a, 0x32, 0, 0, 0, 0, 0, 1, 0x80]; // escape + type + timestamp(6) + signal
    const partialMessage = [0x5d, 0xab, 0x09, 0x1a]; // 3 real bytes, then a lone trailing 0x1a
    const buffer = Uint8Array.from([...header, ...partialMessage]);

    const result = deframeBeastBytes(buffer);
    expect(result.frames).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.remainder).toEqual(buffer);
  });

  it('returns an incomplete frame as remainder and completes it once the rest arrives', () => {
    const full = frameBytes(0x32, [0x5d, 0xab, 0x09, 0x69, 0x30, 0xe6, 0x68]);
    const firstChunk = Uint8Array.from(full.slice(0, 6));
    const secondChunk = Uint8Array.from(full.slice(6));

    const firstResult = deframeBeastBytes(firstChunk);
    expect(firstResult.frames).toHaveLength(0);
    expect(firstResult.remainder.length).toBe(firstChunk.length);

    const combined = new Uint8Array(firstResult.remainder.length + secondChunk.length);
    combined.set(firstResult.remainder);
    combined.set(secondChunk, firstResult.remainder.length);
    const secondResult = deframeBeastBytes(combined);
    expect(secondResult.frames).toHaveLength(1);
    expect(secondResult.remainder).toHaveLength(0);
  });

  it('returns an empty remainder when the buffer ends exactly on a frame boundary', () => {
    const buffer = Uint8Array.from(frameBytes(0x32, [0x5d, 0xab, 0x09, 0x69, 0x30, 0xe6, 0x68]));
    expect(deframeBeastBytes(buffer).remainder).toHaveLength(0);
  });

  it('preserves a lone leading escape byte as the remainder when the type byte has not arrived yet', () => {
    const buffer = Uint8Array.of(0x1a);
    const result = deframeBeastBytes(buffer);
    expect(result.frames).toHaveLength(0);
    expect(result.remainder).toEqual(buffer);
  });
});

describe('deframeBeastBytes - malformed framing', () => {
  it('reports leading bytes before the first sync marker as malformed', () => {
    const garbage = [0x00, 0x01, 0x02];
    const validFrame = frameBytes(0x32, [0x5d, 0xab, 0x09, 0x69, 0x30, 0xe6, 0x68]);
    const buffer = Uint8Array.from([...garbage, ...validFrame]);
    const result = deframeBeastBytes(buffer);
    expect(result.errors).toContainEqual({
      reason: 'malformedFraming',
      bytes: Uint8Array.from(garbage),
    });
    expect(result.frames).toHaveLength(1);
  });

  it('reports an unrecognized type byte as malformed and keeps scanning', () => {
    const buffer = Uint8Array.from([
      0x1a,
      0xff,
      ...frameBytes(0x32, [0x5d, 0xab, 0x09, 0x69, 0x30, 0xe6, 0x68]),
    ]);
    const result = deframeBeastBytes(buffer);
    expect(result.errors.some((error) => error.reason === 'malformedFraming')).toBe(true);
    expect(result.frames).toHaveLength(1);
  });

  it('coalesces two consecutive unrecognized type bytes into a single malformed-framing span', () => {
    const buffer = Uint8Array.from([
      0x1a,
      0xfe,
      0x1a,
      0xff,
      ...frameBytes(0x32, [0x5d, 0xab, 0x09, 0x69, 0x30, 0xe6, 0x68]),
    ]);
    const result = deframeBeastBytes(buffer);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      reason: 'malformedFraming',
      bytes: Uint8Array.of(0x1a, 0xfe, 0x1a, 0xff),
    });
    expect(result.frames).toHaveLength(1);
  });

  it('reports an unescaped stray 0x1a inside frame data and resumes scanning', () => {
    // Build a short-frame header, then a stray unescaped 0x1a followed by a
    // non-0x1a byte (invalid escape), then a valid following frame.
    const header = [0x1a, 0x32, 0, 0, 0, 0, 0, 1, 0x80];
    const strayEscape = [0x1a, 0x00]; // unescaped 0x1a not followed by another 0x1a
    const validFrame = frameBytes(0x32, [0x5d, 0xab, 0x09, 0x69, 0x30, 0xe6, 0x68]);
    const buffer = Uint8Array.from([...header, ...strayEscape, ...validFrame]);
    const result = deframeBeastBytes(buffer);
    expect(result.errors.some((error) => error.reason === 'malformedFraming')).toBe(true);
    expect(result.frames).toHaveLength(1);
  });
});

describe('deframeBeastBytes - undecoded messages', () => {
  it('reports a Mode-S message with a bad CRC as undecoded, keeping the raw bytes', () => {
    const message = [
      0x8d, 0xab, 0x09, 0x69, 0x58, 0xc9, 0x01, 0x06, 0xe9, 0x19, 0x9e, 0x88, 0xd1, 0x00,
    ]; // corrupted CRC
    const buffer = Uint8Array.from(frameBytes(0x33, message));
    const result = deframeBeastBytes(buffer);
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0]?.decoded).toBeUndefined();
    expect(result.frames[0]?.rawMessage).toEqual(Uint8Array.from(message));
    expect(result.errors).toContainEqual({
      reason: 'undecodedMessage',
      bytes: Uint8Array.from(message),
    });
  });
});

// Frame bytes below are a verbatim, contiguous run from a live Beast-binary
// capture off a real dump1090-fa station - a long (DF17 position), long
// (DF17 velocity), and short (DF11) frame back to back, all from the same
// aircraft (AB0969) - not synthetic. Confirms the deframer correctly walks
// multiple real consecutive frames of different lengths.
describe('deframeBeastBytes - real dump1090-fa Beast capture', () => {
  it('deframes three consecutive real frames', () => {
    const bytes = Uint8Array.of(
      0x1a,
      0x33,
      0x01,
      0x09,
      0x5c,
      0x83,
      0xd3,
      0xbd,
      0x27,
      0x8d,
      0xab,
      0x09,
      0x69,
      0x58,
      0xc7,
      0xf4,
      0x8a,
      0x99,
      0x77,
      0x3d,
      0xf5,
      0x01,
      0x91,
      0x1a,
      0x33,
      0x01,
      0x09,
      0x5c,
      0x83,
      0xe0,
      0x6b,
      0x26,
      0x8d,
      0xab,
      0x09,
      0x69,
      0x99,
      0x0a,
      0x55,
      0x02,
      0x80,
      0x08,
      0x35,
      0xa7,
      0x73,
      0x9c,
      0x1a,
      0x32,
      0x01,
      0x09,
      0x5c,
      0xa8,
      0x72,
      0x41,
      0x28,
      0x5d,
      0xab,
      0x09,
      0x69,
      0x30,
      0xe6,
      0x68,
    );
    const result = deframeBeastBytes(bytes);
    expect(result.errors).toHaveLength(0);
    expect(result.remainder).toHaveLength(0);
    expect(result.frames).toHaveLength(3);
    expect(result.frames.map((f) => f.type)).toEqual(['longModeS', 'longModeS', 'shortModeS']);
    expect(result.frames.map((f) => f.decoded?.kind)).toEqual([
      'extendedSquitterPosition',
      'extendedSquitterVelocity',
      'allCallReply',
    ]);
    for (const frame of result.frames) {
      const icaoHex =
        frame.decoded && 'icaoHex' in frame.decoded ? frame.decoded.icaoHex : undefined;
      expect(icaoHex).toBe('AB0969');
    }
  });
});

// `fixtures/beast-capture.bin` is a longer, unedited real Beast-binary
// capture from the same reference dump1090-fa station - a full 300-second
// session, 14 distinct aircraft, every frame type and (as of this decode
// surface) every decode kind this package currently supports, including a
// DF16 long air-air surveillance reply (no active Resolution Advisory - a
// genuine RA is a rare safety event, not something ambient traffic is
// expected to produce). A whole-session, zero-error, zero-undecoded
// deframe is a strong regression signal that the smaller hand-picked
// samples above can't provide on their own.
describe('deframeBeastBytes - real dump1090-fa Beast capture (full session)', () => {
  const fixtureBytes = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'beast-capture.bin'),
  );
  const result = deframeBeastBytes(new Uint8Array(fixtureBytes));

  it('deframes an entire real capture session cleanly', () => {
    expect(result.errors).toHaveLength(0);
    expect(result.remainder).toHaveLength(0);
    expect(result.frames).toHaveLength(6903);
    expect(result.frames.every((frame) => frame.decoded !== undefined)).toBe(true);
  });

  it('decodes every DF16/17/18 and surveillance-reply kind this package currently supports at least once', () => {
    const kinds = new Set(result.frames.map((frame) => frame.decoded?.kind));
    for (const kind of [
      'extendedSquitterPosition',
      'extendedSquitterVelocity',
      'extendedSquitterIdentification',
      'extendedSquitterTargetStateAndStatus',
      'extendedSquitterOperationalStatus',
      'extendedSquitterEmergencyStatus',
      'allCallReply',
      'shortAirAirSurveillanceReply',
      'longAirAirSurveillanceReply',
      'surveillanceAltitudeReply',
      'surveillanceIdentityReply',
      'commBAltitudeReply',
      'commBIdentityReply',
    ] as const) {
      expect(kinds.has(kind)).toBe(true);
    }
  });

  it('omits resolutionAdvisory from every real DF16 reply in this capture, since none carry a genuine BDS 3,0 register', () => {
    const df16Frames = result.frames.filter(
      (frame) => frame.decoded?.kind === 'longAirAirSurveillanceReply',
    );
    expect(df16Frames.length).toBeGreaterThan(0);
    for (const frame of df16Frames) {
      if (frame.decoded?.kind !== 'longAirAirSurveillanceReply') {
        continue;
      }
      expect(frame.decoded.resolutionAdvisory).toBeUndefined();
    }
  });

  it('decodes a real BDS 4,0/5,0/6,0 Comm-B register of each kind from DF20 replies', () => {
    const allRegisters = result.frames
      .filter(
        (frame) =>
          frame.decoded?.kind === 'commBAltitudeReply' ||
          frame.decoded?.kind === 'commBIdentityReply',
      )
      .flatMap((frame) =>
        frame.decoded?.kind === 'commBAltitudeReply' || frame.decoded?.kind === 'commBIdentityReply'
          ? frame.decoded.commBRegisters
          : [],
      );
    const findByBdsCode = (bdsCode: string) =>
      allRegisters.find((register) => register.bdsCode === bdsCode);

    expect(findByBdsCode('4,0')).toMatchObject({
      mcpFcuSelectedAltitudeFt: 36000,
      fmsSelectedAltitudeFt: 36000,
      baroPressureSettingMb: 1013.3,
    });
    expect(findByBdsCode('5,0')).toMatchObject({
      groundSpeedKt: 478,
      trueAirspeedKt: 476,
    });
    expect(findByBdsCode('6,0')).toMatchObject({
      indicatedAirspeedKt: 274,
      baroVerticalRateFtPerMin: -64,
    });
  });
});
