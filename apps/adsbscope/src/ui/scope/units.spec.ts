// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_PX_PER_REM, readPxPerRem } from './units.js';

afterEach(() => {
  document.documentElement.style.fontSize = '';
});

describe('readPxPerRem', () => {
  it("reads the root element's font size", () => {
    document.documentElement.style.fontSize = '20px';

    expect(readPxPerRem(document.documentElement)).toBe(20);
  });

  it('falls back to the browser default when the font size is missing or unusable', () => {
    document.documentElement.style.fontSize = '';
    expect(readPxPerRem(document.documentElement)).toBe(DEFAULT_PX_PER_REM);

    document.documentElement.style.fontSize = '0px';
    expect(readPxPerRem(document.documentElement)).toBe(DEFAULT_PX_PER_REM);
  });
});
