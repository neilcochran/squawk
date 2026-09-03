import {
  decodeAirborneCprPair,
  decodeAirborneCprWithReference,
  decodeSurfaceCprPair,
  decodeSurfaceCprWithReference,
} from '@squawk/mode-s';
import type { CprPosition, DecodedModeSMessage, ModeAcReply } from '@squawk/mode-s';
import type { Aircraft, Position } from '@squawk/types';

import type { AircraftUpdate } from './tracker.js';

/**
 * Max age gap, in ms, between an even and odd CPR frame to still combine
 * them into one pair decode. Matches the pairing window `@squawk/mode-s`
 * documents for `decodeAirborneCprPair`/`decodeSurfaceCprPair` - airborne
 * position is broadcast at roughly 2 Hz, so frames further apart than this
 * risk spanning a latitude zone crossing.
 */
const CPR_PAIR_MAX_AGE_MS = 10_000;

/** One retained CPR frame plus when it was received, for pairing against the opposite format. */
interface CprSlot {
  frame: CprPosition;
  receivedAt: number;
}

/** Retained even/odd CPR frames for one aircraft, airborne or surface. */
interface CprPairState {
  even?: CprSlot;
  odd?: CprSlot;
}

/**
 * Maps decoded Beast/Mode-S messages into partial {@link AircraftUpdate}s.
 * Unlike the JSON/SBS mappers, this can't be a pure function - CPR position
 * decoding needs per-aircraft even/odd pairing state across messages, which
 * this owns internally (dump1090-fa resolves CPR before either of those
 * other formats sees it, so neither mapper needed anything like this).
 *
 * Create one with {@link createBeastMapper} rather than implementing this
 * interface directly.
 */
export interface BeastMapper {
  /**
   * Maps one decoded message to a partial update, or undefined if it carries
   * no attributable aircraft data: an undecoded frame, a Mode A/C reply
   * (carries no ICAO address - see the `@squawk/mode-s` README), or a
   * DF0/4/5/16/20/21 reply whose CRC-recovered `candidateIcaoHex` doesn't
   * match an aircraft `getKnownAircraft` already knows about (these replies
   * need cross-checking against known traffic before their address can be
   * trusted; see `@squawk/mode-s`'s README).
   *
   * @param decoded - The frame's decoded message, as read off `BeastFrame.decoded`.
   * @param getKnownAircraft - Looks up an aircraft's current tracked state by ICAO hex, e.g. `tracker.getAircraft`. Used both to cross-check a candidate address and as the CPR reference for an aircraft with a previously-resolved position.
   */
  map(
    decoded: DecodedModeSMessage | ModeAcReply | undefined,
    getKnownAircraft: (icaoHex: string) => Aircraft | undefined,
  ): AircraftUpdate | undefined;
  /** Clears retained CPR pairing state for one aircraft. Call when the tracker reports it lost, so a later reappearance starts fresh rather than pairing against a stale frame. */
  forget(icaoHex: string): void;
}

/** Options for {@link createBeastMapper}. */
export interface BeastMapperOptions {
  /**
   * The receiving station's own position - used as the CPR reference for
   * surface decoding (required; there is no pair-only path for surface) and
   * for an aircraft's first airborne fix before a pair has arrived. A
   * per-aircraft reference (its own last known position, once resolved)
   * always takes priority over this when available.
   */
  receiverPosition?: Pick<Position, 'lat' | 'lon'>;
}

/**
 * Resolves a position from a paired even/odd frame if one is available
 * within {@link CPR_PAIR_MAX_AGE_MS}, otherwise from `frame` plus `reference`
 * if one was given. Returns undefined if neither path is available.
 */
function decodePairOrReference(
  surface: boolean,
  format: 'even' | 'odd',
  frame: CprPosition,
  state: CprPairState,
  slot: CprSlot,
  reference: Pick<Position, 'lat' | 'lon'> | undefined,
): Position | undefined {
  const other = format === 'even' ? state.odd : state.even;
  if (other !== undefined && Math.abs(slot.receivedAt - other.receivedAt) <= CPR_PAIR_MAX_AGE_MS) {
    const even = format === 'even' ? frame : other.frame;
    const odd = format === 'odd' ? frame : other.frame;
    const paired = surface
      ? reference !== undefined
        ? decodeSurfaceCprPair(even, odd, format, reference)
        : undefined
      : decodeAirborneCprPair(even, odd, format);
    if (paired !== undefined) {
      return paired;
    }
  }

  if (reference === undefined) {
    return undefined;
  }
  return surface
    ? decodeSurfaceCprWithReference(format, frame, reference)
    : decodeAirborneCprWithReference(format, frame, reference);
}

/**
 * Creates a {@link BeastMapper}.
 *
 * @param options - Optional receiver position, used as the CPR reference for surface decoding and an aircraft's first airborne fix.
 */
