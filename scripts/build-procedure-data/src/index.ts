import { readFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { parseStardp } from './parse-stardp.js';
import { writeOutput } from './write-output.js';

/** Relative path from the script root to the default output file. */
const DEFAULT_OUTPUT_PATH = '../../../packages/procedure-data/data/procedures.json.gz';

/** Pattern used to extract the NASR cycle date from a subscription directory name. */
const CYCLE_DATE_PATTERN = /28DaySubscription_Effective_(\d{4}-\d{2}-\d{2})/;

/** Fixed-width data file within the NASR subscription directory. */
const STARDP_FILE = 'STARDP.txt';

/**
 * Prints usage instructions to stderr and exits with code 1.
 */
function printUsageAndExit(): never {
  process.stderr.write(
    'Usage: node dist/index.js --local <nasr-subscription-dir> [--output <output-path>]\n\n' +
      'Options:\n' +
      '  --local <path>   Path to an extracted NASR subscription directory.\n' +
      '  --output <path>  Path to write the output .json.gz file.\n' +
      `                   Defaults to: ${DEFAULT_OUTPUT_PATH}\n`,
  );
  process.exit(1);
}

/**
 * Main entry point. Parses CLI arguments, reads STARDP.txt,
 * runs the data pipeline, and writes the output.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let subscriptionDir: string | undefined;
  let outputPath: string = resolve(import.meta.dirname, DEFAULT_OUTPUT_PATH);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--local' && next) {
      subscriptionDir = resolve(next);
      i++;
    } else if (arg === '--output' && next) {
      outputPath = resolve(next);
      i++;
    } else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      printUsageAndExit();
    }
  }

  if (!subscriptionDir) {
    process.stderr.write('Error: --local <path> is required.\n');
    printUsageAndExit();
  }

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

  const stardpPath = join(subscriptionDir, STARDP_FILE);
  console.log(`[index] Parsing ${STARDP_FILE}...`);
  const content = readFileSync(stardpPath, 'utf-8');
  const procedures = parseStardp(content);

  const sidCount = procedures.filter((p) => p.type === 'SID').length;
  const starCount = procedures.filter((p) => p.type === 'STAR').length;
  console.log(
    `[index] Parsed ${procedures.length} procedures (${sidCount} SIDs, ${starCount} STARs).`,
  );

  await writeOutput(procedures, nasrCycleDate, outputPath);
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
