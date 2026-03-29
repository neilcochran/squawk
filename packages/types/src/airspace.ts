import type { Polygon } from 'geojson';

export interface ArtccSector {
  centerName: string;
  facilityId: string;
  sectorId: string;
  floorFt: number;
  isSurfaceFloor: boolean;
  ceilingFt: number;
  boundary: Polygon;
}
