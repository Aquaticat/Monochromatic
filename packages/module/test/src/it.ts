import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import type { Logger, } from '@monochromatic-dev/module-logger/types';

import { $ as withTimeout, } from '@monochromatic-dev/module-es/with-timeout';
import {
  makeDescriptor,
  type TestDescriptor,
} from './descriptor.ts';
import {
  createScopedExpect,
  type ScopedExpect,
} from './expect.ts';
import {
  createSinon,
  type DisposableSandbox,
} from './sinon.ts';

/**
 * Context passed to each test function.
 * Contains a scoped `expect` with assertion counting
 * and a sinon sandbox that auto-restores after the test.
 */
export type TestContext = {
  /** Scoped expect with assertion tracking. Supports `expect.assertions(n)` and `expect.hasAssertions()`. */
  readonly expect: ScopedExpect;
  /** Sinon sandbox for stubs, spies, and fake timers. Auto-restores after the test completes. */
  readonly sinon: DisposableSandbox;
};

/**
 * Options for a single test case.
 */
export type ItOptions = {
  /** Whether the test is expected to throw. When `true` or a reason string, a throwing test is treated as PASS and a passing test as FAIL. Defaults to `false`. */
  readonly fails?: boolean | string;
  /**
   * Async function that performs assertions and throws on failure.
   * Receives a {@link TestContext} with a scoped `expect` for assertion counting.
   * The global `expect` still works but does not support `expect.assertions(n)`.
   */
  readonly fn: (ctx: TestContext,) => Promise<void>;
  /** Logger to use for pass/fail output. Provided by the parent describe. */
  readonly l?: Logger;
  /** Human-readable test name, shown in output and error messages. */
  readonly name: string;
  /** Number of additional times to re-run the test after the first execution. Useful for catching flaky tests. Defaults to `0`. */
  readonly repeats?: number;
  /** Whether to skip execution entirely. When `true` or a reason string, the test logs SKIP and returns immediately. Defaults to `false`. */
  readonly skip?: boolean | string;
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
 * @param fn - test body to execute
 *
 * @param ctx - test context with scoped expect and sinon sandbox
 *
 * @param timeout - optional timeout in milliseconds
 *
 * @param name - test name, used as the timeout label
 */
async function runFnOnce({
  fn,
  ctx,
  timeout,
  name,
}: {
  readonly ctx: TestContext;
  readonly fn: (ctx: TestContext,) => Promise<void>;
  readonly name: string;
  readonly timeout: number | undefined;
},): Promise<void> {
  const promise = fn(ctx,);

  await (timeout !== undefined
    ? withTimeout({
      promise,
      ms: timeout,
      label: name,
    },)
    : promise);
}

/**
 * Executes a single test case. Internal: the public {@link it} entry
 * point wraps this in {@link makeDescriptor} so callers receive a lazy
 * descriptor.
 *
 * Logs `PASS name (Nms)` on success.
 * Throws `Error(name, { cause })` on failure or timeout,
 * propagating the original error as the cause.
 *
 * @param opts - test options
 *
 * @returns test result containing the test name
 *
 * @throws Error wrapping the original failure with the test name and cause chain
 */
async function runIt(opts: ItOptions,): Promise<ItResult> {
  const {
    name,
    fn,
    timeout,
    skip = false,
    repeats = 0,
    fails = false,
    l: parentLogger,
  } = opts;
  const l = parentLogger !== undefined
    ? tagged({
      tag: name,
      l: parentLogger,
    },)
    : tagged({ tag: name, },);

  if (skip !== false) {
    const reason = typeof skip === 'string' ? `: ${skip}` : '';
    l.info(`SKIP${reason}`,);
    return { name, };
  }

  const [scopedExpect, tracker,] = createScopedExpect();
  await using sandbox = createSinon();
  const ctx: TestContext = {
    expect: scopedExpect,
    sinon: sandbox,
  };

  const totalRuns = 1 + repeats;

  for (let run = 0; run < totalRuns; run += 1) {
    const runLabel = totalRuns > 1
      ? ` [run ${String(run + 1,)}/${String(totalRuns,)}]`
      : '';
    let threw = false;
    let caughtError: unknown = undefined;
    const runStart = performance.now();

    tracker.count = 0;
    sandbox.restore();

    try {
      // oxlint-disable-next-line no-await-in-loop -- sequential test repetitions must run one at a time
      await runFnOnce({
        fn,
        ctx,
        timeout,
        name,
      },);
    }
    catch (error) {
      threw = true;
      caughtError = error;
    }

    // Restore stubs between repeat runs so the next iteration sees a
    // clean sandbox; `await using` only fires at function-scope exit.
    sandbox.restore();

    const durationMs = performance.now() - runStart;

    const failsReason = typeof fails === 'string' ? ` (${fails})` : '';

    if (fails !== false) {
      if (threw) {
        l.info(
          `PASS${runLabel}: threw as expected${failsReason} (${
            durationMs.toFixed(0,)
          }ms)`,
        );
        continue;
      }

      l.error(
        `FAIL${runLabel}: expected to throw but passed${failsReason} (${
          durationMs.toFixed(0,)
        }ms)`,
      );
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

    //region Assertion count verification
    if (tracker.expected !== null && tracker.count !== tracker.expected) {
      l.error(
        `FAIL${runLabel}: expected ${String(tracker.expected,)} assertions but ${
          String(tracker.count,)
        } were called (${durationMs.toFixed(0,)}ms)`,
      );
      throw new Error(
        name,
        {
          cause: new Error(
            `Expected ${String(tracker.expected,)} assertions, but ${
              String(tracker.count,)
            } were called`,
          ),
        },
      );
    }

    if (tracker.requiresAtLeastOne && tracker.count === 0) {
      l.error(
        `FAIL${runLabel}: expected at least one assertion but none were called (${
          durationMs.toFixed(0,)
        }ms)`,
      );
      throw new Error(
        name,
        { cause: new Error('Expected at least one assertion to be called',), },
      );
    }
    //endregion Assertion count verification

    l.info(`PASS${runLabel} (${durationMs.toFixed(0,)}ms)`,);
  }

  return { name, };
}

/**
 * Defines a single test case as a lazy {@link TestDescriptor}.
 * Construction is synchronous and side-effect free; execution begins
 * when the descriptor is awaited or dispatched by a parent suite.
 *
 * @param opts - test options
 *
 * @returns lazy descriptor that resolves with the test result
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
export function it(opts: ItOptions,): TestDescriptor<ItResult> {
  return makeDescriptor(function runItIgnoringCtx() {
    return runIt(opts,);
  },);
}
