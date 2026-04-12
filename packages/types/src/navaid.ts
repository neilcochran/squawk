/**
 * Type of navigational aid as classified by the FAA.
 */
export type NavaidType =
  | 'VOR'
  | 'VORTAC'
  | 'VOR/DME'
  | 'TACAN'
  | 'DME'
  | 'NDB'
  | 'NDB/DME'
  | 'FAN_MARKER'
  | 'MARINE_NDB'
  | 'VOT';

/**
 * Maps FAA NAV_TYPE values from NASR data to NavaidType.
 */
export const NAVAID_TYPE_MAP: Record<string, NavaidType> = {
  VOR: 'VOR',
  VORTAC: 'VORTAC',
  'VOR/DME': 'VOR/DME',
  TACAN: 'TACAN',
  DME: 'DME',
  NDB: 'NDB',
  'NDB/DME': 'NDB/DME',
  'FAN MARKER': 'FAN_MARKER',
  'MARINE NDB': 'MARINE_NDB',
  VOT: 'VOT',
};

/**
 * Operational status of a navaid facility.
 */
export type NavaidStatus =
  | 'OPERATIONAL_IFR'
  | 'OPERATIONAL_RESTRICTED'
  | 'OPERATIONAL_VFR'
  | 'SHUTDOWN';

/**
 * Maps FAA NAV_STATUS values from NASR data to NavaidStatus.
 */
export const NAVAID_STATUS_MAP: Record<string, NavaidStatus> = {
  'OPERATIONAL IFR': 'OPERATIONAL_IFR',
  'OPERATIONAL RESTRICTED': 'OPERATIONAL_RESTRICTED',
  'OPERATIONAL VFR ONLY': 'OPERATIONAL_VFR',
  SHUTDOWN: 'SHUTDOWN',
};

/**
 * A navigational aid (navaid) facility such as a VOR, VORTAC, NDB, or TACAN.
 * Provides radio-based position and course guidance for aircraft navigation.
 */
export interface Navaid {
  /** Navaid identifier (e.g. "BOS", "JFK", "ABR"). */
  identifier: string;
  /** Official facility name (e.g. "BOSTON", "KENNEDY", "ABERDEEN"). */
  name: string;
  /** Type of navigational aid. */
  type: NavaidType;
  /** Operational status of the navaid. */
  status: NavaidStatus;
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
  /** Two-letter state code (e.g. "NY", "CA"). */
  state: string;
  /** Two-letter country code (e.g. "US"). */
  country: string;
  /** Associated city name. */
  city?: string;
  /** Field elevation in feet MSL. */
  elevationFt?: number;
  /** VOR/VORTAC/VOR-DME/TACAN/DME/VOT frequency in MHz (108.0-117.95). */
  frequencyMhz?: number;
  /** NDB/NDB-DME/MARINE NDB frequency in kHz (190-535). */
  frequencyKhz?: number;
  /** TACAN/DME channel designation (e.g. "84X", "77X"). */
  tacanChannel?: string;
  /** Magnetic variation in degrees (absolute value). */
  magneticVariationDeg?: number;
  /** Magnetic variation direction ("E" or "W"). */
  magneticVariationDirection?: string;
  /** Year the magnetic variation was last determined. */
  magneticVariationYear?: number;
  /** Low-altitude ARTCC identifier (e.g. "ZNY", "ZBW"). */
  lowArtccId?: string;
  /** High-altitude ARTCC identifier (e.g. "ZNY", "ZBW"). */
  highArtccId?: string;
  /** Navaid service volume class code (e.g. "VL", "VH", "H", "L", "T"). */
  navaidClass?: string;
  /** DME service volume class code (e.g. "DH", "DL"). */
  dmeServiceVolume?: string;
  /** Transmitter power output in watts. */
  powerOutputWatts?: number;
  /** Whether simultaneous voice transmission is available on the frequency. */
  simultaneousVoice?: boolean;
  /** NDB classification code (e.g. "HH", "H", "MH", "MHW", "HW", "LOM", "LMM"). */
  ndbClass?: string;
  /** Whether the navaid is available for public use. */
  publicUse?: boolean;
  /** Scheduled operating hours (e.g. "24", "SS-SR"). */
  operatingHours?: string;
  /** NOTAM facility identifier. */
  notamId?: string;
  /** Fan marker identifier (for FAN_MARKER type only). */
  markerIdentifier?: string;
  /** Fan marker shape (for FAN_MARKER type only). */
  markerShape?: string;
  /** Fan marker bearing in degrees (for FAN_MARKER type only). */
  markerBearingDeg?: number;
  /** DME/TACAN latitude in decimal degrees, if different from the navaid position. */
  dmeLat?: number;
  /** DME/TACAN longitude in decimal degrees, if different from the navaid position. */
  dmeLon?: number;
}
