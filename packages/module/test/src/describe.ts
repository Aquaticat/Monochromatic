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
 * Options for a test suite.
 */
export type DescribeOptions = {
  /**
   * Child promises from nested {@link describe} or `it` calls.
   * Each child resolves with its name on success so the parent
   * can log the `child <- parent` relationship.
   */
  readonly children: readonly Promise<DescribeResult | ItResult>[];
  /**
   * Logger override. When omitted, a tagged logger derived from
   * the module-es default logger is used.
   */
  readonly l?: Logger;
  /**
   * Suite name shown in output and error cause chain.
   * Set to empty string to make this level invisible in output --
   * the suite still groups and times its children, but adds
   * no name segment to the path.
   */
  readonly name: string;
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
 * All children run concurrently via `Promise.allSettled`.
 * If any child rejects, describe throws an error wrapping the
 * child errors in the cause chain. Empty name skips this layer
 * in the error chain -- the child error propagates directly.
 *
 * @param name - Suite name shown in output and error cause chain
 *
 * @param children - Child promises from nested describe or it calls
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
 *     it({ name: 'adds', fn: () => expect(1 + 1).toBe(2) }),
 *     it({ name: 'subtracts', fn: () => expect(2 - 1).toBe(1) }),
 *   ],
 *   timeout: 5000,
 * });
 * ```
 */
export async function describe({
  name,
  children,
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

  const allSettled = timeout !== undefined
    ? withTimeout({
      promise: Promise.allSettled(children,),
      ms: timeout,
      label: name || '(root)',
    },)
    : Promise.allSettled(children,);

  const settled = await allSettled;

  const errors: unknown[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      l.info(`${result.value.name} <- ${name || '(root)'}`,);
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
