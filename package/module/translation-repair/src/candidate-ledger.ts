import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import {
  type Candidate,
  type CandidateProducer,
  producerModelIds,
  type SelectionBallot,
} from './candidate-select-model.ts';
import { errorName, } from './error-name.ts';

//region Candidate ledger
// WHAT EACH MODEL ACTUALLY WROTE, and what the judges said about it.
//
// WHY THIS EXISTS. Every contest in this pipeline ran through
// `selectBestCandidate`, counted ballots, reported a standing, and then threw
// the text away. A standing says a model was preferred on 3% of ballots; it
// cannot say whether that model wrote something wrong or merely something
// nobody picked as the single best of ten. Those are different findings with
// different remedies, and no run this project has ever made could tell them
// apart after the fact.
//
// IT COST A REAL INVESTIGATION. Asked to confirm or reject that one seat was
// weak, the only honest answer available from the archive was that no run had
// kept a single line that seat produced, and re-deriving it meant buying fresh
// calls. A roster decision should read evidence the run already paid for.
//
// ONE HOOK, EVERY CONTEST. This is written from `selectBestCandidate`, which
// the translate lane, both editor paths, the refiner and the fidelity judge all
// route through, so no caller has to remember to record anything.
//
// NEVER RAISES INTO THE SELECTION PATH. A pipeline that failed a slice because
// its telemetry could not write would be worse than one with no telemetry, so
// every failure here is caught, named and swallowed. The absence shows up in
// the report rather than in the run.
//
// HOLDS UNLICENSED CORPUS WORDING, exactly as the settled artifacts already do,
// because candidate text is a rendering of a corpus passage. It lands under the
// run directory, which is outside this repository, and it must never be
// committed. `TRANSLATION_REPAIR_RUNS_DIR` names that directory; with the
// variable unset nothing is written at all, which is what unit runs want.

/**
 * Directory under a runs dir holding one file per judged contest.
 */
const LEDGER_DIR = 'ledger';

/**
 * Width the ordinal is padded to, so a thousand contests still sort as text.
 */
const ORDINAL_DIGITS = 6;

/**
 * Environment variable naming the run directory, matching `run-config.ts`.
 *
 * READ DIRECTLY RATHER THAN THROUGH `resolveRunsDir`, because that lives in
 * `corpus-run/` and this is core pipeline code. A core module reaching into the
 * runner family to write telemetry would invert the dependency the rest of the
 * package keeps.
 */
const RUNS_DIR_VARIABLE = 'TRANSLATION_REPAIR_RUNS_DIR';

/**
 * How many contests this process has recorded, used to order the files.
 *
 * A HOLDER RATHER THAN A BARE BINDING, matching the `state` object in
 * `anthropic-delta-scan.ts`: the count has to change, and a mutable module
 * binding is the shape this codebase avoids.
 */
const state = { recorded: 0, };

/**
 * One candidate as it was shown to the judges.
 */
export type LedgerCandidate = {
  /**
   * One-based position in the slate, which is what a ballot names.
   */
  readonly index: number;

  /**
   * Every model with a hand in this candidate, composites expanded.
   */
  readonly producers: readonly string[];

  /**
   * Exactly the text judges compared.
   */
  readonly rendered: string;
};

/**
 * One judged contest, whole.
 */
export type LedgerRound = {
  /**
   * What the judges were asked to decide, verbatim from the caller.
   */
  readonly task: string;

  /**
   * When it was judged.
   */
  readonly at: string;

  /**
   * Every candidate, in the order the judges saw them.
   */
  readonly candidates: readonly LedgerCandidate[];

  /**
   * Every ballot, reasons included.
   */
  readonly ballots: readonly SelectionBallot[];

  /**
   * Winning position, or that nothing was chosen.
   */
  readonly selectedIndex: number | 'declined';
};

/**
 * Names every model behind a candidate, composites expanded.
 *
 * @param producer - provenance the slate recorded
 *
 * @returns Model ids, one entry per contributor
 *
 * @example
 * ```ts
 * const names = producersOf({ producer, },);
 * ```
 */
function producersOf(
  { producer, }: { readonly producer: CandidateProducer; },
): readonly string[] {
  // ALREADY THE ANSWER. `RosterModelId` is a union of string literals, so the
  // ids need no conversion; mapping them through an identity would only add a
  // step for a reader to check.
  return producerModelIds(producer,);
}

/**
 * Records one judged contest, text and ballots together.
 *
 * SWALLOWS EVERY FAILURE. See the module note: telemetry must not be able to
 * fail a slice the run already paid for.
 *
 * @param task - what the judges were asked, used to tell contests apart
 *
 * @param candidates - slate exactly as the judges saw it
 *
 * @param ballots - what each judge said, reasons verbatim
 *
 * @param selectedIndex - winning position, or that the round declined
 *
 * @param l - pipeline logger
 *
 * @example
 * ```ts
 * await recordContest({ task, candidates, ballots, selectedIndex, l, },);
 * ```
 */
export async function recordContest<ValueT,>(
  {
    task,
    candidates,
    ballots,
    selectedIndex,
    l,
  }: {
    readonly task: string;
    readonly candidates: readonly Candidate<ValueT>[];
    readonly ballots: readonly SelectionBallot[];
    readonly selectedIndex: number | 'declined';
    readonly l: Logger;
  },
): Promise<void> {
  /**
   * Run directory to write under, absent outside a run.
   */
  const runsDir = process.env[RUNS_DIR_VARIABLE];

  // NOTHING TO WRITE OUTSIDE A RUN, which is the ordinary case for unit tests
  // and for probes that set no run directory. Silent because it is not a fault.
  if ((runsDir === undefined) || (runsDir === ''))
    return;

  /**
   * Logger tagged with this recorder.
   */
  const rl = tagged({
    tag: recordContest.name,
    l,
  },);

  /**
   * Position of this contest in the process, so files sort in judging order.
   */
  const ordinal = state.recorded;
  state.recorded += 1;

  /**
   * Everything this contest held.
   */
  const round: LedgerRound = {
    task,
    at: new Date().toISOString(),
    candidates: candidates.map(function asLedger(
      candidate,
      at,
    ): LedgerCandidate {
      return {
        index: at + 1,
        producers: producersOf({ producer: candidate.producer, },),
        rendered: candidate.rendered,
      };
    },),
    ballots,
    selectedIndex,
  };

  /**
   * Ordinal rendered wide enough that a thousand contests sort as text.
   */
  const padded = String(ordinal,)
    .padStart(
      ORDINAL_DIGITS,
      '0',
    );

  try {
    /**
     * Directory the ledger lives in, created on first write.
     */
    const dir = join(
      runsDir,
      LEDGER_DIR,
    );
    await mkdir(
      dir,
      { recursive: true, },
    );
    await writeFile(
      join(
        dir,
        `${padded}.json`,
      ),
      JSON.stringify(
        round,
        null,
        2,
      ),
      'utf8',
    );
  } catch (error) {
    // NAMED, NOT QUOTED. A filesystem error quotes a path, and a run directory
    // path can name a person.
    rl.warn(
      `could not record contest ${String(ordinal,)}: ${errorName({ error, },)}. `
        + 'The run is unaffected; this contest will be missing from the ledger',
    );
  }
}

//endregion Candidate ledger
