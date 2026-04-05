import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import { $ as defaultLogger, } from '@monochromatic-dev/module-es/logger';
import type { $ as Logger, } from '@monochromatic-dev/module-es/ts/types/t object/t logger/t/index.ts';

import type { ItResult, } from './it.ts';
import { withTimeout, } from './with-timeout.ts';

/**
 * Result returned by a completed suite, mirroring {@link ItResult}.
 */
export type DescribeResult = {
  /** Suite name, returned so parent suites can log the hierarchy. */
  readonly name: string;
};

/**
 * Single child entry: either an already-started promise or a thunk that starts one.
 * Thunks are required for `sequential: true` so execution is deferred.
 * Bare promises work in both modes but are already running when passed.
 */
export type DescribeChild =
  | Promise<DescribeResult | ItResult>
  | (() => Promise<DescribeResult | ItResult>);

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
   * Use thunks with `sequential: true` to guarantee execution order.
   */
  readonly children: readonly DescribeChild[];
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
   * Run children one at a time in array order instead of concurrently.
   * Defaults to `false` (concurrent via `Promise.allSettled`).
   * When `true`, children should be thunks so execution is actually deferred.
   */
  readonly sequential?: boolean;
  /**
   * Timeout in milliseconds for the entire suite (all children).
   * Powered by `Promise.race`. Children with their own timeout
   * should use a smaller value than this.
   */
  readonly timeout?: number;
};

/**
 * Defines and immediately executes a test suite.
 *
 * Children run concurrently via `Promise.allSettled` by default,
 * or sequentially when `sequential: true`.
 * If any child rejects, describe throws an error wrapping the
 * child errors in the cause chain. Empty name skips this layer
 * in the error chain -- the child error propagates directly.
 *
 * @param name - Suite name shown in output and error cause chain
 *
 * @param children - Child promises or thunks from nested describe or it calls
 *
 * @param sequential - Run children one at a time in array order
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
  sequential = false,
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

  if (name !== '') {
    l.trace('start',);
  }

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
   * Runs all children sequentially, collecting results in order.
   * Each child starts only after the previous one settles.
   *
   * @returns array of settled results matching `Promise.allSettled` format
   */
  async function runSequential(): Promise<PromiseSettledResult<DescribeResult | ItResult>[]> {
    const results: PromiseSettledResult<DescribeResult | ItResult>[] = [];

    for (const child of children) {
      try {
        // oxlint-disable-next-line no-await-in-loop -- sequential execution requires awaiting each child before starting the next
        const value = await startChild(child,);
        results.push({ status: 'fulfilled', value, },);
      }
      catch (reason) {
        // oxlint-disable-next-line no-unsafe-type-assertion -- PromiseSettledResult requires reason typed as any
        results.push({ status: 'rejected', reason, } as PromiseRejectedResult,);
      }
    }

    return results;
  }

  const settleAll = sequential
    ? runSequential()
    : Promise.allSettled(children.map(startChild,),);

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
    if (result.status === 'fulfilled') {
      logSuccess(`${result.value.name} <- ${name || '(root)'}`,);
    }
    else {
      const childName = result.reason instanceof Error ? result.reason.message : '(unknown)';
      l.error(`${childName} <- ${name || '(root)'}`,);
      errors.push(result.reason,);
    }
  }

  if (errors.length === 0) {
    return { name, };
  }

  const cause = errors.length === 1
    ? errors[0]
    : new AggregateError(
      errors,
      `${String(errors.length,)} children failed in suite "${name || '(root)'}"`,
    );

  if (name === '') {
    throw cause;
  }

  throw new Error(
    name,
    { cause, },
  );
}
