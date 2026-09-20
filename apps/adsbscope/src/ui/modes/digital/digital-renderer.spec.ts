import { describe, expect, it, vi } from 'vitest';

import type { ScopeSnapshot, ScopeTarget, ScopeVideoMap } from '../../../shared/protocol.js';
import { TIME_SHARE_ALTERNATE_MS, TIME_SHARE_CYCLE_MS } from '../../scope/data-block.js';
import { EMERGENCY_FLASH_PERIOD_MS } from '../../scope/emergency.js';
import { createViewport, polarToScreen } from '../../scope/projection.js';
import type { ScopeFrame } from '../../scope/renderer.js';
import { createRecordingContext, makeSnapshot, makeTarget } from '../../scope/test-utils.js';
import type { RecordingContext } from '../../scope/test-utils.js';
import { DEFAULT_PX_PER_REM } from '../../scope/units.js';
import { canvasFont } from '../../styles/theme.js';
import type { ScopeTheme } from '../../styles/theme.js';
import { MAP_SETTING_ID } from '../shared-settings.js';

import {
  COASTING_AFTER_MS,
  createDigitalRenderer,
  DIGITAL_LAYOUT_REM,
} from './digital-renderer.js';
import { DIGITAL_THEME } from './digital-theme.js';

const WIDTH_PX = 800;
const HEIGHT_PX = 600;
const VIEWPORT = createViewport(WIDTH_PX, HEIGHT_PX, 60, DEFAULT_PX_PER_REM);
const COLORS = DIGITAL_THEME.canvas;

function renderFrame(
  snapshot: ScopeSnapshot | undefined,
  rangeNm = 60,
  pxPerRem = DEFAULT_PX_PER_REM,
  theme: ScopeTheme = DIGITAL_THEME,
  extras: { videoMap?: ScopeVideoMap; settings?: Record<string, string> } = {},
): RecordingContext {
  const recording = createRecordingContext();
  const frame: ScopeFrame = {
    viewport: createViewport(WIDTH_PX, HEIGHT_PX, rangeNm, pxPerRem),
    rangeNm,
    snapshot,
    videoMap: extras.videoMap,
    frameTimeMs: 0,
    settings: extras.settings ?? {},
    selectedIcaoHex: undefined,
  };
  createDigitalRenderer(theme).render(recording.context, frame);
  return recording;
}

