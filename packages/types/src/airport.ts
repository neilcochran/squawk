/**
 * Type of aviation facility as classified by the FAA.
 */
export type FacilityType =
  | 'AIRPORT'
  | 'HELIPORT'
  | 'SEAPLANE_BASE'
  | 'GLIDERPORT'
  | 'ULTRALIGHT'
  | 'BALLOONPORT';

/**
 * Maps FAA SITE_TYPE_CODE values to FacilityType.
 */
export const FACILITY_TYPE_MAP: Record<string, FacilityType> = {
  A: 'AIRPORT',
  H: 'HELIPORT',
  C: 'SEAPLANE_BASE',
  G: 'GLIDERPORT',
  U: 'ULTRALIGHT',
  B: 'BALLOONPORT',
};

/**
 * Facility ownership classification.
 */
export type OwnershipType = 'PUBLIC' | 'PRIVATE';

/**
 * Facility use classification indicating who may use the facility.
 */
export type FacilityUseType = 'PUBLIC' | 'PRIVATE';

/**
 * Operational status of a facility.
 */
export type FacilityStatus = 'OPEN' | 'CLOSED_INDEFINITELY' | 'CLOSED_PERMANENTLY';

/**
 * Runway surface condition rating.
 */
export type SurfaceCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'FAILED';

/**
 * Runway surface treatment type.
 */
export type SurfaceTreatment = 'GROOVED' | 'PFC' | 'GROOVED_PFC';

/**
 * Runway edge lighting intensity classification.
 */
export type RunwayLighting = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONSTANDARD' | 'NONE';

/**
 * Type of visual glide slope indicator installed at a runway end.
 */
export type VgsiType =
  | 'VASI-2L'
  | 'VASI-4L'
  | 'VASI-2R'
  | 'VASI-6L'
  | 'VASI-12'
  | 'VASI-16'
  | 'PAPI-2L'
  | 'PAPI-4L'
  | 'PAPI-2R'
  | 'PAPI-4R'
  | 'PVASI'
  | 'SAVASI'
  | 'TRICOLOR'
  | 'PANELS';

/**
 * Type of runway marking applied.
 */
export type RunwayMarkingType = 'PIR' | 'NPI' | 'BSC' | 'BUOY' | 'STOL' | 'NONE';

/**
 * Condition of runway markings.
 */
export type RunwayMarkingCondition = 'GOOD' | 'FAIR' | 'POOR';

/**
 * One end of a runway, identified by its designator (e.g. "04L", "22R").
 * Contains approach, lighting, and declared distance information for this end.
 */
export interface RunwayEnd {
  /** Runway end designator (e.g. "04L", "22R", "09"). */
  id: string;
  /** True heading in degrees. */
  trueHeading?: number;
  /** Type of ILS or instrument approach installed (e.g. "ILS/DME", "ILS", "RNAV"). */
  ilsType?: string;
  /** Whether right-hand traffic pattern is in effect for this end. */
  rightTraffic?: boolean;
  /** Type of runway markings. */
  markingType?: RunwayMarkingType;
  /** Condition of runway markings. */
  markingCondition?: RunwayMarkingCondition;
  /** Latitude of the runway end in decimal degrees. */
  lat?: number;
  /** Longitude of the runway end in decimal degrees. */
  lon?: number;
  /** Runway end elevation in feet MSL. */
  elevationFt?: number;
  /** Threshold crossing height in feet AGL. */
  thresholdCrossingHeightFt?: number;
  /** Visual glide path angle in degrees. */
  glidepathAngle?: number;
  /** Displaced threshold distance in feet from the runway end. */
  displacedThresholdFt?: number;
  /** Displaced threshold elevation in feet MSL. */
  displacedThresholdElevFt?: number;
  /** Touchdown zone elevation in feet MSL. */
  tdzElevationFt?: number;
  /** Type of visual glide slope indicator. */
  vgsiType?: VgsiType;
  /** Whether runway visual range equipment is installed. */
  hasRvr?: boolean;
  /** Approach lighting system code. */
  approachLights?: string;
  /** Whether runway end identifier lights are available. */
  hasReil?: boolean;
  /** Whether centerline lights are available. */
  hasCenterlineLights?: boolean;
  /** Whether touchdown zone lights are available. */
  hasTdzLights?: boolean;
  /** Takeoff Run Available in feet. */
  toraFt?: number;
  /** Takeoff Distance Available in feet. */
  todaFt?: number;
  /** Accelerate-Stop Distance Available in feet. */
  asdaFt?: number;
  /** Landing Distance Available in feet. */
  ldaFt?: number;
  /** Land And Hold Short Operations available landing distance in feet. */
  lahsoDistanceFt?: number;
  /** Intersecting runway or entity for LAHSO operations. */
  lahsoEntity?: string;
}

