/**
 * Screen placement of points at altitude, built on the projection
 * MapLibre hands to custom layers. MapLibre's screen projection
 * (`map.project`) only knows about terrain elevation, so a point on the
 * top face of an extruded box goes through the custom-layer path
 * instead: a custom layer's render arguments carry
 * `defaultProjectionData.mainMatrix`, which MapLibre documents as
 * "sufficient for simple custom layers that only support mercator
 * projection" and which takes spherical mercator coordinates with a
 * conformal z, the space `MercatorCoordinate.fromLngLat(location,
 * altitudeMeters)` produces. The clip-space result then maps to canvas
 * pixels the same way MapLibre maps its own geometry.
 */

/** Projection inputs captured from one custom-layer render call. */
export interface ProjectionFrame {
  /**
   * Column-major 4x4 matrix from MapLibre's mercator space (x and y in
   * 0..1 across the world, z in mercator units) to clip space:
   * `defaultProjectionData.mainMatrix` of the render arguments.
   */
  readonly mainMatrix: ArrayLike<number>;
  /** Canvas width in CSS pixels. */
  readonly width: number;
  /** Canvas height in CSS pixels. */
  readonly height: number;
}

/** A location in MapLibre's mercator coordinate space, as `MercatorCoordinate` provides it. */
export interface MercatorPoint {
  /** Mercator x, 0 at the west edge of the world and 1 at the east edge. */
  readonly x: number;
  /** Mercator y, 0 at the north edge of the world and 1 at the south edge. */
  readonly y: number;
  /** Altitude in mercator units, as `MercatorCoordinate.fromLngLat` encodes meters. */
  readonly z: number;
}

/** A position on the map canvas in CSS pixels from its top-left corner. */
export interface ScreenPoint {
  /** Pixels from the left edge. */
  readonly x: number;
  /** Pixels from the top edge. */
  readonly y: number;
}

/**
 * Projects a mercator point, altitude included, to canvas pixels through
 * the frame's projection matrix: the matrix takes the point to clip
 * space, the perspective divide yields normalized device coordinates,
 * and those map to pixels with y flipped so the top of the canvas is
 * row 0.
 *
 * Returns `undefined` when the point is behind the camera, where the
 * perspective divide would mirror it onto the screen, or when the
 * matrix is not a full 4x4.
 */
export function projectMercatorPoint(
  frame: ProjectionFrame,
  point: MercatorPoint,
): ScreenPoint | undefined {
  const matrix = frame.mainMatrix;
  // A missing element poisons the result with NaN, which fails the
  // `clipW > 0` check below and hides the point rather than placing it.
  const m = (index: number): number => matrix[index] ?? Number.NaN;
  const { x, y, z } = point;
  const clipX = m(0) * x + m(4) * y + m(8) * z + m(12);
  const clipY = m(1) * x + m(5) * y + m(9) * z + m(13);
  const clipW = m(3) * x + m(7) * y + m(11) * z + m(15);
  if (!(clipW > 0)) {
    return undefined;
  }
  return {
    x: ((clipX / clipW + 1) / 2) * frame.width,
    y: ((1 - clipY / clipW) / 2) * frame.height,
  };
}
