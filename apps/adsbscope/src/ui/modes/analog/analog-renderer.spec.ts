import { describe, expect, it } from 'vitest';

import type { ScopeSnapshot, ScopeVideoMap } from '../../../shared/protocol.js';
import { FULL_CIRCLE_RAD } from '../../scope/furniture.js';
import { createViewport, polarToScreen } from '../../scope/projection.js';
import type { ScopeRenderer } from '../../scope/renderer.js';
import { createRecordingContext, makeSnapshot, makeTarget } from '../../scope/test-utils.js';
import type { RecordedCall, RecordingContext } from '../../scope/test-utils.js';
import { DEFAULT_PX_PER_REM } from '../../scope/units.js';
import { canvasFont } from '../../styles/theme.js';
import { MAP_SETTING_ID } from '../shared-settings.js';

import {
  AFTERGLOW_ALPHA,
  AFTERGLOW_DEG,
  bearingToCanvasRad,
  createAnalogRenderer,
  TAG_ALPHA,
} from './analog-renderer.js';
import { SWEEP_SETTING_ID, TAGS_ON, TAGS_SETTING_ID } from './analog-settings.js';
import { ANALOG_THEME } from './analog-theme.js';
import { blipAlpha } from './sweep.js';

const WIDTH_PX = 800;
const HEIGHT_PX = 600;
const PERIOD_MS = 4800;
const QUARTER_TURN_MS = PERIOD_MS / 4;
const COLORS = ANALOG_THEME.canvas;

interface FrameOptions {
  snapshot?: ScopeSnapshot | undefined;
  videoMap?: ScopeVideoMap;
  rangeNm?: number;
  settings?: Record<string, string>;
}

/** Renders one frame at `frameTimeMs` and returns only what that frame drew. */
function renderAt(
  renderer: ScopeRenderer,
  frameTimeMs: number,
  options: FrameOptions = {},
): RecordingContext {
  const recording = createRecordingContext();
  const rangeNm = options.rangeNm ?? 60;
  renderer.render(recording.context, {
    viewport: createViewport(WIDTH_PX, HEIGHT_PX, rangeNm, DEFAULT_PX_PER_REM),
    rangeNm,
    snapshot: options.snapshot,
    videoMap: options.videoMap,
    frameTimeMs,
    settings: options.settings ?? {},
  });
  return recording;
}

/** The arcs that are blips: everything that is neither a full-circle range ring nor the afterglow wedge. */
function blipArcs(recording: RecordingContext): RecordedCall[] {
  const viewport = createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM);
  return recording
    .callsTo('arc')
    .filter((call) => call.args[4] !== FULL_CIRCLE_RAD && call.args[2] !== viewport.radiusPx);
}

describe('bearingToCanvasRad', () => {
  it('maps north to straight up and east to the positive x axis', () => {
    expect(bearingToCanvasRad(90)).toBeCloseTo(0);
    expect(bearingToCanvasRad(0)).toBeCloseTo(-Math.PI / 2);
    expect(bearingToCanvasRad(180)).toBeCloseTo(Math.PI / 2);
  });
});

