import { logger as defaultLogger, } from '@monochromatic-dev/module-logger/logger';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import type { Logger, } from '@monochromatic-dev/module-logger/types';

import pLimit from 'p-limit';

import { $ as withTimeout, } from '@monochromatic-dev/module-es/with-timeout';
import type { ItResult, } from './it.ts';

/**
 * Result returned by a completed suite, mirroring {@link ItResult}.
 */
export type DescribeResult = {
  /** Suite name, returned so parent suites can log the hierarchy. */
  readonly name: string;
};

/**
 * Single child entry: either an already-started promise or a thunk that starts one.
 * Thunks are required for `concurrency: 1` so execution is deferred.
 * Bare promises work in all modes but are already running when passed.
 */
export type DescribeChild =
  | Promise<DescribeResult | ItResult>
  | (() => Promise<DescribeResult | ItResult>);

/**
 * Default maximum number of children running at the same time.
 */
const DEFAULT_CONCURRENCY = 16;

/**
 * Options for a test suite.
 */
export type DescribeOptions = {
  /**
   * Child entries from nested {@link describe} or `it` calls.
   * Each child resolves with its name on success so the parent
   * can log the `child <- parent` relationship.
   *
   * Accepts promises (eager) or thunks (deferred).
   * Use thunks with `concurrency: 1` to guarantee execution order.
   */
  readonly children: readonly DescribeChild[];
  /**
   * Maximum number of children running at the same time.
   *
   * - `1` -- sequential execution via `for...of` loop; children should be thunks
   *   so execution is deferred until the previous child settles
   * - `2`..`Number.MAX_SAFE_INTEGER - 1` -- bounded concurrency via `p-limit`
   * - `Infinity` or `Number.MAX_SAFE_INTEGER` -- unbounded concurrency via
   *   raw `Promise.allSettled` (no `p-limit` overhead)
   *
   * **Not inherited by child describes.** Each `describe` has its own
   * `concurrency` defaulting to {@link DEFAULT_CONCURRENCY} (16).
   * When child tests stub shared global state (e.g. prototype methods),
   * set `concurrency: 1` on the innermost `describe` that contains
   * those tests and use thunks (`() => it(...)`) so execution is deferred.
   *
   * Defaults to {@link DEFAULT_CONCURRENCY} (16).
   */
  readonly concurrency?: number;
  /**
   * Logger override. When omitted, a tagged logger derived from
   * the module-es default logger is used.
   */
  readonly l?: Logger;
  /**
   * Suite name shown in output and error cause chain.
   * Set to empty string to make this level invisible in output --
   * the suite still groups and times its children, but adds
   * no name segment to the path. Success logs are downgraded
   * from `info` to `debug` for empty-name suites.
   * Use empty name at the top level since the filename
   * already identifies what is being tested.
   */
  readonly name: string;
  /**
   * Number of additional times to re-run the entire suite after the first execution.
   * Useful for catching flaky suites. `repeats: 2` runs the suite 3 times total.
   * Defaults to `0`.
   */
  readonly repeats?: number;
  /**
   * Whether to skip execution entirely. When `true` or a reason string,
   * the suite logs SKIP and returns immediately without running children.
   * Defaults to `false`.
   */
  readonly skip?: boolean | string;
  /**
   * Timeout in milliseconds for the entire suite (all children).
   * Powered by `Promise.race`. Children with their own timeout
   * should use a smaller value than this.
   */
  readonly timeout?: number;
};

/**
 * Resolves a child entry to a promise, calling thunks to start execution.
 *
 * @param child - Promise or thunk
 *
 * @returns started promise
 */
function startChild(child: DescribeChild,): Promise<DescribeResult | ItResult> {
  return typeof child === 'function' ? child() : child;
}

/**
 * Defines and immediately executes a test suite.
 *
 * Children run concurrently via `Promise.allSettled` by default,
 * capped at `concurrency` (default 16) simultaneous children via `p-limit`.
 * Set `concurrency: 1` for sequential execution.
 * If any child rejects, describe throws an error wrapping the
 * child errors in the cause chain. Empty name skips this layer
 * in the error chain -- the child error propagates directly.
 *
 * @param name - Suite name shown in output and error cause chain
 *
 * @param children - Child promises or thunks from nested describe or it calls
 *
 * @param concurrency - Maximum concurrent children (default 16; 1 for sequential; `Infinity` for unbounded)
 *
 * @param skip - Whether to skip the entire suite
 *
 * @param repeats - Number of additional runs after the first
 *
 * @param timeout - Optional timeout in milliseconds for the entire suite
 *
 * @param l - Optional logger override
 *
 * @returns suite result containing the suite name
 *
 * @throws Error with child errors as cause when any child fails.
 *   Single failure: `Error(name, { cause: childError })`.
 *   Multiple failures: `Error(name, { cause: AggregateError([...]) })`.
 *   Empty name: re-throws the cause directly without wrapping.
 *
 * @example
 * ```ts
 * await describe({
 *   name: 'math',
 *   children: [
 *     it({ name: 'adds', fn: async () => expect(1 + 1).toBe(2) }),
 *     it({ name: 'subtracts', fn: async () => expect(2 - 1).toBe(1) }),
 *   ],
 *   timeout: 5000,
 * });
 * ```
 */
