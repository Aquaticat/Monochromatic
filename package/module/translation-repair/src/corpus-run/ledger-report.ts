import { join, } from 'node:path';

import {
  type LedgerReading,
  readLedgerDirectory,
} from './ledger-directory.ts';
import {
  type CandidateReading,
  summariseLedger,
  workOfModel,
} from './ledger-read.ts';
import { resolveRunsDir, } from './run-config.ts';

//region Ledger report
// WHAT EACH MODEL WROTE, AND WHAT THE JUDGES SAID ABOUT IT. Spends no quota and
// touches no model.
//
// WITHOUT A MODEL NAMED it reports the whole ledger: who wrote how much, how
// often it was chosen, and the two ballot faults counted apart.
//
// WITH `--model <id>` it prints that seat's candidates and the reasons judges
// gave for choosing them. That is the question a standing cannot answer: a low
// share means a seat was rarely picked as the best of several, which is not the
// same as writing something wrong, and only the text says which it was.
//
// PRINTS CORPUS WORDING when a model is named, because the candidate text IS
// the evidence. A run directory already holds it. Do not paste this output
// anywhere public.
//
// THE SUMMARY VIEW PRINTS NO WORDING AT ALL, and `ledger-directory.ts` is what
// keeps that true when a file will not read.

/**
 * Exit code left behind when there is no ledger to read.
 */
const NOTHING_TO_READ = 1;

/**
 * Exit code left behind when the ledger was read but not all of it.
 *
 * SEPARATE FROM AN ABSENT LEDGER, on the same grounds `verify-published.ts`
 * separates its two: a run that recorded nothing and a run whose record is
 * part unreadable answer a roster question differently, and a gate treating
 * them alike either trusts a partial standing or discards a whole one.
 */
const LEDGER_INCOMPLETE = 2;

/**
 * Exit code left behind when the seat flag arrived with no seat after it.
 */
const ASKED_WITHOUT_A_SEAT = 3;

/**
 * Directory under a runs dir the ledger lives in.
 */
const LEDGER_DIR = 'ledger';

/**
 * Flag naming a single seat to read in full.
 */
const MODEL_FLAG = '--model';

/**
 * Answer `indexOf` gives for a flag that was never passed.
 */
const NO_FLAG = -1;

/**
 * First argument that is not the runtime or the script path.
 */
const FLAGS_START = 2;

/**
 * Characters of a candidate shown before it is cut.
 */
const EXCERPT_CHARS = 400;

/**
 * Multiplier turning a fraction into a percentage.
 */
const PERCENT = 100;

/**
 * Prints one candidate a named seat wrote, with what judges said about it.
 *
 * @param reading - candidate and the remarks about it
 *
 * @param at - position in this seat's output, so a reader can cite one
 *
 * @example
 * ```ts
 * printReading({ reading, at: 0, },);
 * ```
 */
function printReading(
  {
    reading,
    at,
  }: {
    readonly reading: CandidateReading;
    readonly at: number;
  },
): void {
  console.log(
    `\n--- ${String(at + 1,)} --- ${reading.won ? 'CHOSEN' : 'not chosen'} `
      + `--- ${reading.task}`,
  );
  console.log(reading
    .rendered
    .slice(
      0,
      EXCERPT_CHARS,
    ),);
  /**
   * Disinterested judges that named this candidate.
   */
  const { remarks, } = reading;

  if (remarks.length === 0)
    console.log('  (no disinterested judge named this candidate)',);
  for (const remark of remarks) {
    console.log(`  ${remark}`,);
  }
}

/**
 * Reports the files that would not read, and what their absence costs.
 *
 * NAMED AS A SHORTFALL RATHER THAN LISTED AND DROPPED. Every figure this report
 * prints is computed over the files that read, so an unreadable contest silently
 * lowers a seat's candidate count and its ballot count together. A reader who
 * did not know that would take a partial standing for a whole one.
 *
 * @param reading - what the ledger directory yielded
 *
 * @example
 * ```ts
 * printRefusals({ reading, },);
 * ```
 */
function printRefusals(
  { reading, }: { readonly reading: LedgerReading; },
): void {
  /**
   * Both halves of the reading, named so no member chain runs two steps deep.
   */
  const {
    refused,
    rounds,
  } = reading;

  for (const refusal of refused) {
    console.log(`  UNREADABLE ${refusal.file}: ${refusal.says}`,);
  }

  if (refused.length === 0)
    return;

  console.log(
    `  ${String(refused.length,)} of `
      + `${String(refused.length + rounds.length,)} ledger files could not be read. `
      + 'Every figure here counts only the files that could, so a seat that wrote into an '
      + 'unreadable contest is undercounted, and so is every judge who weighed it. Re-run the '
      + 'pass to rewrite them, or read the standing as a floor.',
  );
}

/**
 * Prints what every seat did, over the contests that read.
 *
 * @param reading - what the ledger directory yielded
 *
 * @example
 * ```ts
 * printSummary({ reading, },);
 * ```
 */
