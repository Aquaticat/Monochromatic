// Over 100 lines because this is the single home for all additional-run lifecycle logic:
// diagnostics, execution, caching, and scoring. Splitting would scatter the lifecycle.
/**
 * Additional container run execution, caching, scoring, and fix-prompt diagnostics.
 *
 * When a probe uses `additionalRuns`, this module handles the full lifecycle:
 * launching parallel container runs, caching results, verifying output,
 * computing per-run correctness, and formatting diagnostic sections for
 * the fix prompt.
 */
import { runInContainer, } from '../container.ts';
import { extractCode, } from './scoring.ts';

import type { ContainerResult, } from '../container.ts';
import type { AdditionalRun, VerifyResult, } from './additional-run-types.ts';

//region Diagnostics -- formats runtime failures and incorrect output for fix prompts

/** Maximum characters of additional run output to include in fix prompts */
const MAX_ADDITIONAL_OUTPUT = 500;

/**
 * Appends diagnostics from additional container runs to the base fix prompt.
 *
 * Includes runtime errors (crash/timeout) and incorrect output summaries for runs
 * that succeeded at runtime but failed verification. Skips runs that passed.
 * @param base - base fix prompt from buildCodeGenFixPrompt (may be undefined)
 * @param response - raw model output for source extraction when building standalone prompt
 * @param runs - additional run configurations
 * @param containerCaches - per-run container result caches
 * @param verifyCaches - per-run verification result caches
 * @param modelId - model identifier for cache lookups
 * @returns augmented fix prompt, or base unchanged when no additional diagnostics exist
 *
 * @example
 * ```ts
 * const enhanced = appendAdditionalRunDiagnostics(base, response, runs, cCaches, vCaches, modelId);
 * ```
 */
export function appendAdditionalRunDiagnostics(
  base: string | undefined,
  response: string,
  runs: readonly AdditionalRun[] | undefined,
  containerCaches: readonly Map<string, ContainerResult>[],
  verifyCaches: readonly Map<string, VerifyResult>[],
  modelId: string,
): string | undefined {
  if (runs === undefined || runs.length === 0) return base;

  /** Diagnostic text sections for runs that failed or produced incorrect output */
  const diagSections = runs
    .map((run, index) => {
      /** Cached container result for this run and model */
      const container = containerCaches[index]?.get(modelId);
      if (container === undefined) return undefined;
      if (container.timedOut) return `=== ${run.name} ===\nProcess timed out.`;
      if (container.exitCode !== 0) {
        return `=== ${run.name} ===\nExited with code ${String(container.exitCode)}.\n${container.stderr.slice(0, MAX_ADDITIONAL_OUTPUT)}`;
      }
      /** Cached verification result for this run and model */
      const verify = verifyCaches[index]?.get(modelId);
      if (verify !== undefined && verify.correctness < 1) {
        return `=== ${run.name} (incorrect output) ===\n${container.stdout.slice(0, MAX_ADDITIONAL_OUTPUT)}`;
      }
      return undefined;
    })
    .filter((diagSection): diagSection is string => diagSection !== undefined);

  if (diagSections.length === 0) return base;
  /** Combined diagnostic text from all failing additional runs */
  const combined = diagSections.join('\n\n');
  if (base !== undefined) return `${base}\n\n${combined}`;

  // Main run was fine but additional runs failed -- build standalone prompt
  return [
    'Here is your code from the previous response:',
    '',
    '```typescript',
    extractCode(response),
    '```',
    '',
    combined,
    '',
    'Fix all the issues. Output ONLY the complete fixed TypeScript source in a single fenced code block.',
  ].join('\n');
}

//endregion Diagnostics

//region Execution -- launches, caches, and scores additional container runs

/**
 * Launches additional container runs in parallel.
 * Applies per-run source transforms before execution.
 * @param source - base TypeScript source (after main transformSource)
 * @param runs - additional run configurations
 * @param signal - abort signal for cancellation
 * @returns promise resolving to container results in the same order as runs
 *
 * @example
 * ```ts
 * const results = await executeAdditionalRuns(source, config.additionalRuns, signal);
 * ```
 */
export function executeAdditionalRuns(
  source: string,
  runs: readonly AdditionalRun[],
  signal: AbortSignal | undefined,
): Promise<ContainerResult[]> {
  /** Per-run container promises with optional source transforms applied */
  const promises = runs.map((run) => {
    /** Source with per-run transform applied (e.g. injected CLI flags) */
    const runSource = run.transformSource !== undefined ? run.transformSource(source) : source;
    return runInContainer(runSource, run.input, signal);
  });
  return Promise.all(promises);
}

/**
 * Caches additional run container results and verifies successful ones.
 * Populates both the container and verify caches for downstream use
 * by diagnostics and correctness scoring.
 * @param results - container results from executeAdditionalRuns
 * @param runs - additional run configurations (for verify functions)
 * @param containerCaches - per-run container result caches to populate
 * @param verifyCaches - per-run verification result caches to populate
 * @param modelId - model identifier for cache keys
 */
export function cacheAdditionalResults(
  results: readonly ContainerResult[],
  runs: readonly AdditionalRun[],
  containerCaches: Map<string, ContainerResult>[],
  verifyCaches: Map<string, VerifyResult>[],
  modelId: string,
): void {
  for (const [index, result] of results.entries()) {
    containerCaches[index]?.set(modelId, result);
    /** Run configuration for this index, used to call verify on successful containers */
    const run = runs[index];
    if (run !== undefined && result.exitCode === 0 && !result.timedOut) {
      verifyCaches[index]?.set(modelId, run.verify(result));
    }
  }
}

/**
 * Computes per-run correctness fractions from cached additional run results.
 * Returns 0 for runs that crashed or timed out, logging the failure.
 * @param results - container results from executeAdditionalRuns
 * @param runs - additional run configurations (for names in log messages)
 * @param verifyCaches - per-run verification caches populated by cacheAdditionalResults
 * @param modelId - model identifier for cache lookups and log prefixes
 * @param probeName - probe name for log prefixes
 * @returns array of correctness fractions (0-1) in the same order as runs
 */
export function computeAdditionalCorrectnesses(
  results: readonly ContainerResult[],
  runs: readonly AdditionalRun[],
  verifyCaches: readonly Map<string, VerifyResult>[],
  modelId: string,
  probeName: string,
): number[] {
  return results.map((result, index) => {
    if (result.timedOut || result.exitCode !== 0) {
      /** Run name for the log message, falls back to numeric index */
      const runName = runs[index]?.name ?? String(index);
      console.log(
        `  [${modelId}:${probeName}:${runName}] container failed: exit=${String(result.exitCode)} timedOut=${String(result.timedOut)}`,
      );
      return 0;
    }
    return verifyCaches[index]?.get(modelId)?.correctness ?? 0;
  });
}

//endregion Execution
