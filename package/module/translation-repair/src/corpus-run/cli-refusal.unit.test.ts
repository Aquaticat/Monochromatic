/**
 * Tests for reporting a refusal instead of crashing out of a CLI.
 *
 * THE FORWARDING CASE IS THE ONE THAT CONSTRAINS THE DESIGN. Catching every
 * `Error` would make every case here pass while destroying the stack of a
 * genuine programming fault, so a foreign class is checked to come straight
 * back out.
 *
 * BOTH SWAPS ARE DISPOSABLE. `process.exitCode` is process-wide, so a case that
 * set it and walked away would decide the whole suite's exit code, and a suite
 * reporting 680 passes while exiting 4 is worse than a failing test.
 *
 * THE SUITE RUNS AT `concurrency: 1` FOR THE SAME REASON, and it was written
 * without that first. `describe` runs children concurrently by default, so the
 * three cases raced on `console.error` and on `process.exitCode`: one case saw
 * zero captured lines because a sibling's disposal had already put the real
 * reporter back, and another read `undefined` where it had just written zero.
 * Both swaps are process-wide, and there is exactly one process here: the
 * runner spawns `node` once per test FILE, so nothing outside this file is
 * touched, and nothing inside it may overlap.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  reportingRefusals,
  RunJsonUnreadableError,
} from '../../dist/final/node/index.mjs';

//region CLI refusal tests

/**
 * Exit code a CLI leaves behind when a run file would not read.
 */
const COULD_NOT_READ = 4;

/**
 * Lines a reporting run is expected to print.
 */
const REPORTED_LINES = 2;

/**
 * Byte offset the fixture refusal names.
 */
const FIXTURE_BYTE = 27;

/**
 * Collects what would have gone to stderr, restoring the real one on disposal.
 *
 * @param lines - collector the caller reads afterwards
 *
 * @returns Collected lines, and the restore that disposal runs
 *
 * @example
 * ```ts
 * using printed = collectingErrors({ lines: [], },);
 * ```
 */
function collectingErrors(
  { lines, }: { readonly lines: string[]; },
): { readonly lines: readonly string[]; } & Disposable {
  /**
   * Real reporter, put back on disposal.
   */
  const reported = console.error;

  console.error = (...parts: readonly unknown[]) => {
    lines.push(parts.map(String,)
      .join(' ',),);
  };
  return {
    lines,
    [Symbol.dispose]: () => {
      console.error = reported;
    },
  };
}

/**
 * Puts the process exit code back to whatever it was, however a case ends.
 *
 * @returns Restore that disposal runs
 *
 * @example
 * ```ts
 * using held = holdingExitCode();
 * ```
 */
function holdingExitCode(): Disposable {
  /**
   * Exit code standing before this case ran.
   */
  const before = process.exitCode;

  return {
    [Symbol.dispose]: () => {
      process.exitCode = before;
    },
  };
}

/**
 * Runs a body through the reporter and returns whatever came back out.
 *
 * @param run - body expected to throw something the reporter forwards
 *
 * @returns Value that escaped, or a note that nothing did
 *
 * @example
 * ```ts
 * const forwarded = await forwardedFrom({ run, },);
 * ```
 */
async function forwardedFrom(
  { run, }: { readonly run: () => Promise<void>; },
): Promise<unknown> {
  try {
    await reportingRefusals({
      what: 'score-verify',
      run,
    },);
  } catch (error) {
    return error;
  }

  return 'returned instead of forwarding';
}

/**
 * Builds the refusal these cases are reported about.
 *
 * @returns Refusal naming a file, a class and an offset
 *
 * @example
 * ```ts
 * throw fixtureRefusal();
 * ```
 */
function fixtureRefusal(): RunJsonUnreadableError {
  return new RunJsonUnreadableError({
    file: 'run.json',
    failure: 'SyntaxError',
    at: FIXTURE_BYTE,
  },);
}

await describe({
  name: reportingRefusals.name,
  children: [
    it({
      name: 'REPORTS a refusal this package wrote, naming the command and leaving a read code',
      fn: async () => {
        using held = holdingExitCode();
        using printed = collectingErrors({ lines: [], },);

        await reportingRefusals({
          what: 'score-verify',
          run: async () => {
            throw fixtureRefusal();
          },
        },);

        expect(process.exitCode,).toBe(COULD_NOT_READ,);
        expect(printed.lines.length,).toBe(REPORTED_LINES,);
        expect(printed.lines[0],)
          .toBe('score-verify: could not read run.json as JSON (SyntaxError at byte 27)',);
      },
    },),
    it({
      name: 'FORWARDS a class this package did not write, so a real fault keeps its stack',
      fn: async () => {
        using held = holdingExitCode();
        using printed = collectingErrors({ lines: [], },);

        /**
         * What came back out, if anything did.
         */
        const forwarded = await forwardedFrom({
          run: async () => {
            throw new RangeError('a tabby walked across the keyboard',);
          },
        },);

        expect(forwarded instanceof RangeError,).toBe(true,);
        expect(printed.lines.length,).toBe(0,);
      },
    },),
    it({
      name: 'LEAVES a clean run alone, touching neither the exit code nor stderr',
      fn: async () => {
        using held = holdingExitCode();
        using printed = collectingErrors({ lines: [], },);

        process.exitCode = 0;
        await reportingRefusals({
          what: 'score-verify',
          run: async () => {
            // A body that simply finishes, which is every ordinary run.
          },
        },);

        expect(process.exitCode,).toBe(0,);
        expect(printed.lines.length,).toBe(0,);
      },
    },),
  ],
  concurrency: 1,
},);

//endregion CLI refusal tests
