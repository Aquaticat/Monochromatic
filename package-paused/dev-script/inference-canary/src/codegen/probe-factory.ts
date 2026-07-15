/**
 * Factory for code-generation probes.
 *
 * Eliminates the per-probe boilerplate: lint/container caches, extractCode calls,
 * container execution, cache updates, buildFixPrompt wiring, and performance scoring.
 * Each probe only supplies its name, prompt, test input, output verifier, and
 * optional perf test configuration.
 */
import type { ContainerResult, } from '../container.ts';
import { buildFixPromptImpl, } from './probe-factory-build-fix.ts';
import { scoreImpl, } from './probe-factory-run-score.ts';
import { CODE_GEN_SYSTEM, } from './system-prompt.ts';

import type { LintResult, } from '../linter.ts';
import type { Probe, } from '../probes.ts';
import type { VerifyResult, } from './additional-run-types.ts';
import type { TimedContainerResult, } from './perf.ts';
import type {
  CodeGenProbeConfig,
  ProbeFactoryCaches,
} from './probe-factory-types.ts';

export type {
  AdditionalRun,
  VerifyResult,
} from './additional-run-types.ts';
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
export function createCodeGenProbe(config: CodeGenProbeConfig,): Probe {
  /**
   * Per-model caches shared between buildFixPrompt and score closures
   */
  const caches: ProbeFactoryCaches = {
    lint: new Map<string, LintResult>(),
    container: new Map<string, ContainerResult>(),
    perf: new Map<string, TimedContainerResult>(),
    additionalContainers: (config.additionalRuns
      ?? []).map(
      function createContainerCache(): Map<string, ContainerResult> {
        return new Map();
      },
    ),
    additionalVerify: (config.additionalRuns
      ?? []).map(
      function createVerifyCache(): Map<string, VerifyResult> {
        return new Map();
      },
    ),
  };

  /**
   * Spread-friendly slow property, omitted when config.slow is undefined
   */
  const slowProp = config.slow
    !== undefined ? { slow: config.slow, } : {};

  return {
    name: config.name,
    category: 'code-gen',
    system: CODE_GEN_SYSTEM,
    prompt: config.prompt,
    ...slowProp,

    buildFixPrompt: function buildFixPrompt(
      response,
      context,
    ): Promise<string> {
      return buildFixPromptImpl({
        config,
        response,
        context,
        caches,
      },);
    },

    score: function score(
      response,
      context,
    ): Promise<number> {
      return scoreImpl({
        config,
        response,
        context,
        caches,
      },);
    },
  };
}
