// Over 100 lines because the factory function returns a single object with two closures
// (buildFixPrompt, score) that share cache state. Extracting either closure would require
// passing all caches as parameters, adding complexity without improving cohesion.
/**
 * Factory for code-generation probes.
 *
 * Eliminates the per-probe boilerplate: lint/container caches, extractCode calls,
 * container execution, cache updates, buildFixPrompt wiring, and performance scoring.
 * Each probe only supplies its name, prompt, test input, output verifier, and
 * optional perf test configuration.
 */
import { runInContainer, type ContainerResult, } from '../container.ts';

import { buildPerfDiagnostic, computePerfScore, runInContainerTimed, type PerfTestConfig, type TimedContainerResult, } from './perf.ts';
import {
  appendAdditionalRunDiagnostics,
  cacheAdditionalResults,
  computeAdditionalCorrectnesses,
  executeAdditionalRuns,
} from './probe-factory-additional.ts';
import { CODE_GEN_SYSTEM, } from './system-prompt.ts';
import { buildCodeGenFixPrompt, combinedScore, extractCode, lintAndLog, tryExtractCode, } from './scoring.ts';

import type { LintResult, } from '../linter.ts';
import type { Probe, ScoreContext, } from '../probes.ts';
import type { VerifyResult, } from './additional-run-types.ts';
import type { CodeGenProbeConfig, } from './probe-factory-types.ts';

