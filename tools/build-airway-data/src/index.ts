import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseNasrArgs } from '@squawk/build-shared';
import { parseAwy1, parseAwy2, buildWaypoint } from './parse-awy.js';
import { parseAts1, parseAts2, buildAtsWaypoint } from './parse-ats.js';
import { writeOutput } from './write-output.js';
import type { Airway, AirwayType, AirwayRegion, AirwayWaypoint } from '@squawk/types';
import { AWY_TYPE_MAP, ATS_TYPE_MAP, AIRWAY_REGION_MAP } from '@squawk/types';

/** Fixed-width data files within the NASR subscription directory. */
const AWY_FILE = 'AWY.txt';
const ATS_FILE = 'ATS.txt';

/**
 * Determines the AirwayType from an AWY.txt designation string.
 * The first character indicates the type (V, J, Q, T, G, R, A, B).
 */
function getAwyType(designation: string): AirwayType | undefined {
  const firstChar = designation.charAt(0);
  return AWY_TYPE_MAP[firstChar];
}

/**
 * Determines the AirwayType from an ATS.txt designation prefix.
 */
function getAtsType(designationPrefix: string): AirwayType | undefined {
  return ATS_TYPE_MAP[designationPrefix];
}

/**
 * Determines the AirwayRegion from the airway type character.
 */
function getRegion(airwayTypeChar: string): AirwayRegion {
  return AIRWAY_REGION_MAP[airwayTypeChar] ?? 'US';
}

/**
 * Builds the unique airway key from designation and type character.
 */
function airwayKey(designation: string, airwayTypeChar: string): string {
  return `${designation}|${airwayTypeChar}`;
}

/**
 * Parses AWY.txt and returns an array of Airway records.
 */
function parseAwyFile(filePath: string): Airway[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0);

  const awy1Map = new Map<string, Map<number, ReturnType<typeof parseAwy1>>>();
  const awy2Map = new Map<string, Map<number, ReturnType<typeof parseAwy2>>>();

  for (const line of lines) {
    const recordType = line.substring(0, 4);

    if (recordType === 'AWY1') {
      const rec = parseAwy1(line);
      const key = airwayKey(rec.designation, rec.airwayTypeChar);
      if (!awy1Map.has(key)) {
        awy1Map.set(key, new Map());
      }
      awy1Map.get(key)!.set(rec.sequenceNumber, rec);
    } else if (recordType === 'AWY2') {
      const rec = parseAwy2(line);
      const key = airwayKey(rec.designation, rec.airwayTypeChar);
      if (!awy2Map.has(key)) {
        awy2Map.set(key, new Map());
      }
      awy2Map.get(key)!.set(rec.sequenceNumber, rec);
    }
  }

  const airways: Airway[] = [];

  for (const [key, awy1Points] of awy1Map) {
    const awy2Points = awy2Map.get(key);
    if (!awy2Points) {
      continue;
    }

    const seqNumbers = Array.from(awy1Points.keys()).sort((a, b) => a - b);
    const firstRec = awy1Points.get(seqNumbers[0]!);
    if (!firstRec) {
      continue;
    }

    const airwayType = getAwyType(firstRec.designation);
    if (!airwayType) {
      continue;
    }

    const waypoints: AirwayWaypoint[] = [];
    for (const seq of seqNumbers) {
      const awy1 = awy1Points.get(seq)!;
      const awy2 = awy2Points.get(seq);
      if (!awy2) {
        continue;
      }

      const wp = buildWaypoint(awy1, awy2);
      if (wp) {
        waypoints.push(wp);
      }
    }

    if (waypoints.length === 0) {
      continue;
    }

    airways.push({
      designation: firstRec.designation,
      type: airwayType,
      region: getRegion(firstRec.airwayTypeChar),
      waypoints,
    });
  }

  return airways;
}

/**
 * Parses ATS.txt and returns an array of Airway records.
 */
