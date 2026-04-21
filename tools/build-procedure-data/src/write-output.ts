import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { updateReadmeDate } from '@squawk/build-shared';
import type {
  AltitudeConstraint,
  ApproachType,
  MissedApproachSequence,
  Procedure,
  ProcedureCommonRoute,
  ProcedureLeg,
  ProcedureLegFixCategory,
  ProcedureLegPathTerminator,
  ProcedureTransition,
  ProcedureType,
  SpeedConstraint,
  TurnDirection,
} from '@squawk/types';

/**
 * Compact representation of an {@link AltitudeConstraint}. Fields use
 * short keys to reduce the serialized byte count; `secondaryFt` is
 * omitted when the descriptor uses a single altitude.
 */
interface CompactAltitudeConstraint {
  /** Descriptor. */
  d: AltitudeConstraint['descriptor'];
  /** Primary altitude in feet. */
  p: number;
  /** Secondary altitude in feet. */
  s?: number;
}

/**
 * Compact representation of a {@link SpeedConstraint}.
 */
interface CompactSpeedConstraint {
  /** Descriptor. */
  d: SpeedConstraint['descriptor'];
  /** Indicated airspeed limit in knots. */
  s: number;
}

/**
 * Compact representation of a {@link ProcedureLeg} using short keys.
 * Optional fields are omitted when not present on the source leg.
 */
interface CompactLeg {
  /** Path terminator. */
  pt: ProcedureLegPathTerminator;
  /** Fix identifier. */
  fi?: string;
  /** Fix category. */
  cat?: ProcedureLegFixCategory;
  /** Latitude in decimal degrees. */
  lat?: number;
  /** Longitude in decimal degrees. */
  lon?: number;
  /** ICAO region code of the termination fix. */
  ir?: string;
  /** Altitude constraint. */
  ac?: CompactAltitudeConstraint;
  /** Speed constraint. */
  sc?: CompactSpeedConstraint;
  /** Course in degrees. */
  crs?: number;
  /** Course is true rather than magnetic. */
  ct?: 1;
  /** Distance in nautical miles. */
  dist?: number;
  /** Hold time in minutes. */
  hold?: number;
  /** Recommended navaid identifier. */
  rn?: string;
  /** Recommended navaid ICAO region code. */
  rnIr?: string;
  /** Theta bearing from recommended navaid in degrees. */
  th?: number;
  /** Rho distance from recommended navaid in nautical miles. */
  rh?: number;
  /** RNP value in nautical miles. */
  rnp?: number;
  /** Commanded turn direction. */
  td?: TurnDirection;
  /** Arc radius in nautical miles. */
  ar?: number;
  /** Center fix identifier. */
  cf?: string;
  /** Center fix ICAO region code. */
  cfIr?: string;
  /** Initial approach fix flag. */
  iaf?: 1;
  /** Intermediate fix flag. */
  ifx?: 1;
  /** Final approach fix flag. */
  faf?: 1;
  /** Final approach course fix flag. */
  facf?: 1;
  /** Missed approach point flag. */
  map?: 1;
  /** Fly-over fix flag. */
  fo?: 1;
}

/**
 * Compact representation of a {@link ProcedureTransition}.
 */
interface CompactTransition {
  /** Transition name. */
  nm: string;
  /** Compact legs along the transition path. */
  lg: CompactLeg[];
}

/**
 * Compact representation of a {@link ProcedureCommonRoute}.
 */
interface CompactCommonRoute {
  /** Compact legs along the common route. */
  lg: CompactLeg[];
  /** FAA identifiers of adapted airports served by this route. */
  apt: string[];
  /** Runway identifier when the route is runway-specific. */
  rw?: string;
}

/**
 * Compact representation of a {@link MissedApproachSequence}.
 */
interface CompactMissedApproach {
  /** Compact legs of the missed approach climb-out. */
  lg: CompactLeg[];
}

/**
 * Compact representation of a {@link Procedure}.
 */
