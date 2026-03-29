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
  /** True when the floor is at surface/ground level (SFC) rather than a defined MSL altitude. */
  isSurfaceFloor: boolean;
  /** Upper vertical bound in feet MSL. */
  ceilingFt: number;
  /** Lateral boundary as a GeoJSON polygon. */
  boundary: Polygon;
}
