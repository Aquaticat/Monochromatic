import { RunJsonUnreadableError, } from '../run-json-read.ts';

//region CLI refusal
// Turns THIS PACKAGE'S OWN refusals into one diagnostic line, and leaves every
// other failure exactly as it was.
//
// `#222` closed the half of `#220` that mattered most: a run file no longer
// prints itself when it will not parse. Verifying that at the boundary showed
// the other half still open. The refusal is safe now, but it is still UNCAUGHT,
// and a bundled CLI is one line of minified JavaScript, so Node echoes about
// three thousand characters of it around a correct one-line message.
//
// ONLY `RunJsonUnreadableError` IS CAUGHT. Catching every `Error` would hide the
// stack of a genuine programming fault, trading a rare ugly report for a
// permanently undiagnosable one. A refusal this package wrote already says what
// happened and names nothing it should not; anything else keeps its stack.
//
// `ledger-report.ts` does NOT use this. It reads a whole directory and reports
// the files that refused as a shortfall inside its own output, which is a
// better answer than stopping, and its closing comment records why.

/**
 * Exit code a CLI leaves behind when a run file would not read.
 *
 * FOUR, uniform across every command here, because 1 through 3 already carry
 * each CLI's OWN verdicts and those differ per command: 1 means an absent
 * ledger to one reader and a disagreeing published tree to another. A gate
 * reading THIS code learns the same thing whichever reader it ran, which is
 * that the run was never examined.
 */
const COULD_NOT_READ = 4;

/**
 * Runs a CLI body, reporting a refusal this package wrote rather than crashing.
 *
 * @param what - command name as an operator would type it, which starts the line
 *
 * @param run - CLI body to run
 *
 * @throws Whatever `run` threw, where it is not a refusal this package wrote
 *
 * @example
 * ```ts
 * if (import.meta.main)
 *   await reportingRefusals({ what: 'score-verify', run: main, },);
 * ```
 */
export async function reportingRefusals(
  {
    what,
    run,
  }: {
    readonly what: string;
    readonly run: () => Promise<void>;
  },
): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (!(error instanceof RunJsonUnreadableError))
      throw error;

    // TO STDERR, unlike the reports these commands normally print. A reader
    // piping stdout to a file is collecting a report, and this says there is no
    // report to collect.
    console.error(`${what}: ${error.message}`,);
    console.error(
      '  Nothing was read past that file, so this run was not examined. Re-run the pass to '
        + 'rewrite it, or name a run directory that has it.',
    );
    process.exitCode = COULD_NOT_READ;
  }
}

//endregion CLI refusal