/**
 * A runway at an airport facility, identified by its composite designator
 * (e.g. "04L/22R"). Contains physical dimensions, surface info, and
 * per-end details.
 */
export interface Runway {
  /** Runway designator (e.g. "04L/22R", "09/27", "H1"). */
  id: string;
  /** Runway length in feet. */
  lengthFt?: number;
  /** Runway width in feet. */
  widthFt?: number;
  /** Surface type code (e.g. "CONC", "ASPH", "TURF", "GRVL"). */
  surfaceType?: string;
  /** Surface condition rating. */
  condition?: SurfaceCondition;
  /** Surface treatment applied. */
  treatment?: SurfaceTreatment;
  /** Pavement Classification Number value. */
  pcn?: string;
  /** Edge lighting intensity. */
  lighting?: RunwayLighting;
  /** Maximum single-wheel gross weight in thousands of pounds. */
  weightLimitSingleWheelKlb?: number;
  /** Maximum dual-wheel gross weight in thousands of pounds. */
  weightLimitDualWheelKlb?: number;
  /** Maximum dual-tandem-wheel gross weight in thousands of pounds. */
  weightLimitDualTandemKlb?: number;
  /** Maximum double-dual-tandem-wheel gross weight in thousands of pounds. */
  weightLimitDdtKlb?: number;
  /** Details for each end of the runway (typically two). */
  ends: RunwayEnd[];
}

/**
 * A communication frequency associated with an airport facility.
 */
export interface AirportFrequency {
  /** Frequency in MHz (e.g. 119.1, 121.9). */
  frequencyMhz: number;
  /** Purpose or usage of this frequency (e.g. "LCL/P", "GND/P", "ATIS", "UNICOM", "CLASS B"). */
  use: string;
  /** Sectorization or applicability description (e.g. "RWY 04L/22R", "FREQS 2000 FT & BLW"). */
  sectorization?: string;
}

/**
 * Airport (or other aviation facility) reference data with identifiers,
 * location, physical characteristics, services, runways, and frequencies.
 */
export interface Airport {
  /** FAA location identifier (e.g. "JFK", "LAX", "3N6"). */
  faaId: string;
  /** ICAO airport code when assigned (e.g. "KJFK"). */
  icao?: string;
  /** Official facility name. */
  name: string;
  /** Type of aviation facility. */
  facilityType: FacilityType;
  /** Facility ownership classification. */
  ownershipType: OwnershipType;
  /** Facility use classification. */
  useType: FacilityUseType;
  /** Operational status. */
  status: FacilityStatus;
  /** City where the facility is located. */
  city: string;
  /** Two-letter state code (e.g. "NY", "CA"). */
  state: string;
  /** Two-letter country code (e.g. "US"). */
  country: string;
  /** County name. */
  county?: string;
  /** Latitude in decimal degrees. */
  lat: number;
  /** Longitude in decimal degrees. */
  lon: number;
  /** Field elevation in feet MSL. */
  elevationFt?: number;
  /** Magnetic variation in degrees. */
  magneticVariation?: number;
  /** Magnetic variation direction ("E" or "W"). */
  magneticVariationDirection?: string;
  /** Year the magnetic variation was last determined. */
  magneticVariationYear?: number;
  /** Traffic pattern altitude in feet MSL. */
  trafficPatternAltitudeFt?: number;
  /** Sectional chart name (e.g. "NEW YORK", "LOS ANGELES"). */
  sectionChart?: string;
  /** Responsible ARTCC identifier (e.g. "ZNY", "ZLA"). */
  artccId?: string;
  /** Type of control tower (e.g. "ATCT", "NON-ATCT", "TRSA"). */
  towerType?: string;
  /** Available fuel types (e.g. "100LL,A"). */
  fuelTypes?: string;
  /** Airframe repair service level (e.g. "MAJOR", "MINOR", "NONE"). */
  airframeRepair?: string;
  /** Powerplant repair service level (e.g. "MAJOR", "MINOR", "NONE"). */
  powerplantRepair?: string;
  /** Available oxygen types - bottled (e.g. "HIGH", "LOW", "NONE"). */
  bottledOxygen?: string;
  /** Available oxygen types - bulk (e.g. "HIGH", "LOW", "NONE"). */
  bulkOxygen?: string;
  /** Lighting schedule description. */
  lightingSchedule?: string;
  /** Airport beacon lens color (e.g. "WG" for white-green, "WY" for white-yellow). */
  beaconColor?: string;
  /** Whether landing fees are charged. */
  hasLandingFee?: boolean;
  /** Activation or opening date (e.g. "1939/01"). */
  activationDate?: string;
  /** Other available services (e.g. "AFRT,CARGO"). */
  otherServices?: string;
  /** NOTAM facility identifier. */
  notamId?: string;
  /** Runways at this facility. */
  runways: Runway[];
  /** Communication frequencies for this facility. */
  frequencies: AirportFrequency[];
}
