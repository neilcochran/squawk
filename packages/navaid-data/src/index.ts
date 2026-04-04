import type { Navaid, NavaidStatus, NavaidType } from '@squawk/types';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Compact representation of a Navaid in the bundled JSON format.
 */
interface CompactNavaid {
  /** Identifier. */
  id: string;
  /** Name. */
  nm: string;
  /** Type. */
  tp: NavaidType;
  /** Status. */
  st: NavaidStatus;
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lon: number;
  /** State code. */
  state: string;
  /** Country code. */
  ctry: string;
  /** City. */
  city?: string;
  /** Elevation in feet MSL. */
  elev?: number;
  /** Frequency in MHz (VOR-family). */
  fmhz?: number;
  /** Frequency in kHz (NDB-family). */
  fkhz?: number;
  /** TACAN channel. */
  ch?: string;
  /** Magnetic variation. */
  mv?: number;
  /** Magnetic variation direction. */
  mvd?: string;
  /** Magnetic variation year. */
  mvy?: number;
  /** Low-altitude ARTCC ID. */
  lart?: string;
  /** High-altitude ARTCC ID. */
  hart?: string;
  /** Navaid class. */
  cls?: string;
  /** DME service volume. */
  dssv?: string;
  /** Power output watts. */
  pwr?: number;
  /** Simultaneous voice. */
  sv?: true;
  /** NDB class. */
  ndb?: string;
  /** Public use. */
  pub?: true;
  /** Operating hours. */
  hrs?: string;
  /** NOTAM ID. */
  notam?: string;
  /** Fan marker identifier. */
  mkr?: string;
  /** Fan marker shape. */
  mkrs?: string;
  /** Fan marker bearing. */
  mkrb?: number;
  /** DME latitude. */
  dlat?: number;
  /** DME longitude. */
  dlon?: number;
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
    /** Total number of navaid records. */
    recordCount: number;
  };
  /** Navaid records. */
  records: CompactNavaid[];
}

/**
 * Metadata properties attached to the navaid dataset describing
 * the FAA NASR data vintage and build provenance.
 */
export interface NavaidDatasetProperties {
  /** ISO 8601 timestamp of when the dataset was generated. */
  generatedAt: string;
  /** NASR cycle effective date (e.g. "2026-01-22"). */
  nasrCycleDate: string;
  /** Total number of navaid records in the dataset. */
  recordCount: number;
}

/**
 * A pre-processed array of Navaid records with attached metadata
 * about the build provenance and NASR cycle.
 */
export interface NavaidDataset {
  /** Metadata about the dataset build. */
  properties: NavaidDatasetProperties;
  /** Navaid records. */
  records: Navaid[];
}

/**
 * Expands a compact navaid record into the full Navaid interface.
 */
function expandNavaid(c: CompactNavaid): Navaid {
  const navaid: Navaid = {
    identifier: c.id,
    name: c.nm,
    type: c.tp,
    status: c.st,
    lat: c.lat,
    lon: c.lon,
    state: c.state,
    country: c.ctry,
  };

  if (c.city !== undefined) {
    navaid.city = c.city;
  }
  if (c.elev !== undefined) {
    navaid.elevationFt = c.elev;
  }
  if (c.fmhz !== undefined) {
    navaid.frequencyMhz = c.fmhz;
  }
  if (c.fkhz !== undefined) {
    navaid.frequencyKhz = c.fkhz;
  }
  if (c.ch !== undefined) {
    navaid.tacanChannel = c.ch;
  }
  if (c.mv !== undefined) {
    navaid.magneticVariation = c.mv;
  }
  if (c.mvd !== undefined) {
    navaid.magneticVariationDirection = c.mvd;
  }
  if (c.mvy !== undefined) {
    navaid.magneticVariationYear = c.mvy;
  }
  if (c.lart !== undefined) {
    navaid.lowArtccId = c.lart;
  }
  if (c.hart !== undefined) {
    navaid.highArtccId = c.hart;
  }
  if (c.cls !== undefined) {
    navaid.navaidClass = c.cls;
  }
  if (c.dssv !== undefined) {
    navaid.dmeServiceVolume = c.dssv;
  }
  if (c.pwr !== undefined) {
    navaid.powerOutputWatts = c.pwr;
  }
  if (c.sv) {
    navaid.simultaneousVoice = true;
  }
  if (c.ndb !== undefined) {
    navaid.ndbClass = c.ndb;
  }
  if (c.pub) {
    navaid.publicUse = true;
  }
  if (c.hrs !== undefined) {
    navaid.operatingHours = c.hrs;
  }
  if (c.notam !== undefined) {
    navaid.notamId = c.notam;
  }
  if (c.mkr !== undefined) {
    navaid.markerIdentifier = c.mkr;
  }
  if (c.mkrs !== undefined) {
    navaid.markerShape = c.mkrs;
  }
  if (c.mkrb !== undefined) {
    navaid.markerBearingDeg = c.mkrb;
  }
  if (c.dlat !== undefined) {
    navaid.dmeLat = c.dlat;
  }
  if (c.dlon !== undefined) {
    navaid.dmeLon = c.dlon;
  }

  return navaid;
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/navaids.json.gz');
const raw: BundledData = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf-8'));

const records: Navaid[] = raw.records.map(expandNavaid);

/**
 * Pre-processed snapshot of US navaid data derived from the FAA NASR
 * 28-day subscription cycle.
 *
 * Contains navaid identification, location, frequency, type, and service
 * volume information for all non-shutdown US navigational aids (VORs,
 * VORTACs, VOR/DMEs, TACANs, DMEs, NDBs, NDB/DMEs, fan markers, and VOTs).
 *
 * Pass the `records` array directly to `createNavaidResolver()` from
 * `@squawk/navaids` for zero-config lookups:
 *
 * ```typescript
 * import { usBundledNavaids } from '@squawk/navaid-data';
 * import { createNavaidResolver } from '@squawk/navaids';
 *
 * const resolver = createNavaidResolver({ data: usBundledNavaids.records });
 * ```
 */
export const usBundledNavaids: NavaidDataset = {
  properties: {
    generatedAt: raw.meta.generatedAt,
    nasrCycleDate: raw.meta.nasrCycleDate,
    recordCount: raw.meta.recordCount,
  },
  records,
};
