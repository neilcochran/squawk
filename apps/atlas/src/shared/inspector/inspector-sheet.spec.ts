import { describe, it, expect } from 'vitest';

import { computeSheetOcclusionPx, resolveSheetSnap } from './inspector-sheet.ts';

describe('resolveSheetSnap', () => {
  describe('starting from the expanded state', () => {
    it('minimizes when the drag crosses the threshold downward', () => {
      expect(resolveSheetSnap({ offsetPx: 50, maxOffsetPx: 100, startedMinimized: false })).toBe(
        'minimized',
      );
    });

    it('reverts to expanded when the drag stays below the threshold', () => {
      expect(resolveSheetSnap({ offsetPx: 20, maxOffsetPx: 100, startedMinimized: false })).toBe(
        'expanded',
      );
    });

    it('treats the exact threshold as enough to minimize', () => {
      expect(resolveSheetSnap({ offsetPx: 33, maxOffsetPx: 100, startedMinimized: false })).toBe(
        'minimized',
      );
    });

    it('stays expanded when there is no movement', () => {
      expect(resolveSheetSnap({ offsetPx: 0, maxOffsetPx: 100, startedMinimized: false })).toBe(
        'expanded',
      );
    });

    it('clamps an over-drag past the bottom to minimized', () => {
      expect(resolveSheetSnap({ offsetPx: 150, maxOffsetPx: 100, startedMinimized: false })).toBe(
        'minimized',
      );
    });
  });

  describe('starting from the minimized state', () => {
    it('expands when the drag crosses the threshold upward', () => {
      expect(resolveSheetSnap({ offsetPx: 50, maxOffsetPx: 100, startedMinimized: true })).toBe(
        'expanded',
      );
    });

    it('reverts to minimized when the upward drag stays below the threshold', () => {
      expect(resolveSheetSnap({ offsetPx: 80, maxOffsetPx: 100, startedMinimized: true })).toBe(
        'minimized',
      );
    });

    it('treats the exact threshold as enough to expand', () => {
      expect(resolveSheetSnap({ offsetPx: 67, maxOffsetPx: 100, startedMinimized: true })).toBe(
        'expanded',
      );
    });

    it('stays minimized when there is no movement', () => {
      expect(resolveSheetSnap({ offsetPx: 100, maxOffsetPx: 100, startedMinimized: true })).toBe(
        'minimized',
      );
    });

    it('clamps an over-drag past the top to expanded', () => {
      expect(resolveSheetSnap({ offsetPx: -50, maxOffsetPx: 100, startedMinimized: true })).toBe(
        'expanded',
      );
    });
  });

  describe('degenerate range', () => {
    it('keeps the expanded start when the range is zero', () => {
      expect(resolveSheetSnap({ offsetPx: 0, maxOffsetPx: 0, startedMinimized: false })).toBe(
        'expanded',
      );
    });

    it('keeps the minimized start when the range is zero', () => {
      expect(resolveSheetSnap({ offsetPx: 0, maxOffsetPx: 0, startedMinimized: true })).toBe(
        'minimized',
      );
    });

    it('keeps the starting state when the range is negative', () => {
      expect(resolveSheetSnap({ offsetPx: 10, maxOffsetPx: -5, startedMinimized: false })).toBe(
        'expanded',
      );
      expect(resolveSheetSnap({ offsetPx: 10, maxOffsetPx: -5, startedMinimized: true })).toBe(
        'minimized',
      );
    });
  });
});

describe('computeSheetOcclusionPx', () => {
  it('reports zero occlusion when the inspector is inactive', () => {
    expect(
      computeSheetOcclusionPx({
        active: false,
        dragOffsetPx: undefined,
        minimized: false,
        sheetHeightPx: 480,
        peekHeightPx: 64,
      }),
    ).toBe(0);
  });

  it('reports the full sheet height when expanded', () => {
    expect(
      computeSheetOcclusionPx({
        active: true,
        dragOffsetPx: undefined,
        minimized: false,
        sheetHeightPx: 480,
        peekHeightPx: 64,
      }),
    ).toBe(480);
  });

  it('reports only the peek height when minimized', () => {
    expect(
      computeSheetOcclusionPx({
        active: true,
        dragOffsetPx: undefined,
        minimized: true,
        sheetHeightPx: 480,
        peekHeightPx: 64,
      }),
    ).toBe(64);
  });

  it('tracks the drag by subtracting the live offset from the sheet height', () => {
    expect(
      computeSheetOcclusionPx({
        active: true,
        dragOffsetPx: 200,
        minimized: false,
        sheetHeightPx: 480,
        peekHeightPx: 64,
      }),
    ).toBe(280);
  });

  it('lets a live drag override the committed minimized flag', () => {
    expect(
      computeSheetOcclusionPx({
        active: true,
        dragOffsetPx: 100,
        minimized: true,
        sheetHeightPx: 480,
        peekHeightPx: 64,
      }),
    ).toBe(380);
  });

  it('clamps an over-drag past the bottom to zero', () => {
    expect(
      computeSheetOcclusionPx({
        active: true,
        dragOffsetPx: 600,
        minimized: false,
        sheetHeightPx: 480,
        peekHeightPx: 64,
      }),
    ).toBe(0);
  });

  it('caps the minimized peek at the sheet height when the peek measures larger', () => {
    expect(
      computeSheetOcclusionPx({
        active: true,
        dragOffsetPx: undefined,
        minimized: true,
        sheetHeightPx: 40,
        peekHeightPx: 64,
      }),
    ).toBe(40);
  });
});
