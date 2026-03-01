/**
 * Factory for code-generation probes.
 *
 * Eliminates the per-probe boilerplate: lint/container caches, extractCode calls,
 * container execution, cache updates, buildFixPrompt wiring, and performance scoring.
 * Each probe only supplies its name, prompt, test input, output verifier, and
 * optional perf test configuration.
 */
import { runInContainer, } from '../container.ts';

import { buildPerfDiagnostic, computePerfScore, runInContainerTimed, } from './perf.ts';
import { CODE_GEN_SYSTEM, } from './system-prompt.ts';
import { buildCodeGenFixPrompt, combinedScore, extractCode, lintAndLog, } from './scoring.ts';

import type { ContainerResult, } from '../container.ts';
import type { LintResult, } from '../linter.ts';
import type { Probe, ScoreContext, } from '../probes.ts';
import type { PerfTestConfig, TimedContainerResult, } from './perf.ts';

/**
 * Verification result returned by a probe's output checker.
 * Correctness is a 0-1 fraction; the factory combines it with lint quality.
 */
export type VerifyResult = {
  /** 0-1 correctness fraction from output verification */
  readonly correctness: number;
};

/**
 * Configuration for a standard code-gen probe.
 *
 * The factory handles caching, container execution, linting, buildFixPrompt,
 * and optional performance testing. Probes only supply what varies.
 */
export type CodeGenProbeConfig = {
  /** Human-readable probe name for reporting and log prefixes */
  readonly name: string;
  /** User message that forms the probe prompt */
  readonly prompt: string;
  /** Stdin data piped to the generated program in the container */
  readonly testInput: string;
  /**
   * Verifies container output and returns a correctness fraction.
   * Called only when the container exits successfully (exit 0, no timeout).
   * @param result - container execution result with stdout/stderr
   * @returns correctness score between 0 and 1
   */
  readonly verify: (result: ContainerResult) => VerifyResult;
  /** Whether this probe involves long-running execution */
  readonly slow?: boolean;
  /**
   * Optional performance test configuration. When provided, the factory runs a
   * second container with larger input in parallel with the correctness test,
   * measures wall-clock time, and applies the perf score as a multiplier.
   * Performance diagnostics are included in the fix prompt when the score is below 1.0.
   */
  readonly perfTest?: PerfTestConfig;
  /**
   * Optional hook to transform the source after extraction but before execution.
   * Returning `{ reject: true }` forces score to 0 (e.g. constraint violations).
   * @param source - extracted TypeScript source
   * @param context - model identity and pass info
   * @returns transformed source or rejection signal
   */
  readonly transformSource?: (source: string, context: ScoreContext) => { readonly reject: boolean; readonly source: string };
  /**
   * Optional hook to customize the fix prompt beyond the standard buildCodeGenFixPrompt.
   * Receives the base fix prompt (or undefined if no diagnostics) and returns
   * the final prompt to send. Returning undefined skips the second pass.
   * @param base - standard fix prompt from buildCodeGenFixPrompt, or undefined
   * @param context - model identity and pass info
   * @returns modified fix prompt, or undefined to skip
   */
  readonly customizeFixPrompt?: (base: string | undefined, context: ScoreContext) => string | undefined;
};

/**
 * Creates a code-gen probe with standardized caching, container execution, scoring,
 * and optional performance testing.
 *
 * Each probe created by this factory gets its own isolated lint, container, and
 * perf caches. The factory wires up `score` and `buildFixPrompt` automatically,
 * delegating only the output verification logic to the caller-provided `verify`.
 *
 * When `perfTest` is configured, the factory:
 * 1. Runs `runInContainerTimed` in parallel with correctness + lint
 * 2. Applies the perf score (0-1) as a direct multiplier on the combined score
 * 3. Appends perf diagnostics to the fix prompt when the implementation is slow
 * @param config - probe-specific configuration
 * @returns fully wired Probe instance
 *
 * @example
 * ```ts
 * const myProbe = createCodeGenProbe({
 *   name: 'my-probe',
 *   prompt: 'Write a TypeScript CLI that...',
 *   testInput: 'hello\n',
 *   verify: (result) => ({ correctness: result.stdout.trim() === 'hello' ? 1 : 0 }),
 *   perfTest: { input: bigInput, expectedOutput: bigOutput, fastMs: 2000, slowMs: 8000 },
 * });
 * ```
 */