function parseAtsFile(filePath: string): Airway[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0);

  const ats1Map = new Map<string, Map<number, ReturnType<typeof parseAts1>>>();
  const ats2Map = new Map<string, Map<number, ReturnType<typeof parseAts2>>>();

  for (const line of lines) {
    const recordType = line.substring(0, 4);

    if (recordType === 'ATS1') {
      const rec = parseAts1(line);
      const key = airwayKey(rec.fullDesignation, rec.airwayTypeChar);
      if (!ats1Map.has(key)) {
        ats1Map.set(key, new Map());
      }
      ats1Map.get(key)!.set(rec.sequenceNumber, rec);
    } else if (recordType === 'ATS2') {
      const rec = parseAts2(line);
      const key = airwayKey(rec.fullDesignation, rec.airwayTypeChar);
      if (!ats2Map.has(key)) {
        ats2Map.set(key, new Map());
      }
      ats2Map.get(key)!.set(rec.sequenceNumber, rec);
    }
  }

  const airways: Airway[] = [];

  for (const [key, ats1Points] of ats1Map) {
    const ats2Points = ats2Map.get(key);
    if (!ats2Points) {
      continue;
    }

    const seqNumbers = Array.from(ats1Points.keys()).sort((a, b) => a - b);
    const firstRec = ats1Points.get(seqNumbers[0]!);
    if (!firstRec) {
      continue;
    }

    const airwayType = getAtsType(firstRec.designationPrefix);
    if (!airwayType) {
      continue;
    }

    const waypoints: AirwayWaypoint[] = [];
    for (const seq of seqNumbers) {
      const ats1 = ats1Points.get(seq)!;
      const ats2 = ats2Points.get(seq);
      if (!ats2) {
        continue;
      }

      const wp = buildAtsWaypoint(ats1, ats2);
      if (wp) {
        waypoints.push(wp);
      }
    }

    if (waypoints.length === 0) {
      continue;
    }

    airways.push({
      designation: firstRec.fullDesignation,
      type: airwayType,
      region: getRegion(firstRec.airwayTypeChar),
      waypoints,
    });
  }

  return airways;
}

/**
 * Main entry point. Parses CLI arguments, reads AWY.txt and ATS.txt,
 * runs the data pipeline, and writes the output.
 */
async function main(): Promise<void> {
  const { subscriptionDir, nasrCycleDate, outputPath, cleanup } = parseNasrArgs({
    defaultOutputPath: resolve(
      import.meta.dirname,
      '../../../packages/libs/airway-data/data/airways.json.gz',
    ),
  });

  try {
    // Parse AWY.txt (Victor, Jet, RNAV Q/T, Green, Red, Amber, Blue routes).
    const awyPath = join(subscriptionDir, AWY_FILE);
    console.log(`[index] Parsing ${AWY_FILE}...`);
    const awyAirways = parseAwyFile(awyPath);
    const awyWpCount = awyAirways.reduce((sum, a) => sum + a.waypoints.length, 0);
    console.log(
      `[index] Parsed ${awyAirways.length} airways (${awyWpCount} waypoints) from ${AWY_FILE}.`,
    );

    // Parse ATS.txt (Atlantic, Bahama, Pacific, Puerto Rico routes).
    const atsPath = join(subscriptionDir, ATS_FILE);
    console.log(`[index] Parsing ${ATS_FILE}...`);
    const atsAirways = parseAtsFile(atsPath);
    const atsWpCount = atsAirways.reduce((sum, a) => sum + a.waypoints.length, 0);
    console.log(
      `[index] Parsed ${atsAirways.length} airways (${atsWpCount} waypoints) from ${ATS_FILE}.`,
    );

    const allAirways = [...awyAirways, ...atsAirways];
    allAirways.sort((a, b) => a.designation.localeCompare(b.designation));

    console.log(`[index] Total: ${allAirways.length} airways.`);

    await writeOutput(allAirways, nasrCycleDate, outputPath);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
