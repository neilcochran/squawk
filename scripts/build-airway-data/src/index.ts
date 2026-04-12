import { readFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { parseAwy1, parseAwy2, buildWaypoint } from './parse-awy.js';
import { parseAts1, parseAts2, buildAtsWaypoint } from './parse-ats.js';
import { resolveInput } from './resolve-input.js';
import { writeOutput } from './write-output.js';
import type { Airway, AirwayType, AirwayRegion, AirwayWaypoint } from '@squawk/types';
import { AWY_TYPE_MAP, ATS_TYPE_MAP, AIRWAY_REGION_MAP } from '@squawk/types';

/** Relative path from the script root to the default output file. */
const DEFAULT_OUTPUT_PATH = '../../../packages/airway-data/data/airways.json.gz';

/** Pattern used to extract the NASR cycle date from a subscription directory name. */
const CYCLE_DATE_PATTERN = /28DaySubscription_Effective_(\d{4}-\d{2}-\d{2})/;

/** Fixed-width data files within the NASR subscription directory. */
const AWY_FILE = 'AWY.txt';
const ATS_FILE = 'ATS.txt';

/**
 * Prints usage instructions to stderr and exits with code 1.
 */
function printUsageAndExit(): never {
  process.stderr.write(
    'Usage: node dist/index.js --local <nasr-subscription-dir> [--output <output-path>]\n\n' +
      'Options:\n' +
      '  --local <path>   Path to a NASR subscription .zip file or extracted directory.\n' +
      '  --output <path>  Path to write the output .json.gz file.\n' +
      `                   Defaults to: ${DEFAULT_OUTPUT_PATH}\n`,
  );
  process.exit(1);
}

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
  const args = process.argv.slice(2);

  let inputPath: string | undefined;
  let outputPath: string = resolve(import.meta.dirname, DEFAULT_OUTPUT_PATH);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--local' && next) {
      inputPath = resolve(next);
      i++;
    } else if (arg === '--output' && next) {
      outputPath = resolve(next);
      i++;
    } else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      printUsageAndExit();
    }
  }

  if (!inputPath) {
    process.stderr.write('Error: --local <path> is required.\n');
    printUsageAndExit();
  }

  const { subscriptionDir, cleanup } = resolveInput(inputPath);

  try {
    const dirName = basename(subscriptionDir);
    const cycleMatch = dirName.match(CYCLE_DATE_PATTERN);
    if (!cycleMatch) {
      throw new Error(
        `Cannot determine NASR cycle date from directory name "${dirName}". ` +
          `Expected pattern: 28DaySubscription_Effective_YYYY-MM-DD`,
      );
    }
    const nasrCycleDate = cycleMatch[1] ?? '';
    console.log(`[index] NASR cycle date: ${nasrCycleDate}`);

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
