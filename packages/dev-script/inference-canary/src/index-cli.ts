/**
 * CLI argument parsing for the inference canary entry point.
 *
 * Uses @optique/core (type-safe combinatorial parser) and @optique/run (automatic
 * process.argv integration) instead of manual index/includes on process.argv.
 */
import { object, } from '@optique/core/constructs';
import { optional, } from '@optique/core/modifiers';
import { option, } from '@optique/core/primitives';
import { integer, string, } from '@optique/core/valueparser';
import { runSync, } from '@optique/run';

//region Parser definition -- defines all recognized CLI flags and their value parsers

/** Optique object parser covering every supported CLI flag */
const parser = object({
  model: optional(option('--model', string())),
  runs: optional(option('--runs', integer())),
  probe: optional(option('--probe', string())),
  simple: option('--simple'),
  slow: option('--slow'),
  retestAll: option('--retest-all'),
});

//endregion Parser definition

//region Parsed arguments -- module-level exports consumed by index.ts

/** Parsed CLI arguments from process.argv */
const cliArgs = runSync(parser, { programName: 'inference-canary', help: 'option', });

/** Single-model override from --model flag */
export const modelOverride: string | undefined =
  typeof cliArgs.model === 'string' ? cliArgs.model : undefined;

/** Consistency runs override from --runs flag, validated to be \>= 1 to prevent empty score arrays */
export const runsOverride: number | undefined = (function parseRunsOverride(): number | undefined {
  if (typeof cliArgs.runs !== 'number') return undefined;
  if (cliArgs.runs < 1) throw new Error(`--runs must be >= 1, got ${String(cliArgs.runs)}`);
  return cliArgs.runs;
})();

/**
 * Comma-separated probe names to run exclusively (e.g. `stak-interpreter,stak-simulation`).
 * When set, only matching probes run and recent-result caching is bypassed for them.
 */
export const probeFilter: ReadonlySet<string> | undefined = (function parseProbeFilter(): ReadonlySet<string> | undefined {
  if (typeof cliArgs.probe !== 'string') return undefined;
  return new Set(cliArgs.probe.split(',').map(function trimName(name): string { return name.trim(); }).filter(function nonEmpty(name): boolean { return name !== ''; }));
})();

/** Whether to run simple probes instead of code-gen */
export const useSimple =  cliArgs.simple;

/** Whether to include slow probes */
export const includeSlow =  cliArgs.slow;

/** Retest all models even if they have recent (<24h) results */
export const {retestAll} = cliArgs;

//endregion Parsed arguments
