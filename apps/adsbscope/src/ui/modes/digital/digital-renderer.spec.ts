import { describe, expect, it } from 'vitest';

import type { ScopeSnapshot } from '../../../shared/protocol.js';
import { createViewport, polarToScreen } from '../../scope/projection.js';
import type { ScopeFrame } from '../../scope/renderer.js';
import { createRecordingContext, makeSnapshot, makeTarget } from '../../scope/test-utils.js';
import type { RecordingContext } from '../../scope/test-utils.js';
import { DEFAULT_PX_PER_REM } from '../../scope/units.js';
import { canvasFont } from '../../styles/theme.js';
import type { ScopeTheme } from '../../styles/theme.js';

import {
  COASTING_AFTER_MS,
  createDigitalRenderer,
  DIGITAL_LAYOUT_REM,
  isNearCanvas,
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
): RecordingContext {
  const recording = createRecordingContext();
  const frame: ScopeFrame = {
    viewport: createViewport(WIDTH_PX, HEIGHT_PX, rangeNm, pxPerRem),
    rangeNm,
    snapshot,
    frameTimeMs: 0,
    settings: {},
  };
  createDigitalRenderer(theme).render(recording.context, frame);
  return recording;
}

describe('isNearCanvas', () => {
  const marginPx = DIGITAL_LAYOUT_REM.offscreenMargin * DEFAULT_PX_PER_REM;

  it('accepts points on the canvas and just off any edge', () => {
    expect(isNearCanvas(VIEWPORT, { xPx: 400, yPx: 300 })).toBe(true);
    expect(isNearCanvas(VIEWPORT, { xPx: -marginPx, yPx: -marginPx })).toBe(true);
    expect(isNearCanvas(VIEWPORT, { xPx: WIDTH_PX + marginPx, yPx: HEIGHT_PX + marginPx })).toBe(
      true,
    );
  });

  it('rejects points well off each edge', () => {
    const beyondPx = marginPx + 1;
    expect(isNearCanvas(VIEWPORT, { xPx: -beyondPx, yPx: 300 })).toBe(false);
    expect(isNearCanvas(VIEWPORT, { xPx: WIDTH_PX + beyondPx, yPx: 300 })).toBe(false);
    expect(isNearCanvas(VIEWPORT, { xPx: 400, yPx: -beyondPx })).toBe(false);
    expect(isNearCanvas(VIEWPORT, { xPx: 400, yPx: HEIGHT_PX + beyondPx })).toBe(false);
  });
});

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

  it('has no state to reset', () => {
    expect(createDigitalRenderer(DIGITAL_THEME).reset()).toBeUndefined();
  });
});