interface CompactProcedure {
  /** Human-readable procedure name. */
  nm: string;
  /** CIFP procedure identifier. */
  id: string;
  /** Procedure type. */
  tp: ProcedureType;
  /** FAA identifiers of airports served by this procedure. */
  apt: string[];
  /** Compact common routes. */
  cr: CompactCommonRoute[];
  /** Compact transitions. */
  tr: CompactTransition[];
  /** Approach classification (IAP only). */
  at?: ApproachType;
  /** Runway served by the approach (IAP only). */
  rw?: string;
  /** Missed approach (IAP only). */
  ma?: CompactMissedApproach;
}

/**
 * Shape of the bundled JSON output file.
 */
interface BundledOutput {
  /** Dataset metadata. */
  meta: {
    /** ISO 8601 timestamp of when the dataset was generated. */
    generatedAt: string;
    /** CIFP cycle effective date in `YYYY-MM-DD`. */
    cifpCycleDate: string;
    /** Total number of procedure records. */
    recordCount: number;
    /** Number of SIDs. */
    sidCount: number;
    /** Number of STARs. */
    starCount: number;
    /** Number of IAPs. */
    iapCount: number;
    /** Total leg count across all routes, transitions, and missed approaches. */
    legCount: number;
  };
  /** Compact procedure records. */
  records: CompactProcedure[];
}

/**
 * Compacts a full {@link ProcedureLeg} into its short-key form.
 */
function compactLeg(leg: ProcedureLeg): CompactLeg {
  const c: CompactLeg = { pt: leg.pathTerminator };
  if (leg.fixIdentifier !== undefined) {
    c.fi = leg.fixIdentifier;
  }
  if (leg.category !== undefined) {
    c.cat = leg.category;
  }
  if (leg.lat !== undefined) {
    c.lat = leg.lat;
  }
  if (leg.lon !== undefined) {
    c.lon = leg.lon;
  }
  if (leg.icaoRegionCode !== undefined) {
    c.ir = leg.icaoRegionCode;
  }
  if (leg.altitudeConstraint !== undefined) {
    const ac: CompactAltitudeConstraint = {
      d: leg.altitudeConstraint.descriptor,
      p: leg.altitudeConstraint.primaryFt,
    };
    if (leg.altitudeConstraint.secondaryFt !== undefined) {
      ac.s = leg.altitudeConstraint.secondaryFt;
    }
    c.ac = ac;
  }
  if (leg.speedConstraint !== undefined) {
    c.sc = {
      d: leg.speedConstraint.descriptor,
      s: leg.speedConstraint.speedKt,
    };
  }
  if (leg.courseDeg !== undefined) {
    c.crs = leg.courseDeg;
  }
  if (leg.courseIsTrue === true) {
    c.ct = 1;
  }
  if (leg.distanceNm !== undefined) {
    c.dist = leg.distanceNm;
  }
  if (leg.holdTimeMin !== undefined) {
    c.hold = leg.holdTimeMin;
  }
  if (leg.recommendedNavaid !== undefined) {
    c.rn = leg.recommendedNavaid;
  }
  if (leg.recommendedNavaidIcaoRegionCode !== undefined) {
    c.rnIr = leg.recommendedNavaidIcaoRegionCode;
  }
  if (leg.thetaDeg !== undefined) {
    c.th = leg.thetaDeg;
  }
  if (leg.rhoNm !== undefined) {
    c.rh = leg.rhoNm;
  }
  if (leg.rnpNm !== undefined) {
    c.rnp = leg.rnpNm;
  }
  if (leg.turnDirection !== undefined) {
    c.td = leg.turnDirection;
  }
  if (leg.arcRadiusNm !== undefined) {
    c.ar = leg.arcRadiusNm;
  }
  if (leg.centerFix !== undefined) {
    c.cf = leg.centerFix;
  }
  if (leg.centerFixIcaoRegionCode !== undefined) {
    c.cfIr = leg.centerFixIcaoRegionCode;
  }
  if (leg.isInitialApproachFix === true) {
    c.iaf = 1;
  }
  if (leg.isIntermediateFix === true) {
    c.ifx = 1;
  }
  if (leg.isFinalApproachFix === true) {
    c.faf = 1;
  }
  if (leg.isFinalApproachCourseFix === true) {
    c.facf = 1;
  }
  if (leg.isMissedApproachPoint === true) {
    c.map = 1;
  }
  if (leg.isFlyover === true) {
    c.fo = 1;
  }
  return c;
}

