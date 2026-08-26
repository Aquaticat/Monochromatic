/**
 * Tests for reporting a refusal instead of crashing out of a CLI.
 *
 * THE UNEXPECTED-FAULT CASES ARE THE ONES THAT CONSTRAIN THE DESIGN, and they
 * replaced a forwarding case that pinned the opposite contract. That case
 * checked a foreign class came straight back out, on the reasoning that
 * catching every `Error` destroys the stack of a genuine programming fault.
 *
 * `#225` showed re-throwing is not neutral: it hands the decision to whatever
 * prints next, and Node's reporter renders a cause chain, which is how a YAML
 * refusal published a page's front matter. So everything is caught now, and the
 * cases below hold both halves at once: the message must NOT be repeated, and
 * the frames MUST still be there.
 *
 * THREE EXIT CODES NOW, AND EACH IS DEFINED AGAINST THE OTHER TWO. `#226`
 * closed the message of every class that had not declared itself quote-free,
 * and `#227` decided which of our own may speak. So what a reader gets depends
 * on the class thrown: a stated refusal says its sentence and stops at 6, a
 * marked class that is not one says its sentence AND keeps its frames at 5, and
 * everything else is named without being quoted. The cases below hold one of
 * each, so a later change that collapses the three into one report fails here
 * rather than in an operator's terminal.
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
  createSeatTally,
  LedgerShapeError,
  reportingRefusals,
  RUN_SEATS,
  RunConfigError,
  RunJsonUnreadableError,
  StatedRefusalError,
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
 * Lines an unexpected fault is expected to print: name, explanation, frames.
 */
const FAULT_LINES = 3;

/**
 * Index of the frames line among those three.
 */
const FRAMES_LINE = 2;

/**
 * Exit code a CLI leaves behind when it broke for a reason nobody planned for.
 */
const UNEXPECTED_FAULT = 5;

/**
 * Message the fault fixture carries, which must never reach a reader.
 *
 * Phrased as something a real error could say about content it was handed,
 * because that is the shape this guard exists for.
 */
const FAULT_MESSAGE = 'a tabby walked across Pouncewick';

/**
 * Byte offset the fixture refusal names.
 */
const FIXTURE_BYTE = 27;

/**
 * Exit code a CLI leaves behind when it declined in its own words.
 */
const REFUSED_AS_STATED = 6;

/**
 * Lines a stated refusal is expected to print: the sentence, and nothing after.
 */
const STATED_LINES = 1;

/**
 * Message the stated fixture carries, which MUST reach a reader.
 *
 * Shaped as a usage line because that is what the marker exists for: the words
 * an operator needs most are the ones saying what to type next.
 */
const STATED_MESSAGE = 'name at least one basket: sunbeam-report <path> [<path> ...]';

/**
 * File the ledger fixture names, which its message may repeat.
 */
const LEDGER_FILE = 'ledger/000007.json';

/**
 * Field the ledger fixture reports missing, which its message may repeat.
 */
const LEDGER_FIELD = 'ballots';

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

/**
 * Variable a run configuration refusal names.
 */
const CONFIG_VARIABLE = 'TRANSLATION_REPAIR_CHARM_HYPER_API_KEY';

/**
 * Message that refusal carries: the variable name and a fix, which is all
 * that class may ever say.
 */
const CONFIG_MESSAGE = `${CONFIG_VARIABLE} is not set; run under mise so sops injects it`;

/**
 * Empties the run-wide seat tally for the life of a scope and again on exit,
 * so a case reads only what it caused and leaves nothing for the next one.
 *
 * @returns Disposable emptying the tally again
 *
 * @example
 * ```ts
 * using _fresh = withFreshRunSeats();
 * ```
 */
