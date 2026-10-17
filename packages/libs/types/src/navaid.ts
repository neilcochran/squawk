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
 * The full set of {@link NavaidType} values, in declaration order.
 *
 * Use as the single source of truth for value-side iteration (e.g. building a
 * lookup table keyed by navaid type) or with {@link isNavaidType} to narrow
 * an external string into the union. The `as const satisfies` brand keeps
 * this array in sync with the type at compile time.
 */
export const NAVAID_TYPES = [
  'VOR',
  'VORTAC',
  'VOR/DME',
  'TACAN',
  'DME',
  'NDB',
  'NDB/DME',
  'FAN_MARKER',
  'MARINE_NDB',
  'VOT',
] as const satisfies readonly NavaidType[];

const NAVAID_TYPE_SET: ReadonlySet<string> = new Set(NAVAID_TYPES);

/**
 * Type guard that narrows a string to {@link NavaidType} when it matches a
 * member of {@link NAVAID_TYPES}.
 *
 * Useful when consuming external strings (URL params, config files, MCP tool
 * inputs) that should be validated before being used as a navaid type.
 *
 * @param value - The string to test.
 * @returns `true` if `value` is a valid `NavaidType`.
 */
export function isNavaidType(value: string): value is NavaidType {
  return NAVAID_TYPE_SET.has(value);
}

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
  'OPERATIONAL_IFR' | 'OPERATIONAL_RESTRICTED' | 'OPERATIONAL_VFR' | 'SHUTDOWN';

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
 * Where a VOR receiver checkpoint is used: on the airport surface or in
 * flight.
 */
export type NavaidCheckpointType = 'GROUND' | 'AIRBORNE';

/**
 * Maps FAA AIR_GND_CODE values from NASR data to NavaidCheckpointType. The
 * FAA's `G1` code marks a further ground checkpoint at an airport that
 * already has one.
 */
export const NAVAID_CHECKPOINT_TYPE_MAP: Record<string, NavaidCheckpointType> = {
  A: 'AIRBORNE',
  G: 'GROUND',
  G1: 'GROUND',
};

/**
 * A VOR receiver checkpoint: a published spot where a pilot tunes the navaid
 * and confirms the receiver indicates the published radial, the periodic
 * equipment check that IFR flight by VOR requires.
 */
export interface NavaidCheckpoint {
  /** Whether the checkpoint is on the airport surface or flown over. */
  type: NavaidCheckpointType;
  /**
   * Magnetic bearing in degrees from the navaid to the checkpoint: the radial
   * the receiver should indicate there.
   */
  magneticBearingDeg: number;
  /** Altitude in feet MSL at which an airborne checkpoint is flown. */
  altitudeFt?: number;
  /** FAA identifier of the airport the checkpoint is at (e.g. "ACK"). */
  airportId?: string;
  /**
   * Where the checkpoint is, as the FAA describes it, usually leading with
   * its distance from the navaid (e.g. "1.9 NM ON RUNUP AREA AT APCH END RWY
   * 24.").
   */
  description: string;
}

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
  /**
   * Operational status of the distance-measuring component, where the FAA
   * publishes one separately: on DME, VOR/DME and NDB/DME facilities. It can
   * differ from `status`; a VOR/DME whose VOR has restricted radials often
   * has an unrestricted DME, and the reverse.
   */
  dmeStatus?: NavaidStatus;
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
  /** Two-letter state code (e.g. "NY", "CA"). Absent for non-US navaids. */
  state?: string;
  /** Two-letter country code (e.g. "US"). */
  country: string;
  /** Associated city name. Present on every bundled record. */
  city?: string;
  /** Field elevation in feet MSL. */
  elevationFt?: number;
  /**
   * VOR, VORTAC, VOR/DME, TACAN, DME and VOT frequency in MHz. These use the
   * VOR band, 108.0 to 117.95, with one exception: a TACAN is tuned by
   * channel and publishes the VHF frequency paired with it, and the channels
   * with no VOR-band pairing (1 to 16 and 60 to 69) pair with 133.3 to
   * 135.95.
   */
  frequencyMhz?: number;
  /** NDB/NDB-DME/MARINE NDB frequency in kHz (190-535). */
  frequencyKhz?: number;
  /** TACAN/DME channel designation (e.g. "84X", "77X"). */
  tacanChannel?: string;
  /**
   * Magnetic variation in degrees (absolute value). For a VOR, VORTAC,
   * VOR/DME or TACAN this is the variation the station is aligned to, which
   * defines its radials; it is not necessarily the present-day variation at
   * the station. A DME, VOT or fan marker has none.
   */
  magneticVariationDeg?: number;
  /** Magnetic variation direction ("E" or "W"). */
  magneticVariationDirection?: string;
  /**
   * Epoch year of the magnetic variation, carried as published. Many
   * stations keep an alignment decades old, and a few carry a future year.
   */
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
  /**
   * Whether simultaneous voice transmission is available on the frequency.
   * Absent where the source does not say.
   */
  simultaneousVoice?: boolean;
  /** NDB classification code (e.g. "HH", "H", "MH", "MHW", "HW", "LOM", "LMM"). */
  ndbClass?: string;
  /**
   * Whether the navaid is available for public use: false for a private or
   * military facility. Present on every bundled record.
   */
  publicUse?: boolean;
  /** Scheduled operating hours (e.g. "24", "SS-SR"). */
  operatingHours?: string;
  /** NOTAM facility identifier. */
  notamId?: string;
  /**
   * Identification a fan marker transmits, published as its keying in words
   * (e.g. "DOT DASH DOT", "CONT DASHES") or as a letter. It is not a
   * facility identifier. Fan markers, and an NDB with a marker, only.
   */
  markerIdentifier?: string;
  /**
   * Shape of the fan marker's radiation pattern. The FAA defines bone and
   * elliptical patterns; every bundled marker is "E", elliptical.
   */
  markerShape?: string;
  /** True bearing in degrees of the major axis of the fan marker's pattern. */
  markerBearingDeg?: number;
  /** DME/TACAN latitude in decimal degrees, if different from the navaid position. */
  dmeLat?: number;
  /** DME/TACAN longitude in decimal degrees, if different from the navaid position. */
  dmeLon?: number;
  /**
   * FAA remarks about the navaid, one per published remark. Most state where
   * its signal is unusable, by radial, distance and altitude (e.g. "VOR
   * UNUSBL 163-236 BYD 40 NM BLW 18000 FT"); others cover operating hours,
   * monitoring and channel pairing. A stand-alone DME's radials are written
   * against true north and marked with a T (e.g. "DME UNUSBL 080T-125T BLW
   * 10000 FT"). Notes on how the position or elevation was surveyed are not
   * carried.
   */
  remarks?: string[];
  /** VOR receiver checkpoints that use this navaid. */
  checkpoints?: NavaidCheckpoint[];
}
