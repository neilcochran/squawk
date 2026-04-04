import type {
  Airport,
  AirportFrequency,
  FacilityStatus,
  FacilityType,
  FacilityUseType,
  IlsCategory,
  IlsSystem,
  IlsSystemType,
  OwnershipType,
  Runway,
  RunwayEnd,
  RunwayLighting,
  RunwayMarkingCondition,
  RunwayMarkingType,
  SurfaceCondition,
  SurfaceTreatment,
  VgsiType,
} from '@squawk/types';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Compact representation of an IlsSystem in the bundled JSON format.
 */
interface CompactIls {
  /** System type. */
  st: IlsSystemType;
  /** Identifier. */
  id?: string;
  /** Category. */
  cat?: IlsCategory;
  /** Localizer frequency MHz. */
  lf?: number;
  /** Localizer course degrees. */
  lc?: number;
  /** Glide slope angle degrees. */
  ga?: number;
  /** Glide slope type. */
  gt?: string;
  /** DME channel. */
  dc?: string;
}

/**
 * Compact representation of a RunwayEnd in the bundled JSON format.
 */
interface CompactRunwayEnd {
  /** Runway end designator. */
  id: string;
  /** True heading. */
  hdg?: number;
  /** ILS system. */
  ils?: CompactIls;
  /** Right-hand traffic. */
  rht?: true;
  /** Marking type. */
  mt?: RunwayMarkingType;
  /** Marking condition. */
  mc?: RunwayMarkingCondition;
  /** Latitude. */
  lat?: number;
  /** Longitude. */
  lon?: number;
  /** Elevation. */
  el?: number;
  /** Threshold crossing height. */
  tch?: number;
  /** Glidepath angle. */
  gpa?: number;
  /** Displaced threshold distance. */
  dt?: number;
  /** Displaced threshold elevation. */
  dte?: number;
  /** Touchdown zone elevation. */
  tdz?: number;
  /** VGSI type. */
  vg?: VgsiType;
  /** Has RVR. */
  rvr?: true;
  /** Approach lights. */
  al?: string;
  /** Has REIL. */
  reil?: true;
  /** Has centerline lights. */
  cl?: true;
  /** Has TDZ lights. */
  tl?: true;
  /** TORA. */
  tora?: number;
  /** TODA. */
  toda?: number;
  /** ASDA. */
  asda?: number;
  /** LDA. */
  lda?: number;
  /** LAHSO distance. */
  lahso?: number;
  /** LAHSO entity. */
  lahsoE?: string;
}

/**
 * Compact representation of a Runway in the bundled JSON format.
 */
interface CompactRunway {
  /** Runway designator. */
  id: string;
  /** Length in feet. */
  len?: number;
  /** Width in feet. */
  w?: number;
  /** Surface type. */
  sfc?: string;
  /** Condition. */
  cond?: SurfaceCondition;
  /** Treatment. */
  trt?: SurfaceTreatment;
  /** PCN. */
  pcn?: string;
  /** Lighting. */
  lgt?: RunwayLighting;
  /** Single-wheel weight limit. */
  wsw?: number;
  /** Dual-wheel weight limit. */
  wdw?: number;
  /** Dual-tandem weight limit. */
  wdt?: number;
  /** Double-dual-tandem weight limit. */
  wdd?: number;
  /** Runway ends. */
  ends: CompactRunwayEnd[];
}

/**
 * Compact representation of a frequency in the bundled JSON format.
 */
interface CompactFrequency {
  /** Frequency in MHz. */
  f: number;
  /** Frequency use. */
  u: string;
  /** Sectorization. */
  s?: string;
}

/**
 * Compact representation of an Airport in the bundled JSON format.
 */
interface CompactAirport {
  /** FAA identifier. */
  id: string;
  /** ICAO code. */
  icao?: string;
  /** Facility name. */
  nm: string;
  /** Facility type. */
  ft: FacilityType;
  /** Ownership type. */
  own: OwnershipType;
  /** Use type. */
  use: FacilityUseType;
  /** Status. */
  st: FacilityStatus;
  /** City. */
  city: string;
  /** State code. */
  state: string;
  /** Country code. */
  ctry: string;
  /** County. */
  county?: string;
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lon: number;
  /** Elevation. */
  elev?: number;
  /** Magnetic variation. */
  mv?: number;
  /** Magnetic variation direction. */
  mvd?: string;
  /** Magnetic variation year. */
  mvy?: number;
  /** Traffic pattern altitude. */
  tpa?: number;
  /** Chart name. */
  chart?: string;
  /** ARTCC identifier. */
  artcc?: string;
  /** Tower type. */
  twr?: string;
  /** Fuel types. */
  fuel?: string;
  /** Airframe repair. */
  afr?: string;
  /** Powerplant repair. */
  ppr?: string;
  /** Bottled oxygen. */
  boxo?: string;
  /** Bulk oxygen. */
  bxo?: string;
  /** Lighting schedule. */
  ls?: string;
  /** Beacon color. */
  bcn?: string;
  /** Landing fee. */
  fee?: true;
  /** Activation date. */
  act?: string;
  /** Other services. */
  svc?: string;
  /** NOTAM identifier. */
  notam?: string;
  /** Runways. */
  rwys?: CompactRunway[];
  /** Frequencies. */
  freqs?: CompactFrequency[];
}