export type { AdditionalRun, VerifyResult, } from './additional-run-types.ts';
export type { CodeGenProbeConfig, } from './probe-factory-types.ts';

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
 *
 * @param config - probe-specific configuration
 *
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
  /** Per-model lint result cache, populated by score() and read by buildFixPrompt() */
  const lintCache = new Map<string, LintResult>();
  /** Per-model main container result cache */
  const containerCache = new Map<string, ContainerResult>();
  /** Per-model perf container result cache */
  const perfCache = new Map<string, TimedContainerResult>();
  /** Per-additional-run container result caches, indexed by run position */
  const additionalContainerCaches: Map<string, ContainerResult>[] =
    (config.additionalRuns ?? []).map(function createContainerCache(): Map<string, ContainerResult> { return new Map(); });
  /** Per-additional-run verification result caches, indexed by run position */
  const additionalVerifyCaches: Map<string, VerifyResult>[] =
    (config.additionalRuns ?? []).map(function createVerifyCache(): Map<string, VerifyResult> { return new Map(); });

  /** Spread-friendly slow property, omitted when config.slow is undefined */
  const slowProp = config.slow !== undefined ? { slow: config.slow, } : {};

  return {
    name: config.name,
    category: 'code-gen',
    system: CODE_GEN_SYSTEM,
    prompt: config.prompt,
    ...slowProp,

    buildFixPrompt: async function buildFixPrompt(response, context): Promise<string | undefined> {
      /** Base fix prompt from standard lint/runtime diagnostics */
      const base = await buildCodeGenFixPrompt(
        response, context,
        lintCache.get(context.label),
        containerCache.get(context.label),
      );

      // Append additional run diagnostics when runs failed or produced incorrect output
      /** Fix prompt with additional run failure diagnostics appended */
      const withAdditional = appendAdditionalRunDiagnostics(
        base, config.additionalRuns, additionalContainerCaches,
        additionalVerifyCaches, context.label,
      );

      // Apply probe-specific customization (e.g. constraint violation messages)
      /** Fix prompt after probe-specific customizeFixPrompt hook */
      const customized = config.customizeFixPrompt !== undefined
        ? config.customizeFixPrompt(withAdditional, context)
        : withAdditional;

      // Append perf diagnostics when a perf test is configured and the result was slow
      if (config.perfTest === undefined) return customized;
      /** Cached perf result for this model */
      const perf = perfCache.get(context.label);
      if (perf === undefined) return customized;
      /** Formatted performance diagnostic text, undefined when perf was acceptable */
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

    score: async function score(response, context): Promise<number> {
      /** Extraction result: source code and whether a fenced block was found */
      const extraction = tryExtractCode(response);
      if (!extraction.fenced) {
        console.log(`  [${context.label}:${config.name}] no fenced code block found in response`);
        // Still lint the raw response so artifacts are written for debugging,
        // but score is forced to 0 since the model didn't follow the output format.
        await lintAndLog(extraction.source, config.name, context);
        return 0;
      }

      /** Extracted TypeScript source from the model response */
      const rawSource = extraction.source;
      /** Source after probe-level transform, with reject flag for constraint violations */
      const transformed = config.transformSource !== undefined
        ? config.transformSource(rawSource, context)
        : { reject: false, source: rawSource, };

      /** Final source to execute in containers */
      const {source} = transformed;

      // Launch all container runs in parallel: correctness + lint + perf + additional
      /** Main correctness container promise */
      const correctnessPromise = runInContainer(source, config.testInput, context.signal);
      /** Lint analysis promise */
      const lintPromise = lintAndLog(source, config.name, context);
      /** Perf container promise (undefined when no perfTest configured) */
      const perfPromise = config.perfTest !== undefined
        ? runInContainerTimed(source, config.perfTest.input, context.signal)
        : undefined;
      /** Additional run container promises (empty array when no additional runs) */
      const additionalPromise = config.additionalRuns !== undefined
        ? executeAdditionalRuns(source, config.additionalRuns, context.signal)
        : undefined;

      const [result, lint, perfResult, additionalResults] = await Promise.all([
        correctnessPromise,
        lintPromise,
        ...(perfPromise !== undefined ? [perfPromise] : []),
        ...(additionalPromise !== undefined ? [additionalPromise] : []),
      ]) as [ContainerResult, LintResult, TimedContainerResult | undefined, ContainerResult[] | undefined];

      lintCache.set(context.label, lint);
      containerCache.set(context.label, result);

      // Cache and verify additional runs
      if (additionalResults !== undefined && config.additionalRuns !== undefined) {
        cacheAdditionalResults(
          additionalResults, config.additionalRuns,
          additionalContainerCaches, additionalVerifyCaches, context.label,
        );
      }

      // Compute and log perf score when configured
      // perfMultiplier is let because it starts at 1.0 (no perf test) and is
      // conditionally reassigned when a perf test produces a result
      let perfMultiplier = 1;
      if (config.perfTest !== undefined && perfResult !== undefined) {
        perfCache.set(context.label, perfResult);
        perfMultiplier = computePerfScore(perfResult, config.perfTest);
        console.log(
          `  [${context.label}:${config.name}] perf: ${String(perfResult.durationMs)}ms score=${perfMultiplier.toFixed(2)}`,
        );
      }

      if (transformed.reject) return combinedScore(0, lint) * perfMultiplier;
      if (result.timedOut || result.exitCode !== 0) {
        console.log(`  [${context.label}:${config.name}] container failed: exit=${String(result.exitCode)} timedOut=${String(result.timedOut)}`);
        return combinedScore(0, lint) * perfMultiplier;
      }

      const { correctness: mainCorrectness, } = config.verify(result);

      // Combine main and additional run correctness via Math.min --
      // every run must achieve perfect correctness for a non-zero final score
      /** Per-run correctness fractions from additional runs (empty when none configured) */
      const additionalCorrectnesses = additionalResults !== undefined && config.additionalRuns !== undefined
        ? computeAdditionalCorrectnesses(
          additionalResults, config.additionalRuns,
          additionalVerifyCaches, context.label, config.name,
        )
        : [];

      /** Combined correctness: minimum of main and all additional runs */
      const overallCorrectness = Math.min(mainCorrectness, ...additionalCorrectnesses);
      return combinedScore(overallCorrectness, lint) * perfMultiplier;
    },
  };
}
