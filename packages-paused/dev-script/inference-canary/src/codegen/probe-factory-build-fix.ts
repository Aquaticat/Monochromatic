/**
 * Fix prompt implementation for code-generation probes.
 *
 * Assembles a fix prompt from cached lint/container results, additional run
 * diagnostics, probe-specific customization, and performance diagnostics.
 * Extracted from the probe factory to keep each module under the line limit.
 */
import { buildPerfDiagnostic, } from './perf.ts';
import {
  appendAdditionalRunDiagnostics,
} from './probe-factory-additional-diagnostics.ts';
import {
  buildCodeGenFixPrompt,
  extractCode,
} from './scoring.ts';

import type { ScoreContext, } from '../probes.ts';
import type {
  CodeGenProbeConfig,
  ReadonlyProbeFactoryCaches,
} from './probe-factory-types.ts';

/**
 * Options for {@link buildFixPromptImpl}.
 *
 * @example
 * ```ts
 * const options: BuildFixPromptImplOptions = {
 *   config: probeConfig,
 *   response: 'raw model text',
 *   context: scoreContext,
 *   caches: probeFactoryCaches,
 * };
 * ```
 */
type BuildFixPromptImplOptions = {
  /**
   * Probe configuration with verify, perfTest, and customizeFixPrompt hooks
   */
  readonly config: CodeGenProbeConfig;
  /**
   * Raw model response text
   */
  readonly response: string;
  /**
   * Scoring context with model label for cache lookups
   */
  readonly context: ScoreContext;
  /**
   * Shared per-model caches for lint, container, perf, and additional runs (read-only)
   */
  readonly caches: ReadonlyProbeFactoryCaches;
};

/**
 * Builds a fix prompt for a code-generation probe using cached results.
 *
 * Combines standard lint/runtime diagnostics, additional run failure diagnostics,
 * probe-specific customization, and performance diagnostics into a single prompt
 * that guides the model toward fixing all issues in one pass.
 *
 * @param config - probe configuration with verify, perfTest, and customizeFixPrompt hooks
 *
 * @param response - raw model response text
 *
 * @param context - scoring context with model label for cache lookups
 *
 * @param caches - shared per-model caches for lint, container, perf, and additional runs
 *
 * @returns fix prompt string, or empty string when no issues were detected
 *
 * @example
 * ```ts
 * const prompt = await buildFixPromptImpl({ config, response, context, caches });
 * if (prompt !== '') sendFixTurn(prompt);
 * ```
 */
export async function buildFixPromptImpl({
  config,
  response,
  context,
  caches,
}: BuildFixPromptImplOptions,): Promise<string> {
  /**
   * Reused lint result for this model from the scoring phase, when present.
   */
  const priorLint = caches.lint
    .get(context.label,);
  /**
   * Reused container result for this model from the scoring phase, when present.
   */
  const priorContainer = caches.container
    .get(context.label,);
  /**
   * Base fix prompt from standard lint/runtime diagnostics
   */
  const base = await buildCodeGenFixPrompt({
    response,
    context,
    ...((priorLint !== undefined) ? { priorLint, } : {}),
    ...((priorContainer !== undefined) ? { priorContainer, } : {}),
  },);

  // Append additional run diagnostics when runs failed or produced incorrect output
  /**
   * Fix prompt with additional run failure diagnostics appended
   */
  const withAdditional = appendAdditionalRunDiagnostics({
    base,
    runs: config.additionalRuns
      ?? [],
    containerCaches: caches.additionalContainers,
    verifyCaches: caches.additionalVerify,
    label: context.label,
  },);

  // Apply probe-specific customization (e.g. constraint violation messages)
  /**
   * Fix prompt after probe-specific customizeFixPrompt hook
   */
  const customized = config.customizeFixPrompt
    !== undefined
    ? config.customizeFixPrompt(
      withAdditional,
      context,
    )
    : withAdditional;

  // Append perf diagnostics when a perf test is configured and the result was slow
  if (config.perfTest
    === undefined)
    return customized;
  /**
   * Cached perf result for this model
   */
  const perf = caches.perf
    .get(context.label,);
  if (perf === undefined)
    return customized;
  /**
   * Formatted performance diagnostic text, empty string when perf was acceptable
   */
  const perfDiag = buildPerfDiagnostic({
    perfResult: perf,
    config: config.perfTest,
  },);
  if (perfDiag === '')
    return customized;

  if (customized !== '')
    return `${customized}\n\n${perfDiag}\n\nFix all the issues including the performance problem above. Output ONLY the complete fixed TypeScript source in a single fenced code block.`;

  // No lint/runtime issues but perf is slow: create a standalone perf fix prompt
  return [
    'Here is your code from the previous response:',
    '',
    '```typescript',
    extractCode(response,),
    '```',
    '',
    perfDiag,
    '',
    'Fix the performance issue. Output ONLY the complete fixed TypeScript source in a single fenced code block.',
  ]
    .join('\n',);
}
