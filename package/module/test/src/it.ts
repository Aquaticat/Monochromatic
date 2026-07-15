import {
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';

import { withTimeout, } from '@monochromatic-dev/module-async-time/ts';
import { formatDuration, } from '@monochromatic-dev/module-numeric-format/ts';
import {
  type DescriptorContext,
  makeDescriptor,
  type TestDescriptor,
} from './descriptor.ts';
import {
  createScopedExpect,
  type ScopedExpect,
} from './expect.ts';
import { formatFailure, } from './format-error.ts';
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
  /**
   * Scoped expect with assertion tracking. Supports `expect.assertions(n)` and `expect.hasAssertions()`.
   */
  readonly expect: ScopedExpect;
  /**
   * Sinon sandbox for stubs, spies, and fake timers. Auto-restores after the test completes.
   */
  readonly sinon: DisposableSandbox;
};

/**
 * Options for a single test case.
 */
export type ItOptions = {
  /**
   * Whether the test is expected to throw. When `true` or a reason string, a throwing test is treated as PASS and a passing test as FAIL. Defaults to `false`.
   */
  readonly fails?: boolean | string;
  /**
   * Async function that performs assertions and throws on failure.
   * Receives a {@link TestContext} with a scoped `expect` for assertion counting.
   * The global `expect` still works but does not support `expect.assertions(n)`.
   */
  readonly fn: (ctx: TestContext,) => Promise<void>;
  /**
   * Logger to use for pass/fail output. Provided by the parent describe.
   */
  readonly l?: Logger;
  /**
   * Human-readable test name, shown in output and error messages.
   */
  readonly name: string;
  /**
   * Number of additional times to re-run the test after the first execution. Useful for catching flaky tests. Defaults to `0`.
   */
  readonly repeats?: number;
  /**
   * Whether to skip execution entirely. When `true` or a reason string, the test logs SKIP and returns immediately. Defaults to `false`.
   */
  readonly skip?: boolean | string;
  /**
   * Timeout in milliseconds. Must be less than any parent describe timeout.
   */
  readonly timeout?: number;
};

/**
 * Result returned by a completed test case.
 */
