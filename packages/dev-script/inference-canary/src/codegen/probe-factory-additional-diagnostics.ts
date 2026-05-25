/**
 * Fix-prompt diagnostics for additional container runs.
 *
 * Formats runtime failures and incorrect output from additional runs
 * into diagnostic sections that are appended to the base fix prompt.
 */
import type { ContainerResult, } from '../container.ts';
import type {
  AdditionalRun,
  VerifyResult,
} from './additional-run-types.ts';

/** Maximum characters of additional run output to include in fix prompts */
const MAX_ADDITIONAL_OUTPUT = 500;

/**
 * Options for {@link appendAdditionalRunDiagnostics}.
 *
 * @example
 * ```ts
 * const options: AppendAdditionalRunDiagnosticsOptions = {
 *   base: 'lint diagnostics',
 *   runs: probe.additionalRuns,
 *   containerCaches,
 *   verifyCaches,
 *   label: 'Opus',
 * };
 * ```
 */
type AppendAdditionalRunDiagnosticsOptions = {
  /** Base fix prompt from buildCodeGenFixPrompt (may be undefined) */
  readonly base: string | undefined;
  /** Additional run configurations */
  readonly runs: readonly AdditionalRun[] | undefined;
  /** Per-run container result caches */
  readonly containerCaches: readonly Map<string, ContainerResult>[];
  /** Per-run verification result caches */
  readonly verifyCaches: readonly Map<string, VerifyResult>[];
  /** Model label for cache lookups */
  readonly label: string;
};

/**
 * Appends diagnostics from additional container runs to the base fix prompt.
 *
 * Includes runtime errors (crash/timeout) and incorrect output summaries for runs
 * that succeeded at runtime but failed verification. Skips runs that passed.
 *
 * @param base - base fix prompt from buildCodeGenFixPrompt (may be undefined)
 *
 * @param runs - additional run configurations
 *
 * @param containerCaches - per-run container result caches
 *
 * @param verifyCaches - per-run verification result caches
 *
 * @param label - model label for cache lookups
 *
 * @returns augmented fix prompt, or base unchanged when no additional diagnostics exist
 *
 * @example
 * ```ts
 * const enhanced = appendAdditionalRunDiagnostics({ base, runs, containerCaches, verifyCaches, label });
 * ```
 */
export function appendAdditionalRunDiagnostics({
  base,
  runs,
  containerCaches,
  verifyCaches,
  label,
}: AppendAdditionalRunDiagnosticsOptions,): string | undefined {
  if ((runs === undefined) || (runs.length
    === 0))
    return base;

  /** Diagnostic text sections for runs that failed or produced incorrect output */
  const diagSections = runs
    .map(function buildDiagSection(
      run,
      index,
    ): string | undefined {
      /** Cached container result for this run and model */
      const container = containerCaches[index]
        ?.get(label,);
      if (container === undefined)
        return undefined;
      if (container.timedOut)
        return `=== ${run.name} ===\nProcess timed out.`;
      if (container.exitCode
        !== 0) {
        return `=== ${run.name} ===\nExited with code ${String(container.exitCode,)}.\n${
          container.stderr
            .slice(
            0,
            MAX_ADDITIONAL_OUTPUT,
          )
        }`;
      }
      /** Cached verification result for this run and model */
      const verify = verifyCaches[index]
        ?.get(label,);
      if ((verify !== undefined) && (verify.correctness
        < 1)) {
        return `=== ${run.name} (incorrect output) ===\n${
          container.stdout
            .slice(
            0,
            MAX_ADDITIONAL_OUTPUT,
          )
        }`;
      }
      return undefined;
    },)
    .filter(function isDefined(diagSection,): diagSection is string {
      return diagSection !== undefined;
    },);

  if (diagSections.length
    === 0)
    return base;
  /** Combined diagnostic text from all failing additional runs */
  const combined = diagSections.join('\n\n',);
  if (base !== undefined)
    return `${base}\n\n${combined}`;

  // Main run was fine but additional runs failed: build standalone prompt
  return [
    'Your code from the previous response has issues.',
    combined,
    '',
    'Fix all the issues. Output ONLY the complete fixed TypeScript source in a single fenced code block.',
  ]
    .join('\n',);
}
