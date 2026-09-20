// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createViewport, polarToScreen } from './projection.js';
import type { ScopeFrame, ScopeRenderer } from './renderer.js';
import { ScopeCanvas } from './scope-canvas.js';
import { createRecordingContext, makeSnapshot, makeTarget } from './test-utils.js';
import { DEFAULT_PX_PER_REM } from './units.js';

const SETTINGS = { tags: 'off' };
const onSelect = vi.fn<(icaoHex: string | undefined) => void>();

let frameCallbacks: Map<number, FrameRequestCallback>;
let nextFrameHandle: number;

function runFrame(timeMs: number): void {
  const pending = [...frameCallbacks.values()];
  frameCallbacks.clear();
  for (const callback of pending) {
    callback(timeMs);
  }
}

function makeRenderer(): ScopeRenderer & {
  render: ReturnType<typeof vi.fn<ScopeRenderer['render']>>;
  reset: ReturnType<typeof vi.fn<ScopeRenderer['reset']>>;
  pickDataBlock: ReturnType<typeof vi.fn<ScopeRenderer['pickDataBlock']>>;
} {
  return {
    render: vi.fn<ScopeRenderer['render']>(),
    reset: vi.fn<ScopeRenderer['reset']>(),
    pickDataBlock: vi.fn<ScopeRenderer['pickDataBlock']>(),
  };
}

function lastFrame(renderer: ReturnType<typeof makeRenderer>): ScopeFrame | undefined {
  return renderer.render.mock.calls.at(-1)?.[1];
}

beforeEach(() => {
  frameCallbacks = new Map();
  nextFrameHandle = 1;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const handle = nextFrameHandle++;
    frameCallbacks.set(handle, callback);
    return handle;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
    frameCallbacks.delete(handle);
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.style.fontSize = '';
});

function stubContext(): void {
  const { context } = createRecordingContext();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => context as unknown as null,
  );
}

