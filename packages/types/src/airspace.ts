import type { Polygon } from 'geojson';

/**
 * Airspace sector metadata used by ARTCC resolver logic.
 */
export interface ArtccSector {
  /** Human-readable Center name (e.g. "Washington ARTCC"). */
  centerName: string;
  /** FAA facility identifier (e.g. "ZDC"). */
  facilityId: string;
  /** Sector ID code inside the Center. */
  sectorId: string;
  /** Lower vertical bound in feet MSL. */
  floorFt: number;
  /** True when floor is at surface/ground.
   * This often influences handling for ground-bound objects and airspace edges.
   */
  isSurfaceFloor: boolean;
  /** Upper vertical bound in feet MSL. */
  ceilingFt: number;
  /** Lateral boundary as a GeoJSON polygon. */
  boundary: Polygon;
}
