import { greatCircle } from '@squawk/geo';
import type { Airport, Coordinates, Fix, Navaid } from '@squawk/types';

import type {
  PolarTuple,
  ScopeVideoMap,
  VideoMapLine,
  VideoMapPoint,
} from '../../shared/protocol.js';
import { toPolarPoint } from '../snapshot.js';

import {
  areFixLabelsShown,
  areRunwaysShown,
  isAirportShown,
  isFixShown,
  isNavaidShown,
  shownAirspaceClass,
  VIDEO_MAP_LINE_DETAIL,
  VIDEO_MAP_VIEW_FACTOR,
} from './layers.js';

/** One airspace boundary, reduced to what the map needs from it. */
export interface VideoMapAirspace {
  /** The airspace's type, as in the `AirspaceType` of `@squawk/types`. */
  type: string;
  /** The boundary's rings, each a closed loop of positions. The first is the outer boundary. */
  rings: readonly (readonly Coordinates[])[];
}

/** The source records a video map is built from. */
export interface VideoMapSourceData {
  /** Every known airport. */
  airports: readonly Airport[];
  /** Every known navaid. */
  navaids: readonly Navaid[];
  /** Every known fix. */
  fixes: readonly Fix[];
  /** Every known airspace boundary. */
  airspace: readonly VideoMapAirspace[];
}

const DEG_TO_RAD = Math.PI / 180;

function isWithin(receiver: Coordinates, position: Coordinates, radiusNm: number): boolean {
  return greatCircle.distanceNm(receiver.lat, receiver.lon, position.lat, position.lon) <= radiusNm;
}

function toPolarTuple(receiver: Coordinates, position: Coordinates): PolarTuple {
  const { trueBearingDeg, rangeNm } = toPolarPoint(receiver, position);
  return [trueBearingDeg, rangeNm];
}

function distanceBetweenNm(a: PolarTuple, b: PolarTuple): number {
  const ax = a[1] * Math.sin(a[0] * DEG_TO_RAD);
  const ay = a[1] * Math.cos(a[0] * DEG_TO_RAD);
  const bx = b[1] * Math.sin(b[0] * DEG_TO_RAD);
  const by = b[1] * Math.cos(b[0] * DEG_TO_RAD);
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Thins a line by dropping every vertex that lies within `toleranceNm` of the
 * last one kept. The first and last vertices are always kept, so a closed
 * boundary stays closed. Airspace arcs are published as dense runs of points
 * that, at most scope ranges, fall within a pixel of each other; merging them
 * shrinks the map severalfold with no visible difference.
 *
 * @param points - The line's vertices.
 * @param toleranceNm - Minimum spacing between kept vertices, in nautical miles.
 * @returns The thinned line.
 */
export function thinLine(points: readonly PolarTuple[], toleranceNm: number): PolarTuple[] {
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined || points.length <= 2) {
    return [...points];
  }
  const thinned: PolarTuple[] = [first];
  let lastKept = first;
  for (const point of points.slice(1, -1)) {
    if (distanceBetweenNm(lastKept, point) >= toleranceNm) {
      thinned.push(point);
      lastKept = point;
    }
  }
  thinned.push(last);
  return thinned;
}

function airportFeatures(
  airport: Airport,
  receiver: Coordinates,
  rangeNm: number,
): { point: VideoMapPoint; runways: VideoMapLine[] } {
  const runways: VideoMapLine[] = [];
  if (areRunwaysShown(rangeNm)) {
    for (const runway of airport.runways) {
      const [firstEnd, secondEnd] = runway.ends;
      if (
        firstEnd?.lat !== undefined &&
        firstEnd.lon !== undefined &&
        secondEnd?.lat !== undefined &&
        secondEnd.lon !== undefined
      ) {
        runways.push({
          kind: 'runway',
          points: [
            toPolarTuple(receiver, { lat: firstEnd.lat, lon: firstEnd.lon }),
            toPolarTuple(receiver, { lat: secondEnd.lat, lon: secondEnd.lon }),
          ],
        });
      }
    }
  }
  return {
    point: {
      kind: 'airport',
      label: airport.icao ?? airport.faaId,
      position: toPolarPoint(receiver, airport),
      ...(runways.length > 0 && { outlined: true }),
    },
    runways,
  };
}

/**
 * Builds the video map for one scope range: every feature worth showing at
 * that range (see `layers.ts`) that lies within view of the receiver,
 * resolved into scope coordinates. Pure, and deterministic for a given input.
 *
 * An airspace boundary is included whole if any vertex of its outer ring is
 * within view, so a boundary that straddles the edge of the screen is drawn
 * right up to it rather than being cut off early.
 *
 * @param data - The source records.
 * @param receiver - The receiving station's position: the center of the scope.
 * @param rangeNm - The scope range in nautical miles.
 * @returns The map, with points ordered airports, navaids, fixes and lines ordered airspace, runways.
 */
export function buildVideoMap(
  data: VideoMapSourceData,
  receiver: Coordinates,
  rangeNm: number,
): ScopeVideoMap {
  const radiusNm = rangeNm * VIDEO_MAP_VIEW_FACTOR;
  const toleranceNm = rangeNm / VIDEO_MAP_LINE_DETAIL;
  const points: VideoMapPoint[] = [];
  const runwayLines: VideoMapLine[] = [];
  const airspaceLines: VideoMapLine[] = [];

  for (const airport of data.airports) {
    if (isAirportShown(airport, rangeNm) && isWithin(receiver, airport, radiusNm)) {
      const features = airportFeatures(airport, receiver, rangeNm);
      points.push(features.point);
      runwayLines.push(...features.runways);
    }
  }
  for (const navaid of data.navaids) {
    if (isNavaidShown(navaid, rangeNm) && isWithin(receiver, navaid, radiusNm)) {
      points.push({
        kind: 'navaid',
        label: navaid.identifier,
        position: toPolarPoint(receiver, navaid),
      });
    }
  }
  for (const fix of data.fixes) {
    if (isFixShown(fix, rangeNm) && isWithin(receiver, fix, radiusNm)) {
      points.push({
        kind: 'fix',
        position: toPolarPoint(receiver, fix),
        ...(areFixLabelsShown(rangeNm) && { label: fix.identifier }),
      });
    }
  }
  for (const airspace of data.airspace) {
    const outerRing = airspace.rings[0] ?? [];
    const airspaceClass = shownAirspaceClass(airspace.type, rangeNm);
    if (
      airspaceClass !== undefined &&
      outerRing.some((vertex) => isWithin(receiver, vertex, radiusNm))
    ) {
      for (const ring of airspace.rings) {
        airspaceLines.push({
          kind: 'airspace',
          airspaceClass,
          points: thinLine(
            ring.map((vertex) => toPolarTuple(receiver, vertex)),
            toleranceNm,
          ),
        });
      }
    }
  }

  return { rangeNm, points, lines: [...airspaceLines, ...runwayLines] };
}
