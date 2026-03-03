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
import { appendAdditionalRunDiagnostics, } from './probe-factory-additional.ts';
import { CODE_GEN_SYSTEM, } from './system-prompt.ts';
import { buildCodeGenFixPrompt, combinedScore, extractCode, lintAndLog, } from './scoring.ts';

import type { ContainerResult, } from '../container.ts';
import type { LintResult, } from '../linter.ts';
import type { Probe, ScoreContext, } from '../probes.ts';
import type { PerfTestConfig, TimedContainerResult, } from './perf.ts';
import type { CodeGenProbeConfig, VerifyResult, } from './probe-factory-types.ts';

export type { AdditionalRun, CodeGenProbeConfig, VerifyResult, } from './probe-factory-types.ts';

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
  const additionalContainerCaches: Map<string, ContainerResult>[] =
    (config.additionalRuns ?? []).map(() => new Map());
  const additionalVerifyCaches: Map<string, VerifyResult>[] =
    (config.additionalRuns ?? []).map(() => new Map());

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

      // Append additional run diagnostics when runs failed or produced incorrect output
      const withAdditional = appendAdditionalRunDiagnostics(
        base, response, config.additionalRuns, additionalContainerCaches,
        additionalVerifyCaches, context.modelId,
      );

      // Apply probe-specific customization (e.g. constraint violation messages)
      const customized = config.customizeFixPrompt !== undefined
        ? config.customizeFixPrompt(withAdditional, context)
        : withAdditional;

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

      // Build parallel container runs: correctness + lint + perf + additional runs
      const correctnessPromise = runInContainer(source, config.testInput, context.signal);
      const lintPromise = lintAndLog(source, config.name, context);
      const perfPromise = config.perfTest !== undefined
        ? runInContainerTimed(source, config.perfTest.input, context.signal)
        : undefined;
      const additionalRunPromises = (config.additionalRuns ?? []).map((run) => {
        const runSource = run.transformSource !== undefined ? run.transformSource(source) : source;
        return runInContainer(runSource, run.input, context.signal);
      });

      const [result, lint, perfResult] = await Promise.all([
        correctnessPromise,
        lintPromise,
        ...(perfPromise !== undefined ? [perfPromise] : []),
      ]) as [ContainerResult, LintResult, TimedContainerResult | undefined];
      const additionalResults = await Promise.all(additionalRunPromises);

      lintCache.set(context.modelId, lint);
      containerCache.set(context.modelId, result);

      // Cache additional run results and verify successful ones
      for (const [index, additionalResult] of additionalResults.entries()) {
        additionalContainerCaches[index]?.set(context.modelId, additionalResult);
        const run = config.additionalRuns?.[index];
        if (run !== undefined && additionalResult.exitCode === 0 && !additionalResult.timedOut) {
          additionalVerifyCaches[index]?.set(context.modelId, run.verify(additionalResult));
        }
      }

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

      const { correctness: mainCorrectness, } = config.verify(result);

      // Combine main and additional run correctness via Math.min --
      // every run must achieve perfect correctness for a non-zero final score
      const additionalCorrectnesses = additionalResults.map((additionalResult, index) => {
        if (additionalResult.timedOut || additionalResult.exitCode !== 0) {
          const run = config.additionalRuns?.[index];
          console.log(
            `  [${context.modelId}:${config.name}:${run?.name ?? String(index)}] container failed: exit=${String(additionalResult.exitCode)} timedOut=${String(additionalResult.timedOut)}`,
          );
          return 0;
        }
        return additionalVerifyCaches[index]?.get(context.modelId)?.correctness ?? 0;
      });

      const overallCorrectness = Math.min(mainCorrectness, ...additionalCorrectnesses);
      return combinedScore(overallCorrectness, lint) * perfMultiplier;
    },
  };
}