export type ItResult = {
  /**
   * Test name, returned so parent suites can log the hierarchy.
   */
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
  readonly timeout?: number;
},): Promise<void> {
  /**
   * Hoists the test-fn invocation so it can be optionally wrapped with `withTimeout`.
   */
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
 * Logs `PASS (Nms)` at `debug` on success, so per-test output stays
 * out of default verbosity. The parent `describe` surfaces the
 * fulfilled child names in a single `info` line, preserving the
 * parent-children mapping without one info line per test. `FAIL` at
 * `error` is always visible; `SKIP` at `info`.
 * On failure, also emits the caught error inline at `error` level
 * (message, stack, `.cause` chain, `AggregateError.errors`) adjacent
 * to the `FAIL` summary, so the log stream alone is sufficient for
 * diagnosis without depending on the runtime's unhandled-rejection
 * printer. The throw shape is unchanged.
 * Throws `Error(name, { cause })` on failure or timeout, propagating
 * the original error as the cause.
 *
 * @param opts - test options
 *
 * @param descriptorCtx - inherited execution context. Carries the
 *   parent suite's composed tagged logger, which this test wraps with
 *   its own name so the resulting tag chain reads root-first.
 *
 * @returns test result containing the test name
 *
 * @throws Error wrapping the original failure with the test name and cause chain
 */
async function runIt(
  {
    opts,
    descriptorCtx,
  }: {
    readonly descriptorCtx: DescriptorContext;
    readonly opts: ItOptions;
  },
): Promise<ItResult> {
  /**
   * Pulls out individual fields with their defaults so the body can refer to them without re-reading the option object.
   */
  const {
    name,
    fn,
    timeout,
    skip = false,
    repeats = 0,
    fails = false,
    l: explicitLogger,
  } = opts;
  /**
   * Parent logger comes from either an explicit `opts.l` (rare, used
   * when callers build their own logger pipeline) or the parent suite's
   * composed tagged logger threaded through `descriptorCtx.parentLogger`.
   * Wrapping the parent with this test's name puts the test tag rightmost
   * so the full chain reads root-first: `[outer] [inner] [test-name] PASS`.
   */
  const baseLogger = explicitLogger ?? descriptorCtx
    .parentLogger;
  /**
   * Composed tagged logger used for every PASS/FAIL/SKIP line of this test.
   */
  const l = baseLogger !== undefined
    ? tagged({
      tag: name,
      l: baseLogger,
    },)
    : tagged({ tag: name, },);

  if (skip !== false) {
    /**
     * Reason suffix appended after the SKIP keyword when a string was supplied.
     */
    const reason = (typeof skip) === 'string' ? `: ${skip}` : '';
    l.info(`SKIP${reason}`,);
    return { name, };
  }

  /**
   * Scoped expect plus its tracker so per-run assertion counts can be checked after each iteration.
   */
  const [scopedExpect, tracker,] = createScopedExpect();
  /**
   * Sinon sandbox tied to this test so stubs auto-restore when the function returns.
   */
  await using sandbox = createSinon();
  /**
   * Test context handed to the user-supplied test body.
   */
  const ctx: TestContext = {
    expect: scopedExpect,
    sinon: sandbox,
  };

  /**
   * Total iteration count: one base run plus any explicit repeats.
   */
  const totalRuns = 1 + repeats;

  /**
   * Spreads `timeout` into the runFnOnce call only when set, so exactOptional never receives an explicit `undefined`.
   */
  const timeoutArg = timeout !== undefined ? { timeout, } : {};

  for (let run = 0; run < totalRuns; run += 1) {
    /**
     * Per-iteration label inserted in log messages so repeat runs can be told apart.
     */
    const runLabel = totalRuns > 1
      ? ` [run ${String(run + 1,)}/${String(totalRuns,)}]`
      : '';
    /**
     * Tracks whether the test body threw so post-run logic can branch on outcome.
     */
    let threw = false;
    /**
     * Captured throwable so failure formatting and rethrow can use the original cause.
     */
    let caughtError: unknown = undefined;
    /**
     * Start timestamp for this iteration so duration can be reported in PASS/FAIL output.
     */
    const runStart = performance.now();

    tracker.count = 0;
    sandbox.restore();

    try {
      // oxlint-disable-next-line no-await-in-loop -- sequential test repetitions must run one at a time
      await runFnOnce({
        fn,
        ctx,
        name,
        ...timeoutArg,
      },);
    }
    catch (error) {
      threw = true;
      caughtError = error;
    }

    // Restore stubs between repeat runs so the next iteration sees a
    // clean sandbox; `await using` only fires at function-scope exit.
    sandbox.restore();

    /**
     * Elapsed time for this iteration, formatted into the result log line.
     */
    const durationMs = performance.now()
      - runStart;

    /**
     * Inline annotation appended after the FAIL/PASS line when `fails` was set as a string.
     */
    const failsReason = (typeof fails) === 'string' ? ` (${fails})` : '';

    if (fails !== false) {
      if (threw) {
        l.debug(
          `PASS${runLabel}: threw as expected${failsReason} (${
            formatDuration(durationMs,)
          })`,
        );
        continue;
      }

      /**
       * Synthetic cause attached to the rethrow when a `fails`-marked test unexpectedly passes.
       */
      const failsCause = new Error('Expected test to throw but it passed',);
      // oxlint-disable-next-line no-await-in-loop -- formatFailure is async; await is required before the throw on the next line, and only one loop iteration runs on this path
      l.error(await formatFailure({
        summary: `FAIL${runLabel}: expected to throw but passed${failsReason} (${
          formatDuration(durationMs,)
        })`,
        value: failsCause,
      },),);
      throw new Error(
        name,
        { cause: failsCause, },
      );
    }

    if (threw) {
      // oxlint-disable-next-line no-await-in-loop -- formatFailure is async; await is required before the throw on the next line, and only one loop iteration runs on this path
      l.error(await formatFailure({
        summary: `FAIL${runLabel} (${formatDuration(durationMs,)})`,
        value: caughtError,
      },),);
      throw new Error(
        name,
        { cause: caughtError, },
      );
    }

    //region Assertion count verification
    if ((tracker.expected
      !== undefined) && (tracker.count
        !== tracker
        .expected)) {
      /**
       * Synthetic cause naming the assertion-count mismatch so the failure surface mirrors a regular throw.
       */
      const assertionCause = new Error(
        `Expected ${String(tracker.expected,)} assertions, but ${
          String(tracker.count,)
        } were called`,
      );
      // oxlint-disable-next-line no-await-in-loop -- formatFailure is async; await is required before the throw on the next line, and only one loop iteration runs on this path
      l.error(await formatFailure({
        summary: `FAIL${runLabel}: expected ${String(tracker.expected,)} assertions but ${
          String(tracker.count,)
        } were called (${formatDuration(durationMs,)})`,
        value: assertionCause,
      },),);
      throw new Error(
        name,
        { cause: assertionCause, },
      );
    }

    if (tracker.requiresAtLeastOne
      && (tracker.count
        === 0)) {
      /**
       * Synthetic cause used when `expect.hasAssertions()` was declared but no assertion ran.
       */
      const noAssertionsCause = new Error(
        'Expected at least one assertion to be called',
      );
      // oxlint-disable-next-line no-await-in-loop -- formatFailure is async; await is required before the throw on the next line, and only one loop iteration runs on this path
      l.error(await formatFailure({
        summary:
          `FAIL${runLabel}: expected at least one assertion but none were called (${
            formatDuration(durationMs,)
          })`,
        value: noAssertionsCause,
      },),);
      throw new Error(
        name,
        { cause: noAssertionsCause, },
      );
    }
    //endregion Assertion count verification

    l.debug(`PASS${runLabel} (${formatDuration(durationMs,)})`,);
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
  return makeDescriptor(function runItWithCtx(ctx,) {
    return runIt({
      opts,
      descriptorCtx: ctx,
    },);
  },);
}
