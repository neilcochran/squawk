// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { fitCanvas } from './fit-canvas.js';
import { createRecordingContext } from './test-utils.js';

function makeCanvas(clientWidth: number, clientHeight: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: clientWidth });
  Object.defineProperty(canvas, 'clientHeight', { value: clientHeight });
  return canvas;
}

describe('fitCanvas', () => {
  it('sizes the backing store to the CSS size at a pixel ratio of 1', () => {
    const canvas = makeCanvas(800, 600);
    const recording = createRecordingContext();

    const size = fitCanvas(canvas, recording.context, 1);

    expect(size).toEqual({ widthPx: 800, heightPx: 600 });
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
    expect(recording.callsTo('setTransform')[0]?.args).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('scales the backing store and the context on a high-density display', () => {
    const canvas = makeCanvas(801, 600);
    const recording = createRecordingContext();

    const size = fitCanvas(canvas, recording.context, 1.5);

    expect(size).toEqual({ widthPx: 801, heightPx: 600 });
    expect(canvas.width).toBe(1202);
    expect(canvas.height).toBe(900);
    expect(recording.callsTo('setTransform')[0]?.args).toEqual([1.5, 0, 0, 1.5, 0, 0]);
  });
});
