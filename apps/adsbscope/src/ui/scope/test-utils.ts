import type { ScopeSnapshot, ScopeTarget } from '../../shared/protocol.js';

/** One recorded canvas call, with the fill/stroke/alpha state in effect when it was made. */
export interface RecordedCall {
  /** The context method called. */
  method: string;
  /** The arguments it was called with. */
  args: unknown[];
  /** `fillStyle` at the time of the call. */
  fillStyle: string;
  /** `strokeStyle` at the time of the call. */
  strokeStyle: string;
  /** `globalAlpha` at the time of the call. */
  globalAlpha: number;
}

/** A stand-in 2D context that records every call made on it. */
export interface RecordingContext {
  /** The stand-in, typed as the real thing so it can be handed to a renderer. */
  context: CanvasRenderingContext2D;
  /** Every call made so far, in order. */
  calls: RecordedCall[];
  /** The recorded calls to one method. */
  callsTo(method: string): RecordedCall[];
  /** The first argument of every `fillText` call: all text drawn. */
  texts(): string[];
}

const RECORDED_METHODS = [
  'arc',
  'beginPath',
  'closePath',
  'fill',
  'fillRect',
  'fillText',
  'lineTo',
  'moveTo',
  'setTransform',
  'stroke',
  'strokeRect',
];

/**
 * Creates a recording stand-in for `CanvasRenderingContext2D`, so renderer
 * specs can assert on what was drawn without a real canvas.
 *
 * @returns The stand-in and its call log.
 */
export function createRecordingContext(): RecordingContext {
  const calls: RecordedCall[] = [];
  const state: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  };
  function record(method: string, args: unknown[]): void {
    calls.push({
      method,
      args,
      fillStyle: String(state.fillStyle),
      strokeStyle: String(state.strokeStyle),
      globalAlpha: Number(state.globalAlpha),
    });
  }
  for (const method of RECORDED_METHODS) {
    state[method] = (...args: unknown[]): void => record(method, args);
  }
  state.createConicGradient = (
    ...args: unknown[]
  ): { addColorStop: (...stop: unknown[]) => void } => {
    record('createConicGradient', args);
    return {
      addColorStop: (...stop: unknown[]): void => record('addColorStop', stop),
    };
  };
  return {
    context: state as unknown as CanvasRenderingContext2D,
    calls,
    callsTo(method: string): RecordedCall[] {
      return calls.filter((call) => call.method === method);
    },
    texts(): string[] {
      return calls.filter((call) => call.method === 'fillText').map((call) => String(call.args[0]));
    },
  };
}

/**
 * Builds a scope target for specs.
 *
 * @param overrides - Fields to set on top of a bare target.
 * @returns The target.
 */
export function makeTarget(overrides: Partial<ScopeTarget> = {}): ScopeTarget {
  return { icaoHex: 'a1b2c3', history: [], lastSeenAt: 1_000_000, ...overrides };
}

/**
 * Builds a snapshot for specs.
 *
 * @param targets - The snapshot's targets.
 * @param overrides - Fields to set on top of a connected snapshot taken at `1_000_000`.
 * @returns The snapshot.
 */
export function makeSnapshot(
  targets: ScopeTarget[] = [],
  overrides: Partial<ScopeSnapshot> = {},
): ScopeSnapshot {
  return { at: 1_000_000, connection: 'connected', targets, ...overrides };
}
