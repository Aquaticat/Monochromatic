/**
 * CLI argument parsing for the inference canary entry point.
 *
 * Uses @optique/core (type-safe combinatorial parser) and @optique/run (automatic
 * process.argv integration) instead of manual index/includes on process.argv.
 */
import { object, } from '@optique/core/constructs';
import { optional, } from '@optique/core/modifiers';
import { option, } from '@optique/core/primitives';
import {
  integer,
  string,
} from '@optique/core/valueparser';
import { runSync, } from '@optique/run';

//region Parser definition: defines all recognized CLI flags and their value parsers

/**
 * Optique object parser covering every supported CLI flag
 */
const parser = object({
  model: optional(option(
    '--model',
    string(),
  ),),
  runs: optional(option(
    '--runs',
    integer(),
  ),),
  probe: optional(option(
    '--probe',
    string(),
  ),),
  simple: option('--simple',),
  slow: option('--slow',),
  retestAll: option('--retest-all',),
},);

//endregion Parser definition

//region Parsed arguments: module-level exports consumed by index.ts

/**
 * Parsed CLI arguments from process.argv
 */
const cliArgs = runSync(
  parser,
  {
    programName: 'inference-canary',
    help: 'option',
  },
);

/**
 * Validates a parsed `--runs` value, returning it unchanged.
 *
 * @param runs - parsed `--runs` integer
 *
 * @returns validated run count
 *
 * @throws when `runs` is below 1, since that produces empty score arrays
 *
 * @example
 * ```ts
 * validatedRuns(3); // 3
 * ```
 */
function validatedRuns(runs: number,): number {
  if (runs < 1)
    throw new Error(`--runs must be >= 1, got ${String(runs,)}`,);
  return runs;
}

/**
 * Parses a comma-separated `--probe` value into a set of trimmed, non-empty names.
 *
 * @param raw - raw `--probe` flag value
 *
 * @returns set of probe names to run exclusively
 *
 * @example
 * ```ts
 * parseProbeNames('a, b'); // Set { 'a', 'b' }
 * ```
 */
function parseProbeNames(raw: string,): ReadonlySet<string> {
  return new Set(raw
    .split(',',)
    .map(function trimName(name,): string {
      return name.trim();
    },)
    .filter(function nonEmpty(name,): boolean {
      return name !== '';
    },),);
}

/**
 * Single-model override from --model flag (matches by label, e.g. "Opus 4.6 medium"); empty string when unset
 */
export const modelOverride: string = ((typeof cliArgs.model) === 'string')
  ? cliArgs.model
  : '';

/**
 * Consistency runs override from --runs flag, validated to be \>= 1 to prevent empty score arrays; 0 when unset
 */
export const runsOverride: number = ((typeof cliArgs.runs) === 'number')
  ? validatedRuns(cliArgs.runs,)
  : 0;

/**
 * Comma-separated probe names to run exclusively (e.g. `stak-interpreter,stak-simulation`).
 * When set, only matching probes run and recent-result caching is bypassed for them.
 * An empty set means no `--probe` filter was given, so all probes run.
 */
export const probeFilter: ReadonlySet<string> = ((typeof cliArgs.probe) === 'string')
  ? parseProbeNames(cliArgs.probe,)
  : new Set<string>();

/**
 * Whether to run simple probes instead of code-gen
 */
export const useSimple: boolean = cliArgs.simple;

/**
 * Whether to include slow probes
 */
export const includeSlow: boolean = cliArgs.slow;

/* oxlint-disable eslint/prefer-destructuring -- exported const with explicit type annotation is incompatible with destructuring in TS */
/**
 * Retest all models even if they have recent (less than 24h) results
 */
export const retestAll: boolean = cliArgs.retestAll;
/* oxlint-enable eslint/prefer-destructuring */

//endregion Parsed arguments