/**
 * Compacts a full {@link ProcedureTransition}.
 */
function compactTransition(t: ProcedureTransition): CompactTransition {
  return {
    nm: t.name,
    lg: t.legs.map(compactLeg),
  };
}

/**
 * Compacts a full {@link ProcedureCommonRoute}.
 */
function compactCommonRoute(r: ProcedureCommonRoute): CompactCommonRoute {
  const c: CompactCommonRoute = {
    lg: r.legs.map(compactLeg),
    apt: r.airports,
  };
  if (r.runway !== undefined) {
    c.rw = r.runway;
  }
  return c;
}

/**
 * Compacts a full {@link MissedApproachSequence}.
 */
function compactMissedApproach(m: MissedApproachSequence): CompactMissedApproach {
  return { lg: m.legs.map(compactLeg) };
}

/**
 * Compacts a full {@link Procedure}.
 */
function compactProcedure(p: Procedure): CompactProcedure {
  const c: CompactProcedure = {
    nm: p.name,
    id: p.identifier,
    tp: p.type,
    apt: p.airports,
    cr: p.commonRoutes.map(compactCommonRoute),
    tr: p.transitions.map(compactTransition),
  };
  if (p.approachType !== undefined) {
    c.at = p.approachType;
  }
  if (p.runway !== undefined) {
    c.rw = p.runway;
  }
  if (p.missedApproach !== undefined) {
    c.ma = compactMissedApproach(p.missedApproach);
  }
  return c;
}

/**
 * Counts total legs across all common routes, transitions, and missed
 * approaches of a procedure.
 */
function countLegs(p: Procedure): number {
  let count = 0;
  for (const route of p.commonRoutes) {
    count += route.legs.length;
  }
  for (const transition of p.transitions) {
    count += transition.legs.length;
  }
  if (p.missedApproach !== undefined) {
    count += p.missedApproach.legs.length;
  }
  return count;
}

/**
 * Writes the decoded procedures to a gzipped compact JSON file at the
 * given path. Creates any missing parent directories and refreshes the
 * companion README's date stamp.
 *
 * @param procedures - Procedures to serialize.
 * @param cifpCycleDate - CIFP cycle effective date in `YYYY-MM-DD`.
 * @param outputPath - Absolute path to write the gzipped output.
 */
export async function writeOutput(
  procedures: Procedure[],
  cifpCycleDate: string,
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const sidCount = procedures.filter((p) => p.type === 'SID').length;
  const starCount = procedures.filter((p) => p.type === 'STAR').length;
  const iapCount = procedures.filter((p) => p.type === 'IAP').length;
  const legCount = procedures.reduce((sum, p) => sum + countLegs(p), 0);

  const output: BundledOutput = {
    meta: {
      generatedAt: new Date().toISOString(),
      cifpCycleDate,
      recordCount: procedures.length,
      sidCount,
      starCount,
      iapCount,
      legCount,
    },
    records: procedures.map(compactProcedure),
  };

  const json = JSON.stringify(output);
  const compressed = gzipSync(Buffer.from(json));
  await writeFile(outputPath, compressed);

  const sizeMb = (compressed.length / 1024 / 1024).toFixed(2);
  console.log(
    `[write-output] Wrote ${output.meta.recordCount} procedures ` +
      `(${sidCount} SIDs, ${starCount} STARs, ${iapCount} IAPs, ${legCount} legs) ` +
      `to ${outputPath} (${sizeMb} MB gzipped)`,
  );

  await updateReadmeDate(outputPath, cifpCycleDate);
}
