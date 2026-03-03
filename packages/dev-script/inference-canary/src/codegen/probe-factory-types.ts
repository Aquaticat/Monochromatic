/**
 * Type definitions for code-generation probe configuration.
 *
 * Shared by the probe factory, additional-run diagnostics, and individual probes.
 * Separated from the factory implementation so types can be imported without
 * pulling in runtime dependencies (container, linter, system prompt).
 */
import type { ContainerResult, } from '../container.ts';
import type { ScoreContext, } from '../probes.ts';
import type { PerfTestConfig, } from './perf.ts';

/**
 * Verification result returned by a probe's output checker.
 * Correctness is a 0-1 fraction; the factory combines it with lint quality.
 */
export type VerifyResult = {
  /** 0-1 correctness fraction from output verification */
  readonly correctness: number;
};

/**
 * Configuration for an additional container run within a code-gen probe.
 *
 * Enables testing the same generated code under different conditions (e.g. CLI flags,
 * different input data) without requiring a separate probe. Each additional run
 * executes in parallel with the main correctness test and produces its own
 * container result and verification.
 */
export type AdditionalRun = {
  /** Human-readable label for diagnostics and fix prompt sections */
  readonly name: string;
  /** Stdin data piped to the generated program */
  readonly input: string;
  /**
   * Transforms source before execution in this run.
   * Applied after the main `transformSource` (if any).
   * @param source - TypeScript source after main transform
   * @returns modified source for this specific run
   *
   * @example
   * ```ts
   * transformSource: (source) => `process.argv.push("--all");\n${source}`
   * ```
   */
  readonly transformSource?: (source: string) => string;
  /**
   * Verifies container output and returns a correctness fraction.
   * Called only when the container exits successfully (exit 0, no timeout).
   * @param result - container execution result with stdout/stderr
   * @returns correctness score between 0 and 1
   */
  readonly verify: (result: ContainerResult) => VerifyResult;
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
  /**
   * Optional additional container runs for testing the generated code under different
   * conditions. Each run can transform the source (e.g. inject CLI flags) and use
   * different stdin input. All runs execute in parallel with the main correctness test.
   *
   * Correctness from all runs is combined via `Math.min` -- every run must pass
   * for the probe to score above zero.
   */
  readonly additionalRuns?: readonly AdditionalRun[];
};
