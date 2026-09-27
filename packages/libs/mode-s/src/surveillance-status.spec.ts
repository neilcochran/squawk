import { describe, it, expect } from 'vitest';

import { decodeSurveillanceStatus } from './surveillance-status.js';

describe('decodeSurveillanceStatus', () => {
  it.each([
    [0, 'none'],
    [1, 'permanentAlert'],
    [2, 'temporaryAlert'],
    [3, 'ident'],
  ] as const)('decodes SS %i to %s', (rawStatus, status) => {
    expect(decodeSurveillanceStatus(rawStatus)).toBe(status);
  });

  it.each([4, -1, 1.5])(
    'returns undefined for %s, which the 2-bit field cannot hold (the type cannot express that)',
    (outOfRange) => {
      expect(decodeSurveillanceStatus(outOfRange)).toBeUndefined();
    },
  );
});