function withFreshRunSeats(): Disposable {
  RUN_SEATS.reset();
  return {
    [Symbol.dispose](): void {
      RUN_SEATS.reset();
    },
  };
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
      name: 'NAMES a class this package did not write, without repeating what it said',
      fn: async () => {
        using held = holdingExitCode();
        using printed = collectingErrors({ lines: [], },);

        await reportingRefusals({
          what: 'score-verify',
          run: async () => {
            throw new RangeError(FAULT_MESSAGE,);
          },
        },);

        expect(process.exitCode,).toBe(UNEXPECTED_FAULT,);
        expect(printed.lines.length,).toBe(FAULT_LINES,);
        expect(printed.lines[0],).toBe('score-verify: refused by RangeError',);
      },
    },),
    it({
      name: 'REFUSES to print the message anywhere, frames line included',
      fn: async () => {
        using held = holdingExitCode();
        using printed = collectingErrors({ lines: [], },);

        await reportingRefusals({
          what: 'score-verify',
          run: async () => {
            throw new RangeError(FAULT_MESSAGE,);
          },
        },);

        /**
         * Everything the reporter said, as one body to search.
         */
        const said = printed.lines.join('\n',);

        expect(said.includes(FAULT_MESSAGE,),).toBe(false,);
      },
    },),
    it({
      name: 'KEEPS the frames, so an unexpected fault stays locatable',
      fn: async () => {
        using held = holdingExitCode();
        using printed = collectingErrors({ lines: [], },);

        await reportingRefusals({
          what: 'score-verify',
          run: async () => {
            throw new RangeError(FAULT_MESSAGE,);
          },
        },);

        /**
         * Frames as the reporter rendered them.
         */
        const frames = printed.lines[FRAMES_LINE] ?? '';

        expect(frames.includes('at ',),).toBe(true,);
      },
    },),
    it({
      name: 'REPEATS a refusal stated in our own words, at its own code and with no frames',
      fn: async () => {
        using held = holdingExitCode();
        using printed = collectingErrors({ lines: [], },);

        await reportingRefusals({
          what: 'score-verify',
          run: async () => {
            throw new StatedRefusalError({ says: STATED_MESSAGE, },);
          },
        },);

        expect(process.exitCode,).toBe(REFUSED_AS_STATED,);
        expect(printed.lines.length,).toBe(STATED_LINES,);
        expect(printed.lines[0],).toBe(`score-verify: ${STATED_MESSAGE}`,);
      },
    },),
    it({
      name: 'KEEPS both halves for a marked class on the fault path, sentence and frames',
      fn: async () => {
        using held = holdingExitCode();
        using printed = collectingErrors({ lines: [], },);

        await reportingRefusals({
          what: 'ledger-report',
          run: async () => {
            throw new LedgerShapeError({
              from: LEDGER_FILE,
              field: LEDGER_FIELD,
            },);
          },
        },);

        /**
         * Frames as the reporter rendered them.
         */
        const frames = printed.lines[FRAMES_LINE] ?? '';

        expect(process.exitCode,).toBe(UNEXPECTED_FAULT,);
        expect(printed.lines.length,).toBe(FAULT_LINES,);
        expect(printed.lines[0],)
          .toBe(`ledger-report: ledger file ${LEDGER_FILE} has no usable ${LEDGER_FIELD}`,);
        expect(frames.includes('at ',),).toBe(true,);
      },
    },),
    it({
      name: 'PRINTS the seat report when the run ends clean, naming the seat '
        + 'that never answered, so a roster half that failed every call cannot '
        + 'pass as a comparison (`#235`)',
      fn: async () => {
        using held = holdingExitCode();
        using printed = collectingErrors({ lines: [], },);

        /**
         * Tally of a run in which one seat answered and one threw every time.
         */
        const seats = createSeatTally();
        seats.record({ modelId: 'hf:openai/gpt-oss-120b', outcome: 'usable', },);
        seats.record({ modelId: 'qwen3.8-max', outcome: 'threw', },);
        seats.record({ modelId: 'qwen3.8-max', outcome: 'threw', },);

        process.exitCode = 0;
        await reportingRefusals({
          what: 'editor-calibrate',
          run: async () => {
            // A run that finishes, which is what `#235` hid behind.
          },
          seats,
        },);

        /**
         * The one line a reader who is not grepping must see.
         */
        const dark = printed.lines.find(function isDarkLine(line,): boolean {
          return line.startsWith('SEATS DARK: ',);
        },) ?? '';

        expect(process.exitCode,).toBe(0,);
        expect(
          printed.lines.includes('SEAT hf:openai/gpt-oss-120b asked=1 usable=1 unusable=0 threw=0',),
        ).toBe(true,);
        expect(printed.lines.includes('SEAT qwen3.8-max asked=2 usable=0 unusable=0 threw=2',),).toBe(true,);
        expect(dark.startsWith(
          'SEATS DARK: 1 of 2 seats asked produced nothing usable this run: '
            + 'qwen3.8-max (asked 2, unusable 0, threw 2).',
        ),).toBe(true,);
        expect(dark.includes('gpt-oss',),).toBe(false,);
      },
    },),
    it({
      name: 'PRINTS the seat report under a stated refusal too, so the report '
        + 'is on every exit path and not only the clean one',
      fn: async () => {
        using held = holdingExitCode();
        using printed = collectingErrors({ lines: [], },);

        /**
         * Tally with one seat that answered, unusably, every time.
         */
        const seats = createSeatTally();
        seats.record({ modelId: 'minimax-m3', outcome: 'unusable', },);

        await reportingRefusals({
          what: 'editor-calibrate',
          run: async () => {
            throw new StatedRefusalError({ says: STATED_MESSAGE, },);
          },
          seats,
        },);

        expect(process.exitCode,).toBe(REFUSED_AS_STATED,);
        expect(printed.lines[0],).toBe(`editor-calibrate: ${STATED_MESSAGE}`,);
        expect(printed.lines[1],).toBe('SEAT minimax-m3 asked=1 usable=0 unusable=1 threw=0',);
        expect((printed.lines[2] ?? '').startsWith('SEATS DARK: 1 of 1 seats asked',),).toBe(true,);
      },
    },),
    it({
      name: 'DEFAULTS to the run-wide tally the client factory counts into, so '
        + 'no CLI has to thread it',
      fn: async () => {
        using held = holdingExitCode();
        using printed = collectingErrors({ lines: [], },);
        using _fresh = withFreshRunSeats();

        RUN_SEATS.record({ modelId: 'minimax-m3', outcome: 'usable', },);

        process.exitCode = 0;
        await reportingRefusals({
          what: 'corpus-pass',
          run: async () => {
            // A run that finishes.
          },
        },);

        expect(process.exitCode,).toBe(0,);
        expect(printed.lines.length,).toBe(1,);
        expect(printed.lines[0],).toBe('SEAT minimax-m3 asked=1 usable=1 unusable=0 threw=0',);
      },
    },),
    it({
      name: 'REPORTS a run configuration refusal in its own words at exit 6, '
        + 'since that message names a variable and a fix and never content',
      fn: async () => {
        using held = holdingExitCode();
        using printed = collectingErrors({ lines: [], },);

        await reportingRefusals({
          what: 'editor-calibrate',
          run: async () => {
            throw new RunConfigError({ variable: CONFIG_VARIABLE, },);
          },
          seats: createSeatTally(),
        },);

        expect(process.exitCode,).toBe(REFUSED_AS_STATED,);
        expect(printed.lines.length,).toBe(STATED_LINES,);
        expect(printed.lines[0],).toBe(`editor-calibrate: ${CONFIG_MESSAGE}`,);
      },
    },),
    it({
      name: 'LEAVES a clean run alone when no seat was asked, touching neither '
        + 'the exit code nor stderr',
      fn: async () => {
        using held = holdingExitCode();
        using printed = collectingErrors({ lines: [], },);

        process.exitCode = 0;
        await reportingRefusals({
          what: 'score-verify',
          run: async () => {
            // A body that simply finishes, which is every ordinary run.
          },
          seats: createSeatTally(),
        },);

        expect(process.exitCode,).toBe(0,);
        expect(printed.lines.length,).toBe(0,);
      },
    },),
  ],
  concurrency: 1,
},);

//endregion CLI refusal tests