export function createCodeGenProbe(config: CodeGenProbeConfig): Probe {
  const lintCache = new Map<string, LintResult>();
  const containerCache = new Map<string, ContainerResult>();
  const perfCache = new Map<string, TimedContainerResult>();

  const slowProp = config.slow !== undefined ? { slow: config.slow, } : {};

  return {
    name: config.name,
    category: 'code-gen',
    system: CODE_GEN_SYSTEM,
    prompt: config.prompt,
    ...slowProp,

    buildFixPrompt: async (response, context) => {
      const base = await buildCodeGenFixPrompt(
        response, context,
        lintCache.get(context.modelId),
        containerCache.get(context.modelId),
      );

      // Apply probe-specific customization first (e.g. constraint violation messages)
      const customized = config.customizeFixPrompt !== undefined
        ? config.customizeFixPrompt(base, context)
        : base;

      // Append perf diagnostics when a perf test is configured and the result was slow
      if (config.perfTest === undefined) return customized;
      const perf = perfCache.get(context.modelId);
      if (perf === undefined) return customized;
      const perfDiag = buildPerfDiagnostic(perf, config.perfTest);
      if (perfDiag === undefined) return customized;

      if (customized !== undefined) {
        return `${customized}\n\n${perfDiag}\n\nFix all the issues including the performance problem above. Output ONLY the complete fixed TypeScript source in a single fenced code block.`;
      }

      // No lint/runtime issues but perf is slow -- create a standalone perf fix prompt
      return [
        'Here is your code from the previous response:',
        '',
        '```typescript',
        extractCode(response),
        '```',
        '',
        perfDiag,
        '',
        'Fix the performance issue. Output ONLY the complete fixed TypeScript source in a single fenced code block.',
      ].join('\n');
    },

    score: async (response, context) => {
      const rawSource = extractCode(response);
      const transformed = config.transformSource !== undefined
        ? config.transformSource(rawSource, context)
        : { reject: false, source: rawSource, };

      const source = transformed.source;

      // Build parallel container runs: correctness + lint, and optionally perf
      const correctnessPromise = runInContainer(source, config.testInput, context.signal);
      const lintPromise = lintAndLog(source, config.name, context);
      const perfPromise = config.perfTest !== undefined
        ? runInContainerTimed(source, config.perfTest.input, context.signal)
        : undefined;

      const [result, lint, perfResult] = await Promise.all([
        correctnessPromise,
        lintPromise,
        ...(perfPromise !== undefined ? [perfPromise] : []),
      ]) as [ContainerResult, LintResult, TimedContainerResult | undefined];

      lintCache.set(context.modelId, lint);
      containerCache.set(context.modelId, result);

      // Compute and log perf score when configured
      // perfMultiplier is let because it starts at 1.0 (no perf test) and is
      // conditionally reassigned when a perf test produces a result
      let perfMultiplier = 1;
      if (config.perfTest !== undefined && perfResult !== undefined) {
        perfCache.set(context.modelId, perfResult);
        perfMultiplier = computePerfScore(perfResult, config.perfTest);
        console.log(
          `  [${context.modelId}:${config.name}] perf: ${String(perfResult.durationMs)}ms score=${perfMultiplier.toFixed(2)}`,
        );
      }

      if (transformed.reject) return combinedScore(0, lint) * perfMultiplier;
      if (result.timedOut || result.exitCode !== 0) {
        console.log(`  [${context.modelId}:${config.name}] container failed: exit=${String(result.exitCode)} timedOut=${String(result.timedOut)}`);
        return combinedScore(0, lint) * perfMultiplier;
      }

      const { correctness, } = config.verify(result);
      return combinedScore(correctness, lint) * perfMultiplier;
    },
  };
}
