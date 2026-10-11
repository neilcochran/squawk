/**
 * Pole of inaccessibility: the interior point of a polygon that is
 * farthest from its boundary. Implements the quadtree search described
 * by Garcia-Castellanos and Lombardo (2007) as popularized by the
 * `polylabel` algorithm: the bounding box is tiled with square cells,
 * each cell's signed distance to the polygon edge is an exact lower
 * bound and `distance + h * sqrt(2)` an upper bound on any point inside
 * it, and cells whose upper bound cannot beat the best point found so
 * far are pruned without subdivision.
 */

import type { Polygon, Position } from 'geojson';

/** Options for {@link poleOfInaccessibility}. */
export interface PoleOfInaccessibilityOptions {
  /**
   * Search tolerance in the polygon's coordinate units. The returned
   * point's distance to the boundary is within this much of the true
   * maximum. Defaults to 1% of the shorter side of the outer ring's
   * bounding box, which is tight enough for a label anchor and keeps the
   * cell count bounded for polygons of any size. Must be a positive
   * finite number.
   */
  precision?: number;
}

/** A position known to carry both coordinates. */
type XY = readonly [number, number];

/**
 * One square search cell: its center, half-size, signed distance from
 * the center to the polygon boundary (positive inside), and the upper
 * bound on the distance of any point within the cell.
 */
interface Cell {
  /** Center x in polygon coordinate units. */
  readonly x: number;
  /** Center y in polygon coordinate units. */
  readonly y: number;
  /** Half the cell's side length. */
  readonly h: number;
  /** Signed distance from the center to the nearest polygon edge. */
  readonly d: number;
  /** Largest distance any point inside the cell could have. */
  readonly max: number;
}

/**
 * Finds the pole of inaccessibility of a polygon - the point inside it
 * that is farthest from every edge - which is the most visually
 * "interior" spot to anchor a label. Unlike {@link polygonCentroid},
 * the result always lies inside the polygon, including for crescents,
 * sectors, and rings with holes whose centroid falls outside the shape.
 *
 * Distances are measured in the polygon's own coordinate units with no
 * projection, so for `[lon, lat]` input the search is slightly
 * anisotropic away from the equator; that bias is well inside the
 * tolerance that matters for placing a label.
 *
 * Positions missing a coordinate are dropped from their ring before the
 * search. Returns `undefined` when the polygon has no usable outer ring
 * or its bounding box has zero width or height, mirroring
 * {@link polygonCentroid}.
 *
 * ```typescript
 * import { polygonGeoJson } from '@squawk/geo';
 *
 * const anchor = polygonGeoJson.poleOfInaccessibility(feature.geometry);
 * ```
 *
 * @param polygon - GeoJSON Polygon. The first ring is the outer
 *   boundary; any further rings are holes.
 * @param options - Search tolerance; see
 *   {@link PoleOfInaccessibilityOptions}.
 * @returns The `[x, y]` pole, or `undefined` for a degenerate polygon.
 */
export function poleOfInaccessibility(
  polygon: Polygon,
  options?: PoleOfInaccessibilityOptions,
): [number, number] | undefined {
  const rings = polygon.coordinates.map(usablePositions);
  const outer = rings[0];
  if (outer === undefined || outer.length === 0) {
    return undefined;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of outer) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);
  if (!Number.isFinite(cellSize) || cellSize === 0) {
    return undefined;
  }
  const precision = options?.precision ?? cellSize / 100;
  if (!Number.isFinite(precision) || precision <= 0) {
    throw new RangeError(`precision must be a positive finite number, got ${precision}`);
  }
  const heap = createCellHeap();
  const half = cellSize / 2;
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      heap.push(makeCell(x + half, y + half, half, rings));
    }
  }
  // Seed the best guess with the area-weighted centroid and the bounding
  // box center so a convex polygon converges in a handful of iterations.
  let best = centroidCell(outer, rings);
  const boxCenter = makeCell(minX + width / 2, minY + height / 2, 0, rings);
  if (boxCenter.d > best.d) {
    best = boxCenter;
  }
  for (let cell = heap.pop(); cell !== undefined; cell = heap.pop()) {
    if (cell.d > best.d) {
      best = cell;
    }
    // Cells pop in descending order of their upper bound, so once the
    // top cell cannot improve on the best point by more than the
    // tolerance, neither can anything still queued.
    if (cell.max - best.d <= precision) {
      break;
    }
    const quarter = cell.h / 2;
    heap.push(makeCell(cell.x - quarter, cell.y - quarter, quarter, rings));
    heap.push(makeCell(cell.x + quarter, cell.y - quarter, quarter, rings));
    heap.push(makeCell(cell.x - quarter, cell.y + quarter, quarter, rings));
    heap.push(makeCell(cell.x + quarter, cell.y + quarter, quarter, rings));
  }
  return [best.x, best.y];
}