describe('ScopeCanvas', () => {
  it('paints each animation frame with the renderer, fitted to the canvas', () => {
    stubContext();
    const renderer = makeRenderer();
    const snapshot = makeSnapshot();

    render(
      <ScopeCanvas
        renderer={renderer}
        rangeNm={60}
        snapshot={snapshot}
        videoMap={undefined}
        settings={SETTINGS}
        selectedIcaoHex={undefined}
        extent="canvas"
        onSelect={onSelect}
      />,
    );
    runFrame(16);
    runFrame(32);

    expect(renderer.render).toHaveBeenCalledTimes(2);
    const frame = lastFrame(renderer);
    expect(frame?.rangeNm).toBe(60);
    expect(frame?.snapshot).toBe(snapshot);
    expect(frame?.frameTimeMs).toBe(32);
    expect(frame?.viewport.widthPx).toBe(800);
    expect(frame?.viewport.heightPx).toBe(600);
    expect(frame?.viewport.pxPerRem).toBe(DEFAULT_PX_PER_REM);
    expect(frame?.settings).toBe(SETTINGS);
  });

  it('hands a changed setting to the renderer without restarting the frame loop', () => {
    stubContext();
    const renderer = makeRenderer();
    const view = render(
      <ScopeCanvas
        renderer={renderer}
        rangeNm={60}
        snapshot={undefined}
        videoMap={undefined}
        settings={SETTINGS}
        selectedIcaoHex={undefined}
        extent="canvas"
        onSelect={onSelect}
      />,
    );
    runFrame(16);
    const changed = { tags: 'on' };

    view.rerender(
      <ScopeCanvas
        renderer={renderer}
        rangeNm={60}
        snapshot={undefined}
        videoMap={undefined}
        settings={changed}
        selectedIcaoHex={undefined}
        extent="canvas"
        onSelect={onSelect}
      />,
    );
    runFrame(32);

    expect(lastFrame(renderer)?.settings).toBe(changed);
    expect(window.cancelAnimationFrame).not.toHaveBeenCalled();
    expect(renderer.reset).toHaveBeenCalledTimes(1);
  });

  it('draws at the scale of the root font size, and picks up a change on resize', () => {
    stubContext();
    const renderer = makeRenderer();
    document.documentElement.style.fontSize = '20px';
    render(
      <ScopeCanvas
        renderer={renderer}
        rangeNm={60}
        snapshot={undefined}
        videoMap={undefined}
        settings={SETTINGS}
        selectedIcaoHex={undefined}
        extent="canvas"
        onSelect={onSelect}
      />,
    );
    runFrame(16);
    expect(lastFrame(renderer)?.viewport.pxPerRem).toBe(20);

    document.documentElement.style.fontSize = '24px';
    window.dispatchEvent(new Event('resize'));
    runFrame(32);

    expect(lastFrame(renderer)?.viewport.pxPerRem).toBe(24);
  });

  it('hands the video map to the renderer', () => {
    stubContext();
    const renderer = makeRenderer();
    const videoMap = { rangeNm: 60, points: [], lines: [] };

    render(
      <ScopeCanvas
        renderer={renderer}
        rangeNm={60}
        snapshot={undefined}
        videoMap={videoMap}
        settings={SETTINGS}
        selectedIcaoHex={undefined}
        extent="canvas"
        onSelect={onSelect}
      />,
    );
    runFrame(16);

    expect(lastFrame(renderer)?.videoMap).toBe(videoMap);
  });

  it('picks up a new range and snapshot without restarting the frame loop', () => {
    stubContext();
    const renderer = makeRenderer();
    const view = render(
      <ScopeCanvas
        renderer={renderer}
        rangeNm={60}
        snapshot={undefined}
        videoMap={undefined}
        settings={SETTINGS}
        selectedIcaoHex={undefined}
        extent="canvas"
        onSelect={onSelect}
      />,
    );
    runFrame(16);
    const scheduledBefore = vi.mocked(window.requestAnimationFrame).mock.calls.length;
    const snapshot = makeSnapshot();

    view.rerender(
      <ScopeCanvas
        renderer={renderer}
        rangeNm={40}
        snapshot={snapshot}
        videoMap={undefined}
        settings={SETTINGS}
        selectedIcaoHex={undefined}
        extent="canvas"
        onSelect={onSelect}
      />,
    );
    runFrame(32);

    expect(lastFrame(renderer)?.rangeNm).toBe(40);
    expect(lastFrame(renderer)?.snapshot).toBe(snapshot);
    expect(vi.mocked(window.requestAnimationFrame).mock.calls.length).toBe(scheduledBefore + 1);
    expect(window.cancelAnimationFrame).not.toHaveBeenCalled();
  });

  it('resets a renderer when it is switched to and paints with it from the next frame', () => {
    stubContext();
    const first = makeRenderer();
    const second = makeRenderer();
    const view = render(
      <ScopeCanvas
        renderer={first}
        rangeNm={60}
        snapshot={undefined}
        videoMap={undefined}
        settings={SETTINGS}
        selectedIcaoHex={undefined}
        extent="canvas"
        onSelect={onSelect}
      />,
    );
    runFrame(16);

    view.rerender(
      <ScopeCanvas
        renderer={second}
        rangeNm={60}
        snapshot={undefined}
        videoMap={undefined}
        settings={SETTINGS}
        selectedIcaoHex={undefined}
        extent="canvas"
        onSelect={onSelect}
      />,
    );
    runFrame(32);

    expect(first.reset).toHaveBeenCalledTimes(1);
    expect(second.reset).toHaveBeenCalledTimes(1);
    expect(first.render).toHaveBeenCalledTimes(1);
    expect(second.render).toHaveBeenCalledTimes(1);
  });

  it('re-fits the canvas and resets the renderer when the window is resized', () => {
    stubContext();
    const renderer = makeRenderer();
    render(
      <ScopeCanvas
        renderer={renderer}
        rangeNm={60}
        snapshot={undefined}
        videoMap={undefined}
        settings={SETTINGS}
        selectedIcaoHex={undefined}
        extent="canvas"
        onSelect={onSelect}
      />,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);

    window.dispatchEvent(new Event('resize'));
    runFrame(16);

    expect(renderer.reset).toHaveBeenCalledTimes(2);
    expect(lastFrame(renderer)?.viewport.widthPx).toBe(1000);
  });

  it('stops painting and listening once unmounted', () => {
    stubContext();
    const renderer = makeRenderer();
    const view = render(
      <ScopeCanvas
        renderer={renderer}
        rangeNm={60}
        snapshot={undefined}
        videoMap={undefined}
        settings={SETTINGS}
        selectedIcaoHex={undefined}
        extent="canvas"
        onSelect={onSelect}
      />,
    );

    view.unmount();
    runFrame(16);
    window.dispatchEvent(new Event('resize'));

    expect(renderer.render).not.toHaveBeenCalled();
    expect(renderer.reset).toHaveBeenCalledTimes(1);
  });

  describe('selecting', () => {
    const position = { trueBearingDeg: 90, rangeNm: 70 };
    const snapshot = makeSnapshot([makeTarget({ icaoHex: 'aaaaaa', position })]);
    const at = polarToScreen(createViewport(800, 600, 60, DEFAULT_PX_PER_REM), position);

    function renderCanvas(extent: 'canvas' | 'rangeCircle'): HTMLElement {
      stubContext();
      render(
        <ScopeCanvas
          renderer={makeRenderer()}
          rangeNm={60}
          snapshot={snapshot}
          videoMap={undefined}
          settings={SETTINGS}
          selectedIcaoHex="aaaaaa"
          extent={extent}
          onSelect={onSelect}
        />,
      );
      const canvas = screen.getByLabelText('Radar scope');
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 800, 600));
      return canvas;
    }

    it('hands the selection to the renderer with every frame', () => {
      stubContext();
      const renderer = makeRenderer();
      render(
        <ScopeCanvas
          renderer={renderer}
          rangeNm={60}
          snapshot={snapshot}
          videoMap={undefined}
          settings={SETTINGS}
          selectedIcaoHex="aaaaaa"
          extent="canvas"
          onSelect={onSelect}
        />,
      );
      runFrame(16);

      expect(lastFrame(renderer)?.selectedIcaoHex).toBe('aaaaaa');
    });

    it('selects the aircraft that was clicked, measured from the corner of the canvas', () => {
      const canvas = renderCanvas('canvas');
      runFrame(16);

      fireEvent.click(canvas, { clientX: 100 + at.xPx, clientY: 50 + at.yPx });

      expect(onSelect).toHaveBeenLastCalledWith('aaaaaa');
    });

    it('selects the aircraft whose data block was clicked, asking the renderer where the blocks are', () => {
      stubContext();
      const renderer = makeRenderer();
      renderer.pickDataBlock.mockReturnValue('bbbbbb');
      render(
        <ScopeCanvas
          renderer={renderer}
          rangeNm={60}
          snapshot={snapshot}
          videoMap={undefined}
          settings={SETTINGS}
          selectedIcaoHex={undefined}
          extent="canvas"
          onSelect={onSelect}
        />,
      );
      const canvas = screen.getByLabelText('Radar scope');
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 800, 600));
      runFrame(16);

      fireEvent.click(canvas, { clientX: 110, clientY: 60 });
      expect(renderer.pickDataBlock).toHaveBeenLastCalledWith({ xPx: 10, yPx: 10 });
      expect(onSelect).toHaveBeenLastCalledWith('bbbbbb');

      fireEvent.click(canvas, { clientX: 100 + at.xPx, clientY: 50 + at.yPx });
      expect(onSelect).toHaveBeenLastCalledWith('aaaaaa');
      expect(renderer.pickDataBlock).toHaveBeenCalledTimes(1);
    });

    it('clears the selection when empty scope is clicked', () => {
      const canvas = renderCanvas('canvas');
      runFrame(16);

      fireEvent.click(canvas, { clientX: 110, clientY: 60 });

      expect(onSelect).toHaveBeenLastCalledWith(undefined);
    });

    it('picks only what the view style draws: nothing beyond the range circle of a round scope', () => {
      const canvas = renderCanvas('rangeCircle');
      runFrame(16);

      fireEvent.click(canvas, { clientX: 100 + at.xPx, clientY: 50 + at.yPx });

      expect(onSelect).toHaveBeenLastCalledWith(undefined);
    });

    it('ignores a click that lands before the first frame has been painted', () => {
      const canvas = renderCanvas('canvas');
      onSelect.mockClear();

      fireEvent.click(canvas, { clientX: 100 + at.xPx, clientY: 50 + at.yPx });

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  it('renders an inert canvas when no 2D context is available', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const renderer = makeRenderer();

    const view = render(
      <ScopeCanvas
        renderer={renderer}
        rangeNm={60}
        snapshot={undefined}
        videoMap={undefined}
        settings={SETTINGS}
        selectedIcaoHex={undefined}
        extent="canvas"
        onSelect={onSelect}
      />,
    );
    runFrame(16);

    expect(view.container).not.toBeEmptyDOMElement();
    expect(screen.getByLabelText('Radar scope')).toBeInTheDocument();
    expect(renderer.render).not.toHaveBeenCalled();
  });
});