describe('createAnalogRenderer', () => {
  it('starts dark, with the beam at north and nothing painted', () => {
    const renderer = createAnalogRenderer(ANALOG_THEME);
    const target = makeTarget({ position: { trueBearingDeg: 45, rangeNm: 30 } });

    const recording = renderAt(renderer, 1000, { snapshot: makeSnapshot([target]) });

    expect(recording.calls[0]).toMatchObject({
      method: 'fillRect',
      args: [0, 0, WIDTH_PX, HEIGHT_PX],
      fillStyle: COLORS.background,
    });
    expect(blipArcs(recording)).toHaveLength(0);
    const viewport = createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM);
    const beamTip = recording.callsTo('lineTo').at(-1);
    expect(Number(beamTip?.args[0])).toBeCloseTo(viewport.center.xPx);
    expect(Number(beamTip?.args[1])).toBeCloseTo(viewport.center.yPx - viewport.radiusPx);
    expect(beamTip?.strokeStyle).toBe(COLORS.sweep);
  });

  it('draws the same furniture as the digital scope, in its own colors', () => {
    const recording = renderAt(createAnalogRenderer(ANALOG_THEME), 0);

    expect(recording.texts()).toEqual(expect.arrayContaining(['10', '60', '360', '090', '270']));
    expect(recording.context.font).toBe(canvasFont(ANALOG_THEME, DEFAULT_PX_PER_REM));
    expect(
      recording.callsTo('arc').filter((call) => call.args[4] === FULL_CIRCLE_RAD),
    ).toHaveLength(6);
  });

  it('paints a target only when the beam crosses its bearing', () => {
    const renderer = createAnalogRenderer(ANALOG_THEME);
    const snapshot = makeSnapshot([
      makeTarget({ icaoHex: 'aaaaaa', position: { trueBearingDeg: 45, rangeNm: 30 } }),
      makeTarget({ icaoHex: 'bbbbbb', position: { trueBearingDeg: 200, rangeNm: 30 } }),
    ]);
    renderAt(renderer, 0, { snapshot });

    const afterQuarterTurn = renderAt(renderer, QUARTER_TURN_MS, { snapshot });

    const viewport = createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM);
    const arcs = blipArcs(afterQuarterTurn);
    expect(arcs).toHaveLength(1);
    expect(Number(arcs[0]?.args[2])).toBeCloseTo(30 * viewport.pxPerNm);
    const midRad = (Number(arcs[0]?.args[3]) + Number(arcs[0]?.args[4])) / 2;
    expect(midRad).toBeCloseTo(bearingToCanvasRad(45));
    expect(arcs[0]?.strokeStyle).toBe(COLORS.target);
    expect(arcs[0]?.globalAlpha).toBe(1);

    const afterThreeQuarters = renderAt(renderer, QUARTER_TURN_MS * 3, { snapshot });
    expect(blipArcs(afterThreeQuarters)).toHaveLength(2);
  });

  it('fades a blip as it ages and drops it once it has faded out', () => {
    const renderer = createAnalogRenderer(ANALOG_THEME);
    const snapshot = makeSnapshot([makeTarget({ position: { trueBearingDeg: 45, rangeNm: 30 } })]);
    renderAt(renderer, 0, { snapshot });
    renderAt(renderer, QUARTER_TURN_MS, { snapshot });

    const later = renderAt(renderer, QUARTER_TURN_MS * 2);
    const muchLater = renderAt(renderer, QUARTER_TURN_MS * 2 + PERIOD_MS * 5);

    expect(blipArcs(later)[0]?.globalAlpha).toBeCloseTo(blipAlpha(QUARTER_TURN_MS, PERIOD_MS));
    expect(blipArcs(muchLater)).toHaveLength(0);
  });

  it('leaves a trail: a moving target shows its previous return when it is repainted', () => {
    const renderer = createAnalogRenderer(ANALOG_THEME);
    const first = makeSnapshot([makeTarget({ position: { trueBearingDeg: 45, rangeNm: 30 } })]);
    const moved = makeSnapshot([makeTarget({ position: { trueBearingDeg: 46, rangeNm: 28 } })]);
    renderAt(renderer, 0, { snapshot: first });
    renderAt(renderer, QUARTER_TURN_MS, { snapshot: first });

    const nextRotation = renderAt(renderer, QUARTER_TURN_MS + PERIOD_MS, { snapshot: moved });

    const viewport = createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM);
    const radii = blipArcs(nextRotation).map((call) => Number(call.args[2]));
    expect(radii).toHaveLength(2);
    expect(radii[0]).toBeCloseTo(30 * viewport.pxPerNm);
    expect(radii[1]).toBeCloseTo(28 * viewport.pxPerNm);
  });

  it('re-projects a fading blip when the range changes', () => {
    const renderer = createAnalogRenderer(ANALOG_THEME);
    const snapshot = makeSnapshot([makeTarget({ position: { trueBearingDeg: 45, rangeNm: 30 } })]);
    renderAt(renderer, 0, { snapshot });
    renderAt(renderer, QUARTER_TURN_MS, { snapshot });

    const zoomedIn = renderAt(renderer, QUARTER_TURN_MS + 16, { rangeNm: 40 });

    const zoomedViewport = createViewport(WIDTH_PX, HEIGHT_PX, 40, DEFAULT_PX_PER_REM);
    const blip = zoomedIn
      .callsTo('arc')
      .find((call) => Math.abs(Number(call.args[2]) - 30 * zoomedViewport.pxPerNm) < 1e-6);
    expect(blip).toBeDefined();
  });

  it('does not paint targets beyond the range circle or without a position', () => {
    const renderer = createAnalogRenderer(ANALOG_THEME);
    const snapshot = makeSnapshot([
      makeTarget({ icaoHex: 'aaaaaa', position: { trueBearingDeg: 45, rangeNm: 61 } }),
      makeTarget({ icaoHex: 'bbbbbb' }),
    ]);
    renderAt(renderer, 0, { snapshot });

    expect(blipArcs(renderAt(renderer, QUARTER_TURN_MS, { snapshot }))).toHaveLength(0);
  });

  it('draws a return at the receiver as a dot rather than a degenerate arc', () => {
    const renderer = createAnalogRenderer(ANALOG_THEME);
    const snapshot = makeSnapshot([makeTarget({ position: { trueBearingDeg: 45, rangeNm: 0 } })]);
    renderAt(renderer, 0, { snapshot });

    const recording = renderAt(renderer, QUARTER_TURN_MS, { snapshot });

    const viewport = createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM);
    const dot = recording
      .callsTo('arc')
      .find((call) => call.args[4] === FULL_CIRCLE_RAD && Number(call.args[2]) < 5);
    expect(dot?.args.slice(0, 2)).toEqual([viewport.center.xPx, viewport.center.yPx]);
    expect(dot?.fillStyle).toBe(COLORS.target);
  });

  it('paints everything once, not repeatedly, after a long gap between frames', () => {
    const renderer = createAnalogRenderer(ANALOG_THEME);
    const snapshot = makeSnapshot([
      makeTarget({ icaoHex: 'aaaaaa', position: { trueBearingDeg: 45, rangeNm: 30 } }),
      makeTarget({ icaoHex: 'bbbbbb', position: { trueBearingDeg: 300, rangeNm: 20 } }),
    ]);
    renderAt(renderer, 0, { snapshot });

    const resumed = renderAt(renderer, 60_000, { snapshot });

    expect(blipArcs(resumed)).toHaveLength(2);
  });

  describe('afterglow', () => {
    it('trails the beam as a wedge that fades from the beam backward', () => {
      const renderer = createAnalogRenderer(ANALOG_THEME);
      renderAt(renderer, 0);

      const recording = renderAt(renderer, QUARTER_TURN_MS);

      const gradient = recording.callsTo('createConicGradient')[0];
      expect(Number(gradient?.args[0])).toBeCloseTo(bearingToCanvasRad(90 - AFTERGLOW_DEG));
      const stops = recording.callsTo('addColorStop');
      expect(stops[0]?.args).toEqual([0, `${COLORS.sweep}00`]);
      expect(stops[1]?.args[0]).toBeCloseTo(AFTERGLOW_DEG / 360);
      expect(String(stops[1]?.args[1])).toBe(
        `${COLORS.sweep}${Math.round(AFTERGLOW_ALPHA * 255).toString(16)}`,
      );
      const viewport = createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM);
      const wedge = recording
        .callsTo('arc')
        .find((call) => call.args[2] === viewport.radiusPx && call.args[4] !== FULL_CIRCLE_RAD);
      expect(Number(wedge?.args[4])).toBeCloseTo(bearingToCanvasRad(90));
    });

    it('is skipped, leaving just the beam, where conic gradients are unavailable', () => {
      const renderer = createAnalogRenderer(ANALOG_THEME);
      const recording = createRecordingContext();
      Object.assign(recording.context, { createConicGradient: undefined });

      renderer.render(recording.context, {
        viewport: createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM),
        rangeNm: 60,
        snapshot: undefined,
        videoMap: undefined,
        frameTimeMs: 0,
        settings: {},
      });

      expect(recording.callsTo('closePath')).toHaveLength(0);
      expect(recording.callsTo('lineTo').at(-1)?.strokeStyle).toBe(COLORS.sweep);
    });
  });

  describe('settings', () => {
    it('draws no tags by default', () => {
      const renderer = createAnalogRenderer(ANALOG_THEME);
      const snapshot = makeSnapshot([
        makeTarget({ callsign: 'UAL123', position: { trueBearingDeg: 45, rangeNm: 30 } }),
      ]);
      renderAt(renderer, 0, { snapshot });

      expect(renderAt(renderer, QUARTER_TURN_MS, { snapshot }).texts()).not.toContain('UAL123');
    });

    it('draws a faint tag beside the newest blip of each target when tags are on', () => {
      const renderer = createAnalogRenderer(ANALOG_THEME);
      const settings = { [TAGS_SETTING_ID]: TAGS_ON };
      const position = { trueBearingDeg: 45, rangeNm: 30 };
      const snapshot = makeSnapshot([
        makeTarget({ callsign: 'UAL123', altitudeFt: 12_000, groundSpeedKt: 300, position }),
        makeTarget({
          icaoHex: 'c0ffee',
          callsign: 'NOTYET',
          position: { trueBearingDeg: 300, rangeNm: 9 },
        }),
      ]);
      renderAt(renderer, 0, { snapshot, settings });

      const recording = renderAt(renderer, QUARTER_TURN_MS, { snapshot, settings });

      expect(recording.texts()).toEqual(expect.arrayContaining(['UAL123', '120 30']));
      expect(recording.texts()).not.toContain('NOTYET');
      const tag = recording.callsTo('fillText').find((call) => call.args[0] === 'UAL123');
      expect(tag?.globalAlpha).toBeCloseTo(TAG_ALPHA);
      expect(tag?.fillStyle).toBe(COLORS.target);
      const at = polarToScreen(
        createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM),
        position,
      );
      expect(Number(tag?.args[1])).toBeGreaterThan(at.xPx);
    });

    it('drops the tag of a target that is no longer in the snapshot', () => {
      const renderer = createAnalogRenderer(ANALOG_THEME);
      const settings = { [TAGS_SETTING_ID]: TAGS_ON };
      const snapshot = makeSnapshot([
        makeTarget({ callsign: 'UAL123', position: { trueBearingDeg: 45, rangeNm: 30 } }),
      ]);
      renderAt(renderer, 0, { snapshot, settings });
      renderAt(renderer, QUARTER_TURN_MS, { snapshot, settings });

      const afterLoss = renderAt(renderer, QUARTER_TURN_MS + 16, {
        snapshot: makeSnapshot(),
        settings,
      });

      expect(afterLoss.texts()).not.toContain('UAL123');
      expect(blipArcs(afterLoss)).toHaveLength(1);
    });

    it('turns the beam at the rate the sweep setting asks for', () => {
      const renderer = createAnalogRenderer(ANALOG_THEME);
      const settings = { [SWEEP_SETTING_ID]: 'longRange' };
      const snapshot = makeSnapshot([
        makeTarget({ position: { trueBearingDeg: 45, rangeNm: 30 } }),
      ]);
      renderAt(renderer, 0, { snapshot, settings });

      const slow = renderAt(renderer, QUARTER_TURN_MS, { snapshot, settings });
      expect(blipArcs(slow)).toHaveLength(0);

      const later = renderAt(renderer, QUARTER_TURN_MS * 2, { snapshot, settings });
      expect(blipArcs(later)).toHaveLength(1);
    });
  });

  describe('video map', () => {
    const videoMap: ScopeVideoMap = {
      rangeNm: 60,
      points: [
        { kind: 'airport', label: 'KTST', position: { trueBearingDeg: 270, rangeNm: 20 } },
        { kind: 'navaid', label: 'ENE', position: { trueBearingDeg: 90, rangeNm: 20 } },
      ],
      lines: [],
    };

    it('draws the map in the analog colors, under the furniture', () => {
      const recording = renderAt(createAnalogRenderer(ANALOG_THEME), 0, { videoMap });

      const mapLabel = recording.calls.findIndex((call) => call.args[0] === 'KTST');
      const firstRingLabel = recording.calls.findIndex((call) => call.args[0] === '10');
      expect(mapLabel).toBeGreaterThan(0);
      expect(mapLabel).toBeLessThan(firstRingLabel);
      expect(recording.calls[mapLabel]?.fillStyle).toBe(COLORS.videoMapLabel);
    });

    it('draws the basic map by default, and navaids and fixes only on the full map', () => {
      const basic = renderAt(createAnalogRenderer(ANALOG_THEME), 0, { videoMap });
      const full = renderAt(createAnalogRenderer(ANALOG_THEME), 0, {
        videoMap,
        settings: { [MAP_SETTING_ID]: 'full' },
      });

      expect(basic.texts()).not.toContain('ENE');
      expect(full.texts()).toContain('ENE');
    });

    it('leaves the map out when it is turned off', () => {
      const recording = renderAt(createAnalogRenderer(ANALOG_THEME), 0, {
        videoMap,
        settings: { [MAP_SETTING_ID]: 'off' },
      });

      expect(recording.texts()).not.toContain('KTST');
    });
  });

  it('forgets everything on reset, so the scope warms up again from north', () => {
    const renderer = createAnalogRenderer(ANALOG_THEME);
    const snapshot = makeSnapshot([makeTarget({ position: { trueBearingDeg: 45, rangeNm: 30 } })]);
    renderAt(renderer, 0, { snapshot });
    renderAt(renderer, QUARTER_TURN_MS, { snapshot });

    renderer.reset();
    const afterReset = renderAt(renderer, QUARTER_TURN_MS + 16, { snapshot });

    expect(blipArcs(afterReset)).toHaveLength(0);
    const viewport = createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM);
    const beamTip = afterReset.callsTo('lineTo').at(-1);
    expect(Number(beamTip?.args[0])).toBeCloseTo(viewport.center.xPx);
    expect(Number(beamTip?.args[1])).toBeCloseTo(viewport.center.yPx - viewport.radiusPx);
  });

  it('leaves the context fully opaque for whatever draws next', () => {
    const renderer = createAnalogRenderer(ANALOG_THEME);
    const snapshot = makeSnapshot([makeTarget({ position: { trueBearingDeg: 45, rangeNm: 30 } })]);
    renderAt(renderer, 0, { snapshot });
    renderAt(renderer, QUARTER_TURN_MS, { snapshot });

    const recording = renderAt(renderer, QUARTER_TURN_MS * 2, { snapshot });

    expect(recording.context.globalAlpha).toBe(1);
  });
});