/** The ring's positions that carry both coordinates, in order. */
function usablePositions(ring: readonly Position[]): XY[] {
  const usable: XY[] = [];
  for (const position of ring) {
    const x = position[0];
    const y = position[1];
    if (x !== undefined && y !== undefined) {
      usable.push([x, y]);
    }
  }
  return usable;
}

/** Builds a {@link Cell} centered at `(x, y)` with half-size `h`. */
function makeCell(x: number, y: number, h: number, rings: readonly (readonly XY[])[]): Cell {
  const d = signedDistanceToPolygon(x, y, rings);
  return { x, y, h, d, max: d + h * Math.SQRT2 };
}

/**
 * Zero-size cell at the area-weighted centroid of the outer ring, or at
 * the ring's first vertex when the ring has no area.
 */
function centroidCell(outer: readonly XY[], rings: readonly (readonly XY[])[]): Cell {
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const a = outer[i];
    const b = outer[j];
    if (a === undefined || b === undefined) {
      continue;
    }
    const f = a[0] * b[1] - b[0] * a[1];
    x += (a[0] + b[0]) * f;
    y += (a[1] + b[1]) * f;
    area += f * 3;
  }
  if (area === 0) {
    const first = outer[0];
    return makeCell(first?.[0] ?? 0, first?.[1] ?? 0, 0, rings);
  }
  return makeCell(x / area, y / area, 0, rings);
}

/**
 * Signed distance from a point to the polygon boundary: positive inside
 * the polygon (outside every hole), negative outside. Ray casting over
 * every ring decides the sign; the magnitude is the distance to the
 * nearest edge of any ring.
 */
function signedDistanceToPolygon(x: number, y: number, rings: readonly (readonly XY[])[]): number {
  let inside = false;
  let minDistanceSquared = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if (a === undefined || b === undefined) {
        continue;
      }
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) {
        inside = !inside;
      }
      minDistanceSquared = Math.min(minDistanceSquared, segmentDistanceSquared(x, y, a, b));
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(minDistanceSquared);
}

/** Squared distance from point `(px, py)` to the segment `a - b`. */
function segmentDistanceSquared(px: number, py: number, a: XY, b: XY): number {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - a[0];
  let dy = b[1] - a[1];
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = px - x;
  dy = py - y;
  return dx * dx + dy * dy;
}

/** Binary max-heap of {@link Cell}s ordered by their upper bound. */
interface CellHeap {
  /** Adds a cell. */
  push(cell: Cell): void;
  /** Removes and returns the cell with the largest upper bound, or `undefined` when empty. */
  pop(): Cell | undefined;
}

/** Creates an empty {@link CellHeap}. */
function createCellHeap(): CellHeap {
  const cells: Cell[] = [];
  function swap(i: number, j: number): void {
    const a = cells[i];
    const b = cells[j];
    if (a !== undefined && b !== undefined) {
      cells[i] = b;
      cells[j] = a;
    }
  }
  return {
    push(cell: Cell): void {
      cells.push(cell);
      let index = cells.length - 1;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        const parentCell = cells[parent];
        if (parentCell === undefined || parentCell.max >= cell.max) {
          break;
        }
        swap(index, parent);
        index = parent;
      }
    },
    pop(): Cell | undefined {
      const top = cells[0];
      const last = cells.pop();
      if (top === undefined || last === undefined) {
        return undefined;
      }
      if (cells.length === 0) {
        return top;
      }
      cells[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let largest = index;
        const leftCell = cells[left];
        const largestCell = cells[largest];
        if (leftCell !== undefined && largestCell !== undefined && leftCell.max > largestCell.max) {
          largest = left;
        }
        const rightCell = cells[right];
        const largestAfterLeft = cells[largest];
        if (
          rightCell !== undefined &&
          largestAfterLeft !== undefined &&
          rightCell.max > largestAfterLeft.max
        ) {
          largest = right;
        }
        if (largest === index) {
          break;
        }
        swap(index, largest);
        index = largest;
      }
      return top;
    },
  };
}