export async function describe({
  name,
  children,
  concurrency = DEFAULT_CONCURRENCY,
  skip = false,
  repeats = 0,
  timeout,
  l: loggerOverride,
}: DescribeOptions,): Promise<DescribeResult> {
  const baseLogger = loggerOverride ?? defaultLogger;
  const l = name === ''
    ? baseLogger
    : tagged({
      tag: name,
      l: baseLogger,
    },);

  if (skip !== false) {
    const reason = typeof skip === 'string' ? `: ${skip}` : '';
    l.info(`SKIP suite${name ? ` "${name}"` : ''}${reason}`,);
    return { name, };
  }

  /** Whether concurrency is effectively unbounded. */
  const isUnbounded = concurrency >= Number.MAX_SAFE_INTEGER;
  /** Whether children run one at a time. */
  const isSequential = concurrency <= 1;

  if (name !== '') {
    const concurrencyLabel = isSequential
      ? ' (sequential)'
      : (isUnbounded
        ? ' (unbounded)'
        : ` (concurrency: ${String(concurrency,)})`);
    l.debug(`start${concurrencyLabel}`,);
  }

  /**
   * Runs all children sequentially via `for...of`, collecting results in order.
   * Each child starts only after the previous one settles.
   *
   * @returns array of settled results matching `Promise.allSettled` format
   */
  async function runSequential(): Promise<
    PromiseSettledResult<DescribeResult | ItResult>[]
  > {
    const results: PromiseSettledResult<DescribeResult | ItResult>[] = [];

    for (const child of children) {
      try {
        // oxlint-disable-next-line no-await-in-loop -- sequential execution requires awaiting each child before starting the next
        const value = await startChild(child,);
        results.push({
          status: 'fulfilled',
          value,
        },);
      }
      catch (reason) {
        // oxlint-disable-next-line no-unsafe-type-assertion -- PromiseSettledResult requires reason typed as any
        results.push({
          status: 'rejected',
          reason,
        } as PromiseRejectedResult,);
      }
    }

    return results;
  }

  /**
   * Runs one pass of the suite: starts all children, collects results, reports.
   *
   * @param runLabel - Label suffix for repeated runs (empty string for single runs)
   *
   * @throws Error wrapping child failures when any child rejects
   */
  async function runOnce(runLabel: string,): Promise<void> {
    // History: until 2026-04, this block initialized `settleAll = runSequential()`
    // at declaration, then reassigned it inside `if (isSequential)`. That double-
    // ran children when they were thunks: the initial call invoked each thunk
    // once, and the reassignment invoked each thunk again, launching every test
    // twice. With Promise children the reassignment only re-awaited the same
    // already-resolved promises, so the bug was invisible until a test suite
    // used thunks (e.g. to let `concurrency: 1` actually sequence execution of
    // tests that share mutable module state, since `it(...)` returns an
    // in-flight Promise and cannot be sequenced any other way). Initializing
    // via conditional expression eliminates the duplicate invocation and also
    // satisfies oxlint's `init-declarations` rule (no uninitialized `let`).
    const settleAll: Promise<PromiseSettledResult<DescribeResult | ItResult>[]> =
      isSequential
        ? runSequential()
        : (isUnbounded
          ? Promise.allSettled(children.map(function mapChild(child,) {
            return startChild(child,);
          },),)
          : (function runLimited(): Promise<
            PromiseSettledResult<DescribeResult | ItResult>[]
          > {
            const limit = pLimit(concurrency,);
            return Promise.allSettled(children.map(function limitChild(child,) {
              return limit(
                startChild,
                child,
              );
            },),);
          }()));

    const withTimeoutApplied = timeout !== undefined
      ? withTimeout({
        promise: settleAll,
        ms: timeout,
        label: name || '(root)',
      },)
      : settleAll;

    const settled = await withTimeoutApplied;

    const errors: unknown[] = [];
    /** Empty-name suites are invisible wrappers; downgrade success logs to debug. */
    const logSuccess = name === '' ? l.debug : l.info;

    for (const result of settled) {
      if (result.status === 'fulfilled')
        logSuccess(`${result.value.name} <- ${name || '(root)'}${runLabel}`,);
      else {
        const childName = result.reason instanceof Error
          ? result.reason.message
          : '(unknown)';
        l.error(`${childName} <- ${name || '(root)'}${runLabel}`,);
        errors.push(result.reason,);
      }
    }

    if (errors.length === 0)
      return;

    const cause = errors.length === 1
      ? errors[0]
      : new AggregateError(
        errors,
        `${String(errors.length,)} children failed in suite "${name || '(root)'}"`,
      );

    if (name === '')
      throw cause;

    throw new Error(
      name,
      { cause, },
    );
  }

  const totalRuns = 1 + repeats;

  for (let run = 0; run < totalRuns; run += 1) {
    const runLabel = totalRuns > 1
      ? ` [run ${String(run + 1,)}/${String(totalRuns,)}]`
      : '';
    // oxlint-disable-next-line no-await-in-loop -- sequential suite repetitions must run one at a time
    await runOnce(runLabel,);
  }

  return { name, };
}