export function createBeastMapper(options: BeastMapperOptions = {}): BeastMapper {
  const airbornePairs = new Map<string, CprPairState>();
  const surfacePairs = new Map<string, CprPairState>();

  function resolvePosition(
    icaoHex: string,
    surface: boolean,
    format: 'even' | 'odd',
    frame: CprPosition,
    reference: Pick<Position, 'lat' | 'lon'> | undefined,
  ): Position | undefined {
    const pairs = surface ? surfacePairs : airbornePairs;
    const state = pairs.get(icaoHex) ?? {};
    const slot: CprSlot = { frame, receivedAt: Date.now() };
    state[format] = slot;
    pairs.set(icaoHex, state);

    return decodePairOrReference(surface, format, frame, state, slot, reference);
  }

  return {
    map(decoded, getKnownAircraft) {
      if (decoded === undefined || decoded.kind === 'modeAc') {
        return undefined;
      }

      switch (decoded.kind) {
        case 'extendedSquitterPosition': {
          const update: AircraftUpdate = { icaoHex: decoded.icaoHex, onGround: decoded.surface };
          if (decoded.baroAltitudeFt !== undefined) {
            update.baroAltitudeFt = decoded.baroAltitudeFt;
          }
          if (decoded.geoAltitudeFt !== undefined) {
            update.geoAltitudeFt = decoded.geoAltitudeFt;
          }
          if (decoded.groundSpeedKt !== undefined) {
            update.groundSpeedKt = decoded.groundSpeedKt;
          }
          if (decoded.trueTrackDeg !== undefined) {
            update.trueTrackDeg = decoded.trueTrackDeg;
          }
          if (decoded.latCpr !== undefined && decoded.lonCpr !== undefined) {
            const known = getKnownAircraft(decoded.icaoHex);
            const reference = known?.position ?? options.receiverPosition;
            const position = resolvePosition(
              decoded.icaoHex,
              decoded.surface,
              decoded.cprFormat,
              { latCpr: decoded.latCpr, lonCpr: decoded.lonCpr },
              reference,
            );
            if (position !== undefined) {
              update.lat = position.lat;
              update.lon = position.lon;
            }
          }
          return update;
        }
        case 'extendedSquitterVelocity': {
          const update: AircraftUpdate = { icaoHex: decoded.icaoHex };
          const { velocity } = decoded;
          if (velocity.verticalRateFtPerMin !== undefined) {
            update.verticalRateFtPerMin = velocity.verticalRateFtPerMin;
          }
          if (velocity.subtype === 'groundSpeed') {
            if (velocity.groundSpeedKt !== undefined) {
              update.groundSpeedKt = velocity.groundSpeedKt;
            }
            if (velocity.trueTrackDeg !== undefined) {
              update.trueTrackDeg = velocity.trueTrackDeg;
            }
          } else {
            if (velocity.indicatedAirspeedKt !== undefined) {
              update.indicatedAirspeedKt = velocity.indicatedAirspeedKt;
            }
            if (velocity.trueAirspeedKt !== undefined) {
              update.trueAirspeedKt = velocity.trueAirspeedKt;
            }
            if (velocity.magneticHeadingDeg !== undefined) {
              update.magneticHeadingDeg = velocity.magneticHeadingDeg;
            }
          }
          return update;
        }
        case 'extendedSquitterIdentification': {
          const update: AircraftUpdate = { icaoHex: decoded.icaoHex };
          if (decoded.identification.callsign !== undefined) {
            update.callsign = decoded.identification.callsign;
          }
          if (decoded.identification.category !== undefined) {
            update.category = decoded.identification.category;
          }
          return update;
        }
        case 'extendedSquitterEmergencyStatus':
          return { icaoHex: decoded.icaoHex, squawk: decoded.squawk };
        case 'extendedSquitterTargetStateAndStatus':
        case 'extendedSquitterOperationalStatus':
        case 'extendedSquitterAcasRaBroadcast':
        case 'allCallReply':
          return { icaoHex: decoded.icaoHex };
        case 'shortAirAirSurveillanceReply':
        case 'longAirAirSurveillanceReply':
        case 'surveillanceAltitudeReply':
        case 'commBAltitudeReply':
        case 'surveillanceIdentityReply':
        case 'commBIdentityReply': {
          if (getKnownAircraft(decoded.candidateIcaoHex) === undefined) {
            return undefined;
          }
          const update: AircraftUpdate = { icaoHex: decoded.candidateIcaoHex };
          if ('altitudeFt' in decoded && decoded.altitudeFt !== undefined) {
            update.baroAltitudeFt = decoded.altitudeFt;
          }
          if ('squawk' in decoded) {
            update.squawk = decoded.squawk;
          }
          return update;
        }
        default:
          return undefined;
      }
    },
    forget(icaoHex) {
      airbornePairs.delete(icaoHex);
      surfacePairs.delete(icaoHex);
    },
  };
}