/**
 * Shape of the bundled JSON data file.
 */
interface BundledData {
  /** Dataset metadata. */
  meta: {
    /** ISO 8601 timestamp of when the dataset was generated. */
    generatedAt: string;
    /** NASR cycle effective date. */
    nasrCycleDate: string;
    /** Total number of airport records. */
    recordCount: number;
  };
  /** Airport records. */
  records: CompactAirport[];
}

/**
 * Metadata properties attached to the airport dataset describing
 * the FAA NASR data vintage and build provenance.
 */
export interface AirportDatasetProperties {
  /** ISO 8601 timestamp of when the dataset was generated. */
  generatedAt: string;
  /** NASR cycle effective date (e.g. "2026-01-22"). */
  nasrCycleDate: string;
  /** Total number of airport records in the dataset. */
  recordCount: number;
}

/**
 * A pre-processed array of Airport records with attached metadata
 * about the build provenance and NASR cycle.
 */
export interface AirportDataset {
  /** Metadata about the dataset build. */
  properties: AirportDatasetProperties;
  /** Airport records. */
  records: Airport[];
}

/**
 * Expands a compact ILS into a full IlsSystem.
 */
function expandIls(c: CompactIls): IlsSystem {
  const ils: IlsSystem = { systemType: c.st };
  if (c.id !== undefined) {
    ils.identifier = c.id;
  }
  if (c.cat !== undefined) {
    ils.category = c.cat;
  }
  if (c.lf !== undefined) {
    ils.localizerFrequencyMhz = c.lf;
  }
  if (c.lc !== undefined) {
    ils.localizerCourseDeg = c.lc;
  }
  if (c.ga !== undefined) {
    ils.glideSlopeAngleDeg = c.ga;
  }
  if (c.gt !== undefined) {
    ils.glideSlopeType = c.gt;
  }
  if (c.dc !== undefined) {
    ils.dmeChannel = c.dc;
  }
  return ils;
}

/**
 * Expands a compact runway end into a full RunwayEnd.
 */
function expandRunwayEnd(c: CompactRunwayEnd): RunwayEnd {
  const end: RunwayEnd = { id: c.id };
  if (c.hdg !== undefined) {
    end.trueHeading = c.hdg;
  }
  if (c.ils !== undefined) {
    end.ils = expandIls(c.ils);
  }
  if (c.rht) {
    end.rightTraffic = true;
  }
  if (c.mt !== undefined) {
    end.markingType = c.mt;
  }
  if (c.mc !== undefined) {
    end.markingCondition = c.mc;
  }
  if (c.lat !== undefined) {
    end.lat = c.lat;
  }
  if (c.lon !== undefined) {
    end.lon = c.lon;
  }
  if (c.el !== undefined) {
    end.elevationFt = c.el;
  }
  if (c.tch !== undefined) {
    end.thresholdCrossingHeightFt = c.tch;
  }
  if (c.gpa !== undefined) {
    end.glidepathAngle = c.gpa;
  }
  if (c.dt !== undefined) {
    end.displacedThresholdFt = c.dt;
  }
  if (c.dte !== undefined) {
    end.displacedThresholdElevFt = c.dte;
  }
  if (c.tdz !== undefined) {
    end.tdzElevationFt = c.tdz;
  }
  if (c.vg !== undefined) {
    end.vgsiType = c.vg;
  }
  if (c.rvr) {
    end.hasRvr = true;
  }
  if (c.al !== undefined) {
    end.approachLights = c.al;
  }
  if (c.reil) {
    end.hasReil = true;
  }
  if (c.cl) {
    end.hasCenterlineLights = true;
  }
  if (c.tl) {
    end.hasTdzLights = true;
  }
  if (c.tora !== undefined) {
    end.toraFt = c.tora;
  }
  if (c.toda !== undefined) {
    end.todaFt = c.toda;
  }
  if (c.asda !== undefined) {
    end.asdaFt = c.asda;
  }
  if (c.lda !== undefined) {
    end.ldaFt = c.lda;
  }
  if (c.lahso !== undefined) {
    end.lahsoDistanceFt = c.lahso;
  }
  if (c.lahsoE !== undefined) {
    end.lahsoEntity = c.lahsoE;
  }
  return end;
}

/**
 * Expands a compact runway into a full Runway.
 */
