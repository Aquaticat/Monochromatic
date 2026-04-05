import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import type { $ as Logger, } from '@monochromatic-dev/module-es/ts/types/t object/t logger/t/index.ts';

import { withTimeout, } from './with-timeout.ts';

/**
 * Options for a single test case.
 */
export type ItOptions = {
  /** Whether the test is expected to throw. When `true`, a throwing test is treated as PASS and a passing test as FAIL. Defaults to `false`. */
  readonly fails?: boolean;
  /** Async function that performs assertions and throws on failure. */
  readonly fn: () => Promise<void>;
  /** Logger to use for pass/fail output. Provided by the parent describe. */
  readonly l?: Logger;
  /** Human-readable test name, shown in output and error messages. */
  readonly name: string;
  /** Number of additional times to re-run the test after the first execution. Useful for catching flaky tests. Defaults to `0`. */
  readonly repeats?: number;
  /** Whether to skip execution entirely. When `true`, the test logs SKIP and returns immediately. Defaults to `false`. */
  readonly skip?: boolean;
  /** Timeout in milliseconds. Must be less than any parent describe timeout. */
  readonly timeout?: number;
};

/**
 * Result returned by a completed test case.
 */
export type ItResult = {
  /** Test name, returned so parent suites can log the hierarchy. */
  readonly name: string;
};

/**
 * Runs a single invocation of the test function, handling timeout if configured.
 *
 * @param fn - Test body to execute
 *
 * @param timeout - Optional timeout in milliseconds
 *
 * @param name - Test name, used as the timeout label
 */
async function runOnce({
  fn,
  timeout,
  name,
}: {
  readonly fn: () => Promise<void>;
  readonly name: string;
  readonly timeout: number | undefined;
},): Promise<void> {
  const promise = fn();

  await (timeout !== undefined
    ? withTimeout({
      promise,
      ms: timeout,
      label: name,
    },)
    : promise);
}

/**
 * Defines and immediately executes a single test case.
 *
 * Logs `PASS name (Nms)` on success.
 * Throws `Error(name, { cause })` on failure or timeout,
 * propagating the original error as the cause.
 *
 * @param name - Human-readable test name
 *
 * @param fn - Async function that performs assertions
 *
 * @param timeout - Optional timeout in milliseconds
 *
 * @param skip - Whether to skip execution entirely
 *
 * @param repeats - Number of additional runs after the first
 *
 * @param fails - Whether the test is expected to throw
 *
 * @param l - Optional logger override from parent suite
 *
 * @returns test result containing the test name
 *
 * @throws Error wrapping the original failure with the test name and cause chain
 *
 * @example
 * ```ts
 * await it({
 *   name: 'adds two numbers',
 *   fn: async () => {
 *     expect(add(1, 2)).toBe(3);
 *   },
 * });
 * ```
 */
export async function it({
  name,
  fn,
  timeout,
  skip = false,
  repeats = 0,
  fails = false,
  l: parentLogger,
}: ItOptions,): Promise<ItResult> {
  const l = parentLogger !== undefined
    ? tagged({
      tag: name,
      l: parentLogger,
    },)
    : tagged({ tag: name, },);

  if (skip) {
    l.info('SKIP',);
    return { name, };
  }

  const totalRuns = 1 + repeats;

  for (let run = 0; run < totalRuns; run += 1) {
    const runLabel = totalRuns > 1 ? ` [run ${String(run + 1,)}/${String(totalRuns,)}]` : '';
    let threw = false;
    let caughtError: unknown = undefined;
    const runStart = performance.now();

    try {
      // oxlint-disable-next-line no-await-in-loop -- sequential test repetitions must run one at a time
      await runOnce({
        fn,
        timeout,
        name,
      },);
    }
    catch (error) {
      threw = true;
      caughtError = error;
    }

    const durationMs = performance.now() - runStart;

    if (fails) {
      if (threw) {
        l.info(`PASS${runLabel} — threw as expected (${durationMs.toFixed(0,)}ms)`,);
        continue;
      }

      l.error(`FAIL${runLabel} — expected to throw but passed (${durationMs.toFixed(0,)}ms)`,);
      throw new Error(
        name,
        { cause: new Error('Expected test to throw but it passed',), },
      );
    }

    if (threw) {
      l.error(`FAIL${runLabel} (${durationMs.toFixed(0,)}ms)`,);
      throw new Error(
        name,
        { cause: caughtError, },
      );
    }

    l.info(`PASS${runLabel} (${durationMs.toFixed(0,)}ms)`,);
  }

  return { name, };
}
