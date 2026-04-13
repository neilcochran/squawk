import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { updateReadmeDate } from '@squawk/build-shared';
import { gzipSync } from 'node:zlib';
import type { Airport, AirportFrequency, IlsSystem, Runway, RunwayEnd } from '@squawk/types';

/**
 * Compact representation of an IlsSystem. Short keys reduce file size.
 */
interface CompactIls {
  /** System type. */
  st: string;
  /** Identifier. */
  id?: string;
  /** Category. */
  cat?: string;
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
 * Compact representation of a RunwayEnd. Short keys reduce file size.
 */
interface CompactRunwayEnd {
  /** Runway end designator. */
  id: string;
  /** True heading in degrees. */
  hdg?: number;
  /** ILS system. */
  ils?: CompactIls;
  /** Right-hand traffic pattern. */
  rht?: true;
  /** Marking type. */
  mt?: string;
  /** Marking condition. */
  mc?: string;
  /** Latitude. */
  lat?: number;
  /** Longitude. */
  lon?: number;
  /** Elevation in feet MSL. */
  el?: number;
  /** Threshold crossing height in feet. */
  tch?: number;
  /** Glidepath angle in degrees. */
  gpa?: number;
  /** Displaced threshold in feet. */
  dt?: number;
  /** Displaced threshold elevation. */
  dte?: number;
  /** Touchdown zone elevation. */
  tdz?: number;
  /** VGSI type. */
  vg?: string;
  /** Has RVR equipment. */
  rvr?: true;
  /** Approach lighting system. */
  al?: string;
  /** Has REIL. */
  reil?: true;
  /** Has centerline lights. */
  cl?: true;
  /** Has TDZ lights. */
  tl?: true;
  /** TORA in feet. */
  tora?: number;
  /** TODA in feet. */
  toda?: number;
  /** ASDA in feet. */
  asda?: number;
  /** LDA in feet. */
  lda?: number;
  /** LAHSO distance in feet. */
  lahso?: number;
  /** LAHSO intersecting entity. */
  lahsoE?: string;
}

/**
 * Compact representation of a Runway. Short keys reduce file size.
 */
interface CompactRunway {
  /** Runway designator. */
  id: string;
  /** Length in feet. */
  len?: number;
  /** Width in feet. */
  w?: number;
  /** Surface type code. */
  sfc?: string;
  /** Surface condition. */
  cond?: string;
  /** Surface treatment. */
  trt?: string;
  /** PCN value. */
  pcn?: string;
  /** Lighting intensity. */
  lgt?: string;
  /** Single-wheel weight limit (klb). */
  wsw?: number;
  /** Dual-wheel weight limit (klb). */
  wdw?: number;
  /** Dual-tandem weight limit (klb). */
  wdt?: number;
  /** Double-dual-tandem weight limit (klb). */
  wdd?: number;
  /** Runway ends. */
  ends: CompactRunwayEnd[];
}

/**
 * Compact representation of an AirportFrequency.
 */
interface CompactFrequency {
  /** Frequency in MHz. */
  f: number;
  /** Frequency use/purpose. */
  u: string;
  /** Sectorization. */
  s?: string;
}

/**
 * Compact representation of an Airport record. Short keys reduce file size.
 */
interface CompactAirport {
  /** FAA identifier. */
  id: string;
  /** ICAO code. */
  icao?: string;
  /** Facility name. */
  nm: string;
  /** Facility type. */
  ft: string;
  /** Ownership type. */
  own: string;
  /** Use type. */
  use: string;
  /** Status. */
  st: string;
  /** City. */
  city: string;
  /** State code. */
  state: string;
  /** Country code. */
  ctry: string;
  /** County name. */
  county?: string;
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lon: number;
  /** Elevation in feet MSL. */
  elev?: number;
  /** Magnetic variation. */
  mv?: number;
  /** Magnetic variation direction. */
  mvd?: string;
  /** Magnetic variation year. */
  mvy?: number;
  /** Traffic pattern altitude. */
  tpa?: number;
  /** Sectional chart name. */
  chart?: string;
  /** ARTCC identifier. */
  artcc?: string;
  /** Tower type. */
  twr?: string;
  /** Fuel types. */
  fuel?: string;
  /** Airframe repair level. */
  afr?: string;
  /** Powerplant repair level. */
  ppr?: string;
  /** Bottled oxygen type. */
  boxo?: string;
  /** Bulk oxygen type. */
  bxo?: string;
  /** Lighting schedule. */
  ls?: string;
  /** Beacon color. */
  bcn?: string;
  /** Has landing fee. */
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
 * Shape of the bundled JSON output file.
 */
interface BundledOutput {
  /** Dataset metadata. */
  meta: {
    /** ISO 8601 timestamp of when the dataset was generated. */
    generatedAt: string;
    /** NASR cycle effective date. */
    nasrCycleDate: string;
    /** Total number of airport records in the dataset. */
    recordCount: number;
  };
  /** Airport records as an array. */
  records: CompactAirport[];
}

/**
 * Compacts a RunwayEnd into its short-key representation.
 */
/**
 * Compacts an IlsSystem into its short-key representation.
 */
function compactIls(ils: IlsSystem): CompactIls {
  const c: CompactIls = { st: ils.systemType };
  if (ils.identifier !== undefined) {
    c.id = ils.identifier;
  }
  if (ils.category !== undefined) {
    c.cat = ils.category;
  }
  if (ils.localizerFrequencyMhz !== undefined) {
    c.lf = ils.localizerFrequencyMhz;
  }
  if (ils.localizerMagneticCourseDeg !== undefined) {
    c.lc = ils.localizerMagneticCourseDeg;
  }
  if (ils.glideSlopeAngleDeg !== undefined) {
    c.ga = ils.glideSlopeAngleDeg;
  }
  if (ils.glideSlopeType !== undefined) {
    c.gt = ils.glideSlopeType;
  }
  if (ils.dmeChannel !== undefined) {
    c.dc = ils.dmeChannel;
  }
  return c;
}

/**
 * Compacts a RunwayEnd into its short-key representation.
 */
function compactEnd(end: RunwayEnd): CompactRunwayEnd {
  const c: CompactRunwayEnd = { id: end.id };
  if (end.trueHeadingDeg !== undefined) {
    c.hdg = end.trueHeadingDeg;
  }
  if (end.ils !== undefined) {
    c.ils = compactIls(end.ils);
  }
  if (end.rightTraffic) {
    c.rht = true;
  }
  if (end.markingType !== undefined) {
    c.mt = end.markingType;
  }
  if (end.markingCondition !== undefined) {
    c.mc = end.markingCondition;
  }
  if (end.lat !== undefined) {
    c.lat = end.lat;
  }
  if (end.lon !== undefined) {
    c.lon = end.lon;
  }
  if (end.elevationFt !== undefined) {
    c.el = end.elevationFt;
  }
  if (end.thresholdCrossingHeightFt !== undefined) {
    c.tch = end.thresholdCrossingHeightFt;
  }
  if (end.glidepathAngleDeg !== undefined) {
    c.gpa = end.glidepathAngleDeg;
  }
  if (end.displacedThresholdFt !== undefined) {
    c.dt = end.displacedThresholdFt;
  }
  if (end.displacedThresholdElevationFt !== undefined) {
    c.dte = end.displacedThresholdElevationFt;
  }
  if (end.tdzElevationFt !== undefined) {
    c.tdz = end.tdzElevationFt;
  }
  if (end.vgsiType !== undefined) {
    c.vg = end.vgsiType;
  }
  if (end.hasRvr) {
    c.rvr = true;
  }
  if (end.approachLights !== undefined) {
    c.al = end.approachLights;
  }
  if (end.hasReil) {
    c.reil = true;
  }
  if (end.hasCenterlineLights) {
    c.cl = true;
  }
  if (end.hasTdzLights) {
    c.tl = true;
  }
  if (end.toraFt !== undefined) {
    c.tora = end.toraFt;
  }
  if (end.todaFt !== undefined) {
    c.toda = end.todaFt;
  }
  if (end.asdaFt !== undefined) {
    c.asda = end.asdaFt;
  }
  if (end.ldaFt !== undefined) {
    c.lda = end.ldaFt;
  }
  if (end.lahsoDistanceFt !== undefined) {
    c.lahso = end.lahsoDistanceFt;
  }
  if (end.lahsoEntity !== undefined) {
    c.lahsoE = end.lahsoEntity;
  }
  return c;
}

/**
 * Compacts a Runway into its short-key representation.
 */
function compactRunway(rwy: Runway): CompactRunway {
  const c: CompactRunway = { id: rwy.id, ends: rwy.ends.map(compactEnd) };
  if (rwy.lengthFt !== undefined) {
    c.len = rwy.lengthFt;
  }
  if (rwy.widthFt !== undefined) {
    c.w = rwy.widthFt;
  }
  if (rwy.surfaceType !== undefined) {
    c.sfc = rwy.surfaceType;
  }
  if (rwy.condition !== undefined) {
    c.cond = rwy.condition;
  }
  if (rwy.treatment !== undefined) {
    c.trt = rwy.treatment;
  }
  if (rwy.pcn !== undefined) {
    c.pcn = rwy.pcn;
  }
  if (rwy.lighting !== undefined) {
    c.lgt = rwy.lighting;
  }
  if (rwy.weightLimitSingleWheelKlb !== undefined) {
    c.wsw = rwy.weightLimitSingleWheelKlb;
  }
  if (rwy.weightLimitDualWheelKlb !== undefined) {
    c.wdw = rwy.weightLimitDualWheelKlb;
  }
  if (rwy.weightLimitDualTandemKlb !== undefined) {
    c.wdt = rwy.weightLimitDualTandemKlb;
  }
  if (rwy.weightLimitDdtKlb !== undefined) {
    c.wdd = rwy.weightLimitDdtKlb;
  }
  return c;
}

/**
 * Compacts an AirportFrequency into its short-key representation.
 */
function compactFreq(freq: AirportFrequency): CompactFrequency {
  const c: CompactFrequency = { f: freq.frequencyMhz, u: freq.use };
  if (freq.sectorization !== undefined) {
    c.s = freq.sectorization;
  }
  return c;
}

/**
 * Compacts an Airport into its short-key representation.
 */
function compactAirport(apt: Airport): CompactAirport {
  const c: CompactAirport = {
    id: apt.faaId,
    nm: apt.name,
    ft: apt.facilityType,
    own: apt.ownershipType,
    use: apt.useType,
    st: apt.status,
    city: apt.city,
    state: apt.state,
    ctry: apt.country,
    lat: apt.lat,
    lon: apt.lon,
  };

  if (apt.icao !== undefined) {
    c.icao = apt.icao;
  }
  if (apt.county !== undefined) {
    c.county = apt.county;
  }
  if (apt.elevationFt !== undefined) {
    c.elev = apt.elevationFt;
  }
  if (apt.magneticVariationDeg !== undefined) {
    c.mv = apt.magneticVariationDeg;
  }
  if (apt.magneticVariationDirection !== undefined) {
    c.mvd = apt.magneticVariationDirection;
  }
  if (apt.magneticVariationYear !== undefined) {
    c.mvy = apt.magneticVariationYear;
  }
  if (apt.trafficPatternAltitudeFt !== undefined) {
    c.tpa = apt.trafficPatternAltitudeFt;
  }
  if (apt.sectionChart !== undefined) {
    c.chart = apt.sectionChart;
  }
  if (apt.artccId !== undefined) {
    c.artcc = apt.artccId;
  }
  if (apt.towerType !== undefined) {
    c.twr = apt.towerType;
  }
  if (apt.fuelTypes !== undefined) {
    c.fuel = apt.fuelTypes;
  }
  if (apt.airframeRepair !== undefined) {
    c.afr = apt.airframeRepair;
  }
  if (apt.powerplantRepair !== undefined) {
    c.ppr = apt.powerplantRepair;
  }
  if (apt.bottledOxygen !== undefined) {
    c.boxo = apt.bottledOxygen;
  }
  if (apt.bulkOxygen !== undefined) {
    c.bxo = apt.bulkOxygen;
  }
  if (apt.lightingSchedule !== undefined) {
    c.ls = apt.lightingSchedule;
  }
  if (apt.beaconColor !== undefined) {
    c.bcn = apt.beaconColor;
  }
  if (apt.hasLandingFee) {
    c.fee = true;
  }
  if (apt.activationDate !== undefined) {
    c.act = apt.activationDate;
  }
  if (apt.otherServices !== undefined) {
    c.svc = apt.otherServices;
  }
  if (apt.notamId !== undefined) {
    c.notam = apt.notamId;
  }

  if (apt.runways.length > 0) {
    c.rwys = apt.runways.map(compactRunway);
  }
  if (apt.frequencies.length > 0) {
    c.freqs = apt.frequencies.map(compactFreq);
  }

  return c;
}

/**
 * Writes Airport records to a gzipped compact JSON file at the given path.
 * Creates the output directory if it does not exist.
 *
 * @param airports - Airport records to serialize.
 * @param nasrCycleDate - NASR cycle effective date string.
 * @param outputPath - Absolute path to write the output .json.gz file.
 */
export async function writeOutput(
  airports: Airport[],
  nasrCycleDate: string,
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const output: BundledOutput = {
    meta: {
      generatedAt: new Date().toISOString(),
      nasrCycleDate,
      recordCount: airports.length,
    },
    records: airports.map(compactAirport),
  };

  const json = JSON.stringify(output);
  const compressed = gzipSync(Buffer.from(json));
  await writeFile(outputPath, compressed);

  const sizeMb = (compressed.length / 1024 / 1024).toFixed(1);
  console.log(
    `[write-output] Wrote ${output.meta.recordCount} records to ${outputPath} (${sizeMb} MB gzipped)`,
  );

  await updateReadmeDate(outputPath, nasrCycleDate);
}
