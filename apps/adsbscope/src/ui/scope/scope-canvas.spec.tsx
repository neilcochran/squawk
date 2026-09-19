// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScopeFrame, ScopeRenderer } from './renderer.js';
import { ScopeCanvas } from './scope-canvas.js';
import { createRecordingContext, makeSnapshot } from './test-utils.js';
import { DEFAULT_PX_PER_REM } from './units.js';

const SETTINGS = { tags: 'off' };

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
} {
  return { render: vi.fn<ScopeRenderer['render']>(), reset: vi.fn<ScopeRenderer['reset']>() };
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
      <ScopeCanvas renderer={renderer} rangeNm={60} snapshot={snapshot} settings={SETTINGS} />,
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
      <ScopeCanvas renderer={renderer} rangeNm={60} snapshot={undefined} settings={SETTINGS} />,
    );
    runFrame(16);
    const changed = { tags: 'on' };

    view.rerender(
      <ScopeCanvas renderer={renderer} rangeNm={60} snapshot={undefined} settings={changed} />,
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
      <ScopeCanvas renderer={renderer} rangeNm={60} snapshot={undefined} settings={SETTINGS} />,
    );
    runFrame(16);
    expect(lastFrame(renderer)?.viewport.pxPerRem).toBe(20);

    document.documentElement.style.fontSize = '24px';
    window.dispatchEvent(new Event('resize'));
    runFrame(32);

    expect(lastFrame(renderer)?.viewport.pxPerRem).toBe(24);
  });

  it('picks up a new range and snapshot without restarting the frame loop', () => {
    stubContext();
    const renderer = makeRenderer();
    const view = render(
      <ScopeCanvas renderer={renderer} rangeNm={60} snapshot={undefined} settings={SETTINGS} />,
    );
    runFrame(16);
    const scheduledBefore = vi.mocked(window.requestAnimationFrame).mock.calls.length;
    const snapshot = makeSnapshot();

    view.rerender(
      <ScopeCanvas renderer={renderer} rangeNm={40} snapshot={snapshot} settings={SETTINGS} />,
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
      <ScopeCanvas renderer={first} rangeNm={60} snapshot={undefined} settings={SETTINGS} />,
    );
    runFrame(16);

    view.rerender(
      <ScopeCanvas renderer={second} rangeNm={60} snapshot={undefined} settings={SETTINGS} />,
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
      <ScopeCanvas renderer={renderer} rangeNm={60} snapshot={undefined} settings={SETTINGS} />,
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
      <ScopeCanvas renderer={renderer} rangeNm={60} snapshot={undefined} settings={SETTINGS} />,
    );

    view.unmount();
    runFrame(16);
    window.dispatchEvent(new Event('resize'));

    expect(renderer.render).not.toHaveBeenCalled();
    expect(renderer.reset).toHaveBeenCalledTimes(1);
  });

  it('renders an inert canvas when no 2D context is available', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const renderer = makeRenderer();

    const view = render(
      <ScopeCanvas renderer={renderer} rangeNm={60} snapshot={undefined} settings={SETTINGS} />,
    );
    runFrame(16);

    expect(view.container).not.toBeEmptyDOMElement();
    expect(screen.getByLabelText('Radar scope')).toBeInTheDocument();
    expect(renderer.render).not.toHaveBeenCalled();
  });
});
