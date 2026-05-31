/**
 * Types for additional container runs within code-gen probes.
 *
 * Additional runs enable testing the same generated code under different conditions
 * (e.g. CLI flags, different input data) without requiring a separate probe.
 * Separated from the main probe config type so the additional-run execution and
 * diagnostics modules can import these without circular dependencies.
 */
import type { ContainerResult, } from '../container.ts';

/**
 * Verification result returned by a probe's output checker.
 * Correctness is a 0-1 fraction; the factory combines it with lint quality.
 */
export type VerifyResult = {
  /**
   * 0-1 correctness fraction from output verification
   */
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
  /**
   * Human-readable label for diagnostics and fix prompt sections
   */
  readonly name: string;
  /**
   * Stdin data piped to the generated program
   */
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
  readonly transformSource?: (source: string,) => string;
  /**
   * Verifies container output and returns a correctness fraction.
   * Called only when the container exits successfully (exit 0, no timeout).
   * @param result - container execution result with stdout/stderr
   * @returns correctness score between 0 and 1
   */
  readonly verify: (result: ContainerResult,) => VerifyResult;
};