describe('createDigitalRenderer', () => {
  it('clears the whole canvas to the background color first', () => {
    const recording = renderFrame(undefined);

    expect(recording.calls[0]).toMatchObject({
      method: 'fillRect',
      args: [0, 0, WIDTH_PX, HEIGHT_PX],
      fillStyle: COLORS.background,
    });
  });

  it('draws and labels the range rings for the selected range', () => {
    const recording = renderFrame(undefined, 60);

    const ringRadii = recording.callsTo('arc').map((call) => Number(call.args[2]));
    expect(ringRadii).toHaveLength(6);
    expect(ringRadii.at(-1)).toBeCloseTo(VIEWPORT.radiusPx);
    expect(recording.texts()).toEqual(expect.arrayContaining(['10', '20', '30', '40', '50', '60']));
  });

  it('draws a compass rose with a tick every 10 degrees and a label every 30', () => {
    const texts = renderFrame(undefined).texts();

    expect(texts).toEqual(expect.arrayContaining(['360', '030', '090', '180', '270', '330']));
    expect(texts).not.toContain('010');
    expect(texts).not.toContain('000');
  });

  it('draws only the scope furniture before the first snapshot and for an empty one', () => {
    const before = renderFrame(undefined);
    const empty = renderFrame(makeSnapshot());

    expect(empty.calls).toEqual(before.calls);
    expect(before.callsTo('strokeRect')).toHaveLength(0);
  });

  it('draws an airborne target as a filled symbol with a leader line and data block', () => {
    const position = { trueBearingDeg: 90, rangeNm: 30 };
    const target = makeTarget({
      callsign: 'UAL123',
      altitudeFt: 12_000,
      groundSpeedKt: 300,
      position,
    });
    const before = renderFrame(makeSnapshot());

    const recording = renderFrame(makeSnapshot([target]));

    const at = polarToScreen(VIEWPORT, position);
    const halfPx = DIGITAL_LAYOUT_REM.symbolHalfSize * DEFAULT_PX_PER_REM;
    const symbol = recording.callsTo('fillRect').at(-1);
    expect(symbol?.args).toEqual([at.xPx - halfPx, at.yPx - halfPx, halfPx * 2, halfPx * 2]);
    expect(symbol?.fillStyle).toBe(COLORS.target);
    expect(recording.texts()).toEqual(expect.arrayContaining(['UAL123', '120 30']));
    expect(recording.callsTo('stroke').length).toBe(before.callsTo('stroke').length + 1);
  });

  it('stacks the data block lines upward from the end of the leader line', () => {
    const target = makeTarget({ callsign: 'UAL123', position: { trueBearingDeg: 0, rangeNm: 10 } });

    const recording = renderFrame(makeSnapshot([target]));

    const callsign = recording.callsTo('fillText').find((call) => call.args[0] === 'UAL123');
    const secondLine = recording.callsTo('fillText').find((call) => call.args[0] === '--- --');
    const lineHeightPx = DIGITAL_LAYOUT_REM.dataBlockLineHeight * DEFAULT_PX_PER_REM;
    expect(Number(callsign?.args[2])).toBeCloseTo(Number(secondLine?.args[2]) - lineHeightPx);
    expect(callsign?.args[1]).toBe(secondLine?.args[1]);
  });

  it('scales its furniture, symbology, and type with the root font size', () => {
    const position = { trueBearingDeg: 90, rangeNm: 10 };
    const target = makeTarget({ position });

    const normal = renderFrame(makeSnapshot([target]), 60, 16);
    const large = renderFrame(makeSnapshot([target]), 60, 32);

    expect(Number(large.callsTo('fillRect').at(-1)?.args[2])).toBe(
      Number(normal.callsTo('fillRect').at(-1)?.args[2]) * 2,
    );
    expect(normal.context.font).toBe(canvasFont(DIGITAL_THEME, 16));
    expect(large.context.font).toBe(canvasFont(DIGITAL_THEME, 32));
  });

  it('draws a velocity vector one minute long along the track', () => {
    const position = { trueBearingDeg: 0, rangeNm: 20 };
    const target = makeTarget({ position, trueTrackDeg: 90, groundSpeedKt: 360 });

    const recording = renderFrame(makeSnapshot([target]));

    const at = polarToScreen(VIEWPORT, position);
    const tip = recording
      .callsTo('lineTo')
      .find((call) => Math.abs(Number(call.args[1]) - at.yPx) < 1e-6 && call.args[0] !== at.xPx);
    expect(Number(tip?.args[0])).toBeCloseTo(at.xPx + 6 * VIEWPORT.pxPerNm);
    expect(tip?.strokeStyle).toBe(COLORS.vector);
  });

  it('draws no velocity vector without both track and ground speed', () => {
    const position = { trueBearingDeg: 0, rangeNm: 20 };
    const withVector = renderFrame(
      makeSnapshot([makeTarget({ position, trueTrackDeg: 90, groundSpeedKt: 360 })]),
    );

    const noSpeed = renderFrame(makeSnapshot([makeTarget({ position, trueTrackDeg: 90 })]));
    const noTrack = renderFrame(makeSnapshot([makeTarget({ position, groundSpeedKt: 360 })]));

    expect(noSpeed.callsTo('stroke').length).toBe(withVector.callsTo('stroke').length - 1);
    expect(noTrack.callsTo('stroke').length).toBe(withVector.callsTo('stroke').length - 1);
  });

  it('draws a target on the ground as a hollow symbol with no velocity vector', () => {
    const position = { trueBearingDeg: 180, rangeNm: 2 };
    const airborne = renderFrame(
      makeSnapshot([makeTarget({ position, trueTrackDeg: 90, groundSpeedKt: 15 })]),
    );

    const recording = renderFrame(
      makeSnapshot([makeTarget({ position, trueTrackDeg: 90, groundSpeedKt: 15, onGround: true })]),
    );

    expect(recording.callsTo('strokeRect')).toHaveLength(1);
    expect(recording.callsTo('fillRect')).toHaveLength(1);
    expect(recording.callsTo('stroke').length).toBe(airborne.callsTo('stroke').length - 1);
    expect(recording.texts()).toContain('GND 02');
  });

  it('draws history dots that fade with age', () => {
    const target = makeTarget({
      position: { trueBearingDeg: 90, rangeNm: 30 },
      history: [
        { trueBearingDeg: 90, rangeNm: 27 },
        { trueBearingDeg: 90, rangeNm: 28 },
        { trueBearingDeg: 90, rangeNm: 29 },
      ],
    });

    const recording = renderFrame(makeSnapshot([target]));

    const dots = recording.callsTo('fill');
    expect(dots).toHaveLength(3);
    expect(dots.map((dot) => dot.globalAlpha)).toEqual([0.25, 0.5, 0.75]);
    expect(dots.every((dot) => dot.fillStyle === COLORS.history)).toBe(true);
    expect(recording.callsTo('fillText').at(-1)?.globalAlpha).toBe(1);
  });

  it('dims a target that has not been heard from recently', () => {
    const position = { trueBearingDeg: 90, rangeNm: 30 };
    const fresh = makeTarget({ position, lastSeenAt: 1_000_000 - COASTING_AFTER_MS });
    const coasting = makeTarget({ position, lastSeenAt: 1_000_000 - COASTING_AFTER_MS - 1 });

    const freshSymbol = renderFrame(makeSnapshot([fresh]))
      .callsTo('fillRect')
      .at(-1);
    const coastingSymbol = renderFrame(makeSnapshot([coasting]))
      .callsTo('fillRect')
      .at(-1);

    expect(freshSymbol?.fillStyle).toBe(COLORS.target);
    expect(coastingSymbol?.fillStyle).toBe(COLORS.coasting);
  });

  it('skips targets with no position and targets far off the canvas', () => {
    const before = renderFrame(makeSnapshot());

    const recording = renderFrame(
      makeSnapshot([
        makeTarget({ callsign: 'NOPOS' }),
        makeTarget({ callsign: 'FAR', position: { trueBearingDeg: 90, rangeNm: 400 } }),
      ]),
    );

    expect(recording.calls).toEqual(before.calls);
  });

  it('draws with the colors of the theme it is given', () => {
    const theme: ScopeTheme = {
      ...DIGITAL_THEME,
      canvas: { ...COLORS, background: '#001100', target: '#33ff66' },
    };
    const target = makeTarget({ position: { trueBearingDeg: 90, rangeNm: 30 } });

    const recording = renderFrame(makeSnapshot([target]), 60, DEFAULT_PX_PER_REM, theme);

    expect(recording.calls[0]?.fillStyle).toBe('#001100');
    expect(recording.callsTo('fillRect').at(-1)?.fillStyle).toBe('#33ff66');
  });

  describe('video map', () => {
    const videoMap: ScopeVideoMap = {
      rangeNm: 60,
      points: [
        { kind: 'airport', label: 'KTST', position: { trueBearingDeg: 270, rangeNm: 20 } },
        { kind: 'navaid', label: 'ENE', position: { trueBearingDeg: 90, rangeNm: 20 } },
      ],
      lines: [
        {
          kind: 'airspace',
          airspaceClass: 'classC',
          points: [
            [0, 10],
            [90, 10],
          ],
        },
      ],
    };

    it('draws the map in its own colors, under the furniture and the traffic', () => {
      const recording = renderFrame(makeSnapshot(), 60, DEFAULT_PX_PER_REM, DIGITAL_THEME, {
        videoMap,
      });

      const mapLabel = recording.calls.findIndex((call) => call.args[0] === 'KTST');
      const firstRingLabel = recording.calls.findIndex((call) => call.args[0] === '10');
      expect(mapLabel).toBeGreaterThan(0);
      expect(mapLabel).toBeLessThan(firstRingLabel);
      expect(recording.calls[mapLabel]?.fillStyle).toBe(COLORS.videoMapLabel);
      expect(recording.callsTo('stroke')[0]?.strokeStyle).toBe(COLORS.airspaceClassC);
    });

    it('draws the basic map by default, and navaids and fixes only on the full map', () => {
      const basic = renderFrame(makeSnapshot(), 60, DEFAULT_PX_PER_REM, DIGITAL_THEME, {
        videoMap,
      });
      const full = renderFrame(makeSnapshot(), 60, DEFAULT_PX_PER_REM, DIGITAL_THEME, {
        videoMap,
        settings: { [MAP_SETTING_ID]: 'full' },
      });

      expect(basic.texts()).toContain('KTST');
      expect(basic.texts()).not.toContain('ENE');
      expect(full.texts()).toContain('ENE');
    });

    it('draws the map across the whole canvas, beyond the outermost ring', () => {
      const beyond: ScopeVideoMap = {
        rangeNm: 60,
        points: [{ kind: 'airport', label: 'KOUT', position: { trueBearingDeg: 90, rangeNm: 70 } }],
        lines: [],
      };

      const recording = renderFrame(makeSnapshot(), 60, DEFAULT_PX_PER_REM, DIGITAL_THEME, {
        videoMap: beyond,
      });

      expect(recording.callsTo('clip')).toHaveLength(0);
      expect(recording.texts()).toContain('KOUT');
    });

    it('leaves the map out when it is turned off, or has not loaded yet', () => {
      const off = renderFrame(makeSnapshot(), 60, DEFAULT_PX_PER_REM, DIGITAL_THEME, {
        videoMap,
        settings: { [MAP_SETTING_ID]: 'off' },
      });
      const notLoaded = renderFrame(makeSnapshot());

      expect(off.texts()).not.toContain('KTST');
      expect(off.calls).toEqual(notLoaded.calls);
    });
  });

  describe('selection', () => {
    const position = { trueBearingDeg: 90, rangeNm: 30 };
    const snapshot = makeSnapshot([
      makeTarget({ icaoHex: 'aaaaaa', position }),
      makeTarget({ icaoHex: 'bbbbbb', position: { trueBearingDeg: 270, rangeNm: 30 } }),
    ]);

    function selectionRings(selectedIcaoHex: string | undefined): unknown[][] {
      const recording = createRecordingContext();
      createDigitalRenderer(DIGITAL_THEME).render(recording.context, {
        viewport: VIEWPORT,
        rangeNm: 60,
        snapshot,
        videoMap: undefined,
        frameTimeMs: 0,
        settings: {},
        selectedIcaoHex,
      });
      const ringAt = recording.calls.findIndex(
        (call) => call.method === 'stroke' && call.strokeStyle === COLORS.selected,
      );
      return ringAt === -1
        ? []
        : recording.calls
            .slice(0, ringAt)
            .filter((call) => call.method === 'arc')
            .slice(-1)
            .map((call) => call.args);
    }

    it('rings the selected target, and only it', () => {
      const at = polarToScreen(VIEWPORT, position);

      expect(selectionRings('aaaaaa')).toEqual([
        [
          at.xPx,
          at.yPx,
          DIGITAL_LAYOUT_REM.selectionRadius * DEFAULT_PX_PER_REM,
          0,
          expect.any(Number),
        ],
      ]);
    });

    it('lets a click on a data block pick its aircraft, once it has been drawn', () => {
      const renderer = createDigitalRenderer(DIGITAL_THEME);
      const recording = createRecordingContext();
      expect(renderer.pickDataBlock({ xPx: 0, yPx: 0 })).toBeUndefined();

      renderer.render(recording.context, {
        viewport: VIEWPORT,
        rangeNm: 60,
        snapshot,
        videoMap: undefined,
        frameTimeMs: 0,
        settings: {},
        selectedIcaoHex: undefined,
      });

      const label = recording.callsTo('fillText').find((call) => call.args[0] === 'AAAAAA');
      const onTheLabel = { xPx: Number(label?.args[1]) + 2, yPx: Number(label?.args[2]) - 2 };
      expect(renderer.pickDataBlock(onTheLabel)).toBe('aaaaaa');
      expect(renderer.pickDataBlock({ xPx: 5, yPx: 5 })).toBeUndefined();

      renderer.reset();
      expect(renderer.pickDataBlock(onTheLabel)).toBeUndefined();
    });

    it('rings nothing when nothing is selected, or the selected aircraft is not plotted', () => {
      expect(selectionRings(undefined)).toEqual([]);
      expect(selectionRings('ffffff')).toEqual([]);
    });
  });

  describe('emergencies', () => {
    const position = { trueBearingDeg: 90, rangeNm: 30 };

    function symbolColorAt(target: ScopeTarget, frameTimeMs: number): string | undefined {
      const recording = createRecordingContext();
      createDigitalRenderer(DIGITAL_THEME).render(recording.context, {
        viewport: VIEWPORT,
        rangeNm: 60,
        snapshot: makeSnapshot([target]),
        videoMap: undefined,
        frameTimeMs,
        settings: {},
        selectedIcaoHex: undefined,
      });
      return recording.callsTo('fillRect').at(-1)?.fillStyle;
    }

    it('flashes an aircraft in an emergency between the emergency color and the usual one', () => {
      const target = makeTarget({ callsign: 'UAL123', emergency: 'general', position });

      expect(symbolColorAt(target, 0)).toBe(COLORS.emergency);
      expect(symbolColorAt(target, EMERGENCY_FLASH_PERIOD_MS / 2)).toBe(COLORS.target);
      expect(symbolColorAt(makeTarget({ position }), 0)).toBe(COLORS.target);
    });

    it('never dims an aircraft in an emergency as coasting', () => {
      const lastSeenAt = makeSnapshot().at - COASTING_AFTER_MS - 1;
      const emergency = makeTarget({ emergency: 'general', position, lastSeenAt });
      const routine = makeTarget({ position, lastSeenAt });

      expect(symbolColorAt(routine, 0)).toBe(COLORS.coasting);
      expect(symbolColorAt(emergency, 0)).toBe(COLORS.emergency);
      expect(symbolColorAt(emergency, EMERGENCY_FLASH_PERIOD_MS / 2)).toBe(COLORS.target);
    });

    it('adds the emergency code to the data block', () => {
      const recording = renderFrame(
        makeSnapshot([makeTarget({ callsign: 'UAL123', emergency: 'general', position })]),
      );

      expect(recording.texts()).toContain('UAL123 EM');
    });
  });

  describe('data block placement', () => {
    const CENTER = { trueBearingDeg: 90, rangeNm: 30 };
    const lead = makeTarget({ icaoHex: 'aaaaaa', callsign: 'LEAD1', position: CENTER });
    const wing = makeTarget({
      icaoHex: 'bbbbbb',
      callsign: 'WING2',
      position: { trueBearingDeg: 90, rangeNm: 31 },
    });

    function frameOf(targets: ScopeTarget[], overrides: Partial<ScopeFrame> = {}): ScopeFrame {
      return {
        viewport: VIEWPORT,
        rangeNm: 60,
        snapshot: makeSnapshot(targets),
        videoMap: undefined,
        frameTimeMs: 0,
        settings: {},
        selectedIcaoHex: undefined,
        ...overrides,
      };
    }

    function blockTopOf(recording: RecordingContext, callsign: string): number {
      return Number(
        recording.callsTo('fillText').find((call) => call.args[0] === callsign)?.args[2],
      );
    }

    it('moves one of two crowded data blocks aside, so that both can be read', () => {
      const recording = createRecordingContext();

      createDigitalRenderer(DIGITAL_THEME).render(recording.context, frameOf([lead, wing]));

      const symbolYPx = polarToScreen(VIEWPORT, CENTER).yPx;
      expect(blockTopOf(recording, 'LEAD1')).toBeLessThan(symbolYPx);
      expect(blockTopOf(recording, 'WING2')).toBeGreaterThan(symbolYPx);
    });

    it('leaves a block where it was put once the crowd has gone, until the renderer is reset', () => {
      const renderer = createDigitalRenderer(DIGITAL_THEME);
      const symbolYPx = polarToScreen(VIEWPORT, CENTER).yPx;
      renderer.render(createRecordingContext().context, frameOf([lead, wing]));

      const alone = createRecordingContext();
      renderer.render(alone.context, frameOf([wing]));
      renderer.reset();
      const afterReset = createRecordingContext();
      renderer.render(afterReset.context, frameOf([wing]));

      expect(blockTopOf(alone, 'WING2')).toBeGreaterThan(symbolYPx);
      expect(blockTopOf(afterReset, 'WING2')).toBeLessThan(symbolYPx);
    });

    it('time-shares the second line of a block with the registered model, when it is known', () => {
      const known = makeTarget({
        icaoHex: 'aaaaaa',
        callsign: 'N409CC',
        aircraftModel: 'PA-28-181',
        altitudeFt: 4500,
        groundSpeedKt: 110,
        position: CENTER,
      });
      const unknown = makeTarget({
        icaoHex: 'bbbbbb',
        callsign: 'UAL123',
        altitudeFt: 12_000,
        groundSpeedKt: 300,
        position: { trueBearingDeg: 270, rangeNm: 30 },
      });
      const renderer = createDigitalRenderer(DIGITAL_THEME);
      const usual = createRecordingContext();
      const alternate = createRecordingContext();
      const frame = frameOf([known, unknown]);

      renderer.render(usual.context, frame);
      renderer.render(alternate.context, {
        ...frame,
        frameTimeMs: TIME_SHARE_CYCLE_MS - TIME_SHARE_ALTERNATE_MS,
      });

      expect(usual.texts()).toEqual(expect.arrayContaining(['N409CC', '045 11', '120 30']));
      expect(usual.texts()).not.toContain('PA-28-181');
      expect(alternate.texts()).toEqual(expect.arrayContaining(['N409CC', 'PA-28-181', '120 30']));
      expect(alternate.texts()).not.toContain('045 11');
    });

    it('sizes a block for the wider of its two second lines, so it does not move as they alternate', () => {
      const target = makeTarget({
        icaoHex: 'aaaaaa',
        callsign: 'N1',
        aircraftModel: 'PA-28-181',
        position: CENTER,
      });
      const renderer = createDigitalRenderer(DIGITAL_THEME);
      const usual = createRecordingContext();
      const alternate = createRecordingContext();
      const frame = frameOf([target]);
      const measured = vi.spyOn(usual.context, 'measureText');

      renderer.render(usual.context, frame);
      renderer.render(alternate.context, {
        ...frame,
        frameTimeMs: TIME_SHARE_CYCLE_MS - TIME_SHARE_ALTERNATE_MS,
      });

      expect(measured).toHaveBeenCalledWith('PA-28-181');
      const callsignAt = (recording: RecordingContext): unknown[] | undefined =>
        recording.callsTo('fillText').find((call) => call.args[0] === 'N1')?.args;
      expect(callsignAt(alternate)).toEqual(callsignAt(usual));
    });

    it('works the placement out once per snapshot and viewport, not once per frame', () => {
      const renderer = createDigitalRenderer(DIGITAL_THEME);
      const recording = createRecordingContext();
      const measureText = vi.spyOn(recording.context, 'measureText');
      const frame = frameOf([lead]);
      const oneInputChangedEachTime: ScopeFrame[] = [
        { ...frame, snapshot: makeSnapshot([lead]) },
        { ...frame, viewport: { ...VIEWPORT, widthPx: WIDTH_PX + 100 } },
        { ...frame, viewport: { ...VIEWPORT, heightPx: HEIGHT_PX + 100 } },
        { ...frame, viewport: { ...VIEWPORT, pxPerNm: VIEWPORT.pxPerNm * 2 } },
        { ...frame, viewport: { ...VIEWPORT, pxPerRem: 32 } },
      ];

      renderer.render(recording.context, frame);
      const callsPerPlacement = measureText.mock.calls.length;
      renderer.render(recording.context, { ...frame, frameTimeMs: 16 });
      expect(callsPerPlacement).toBeGreaterThan(0);
      expect(measureText).toHaveBeenCalledTimes(callsPerPlacement);

      for (const next of oneInputChangedEachTime) {
        const fresh = createDigitalRenderer(DIGITAL_THEME);
        const { context } = createRecordingContext();
        const measured = vi.spyOn(context, 'measureText');
        fresh.render(context, frame);
        fresh.render(context, next);
        expect(measured).toHaveBeenCalledTimes(callsPerPlacement * 2);
      }
    });
  });
});