function printSummary(
  { reading, }: { readonly reading: LedgerReading; },
): void {
  /**
   * What every seat did.
   */
  const summary = summariseLedger({ rounds: reading.rounds, },);

  console.log(
    `${String(summary.abstentions,)} ballots named nothing, `
      + `${String(summary.namedMissing,)} named a candidate the slate did not have`,
  );
  for (const work of summary.models) {
    /**
     * Share of disinterested ballots that named this seat's work.
     */
    const share = (work.ballots === 0)
      ? 'UNJUDGED'
      : `${((work.votes / work.ballots) * PERCENT).toFixed(1,)}%`;

    console.log(
      `  ${work.model}: ${String(work.candidates,)} candidates, ${String(work.wins,)} chosen, `
        + `${share} of ${String(work.ballots,)} disinterested ballots, `
        + `${String(work.selfVotes,)} self-votes`,
    );
  }
  console.log(
    '\nPass --model <id> to read one seat\'s text and the reasons judges gave. A low share means '
      + 'rarely picked as best, which is not the same as wrong.',
  );
}

/**
 * Prints one seat's candidates and the reasons judges gave for choosing them.
 *
 * @param reading - what the ledger directory yielded
 *
 * @param wanted - seat to read in full
 *
 * @example
 * ```ts
 * printSeat({ reading, wanted, },);
 * ```
 */
function printSeat(
  {
    reading,
    wanted,
  }: {
    readonly reading: LedgerReading;
    readonly wanted: string;
  },
): void {
  /**
   * Everything that seat wrote.
   */
  const written = workOfModel({
    rounds: reading.rounds,
    model: wanted,
  },);

  /**
   * Its candidates the panel chose.
   */
  const chosen = written.filter(function won(reading_,): boolean {
    return reading_.won;
  },);

  console.log(
    `${wanted} wrote ${String(written.length,)} candidates, `
      + `${String(chosen.length,)} chosen`,
  );
  written.forEach(function show(
    reading_,
    at,
  ): void {
    printReading({
      reading: reading_,
      at,
    },);
  },);
}

/**
 * Reads a run's ledger and reports what it holds.
 *
 * Returns nothing: the report on stdout and the exit code ARE the output.
 *
 * @example
 * ```ts
 * await reportLedger();
 * ```
 */
async function reportLedger(): Promise<void> {
  /**
   * Arguments after the runtime and script paths.
   */
  const args = process
    .argv
    .slice(FLAGS_START,);

  /**
   * Run directory to read, from the environment or the house default, which is
   * the same resolution every other reader in this family uses.
   */
  const runsDir = await resolveRunsDir();

  /**
   * Position of the seat flag, absent when the whole ledger was asked for.
   */
  const flagAt = args.indexOf(MODEL_FLAG,);

  /**
   * Seat to read in full, absent when no flag was passed.
   */
  const wanted = (flagAt === NO_FLAG) ? undefined : args[flagAt + 1];

  // A FLAG WITH NOTHING AFTER IT IS REFUSED rather than ignored. Falling through
  // to the summary would answer a question nobody asked, and the summary looks
  // exactly like a successful run to anything reading the exit code.
  if ((flagAt !== NO_FLAG) && (wanted === undefined)) {
    console.log(
      `ledger-report: ${MODEL_FLAG} arrived with no seat after it. Pass ${MODEL_FLAG} <id> to read `
        + 'one seat, or drop the flag to summarise every seat.',
    );
    process.exitCode = ASKED_WITHOUT_A_SEAT;
    return;
  }

  /**
   * Every contest the ledger holds, beside the files that would not read.
   */
  const reading = await readLedgerDirectory({
    dir: join(
      runsDir,
      LEDGER_DIR,
    ),
  },);

  /**
   * Both halves of the reading, named so no member chain runs two steps deep.
   */
  const {
    refused,
    rounds,
  } = reading;

  console.log(`ledger-report: ${String(rounds.length,)} contests under ${runsDir}`,);
  printRefusals({ reading, },);

  if (refused.length > 0)
    process.exitCode = LEDGER_INCOMPLETE;

  if (rounds.length === 0) {
    if (refused.length === 0) {
      console.log(
        'NOTHING RECORDED. This run wrote no ledger, which is not the same as a run whose models '
          + 'wrote nothing: every run started before candidate-ledger.ts landed has none, and so does '
          + 'any run launched without TRANSLATION_REPAIR_RUNS_DIR set.',
      );
      process.exitCode = NOTHING_TO_READ;
    } else
      console.log(
        'NOTHING COUNTED. Every ledger file this run wrote refused to read, so this is a run whose '
          + 'record was lost rather than a run that recorded nothing.',
      );
    return;
  }

  if (wanted !== undefined) {
    printSeat({
      reading,
      wanted,
    },);
    return;
  }

  printSummary({ reading, },);
}

// NOT WRAPPED IN A CATCH. Every failure raised below now names itself safely:
// the reads go through `readRunJson`, which refuses without quoting the file it
// could not parse, and the listing re-raises with a code rather than a path.
// Wrapping them under one class name would replace a message that says what
// happened with `Error`, which is what `verify-published.ts` learned by doing it.
await reportLedger();

//endregion Ledger report
