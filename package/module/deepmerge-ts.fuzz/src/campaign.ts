/**
 Unbounded fuzz campaign driver, run by the `fuzz` mise task inside a capped
 podman container.

 Rounds forever: each round draws one fresh seed and runs every
 `*.property.unit.test.ts` file as its own node process with that seed and
 the configured run count (see `./fuzz-budget.ts`). The first failing file
 stops the campaign after writing a replay record (file, seed, run count,
 round, and the process output, which includes fast-check's shrunk
 counterexample and path) as JSON into the failure directory.

 Replay a record on the host with
 `DEEPMERGE_FUZZ_SEED=<seed> DEEPMERGE_FUZZ_NUM_RUNS=<runs> node <file>`.

 @module
 */

import { spawnSync, } from 'node:child_process';
import { randomInt, } from 'node:crypto';
import { glob, mkdir, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

/**
 Default runs per property per round when the task passes none.
 */
const DEFAULT_ROUND_RUNS = 10_000;

/**
 Exclusive upper bound of drawn seeds, the positive 32-bit range fast-check
 accepts.
 */
const SEED_BOUND = 2 ** 31;

/**
 Largest child output kept in memory and in the replay record.
 */
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

/**
 Error ending the campaign at its first counterexample.
 */
export class CampaignFailure extends Error {
  /**
   @param recordPath - Replay record written for the failure.
   */
  constructor(recordPath: string,) {
    super(`Counterexample found; replay record written to ${recordPath}`,);
    this.name = 'CampaignFailure';
  }
}

/**
 Read a required environment variable.

 @param name - Variable the `fuzz` task sets.

 @returns Its non-empty value.

 @throws {Error} When the variable is missing, meaning the driver ran outside
   the task.

 @example
 ```ts
 const dir = requiredEnv('DEEPMERGE_FUZZ_FAILURE_DIR');
 ```
 */
function requiredEnv(name: string,): string {
  /**
   Raw value from the environment.
   */
  const value = process.env[name];
  if ((value === undefined) || (value === ''))
    throw new Error(`${name} is unset; run the campaign through \`mise run //package/module/deepmerge-ts.fuzz:fuzz\``,);
  return value;
}

/**
 Run one property file for one round.

 @param file - Property file path relative to the package root.
 @param seed - Round seed.
 @param numRuns - Runs per property.

 @returns Exit status and combined output of the child process.

 @example
 ```ts
 const outcome = runFile({ file: 'src/x.property.unit.test.ts', seed: 1, numRuns: 10, });
 ```
 */
function runFile(
  { file, seed, numRuns, }: { readonly file: string; readonly seed: number; readonly numRuns: number; },
): { readonly status: number | null; readonly output: string; } {
  /**
   Completed child process.
   */
  const child = spawnSync('node', [file,], {
    encoding: 'utf8',
    env: { ...process.env, DEEPMERGE_FUZZ_NUM_RUNS: String(numRuns,), DEEPMERGE_FUZZ_SEED: String(seed,), },
    maxBuffer: MAX_OUTPUT_BYTES,
  },);
  if (child.error !== undefined)
    throw child.error;
  return { output: `${child.stdout}${child.stderr}`, status: child.status, };
}

/**
 Run rounds until a property file fails.

 @throws {CampaignFailure} At the first counterexample, after writing its
   replay record.

 @example
 ```ts
 await runCampaign();
 ```
 */
export async function runCampaign(): Promise<never> {
  /**
   Directory receiving replay records; the only writable mount.
   */
  const failureDir = requiredEnv('DEEPMERGE_FUZZ_FAILURE_DIR',);
  /**
   Runs per property per round.
   */
  const numRuns = Number(process.env['DEEPMERGE_FUZZ_ROUND_RUNS'] ?? DEFAULT_ROUND_RUNS,);
  if (!Number.isInteger(numRuns,) || (numRuns <= 0))
    throw new Error(`DEEPMERGE_FUZZ_ROUND_RUNS must be a positive integer, got ${String(numRuns,)}`,);
  /**
   Property files, sorted so rounds are comparable.
   */
  const files = (await Array.fromAsync(glob('src/**/*.property.unit.test.ts',),)).toSorted();
  console.log(`Campaign over ${String(files.length,)} property files, ${String(numRuns,)} runs each per round; Ctrl-C to stop`,);
  await mkdir(failureDir, { recursive: true, },);
  for (let round = 1; round <= Number.MAX_SAFE_INTEGER; round += 1) {
    /**
     Seed shared by every file this round.
     */
    const seed = randomInt(SEED_BOUND,);
    for (const file of files) {
      /**
       Outcome of this file's round.
       */
      const outcome = runFile({ file, numRuns, seed, },);
      if (outcome.status !== 0) {
        /**
         Replay record location, unique per failure.
         */
        const recordPath = join(failureDir, `${new Date().toISOString().replaceAll(':', '-',)}-seed-${String(seed,)}.json`,);
        await writeFile(recordPath, `${JSON.stringify({ file, numRuns, output: outcome.output, round, seed, status: outcome.status, }, undefined, 2,)}\n`,);
        console.error(outcome.output,);
        throw new CampaignFailure(recordPath,);
      }
    }
    console.log(`round ${String(round,)} passed (seed ${String(seed,)})`,);
  }
  throw new Error('Campaign exhausted Number.MAX_SAFE_INTEGER rounds',);
}

if (import.meta.main)
  await runCampaign();
