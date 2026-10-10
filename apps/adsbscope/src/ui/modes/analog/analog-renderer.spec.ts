import { describe, expect, it, vi } from 'vitest';

import type { ScopeSnapshot, ScopeVideoMap } from '../../../shared/protocol.js';
import { EMERGENCY_FLASH_PERIOD_MS } from '../../scope/emergency.js';
import { FULL_CIRCLE_RAD } from '../../scope/furniture.js';
import { createViewport, polarToScreen } from '../../scope/projection.js';
import type { ScopeFrame, ScopeRenderer } from '../../scope/renderer.js';
import { createRecordingContext, makeSnapshot, makeTarget } from '../../scope/test-utils.js';
import type { RecordedCall, RecordingContext } from '../../scope/test-utils.js';
import { DEFAULT_PX_PER_REM } from '../../scope/units.js';
import { canvasFont } from '../../styles/theme.js';
import { HALO_SETTING_ID, LEADER_SETTING_ID, MAP_SETTING_ID } from '../shared-settings.js';

import {
  AFTERGLOW_ALPHA,
  AFTERGLOW_DEG,
  ANALOG_LAYOUT_REM,
  bearingToCanvasRad,
  createAnalogRenderer,
  EMERGENCY_BLOOM_ARCS,
  IDENT_THICKNESS_SCALE,
  IDENT_WIDTH_SCALE,
  TAG_ALPHA,
} from './analog-renderer.js';
import { SWEEP_SETTING_ID, TAGS_OFF, TAGS_ON, TAGS_SETTING_ID } from './analog-settings.js';
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
  selectedIcaoHex?: string;
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
    selectedIcaoHex: options.selectedIcaoHex,
    measureLine: undefined,
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

  it('draws the range/bearing line the frame carries, labeled, at full brightness', () => {
    const measureLine = {
      from: { trueBearingDeg: 0, rangeNm: 10 },
      to: { trueBearingDeg: 90, rangeNm: 10 },
      trueBearingDeg: 135,
      distanceNm: 10 * Math.SQRT2,
    };
    const recording = createRecordingContext();

    createAnalogRenderer(ANALOG_THEME).render(recording.context, {
      viewport: createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM),
      rangeNm: 60,
      snapshot: undefined,
      videoMap: undefined,
      frameTimeMs: 0,
      settings: {},
      selectedIcaoHex: undefined,
      measureLine,
    });

    const label = recording.callsTo('fillText').find((call) => call.args[0] === '135/14.1');
    expect(label?.fillStyle).toBe(COLORS.measure);
    expect(label?.globalAlpha).toBe(1);
    expect(recording.callsTo('stroke').some((call) => call.strokeStyle === COLORS.measure)).toBe(
      true,
    );
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
        selectedIcaoHex: undefined,
        measureLine: undefined,
      });

      expect(recording.callsTo('closePath')).toHaveLength(0);
      expect(recording.callsTo('lineTo').at(-1)?.strokeStyle).toBe(COLORS.sweep);
    });
  });

  describe('settings', () => {
    it('draws tags by default, and none once they are turned off', () => {
      const snapshot = makeSnapshot([
        makeTarget({ callsign: 'UAL123', position: { trueBearingDeg: 45, rangeNm: 30 } }),
      ]);
      const byDefault = createAnalogRenderer(ANALOG_THEME);
      const turnedOff = createAnalogRenderer(ANALOG_THEME);
      const settings = { [TAGS_SETTING_ID]: TAGS_OFF };
      renderAt(byDefault, 0, { snapshot });
      renderAt(turnedOff, 0, { snapshot, settings });

      expect(renderAt(byDefault, QUARTER_TURN_MS, { snapshot }).texts()).toContain('UAL123');
      expect(renderAt(turnedOff, QUARTER_TURN_MS, { snapshot, settings }).texts()).not.toContain(
        'UAL123',
      );
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

    describe('selection', () => {
      const position = { trueBearingDeg: 45, rangeNm: 30 };
      const snapshot = makeSnapshot([makeTarget({ icaoHex: 'aaaaaa', position })]);

      function ringStrokes(recording: RecordingContext): RecordedCall[] {
        return recording
          .callsTo('stroke')
          .filter((call) => call.strokeStyle === COLORS.selected && call.globalAlpha === 1);
      }

      it("rings the selected aircraft's newest blip at full brightness", () => {
        const renderer = createAnalogRenderer(ANALOG_THEME);
        const settings = { [TAGS_SETTING_ID]: TAGS_OFF };
        renderAt(renderer, 0, { snapshot, settings });

        const selected = renderAt(renderer, QUARTER_TURN_MS, {
          snapshot,
          settings,
          selectedIcaoHex: 'aaaaaa',
        });
        const unselected = renderAt(renderer, QUARTER_TURN_MS + 16, { snapshot, settings });

        const at = polarToScreen(
          createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM),
          position,
        );
        const ring = selected
          .callsTo('arc')
          .find((call) => call.args[0] === at.xPx && call.args[1] === at.yPx);
        expect(ring?.args[4]).toBe(FULL_CIRCLE_RAD);
        expect(ringStrokes(selected)).toHaveLength(1);
        expect(ringStrokes(unselected)).toHaveLength(0);
        expect(blipArcs(unselected)).toHaveLength(1);
        expect(unselected.callsTo('arc').filter((call) => call.args[0] === at.xPx)).toEqual([]);
      });

      it('lets a click on a tag pick its aircraft, but only while tags are showing', () => {
        const renderer = createAnalogRenderer(ANALOG_THEME);
        renderAt(renderer, 0, { snapshot });
        const drawn = renderAt(renderer, QUARTER_TURN_MS, { snapshot });

        const label = drawn.callsTo('fillText').find((call) => call.args[0] === 'AAAAAA');
        const onTheTag = { xPx: Number(label?.args[1]) + 2, yPx: Number(label?.args[2]) - 2 };
        expect(renderer.pickDataBlock(onTheTag)).toBe('aaaaaa');
        expect(renderer.pickDataBlock({ xPx: 5, yPx: 5 })).toBeUndefined();

        renderAt(renderer, QUARTER_TURN_MS + 16, {
          snapshot,
          settings: { [TAGS_SETTING_ID]: TAGS_OFF },
        });
        expect(renderer.pickDataBlock(onTheTag)).toBeUndefined();
      });

      it('rings nothing until the beam has painted the selected aircraft', () => {
        const renderer = createAnalogRenderer(ANALOG_THEME);

        const beforeTheBeam = renderAt(renderer, 0, { snapshot, selectedIcaoHex: 'aaaaaa' });
        const noSuchAircraft = renderAt(renderer, QUARTER_TURN_MS, {
          snapshot,
          selectedIcaoHex: 'ffffff',
        });

        const at = polarToScreen(
          createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM),
          position,
        );
        for (const recording of [beforeTheBeam, noSuchAircraft]) {
          expect(recording.callsTo('arc').filter((call) => call.args[0] === at.xPx)).toEqual([]);
        }
      });

      it('adds a halo of the chosen radius around the selected blip, to the scale of the range', () => {
        const renderer = createAnalogRenderer(ANALOG_THEME);
        const settings = { [TAGS_SETTING_ID]: TAGS_OFF, [HALO_SETTING_ID]: '5' };
        renderAt(renderer, 0, { snapshot, settings });

        const recording = renderAt(renderer, QUARTER_TURN_MS, {
          snapshot,
          settings,
          selectedIcaoHex: 'aaaaaa',
        });

        const viewport = createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM);
        const at = polarToScreen(viewport, position);
        const halo = recording
          .callsTo('arc')
          .find((call) => call.args[0] === at.xPx && call.args[2] === 5 * viewport.pxPerNm);
        expect(halo?.args[4]).toBe(FULL_CIRCLE_RAD);
        expect(ringStrokes(recording)).toHaveLength(2);
      });
    });

    describe('emergencies', () => {
      const position = { trueBearingDeg: 45, rangeNm: 30 };
      const emergency = makeSnapshot([
        makeTarget({ callsign: 'UAL123', emergency: 'general', position }),
      ]);
      const routine = makeSnapshot([makeTarget({ callsign: 'UAL123', position })]);

      it('blooms the return of an aircraft in an emergency into a stack of arcs', () => {
        const bloomed = createAnalogRenderer(ANALOG_THEME);
        const plain = createAnalogRenderer(ANALOG_THEME);
        renderAt(bloomed, 0, { snapshot: emergency });
        renderAt(plain, 0, { snapshot: routine });

        const bloom = blipArcs(renderAt(bloomed, QUARTER_TURN_MS, { snapshot: emergency }));
        const single = blipArcs(renderAt(plain, QUARTER_TURN_MS, { snapshot: routine }));

        expect(single).toHaveLength(1);
        expect(bloom).toHaveLength(EMERGENCY_BLOOM_ARCS);
        const radii = bloom.map((arc) => Number(arc.args[2]));
        expect(radii[0]).toBe(Number(single[0]?.args[2]));
        expect([...radii].sort((a, b) => a - b)).toEqual(radii);
        expect(new Set(radii).size).toBe(EMERGENCY_BLOOM_ARCS);
      });

      it('keeps blooming a return that was painted during the emergency, once it is over', () => {
        const renderer = createAnalogRenderer(ANALOG_THEME);
        renderAt(renderer, 0, { snapshot: emergency });
        renderAt(renderer, QUARTER_TURN_MS, { snapshot: emergency });

        const afterwards = renderAt(renderer, QUARTER_TURN_MS + 16, { snapshot: routine });

        expect(blipArcs(afterwards)).toHaveLength(EMERGENCY_BLOOM_ARCS);
      });

      it('flashes the tag at full brightness in the emergency color, and shows the code', () => {
        const renderer = createAnalogRenderer(ANALOG_THEME);
        renderAt(renderer, 0, { snapshot: emergency });
        const litAtMs = EMERGENCY_FLASH_PERIOD_MS * 2;
        const darkAtMs = litAtMs + EMERGENCY_FLASH_PERIOD_MS / 2;

        const tagAt = (frameTimeMs: number): RecordedCall | undefined =>
          renderAt(renderer, frameTimeMs, { snapshot: emergency })
            .callsTo('fillText')
            .find((call) => call.args[0] === 'UAL123 EM');
        const lit = tagAt(litAtMs);
        const dark = tagAt(darkAtMs);

        expect(lit?.fillStyle).toBe(COLORS.emergency);
        expect(lit?.globalAlpha).toBe(1);
        expect(dark?.fillStyle).toBe(COLORS.target);
        expect(dark?.globalAlpha).toBeLessThan(1);
      });
    });

    describe('ident', () => {
      const position = { trueBearingDeg: 45, rangeNm: 30 };
      const ident = makeSnapshot([makeTarget({ callsign: 'UAL123', identActive: true, position })]);
      const routine = makeSnapshot([makeTarget({ callsign: 'UAL123', position })]);

      function arcSpanRad(arc: RecordedCall | undefined): number {
        return Number(arc?.args[4]) - Number(arc?.args[3]);
      }

      it('paints the return of an aircraft squawking ident wider and thicker, in one arc', () => {
        const identing = createAnalogRenderer(ANALOG_THEME);
        const plain = createAnalogRenderer(ANALOG_THEME);
        renderAt(identing, 0, { snapshot: ident });
        renderAt(plain, 0, { snapshot: routine });

        const wide = blipArcs(renderAt(identing, QUARTER_TURN_MS, { snapshot: ident }));
        const usual = blipArcs(renderAt(plain, QUARTER_TURN_MS, { snapshot: routine }));

        expect(wide).toHaveLength(1);
        expect(arcSpanRad(wide[0])).toBeCloseTo(arcSpanRad(usual[0]) * IDENT_WIDTH_SCALE);
        expect(wide[0]?.lineWidth).toBeCloseTo(Number(usual[0]?.lineWidth) * IDENT_THICKNESS_SCALE);
        expect(wide[0]?.args[2]).toBe(usual[0]?.args[2]);
        expect(wide[0]?.strokeStyle).toBe(COLORS.target);
      });

      it('shows the ident code on the tag, and keeps a return painted during the ident once it is over', () => {
        const renderer = createAnalogRenderer(ANALOG_THEME);
        renderAt(renderer, 0, { snapshot: ident });

        const during = renderAt(renderer, QUARTER_TURN_MS, { snapshot: ident });
        const afterwards = renderAt(renderer, QUARTER_TURN_MS + 16, { snapshot: routine });

        expect(during.texts()).toContain('UAL123 ID');
        expect(afterwards.texts()).toContain('UAL123');
        expect(arcSpanRad(blipArcs(afterwards)[0])).toBeCloseTo(arcSpanRad(blipArcs(during)[0]));
      });
    });

    describe('tag placement', () => {
      const CENTER = { trueBearingDeg: 45, rangeNm: 30 };
      const lead = makeTarget({ icaoHex: 'aaaaaa', callsign: 'LEAD1', position: CENTER });
      const wing = makeTarget({
        icaoHex: 'bbbbbb',
        callsign: 'WING2',
        position: { trueBearingDeg: 45, rangeNm: 31 },
      });
      const blipYPx = polarToScreen(
        createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM),
        CENTER,
      ).yPx;

      function tagTopOf(recording: RecordingContext, callsign: string): number {
        return Number(
          recording.callsTo('fillText').find((call) => call.args[0] === callsign)?.args[2],
        );
      }

      it('joins each tag to its blip with a leader line as faint as the tag', () => {
        const renderer = createAnalogRenderer(ANALOG_THEME);
        const snapshot = makeSnapshot([lead]);
        renderAt(renderer, 0, { snapshot });

        const recording = renderAt(renderer, QUARTER_TURN_MS, { snapshot });

        const tag = recording.callsTo('fillText').find((call) => call.args[0] === 'LEAD1');
        const leaders = recording
          .callsTo('stroke')
          .filter((call) => call.globalAlpha === tag?.globalAlpha && call.globalAlpha < 1);
        expect(leaders).toHaveLength(1);
        expect(leaders[0]?.strokeStyle).toBe(COLORS.target);
      });

      it('moves one of two crowded tags aside, so that both can be read', () => {
        const renderer = createAnalogRenderer(ANALOG_THEME);
        const snapshot = makeSnapshot([lead, wing]);
        renderAt(renderer, 0, { snapshot });

        const recording = renderAt(renderer, QUARTER_TURN_MS, { snapshot });

        expect(tagTopOf(recording, 'LEAD1')).toBeLessThan(blipYPx);
        expect(tagTopOf(recording, 'WING2')).toBeGreaterThan(blipYPx);
      });

      it('leaves a tag where it was put once the crowd has gone, until the renderer is reset', () => {
        const renderer = createAnalogRenderer(ANALOG_THEME);
        const crowded = makeSnapshot([lead, wing]);
        const alone = makeSnapshot([wing]);
        renderAt(renderer, 0, { snapshot: crowded });
        renderAt(renderer, QUARTER_TURN_MS, { snapshot: crowded });

        const afterCrowd = renderAt(renderer, QUARTER_TURN_MS + 16, { snapshot: alone });
        renderer.reset();
        renderAt(renderer, 0, { snapshot: alone });
        const afterReset = renderAt(renderer, QUARTER_TURN_MS, { snapshot: alone });

        expect(tagTopOf(afterCrowd, 'WING2')).toBeGreaterThan(blipYPx);
        expect(tagTopOf(afterReset, 'WING2')).toBeLessThan(blipYPx);
      });

      it('works the placement out again only when a blip is painted, or the snapshot or viewport changes', () => {
        const renderer = createAnalogRenderer(ANALOG_THEME);
        const { context } = createRecordingContext();
        const measured = vi.spyOn(context, 'measureText');
        const viewport = createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM);
        const frame: ScopeFrame = {
          viewport,
          rangeNm: 60,
          snapshot: makeSnapshot([lead]),
          videoMap: undefined,
          frameTimeMs: 0,
          settings: {},
          selectedIcaoHex: undefined,
          measureLine: undefined,
        };

        renderer.render(context, frame);
        expect(measured).not.toHaveBeenCalled();

        renderer.render(context, { ...frame, frameTimeMs: QUARTER_TURN_MS });
        const callsPerPlacement = measured.mock.calls.length;
        expect(callsPerPlacement).toBeGreaterThan(0);

        renderer.render(context, { ...frame, frameTimeMs: QUARTER_TURN_MS + 16 });
        expect(measured).toHaveBeenCalledTimes(callsPerPlacement);

        renderer.render(context, {
          ...frame,
          frameTimeMs: QUARTER_TURN_MS + 32,
          snapshot: makeSnapshot([lead]),
        });
        expect(measured).toHaveBeenCalledTimes(callsPerPlacement * 2);

        const unchangedSnapshot = { ...frame, snapshot: makeSnapshot([lead]) };
        renderer.render(context, { ...unchangedSnapshot, frameTimeMs: QUARTER_TURN_MS + 48 });
        const changedViewports = [
          { ...viewport, widthPx: WIDTH_PX + 100 },
          { ...viewport, widthPx: WIDTH_PX + 100, heightPx: HEIGHT_PX + 100 },
          { ...viewport, widthPx: WIDTH_PX + 100, heightPx: HEIGHT_PX + 100, pxPerNm: 9 },
          {
            ...viewport,
            widthPx: WIDTH_PX + 100,
            heightPx: HEIGHT_PX + 100,
            pxPerNm: 9,
            pxPerRem: 32,
          },
        ];
        changedViewports.forEach((changed, index) => {
          renderer.render(context, {
            ...unchangedSnapshot,
            frameTimeMs: QUARTER_TURN_MS + 64 + index * 16,
            viewport: changed,
          });
          expect(measured).toHaveBeenCalledTimes(callsPerPlacement * (4 + index));
        });

        renderer.render(context, {
          ...unchangedSnapshot,
          frameTimeMs: QUARTER_TURN_MS + 64 + changedViewports.length * 16,
          viewport: {
            ...viewport,
            widthPx: WIDTH_PX + 100,
            heightPx: HEIGHT_PX + 100,
            pxPerNm: 9,
            pxPerRem: 32,
          },
          settings: { [LEADER_SETTING_ID]: 'long' },
        });
        expect(measured).toHaveBeenCalledTimes(callsPerPlacement * (4 + changedViewports.length));
      });

      it('runs the tag leader as long as the leader setting asks', () => {
        const short = createAnalogRenderer(ANALOG_THEME);
        const long = createAnalogRenderer(ANALOG_THEME);
        const snapshot = makeSnapshot([lead]);
        const settings = { [LEADER_SETTING_ID]: 'long' };
        renderAt(short, 0, { snapshot });
        renderAt(long, 0, { snapshot, settings });

        const shortTag = renderAt(short, QUARTER_TURN_MS, { snapshot })
          .callsTo('fillText')
          .find((call) => call.args[0] === 'LEAD1');
        const longTag = renderAt(long, QUARTER_TURN_MS, { snapshot, settings })
          .callsTo('fillText')
          .find((call) => call.args[0] === 'LEAD1');

        const furtherPx =
          (ANALOG_LAYOUT_REM.tagLeaderLength.long - ANALOG_LAYOUT_REM.tagLeaderLength.short) *
          DEFAULT_PX_PER_REM *
          Math.SQRT1_2;
        expect(Number(longTag?.args[1])).toBeCloseTo(Number(shortTag?.args[1]) + furtherPx);
        expect(Number(longTag?.args[2])).toBeCloseTo(Number(shortTag?.args[2]) - furtherPx);
      });
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

    it('ends the map at the outermost ring, as the face of a round tube did', () => {
      const beyond: ScopeVideoMap = {
        rangeNm: 60,
        points: [
          ...videoMap.points,
          { kind: 'airport', label: 'KOUT', position: { trueBearingDeg: 90, rangeNm: 70 } },
        ],
        lines: [],
      };

      const recording = renderAt(createAnalogRenderer(ANALOG_THEME), 0, { videoMap: beyond });

      expect(recording.callsTo('clip')).toHaveLength(1);
      expect(recording.texts()).toContain('KTST');
      expect(recording.texts()).not.toContain('KOUT');
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
