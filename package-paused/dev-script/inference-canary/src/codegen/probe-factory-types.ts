/**
 * Configuration type for code-generation probes.
 *
 * Defines the shape that individual probes pass to `createCodeGenProbe`. The factory
 * handles caching, container execution, linting, fix prompts, and scoring;
 * probes only supply what varies (name, prompt, test input, verifier, hooks).
 */
import type { LintResult, } from '../linter.ts';
import type { ScoreContext, } from '../probes.ts';
import type {
  AdditionalRun,
  VerifyResult,
} from './additional-run-types.ts';
import type {
  PerfTestConfig,
  TimedContainerResult,
} from './perf.ts';

import type { ContainerResult, } from '../container.ts';

/**
 * Configuration for a standard code-gen probe.
 *
 * The factory handles caching, container execution, linting, buildFixPrompt,
 * and optional performance testing. Probes only supply what varies.
 */
export type CodeGenProbeConfig = {
  /**
   * Human-readable probe name for reporting and log prefixes
   */
  readonly name: string;
  /**
   * User message that forms the probe prompt
   */
  readonly prompt: string;
  /**
   * Stdin data piped to the generated program in the container
   */
  readonly testInput: string;
  /**
   * Verifies container output and returns a correctness fraction.
   * Called only when the container exits successfully (exit 0, no timeout).
   * @param result - container execution result with stdout/stderr
   * @returns correctness score between 0 and 1
   */
  readonly verify: (result: ContainerResult,) => VerifyResult;
  /**
   * Whether this probe involves long-running execution
   */
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
  readonly transformSource?: (
    source: string,
    context: ScoreContext,
  ) => {
    readonly reject: boolean;
    readonly source: string;
  };
  /**
   * Optional hook to customize the fix prompt beyond the standard buildCodeGenFixPrompt.
   * Receives the base fix prompt (empty string if no diagnostics) and returns
   * the final prompt to send. Returning empty string skips the second pass.
   * @param base - standard fix prompt from buildCodeGenFixPrompt, or empty string
   * @param context - model identity and pass info
   * @returns modified fix prompt, or empty string to skip
   */
  readonly customizeFixPrompt?: (
    base: string,
    context: ScoreContext,
  ) => string;
  /**
   * Optional additional container runs for testing the generated code under different
   * conditions. Each run can transform the source (e.g. inject CLI flags) and use
   * different stdin input. All runs execute in parallel with the main correctness test.
   *
   * Correctness from all runs is combined via `Math.min`: every run must pass
   * for the probe to score above zero.
   */
  readonly additionalRuns?: readonly AdditionalRun[];
};

/**
 * Shared per-model caches used by the probe factory's `buildFixPrompt` and `score` closures.
 * Both closures read and write these caches, which is why they are bundled together
 * and passed as a single object rather than individual parameters.
 */
export type ProbeFactoryCaches = {
  /**
   * Per-model lint result cache, populated by score() and read by buildFixPrompt()
   */
  readonly lint: Map<string, LintResult>;
  /**
   * Per-model main container result cache
   */
  readonly container: Map<string, ContainerResult>;
  /**
   * Per-model perf container result cache
   */
  readonly perf: Map<string, TimedContainerResult>;
  /**
   * Per-additional-run container result caches, indexed by run position
   */
  readonly additionalContainers: Map<string, ContainerResult>[];
  /**
   * Per-additional-run verification result caches, indexed by run position
   */
  readonly additionalVerify: Map<string, VerifyResult>[];
};

/**
 * A cache the holder may write into: a {@link ReadonlyMap} plus the single `set`
 * mutator, expressed as a readonly property holding `Map.set`. The
 * `prefer-readonly-parameter-types` rule treats the function-valued property as
 * immutable (just as it does for a method reference), so a parameter of this type
 * counts as deeply readonly, while a real `Map` remains structurally assignable
 * and the type is still assignable to {@link ReadonlyMap} for read-only consumers.
 */
export type WritableCache<K, V> = ReadonlyMap<K, V> & {
  readonly set: Map<K, V>['set'];
};

/**
 * Caches view for the probe factory's `score` closure, which populates caches as
 * it runs. Mirrors {@link ProbeFactoryCaches} but uses {@link WritableCache} so
 * the parameter stays deeply readonly without forbidding `.set`.
 */
export type WritableProbeFactoryCaches = {
  /**
   * Per-model lint result cache
   */
  readonly lint: WritableCache<string, LintResult>;
  /**
   * Per-model main container result cache
   */
  readonly container: WritableCache<string, ContainerResult>;
  /**
   * Per-model perf container result cache
   */
  readonly perf: WritableCache<string, TimedContainerResult>;
  /**
   * Per-additional-run container result caches, indexed by run position
   */
  readonly additionalContainers: readonly WritableCache<string, ContainerResult>[];
  /**
   * Per-additional-run verification result caches, indexed by run position
   */
  readonly additionalVerify: readonly WritableCache<string, VerifyResult>[];
};

/**
 * Read-only view of {@link ProbeFactoryCaches} for consumers that only look up
 * cached results (e.g. `buildFixPrompt`). A real {@link ProbeFactoryCaches} is
 * structurally assignable to this, keeping the parameter deeply readonly.
 */
export type ReadonlyProbeFactoryCaches = {
  /**
   * Per-model lint result cache (read-only)
   */
  readonly lint: ReadonlyMap<string, LintResult>;
  /**
   * Per-model main container result cache (read-only)
   */
  readonly container: ReadonlyMap<string, ContainerResult>;
  /**
   * Per-model perf container result cache (read-only)
   */
  readonly perf: ReadonlyMap<string, TimedContainerResult>;
  /**
   * Per-additional-run container result caches (read-only)
   */
  readonly additionalContainers: readonly ReadonlyMap<string, ContainerResult>[];
  /**
   * Per-additional-run verification result caches (read-only)
   */
  readonly additionalVerify: readonly ReadonlyMap<string, VerifyResult>[];
};
