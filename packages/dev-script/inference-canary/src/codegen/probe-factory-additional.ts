/**
 * Fix-prompt diagnostics for additional container runs.
 *
 * When a probe uses `additionalRuns`, this module formats runtime failures
 * and incorrect output from those runs into diagnostic sections that get
 * appended to the standard fix prompt.
 */
import { extractCode, } from './scoring.ts';

import type { ContainerResult, } from '../container.ts';
import type { AdditionalRun, VerifyResult, } from './probe-factory-types.ts';

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

  const sections = runs
    .map((run, index) => {
      const container = containerCaches[index]?.get(modelId);
      if (container === undefined) return undefined;
      if (container.timedOut) return `=== ${run.name} ===\nProcess timed out.`;
      if (container.exitCode !== 0) {
        return `=== ${run.name} ===\nExited with code ${String(container.exitCode)}.\n${container.stderr.slice(0, MAX_ADDITIONAL_OUTPUT)}`;
      }
      const verify = verifyCaches[index]?.get(modelId);
      if (verify !== undefined && verify.correctness < 1) {
        return `=== ${run.name} (incorrect output) ===\n${container.stdout.slice(0, MAX_ADDITIONAL_OUTPUT)}`;
      }
      return undefined;
    })
    .filter((section): section is string => section !== undefined);

  if (sections.length === 0) return base;
  const diagSection = sections.join('\n\n');
  if (base !== undefined) return `${base}\n\n${diagSection}`;

  // Main run was fine but additional runs failed -- build standalone prompt
  return [
    'Here is your code from the previous response:',
    '',
    '```typescript',
    extractCode(response),
    '```',
    '',
    diagSection,
    '',
    'Fix all the issues. Output ONLY the complete fixed TypeScript source in a single fenced code block.',
  ].join('\n');
}
