import { logger as defaultLogger, } from '@monochromatic-dev/module-logger/logger';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import type { Logger, } from '@monochromatic-dev/module-logger/types';

import pLimit from 'p-limit';

import { $ as withTimeout, } from '@monochromatic-dev/module-es/with-timeout';
import {
  DEFAULT_CONCURRENCY,
  type DescriptorContext,
  makeDescriptor,
  RUN_WITH_CONTEXT,
  type TestDescriptor,
} from './descriptor.ts';
import type { ItResult, } from './it.ts';

/**
 * Result returned by a completed suite, mirroring {@link ItResult}.
 */
export type DescribeResult = {
  /** Suite name, returned so parent suites can log the hierarchy. */
  readonly name: string;
};

/**
 * Single child entry: a lazy {@link TestDescriptor} from nested
 * {@link describe} or `it` calls. Execution is dispatched by the parent
 * suite, which calls each child's {@link RUN_WITH_CONTEXT} with the
 * inherited execution context.
 */
export type DescribeChild = TestDescriptor<DescribeResult | ItResult>;

/**
 * Options for a test suite.
 */
export type DescribeOptions = {
  /**
   * Child entries from nested {@link describe} or `it` calls.
   * Each child resolves with its name on success so the parent
   * can log the `child <- parent` relationship.
   *
   * Children are lazy descriptors and do not execute until the
   * parent dispatches them.
   */
  readonly children: readonly DescribeChild[];
  /**
   * Maximum number of children running at the same time.
   *
   * - `1` -- sequential execution via `for...of` loop, no `p-limit` overhead
   * - `2`..`Number.MAX_SAFE_INTEGER - 1` -- bounded concurrency via `p-limit`
   * - `Infinity` or `Number.MAX_SAFE_INTEGER` -- unbounded concurrency via
   *   raw `Promise.allSettled` (no `p-limit` overhead)
   *
   * **Inherited by child describes.** A nested `describe` without its own
   * `concurrency` inherits the parent's effective value, so setting
   * `concurrency: 1` once at the top sequences all descendants.
   *
   * Defaults to {@link DEFAULT_CONCURRENCY} (16) at the root.
   */
  readonly concurrency?: number;
  /**
   * Logger override. When omitted, a tagged logger derived from
   * the module-es default logger is used.
   */
  readonly l?: Logger;
  /**
   * Suite name shown in output and error cause chain.
   * Set to empty string to make this level invisible in output;
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
 * Executes a suite given options and an inherited context.
 * Internal: the public {@link describe} entry point wraps this in
 * {@link makeDescriptor} so callers receive a lazy descriptor.
 *
 * @param opts - suite options
 *
 * @param ctx - inherited execution context (effective concurrency from parent)
 *
 * @returns suite result containing the suite name
 *
 * @throws Error wrapping child failures when any child rejects.
 *   Single failure: `Error(name, { cause: childError })`.
 *   Multiple failures: `Error(name, { cause: AggregateError([...]) })`.
 *   Empty name: re-throws the cause directly without wrapping.
 */
async function runDescribe(
  opts: DescribeOptions,
  ctx: DescriptorContext,
): Promise<DescribeResult> {
  const {
    name,
    children,
    concurrency,
    skip = false,
    repeats = 0,
    timeout,
    l: loggerOverride,
  } = opts;
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

  /** Effective concurrency for this suite, inheriting parent when not set. */
  const effectiveConcurrency = concurrency ?? ctx.effectiveConcurrency;
  /** Context passed to each child for inheritance. */
  const childCtx: DescriptorContext = { effectiveConcurrency, };
  /** Whether concurrency is effectively unbounded. */
  const isUnbounded = effectiveConcurrency >= Number.MAX_SAFE_INTEGER;
  /** Whether children run one at a time. */
  const isSequential = effectiveConcurrency <= 1;

  if (name !== '') {
    const concurrencyLabel = isSequential
      ? ' (sequential)'
      : (isUnbounded
        ? ' (unbounded)'
        : ` (concurrency: ${String(effectiveConcurrency,)})`);
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
        const value = await child[RUN_WITH_CONTEXT](childCtx,);
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
   * Logs per-child completion via `<-` lines, then a suite-level
   * `(Nms)` on success or `FAIL (Nms)` on failure.
   * Empty-name suites downgrade the success duration to `debug`.
   *
   * @param runLabel - label suffix for repeated runs (empty string for single runs)
   *
   * @throws Error wrapping child failures when any child rejects
   */
  async function runOnce(runLabel: string,): Promise<void> {
    const settleAll: Promise<PromiseSettledResult<DescribeResult | ItResult>[]> =
      isSequential
        ? runSequential()
        : (isUnbounded
          ? Promise.allSettled(children.map(function mapChild(child,) {
            return child[RUN_WITH_CONTEXT](childCtx,);
          },),)
          : (function runLimited(): Promise<
            PromiseSettledResult<DescribeResult | ItResult>[]
          > {
            const limit = pLimit(effectiveConcurrency,);
            return Promise.allSettled(children.map(function limitChild(child,) {
              return limit(function dispatchChild() {
                return child[RUN_WITH_CONTEXT](childCtx,);
              },);
            },),);
          }()));

    const withTimeoutApplied = timeout !== undefined
      ? withTimeout({
        promise: settleAll,
        ms: timeout,
        label: name || '(root)',
      },)
      : settleAll;

    const startTime = performance.now();
    const settled = await withTimeoutApplied;
    const durationMs = performance.now() - startTime;

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

    if (errors.length === 0) {
      const labelPrefix = runLabel === '' ? '' : `${runLabel.trim()} `;
      logSuccess(`${labelPrefix}(${durationMs.toFixed(0,)}ms)`,);
      return;
    }

    l.error(`FAIL${runLabel} (${durationMs.toFixed(0,)}ms)`,);

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

/**
 * Defines a test suite as a lazy {@link TestDescriptor}.
 * Construction is synchronous and side-effect free; execution begins
 * when the descriptor is awaited (top-level) or dispatched by a parent
 * suite via {@link RUN_WITH_CONTEXT}.
 *
 * Children run concurrently via `Promise.allSettled` by default,
 * capped at `concurrency` (default 16) simultaneous children via `p-limit`.
 * Set `concurrency: 1` for sequential execution; nested describes inherit
 * the parent's effective value unless they override it.
 *
 * @param opts - suite options
 *
 * @returns lazy descriptor that resolves with the suite result
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
export function describe(opts: DescribeOptions,): TestDescriptor<DescribeResult> {
  return makeDescriptor(function runDescribeWithCtx(ctx,) {
    return runDescribe(
      opts,
      ctx,
    );
  },);
}