function expandRunway(c: CompactRunway): Runway {
  const rwy: Runway = { id: c.id, ends: c.ends.map(expandRunwayEnd) };
  if (c.len !== undefined) {
    rwy.lengthFt = c.len;
  }
  if (c.w !== undefined) {
    rwy.widthFt = c.w;
  }
  if (c.sfc !== undefined) {
    rwy.surfaceType = c.sfc;
  }
  if (c.cond !== undefined) {
    rwy.condition = c.cond;
  }
  if (c.trt !== undefined) {
    rwy.treatment = c.trt;
  }
  if (c.pcn !== undefined) {
    rwy.pcn = c.pcn;
  }
  if (c.lgt !== undefined) {
    rwy.lighting = c.lgt;
  }
  if (c.wsw !== undefined) {
    rwy.weightLimitSingleWheelKlb = c.wsw;
  }
  if (c.wdw !== undefined) {
    rwy.weightLimitDualWheelKlb = c.wdw;
  }
  if (c.wdt !== undefined) {
    rwy.weightLimitDualTandemKlb = c.wdt;
  }
  if (c.wdd !== undefined) {
    rwy.weightLimitDdtKlb = c.wdd;
  }
  return rwy;
}

/**
 * Expands a compact frequency into a full AirportFrequency.
 */
function expandFrequency(c: CompactFrequency): AirportFrequency {
  const freq: AirportFrequency = { frequencyMhz: c.f, use: c.u };
  if (c.s !== undefined) {
    freq.sectorization = c.s;
  }
  return freq;
}

/**
 * Expands a compact airport record into a full Airport.
 */
function expandAirport(c: CompactAirport): Airport {
  const apt: Airport = {
    faaId: c.id,
    name: c.nm,
    facilityType: c.ft,
    ownershipType: c.own,
    useType: c.use,
    status: c.st,
    city: c.city,
    state: c.state,
    country: c.ctry,
    lat: c.lat,
    lon: c.lon,
    runways: (c.rwys ?? []).map(expandRunway),
    frequencies: (c.freqs ?? []).map(expandFrequency),
  };

  if (c.icao !== undefined) {
    apt.icao = c.icao;
  }
  if (c.county !== undefined) {
    apt.county = c.county;
  }
  if (c.elev !== undefined) {
    apt.elevationFt = c.elev;
  }
  if (c.mv !== undefined) {
    apt.magneticVariation = c.mv;
  }
  if (c.mvd !== undefined) {
    apt.magneticVariationDirection = c.mvd;
  }
  if (c.mvy !== undefined) {
    apt.magneticVariationYear = c.mvy;
  }
  if (c.tpa !== undefined) {
    apt.trafficPatternAltitudeFt = c.tpa;
  }
  if (c.chart !== undefined) {
    apt.sectionChart = c.chart;
  }
  if (c.artcc !== undefined) {
    apt.artccId = c.artcc;
  }
  if (c.twr !== undefined) {
    apt.towerType = c.twr;
  }
  if (c.fuel !== undefined) {
    apt.fuelTypes = c.fuel;
  }
  if (c.afr !== undefined) {
    apt.airframeRepair = c.afr;
  }
  if (c.ppr !== undefined) {
    apt.powerplantRepair = c.ppr;
  }
  if (c.boxo !== undefined) {
    apt.bottledOxygen = c.boxo;
  }
  if (c.bxo !== undefined) {
    apt.bulkOxygen = c.bxo;
  }
  if (c.ls !== undefined) {
    apt.lightingSchedule = c.ls;
  }
  if (c.bcn !== undefined) {
    apt.beaconColor = c.bcn;
  }
  if (c.fee) {
    apt.hasLandingFee = true;
  }
  if (c.act !== undefined) {
    apt.activationDate = c.act;
  }
  if (c.svc !== undefined) {
    apt.otherServices = c.svc;
  }
  if (c.notam !== undefined) {
    apt.notamId = c.notam;
  }

  return apt;
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/airports.json.gz');
const raw: BundledData = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf-8'));

const records: Airport[] = raw.records.map(expandAirport);

/**
 * Pre-processed snapshot of US airport data derived from the FAA NASR
 * 28-day subscription cycle.
 *
 * Contains airport identification, location, elevation, runways (dimensions,
 * surface, lighting, declared distances), and communication frequencies for
 * all open US aviation facilities (airports, heliports, seaplane bases, etc.).
 *
 * Pass the `records` array directly to `createAirportResolver()` from
 * `@squawk/airports` for zero-config lookups:
 *
 * ```typescript
 * import { usBundledAirports } from '@squawk/airport-data';
 * import { createAirportResolver } from '@squawk/airports';
 *
 * const resolver = createAirportResolver({ data: usBundledAirports.records });
 * ```
 */
export const usBundledAirports: AirportDataset = {
  properties: {
    generatedAt: raw.meta.generatedAt,
    nasrCycleDate: raw.meta.nasrCycleDate,
    recordCount: raw.meta.recordCount,
  },
  records,
};
