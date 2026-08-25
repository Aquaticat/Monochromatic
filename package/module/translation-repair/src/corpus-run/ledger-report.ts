import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { errorName, } from '../error-name.ts';
import {
  parseLedgerRound,
  type ReadRound,
} from './ledger-parse.ts';
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

/**
 * Exit code left behind when there is no ledger to read.
 */
const NOTHING_TO_READ = 1;

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
 * Code a filesystem failure carries when the path simply is not there, which
 * is the one failure a run with no ledger is expected to produce.
 */
const DIRECTORY_ABSENT = 'ENOENT';

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
 * Names a caught failure by its filesystem code where it carries one, and by
 * its class otherwise.
 *
 * NAMES A CODE, NEVER A MESSAGE. A filesystem error's message quotes the path
 * it failed on and a run directory path can name a person, which is why
 * `errorName` exists at all. A code carries no path, and `EACCES` tells a
 * reader what to do where a bare `Error` tells them nothing.
 *
 * @param error - caught value, of unknown type by construction
 *
 * @returns Code or class name, whichever is there
 *
 * @example
 * ```ts
 * console.error(`could not read it (${failureName({ error, },)})`,);
 * ```
 */
function failureName(
  { error, }: { readonly error: unknown; },
): string {
  if (Error.isError(error,)
    && ('code' in error)
    && ((typeof error.code) === 'string'))
    return error.code;

  return errorName({ error, },);
}

/**
 * Lists a ledger directory, reporting an absent one as empty.
 *
 * @param dir - ledger directory to list
 *
 * @returns File names, empty where the directory is not there
 *
 * @example
 * ```ts
 * const names = await namesUnder({ dir, },);
 * ```
 */
async function namesUnder(
  { dir, }: { readonly dir: string; },
): Promise<readonly string[]> {
  try {
    return await readdir(dir,);
  } catch (error) {
    // ONLY AN ABSENT DIRECTORY IS AN ANSWER. Every other failure is re-raised,
    // because a run whose ledger could not be READ and a run that recorded
    // nothing read the same downstream, and treating a permission failure as an
    // empty ledger would report a roster question as unanswerable when the
    // evidence is sitting there.
    if (Error.isError(error,)
      && ('code' in error)
      && (error.code === DIRECTORY_ABSENT))
      return [];

    throw new Error(
      `ledger-report could not list the ledger directory (${failureName({ error, },)})`,
      { cause: error, },
    );
  }
}

/**
 * Reads every contest a ledger directory holds.
 *
 * @param dir - ledger directory to read
 *
 * @returns Contests in judging order, empty where the directory is absent
 *
 * @example
 * ```ts
 * const rounds = await roundsIn({ dir, },);
 * ```
 */
async function roundsIn(
  { dir, }: { readonly dir: string; },
): Promise<readonly ReadRound[]> {
  /**
   * Files the recorder wrote, empty where the directory is not there.
   *
   * AN ABSENT DIRECTORY IS AN ANSWER, not a fault: a run that wrote no ledger
   * is the ordinary case for everything launched before it existed, and the
   * caller reports that rather than raising.
   */
  const names = await namesUnder({ dir, },);

  /**
   * Names in the order the recorder stamped them, which is contest order:
   * every file is named by a zero-padded ordinal.
   */
  const inOrder = names.toSorted(function byName(
    left,
    right,
  ): number {
    return (left < right) ? -1 : 1;
  },);

  return await Promise.all(inOrder.map(async function one(name,): Promise<ReadRound> {
    /**
     * That file's text.
     */
    const text = await readFile(
      join(
        dir,
        name,
      ),
      'utf8',
    );

    return parseLedgerRound({
      value: JSON.parse(text,) as unknown,
      from: name,
    },);
  },),);
}

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

  /**
   * Every contest the ledger holds.
   */
  const rounds = await roundsIn({
    dir: join(
      runsDir,
      LEDGER_DIR,
    ),
  },);

  console.log(`ledger-report: ${String(rounds.length,)} contests under ${runsDir}`,);

  if (rounds.length === 0) {
    console.log(
      'NOTHING RECORDED. This run wrote no ledger, which is not the same as a run whose models '
        + 'wrote nothing: every run started before candidate-ledger.ts landed has none, and so does '
        + 'any run launched without TRANSLATION_REPAIR_RUNS_DIR set.',
    );
    process.exitCode = NOTHING_TO_READ;
    return;
  }

  if (wanted !== undefined) {
    /**
     * Everything that seat wrote.
     */
    const written = workOfModel({
      rounds,
      model: wanted,
    },);

    /**
     * Its candidates the panel chose.
     */
    const chosen = written.filter(function won(reading,): boolean {
      return reading.won;
    },);

    console.log(
      `${wanted} wrote ${String(written.length,)} candidates, `
        + `${String(chosen.length,)} chosen`,
    );
    written.forEach(function show(
      reading,
      at,
    ): void {
      printReading({
        reading,
        at,
      },);
    },);
    return;
  }

  /**
   * What every seat did.
   */
  const summary = summariseLedger({ rounds, },);

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

// NOT WRAPPED IN A CATCH. Every failure raised below already names itself
// safely, and re-throwing them under one class name replaced a message that
// says what happened with `Error`, which is what `verify-published.ts` learned
// by not doing it.
await reportLedger();

//endregion Ledger report
