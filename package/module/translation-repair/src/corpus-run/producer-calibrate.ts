import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { producerModelIds, } from '../candidate-select-model.ts';
import { errorName, } from '../error-name.ts';
import {
  coverageGapLines,
  readStandingCoverage,
} from '../producer-silence.ts';
import { producerStandings, } from '../producer-standing.ts';
import {
  rankStandings,
  standingLine,
} from '../producer-standing-report.ts';
import type { RosterModelId, } from '../roster-id.ts';
import type { SelectionRound, } from '../self-preference.ts';
import { runTranslateStage, } from '../translate-stage.ts';
import {
  type BenchSlice,
  sampleBenchSlices,
} from './bench-sample.ts';
import {
  createRunClient,
  readHeadSha,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';
import { reportingRefusals, } from './cli-refusal.ts';

//region Producer calibrate
// WHICH OF THE TEN SHOULD WRITE, measured rather than assumed.
//
// The roster carries ten models and the writers stay at three. `roster-bench.ts`
// answered the question about WIDTH and found it changes nothing; this answers
// the question about WHO, which that bench was never shaped to ask.
//
// EVERY MODEL WRITES ON EVERY SLICE. A narrow slate would only ever compare the
// models that happened to be seated, and the head-of-roster seating the width
// bench uses would compare the first three against nothing. Running all ten
// against the same passage is the only shape where a standing means the same
// thing for each of them.
//
// EVERY MODEL ALSO JUDGES, matching production, and the standing then throws
// away each model's ballots on its own work. That is `producer-standing.ts`'s
// whole argument: counting self-votes would rank the most self-confident model
// first rather than the best-written one.
//
// ONE PASS PER SLICE. The sample size is the SLICE COUNT, not a repeat count,
// and the counts are reported beside every rate so a reader can see how much
// weight one leads by. A gap smaller than its own denominator supports is not
// a gap.
//
// WHO IS MISSING FROM THE TABLE IS REPORTED TOO. `producerStandings` carries a
// row only for a model somebody voted on, so a model its provider refused for
// budget simply vanishes, and an absent row reads exactly like a model that
// wrote and lost. This runner seated the writers on a day one of the two
// providers was empty. `producer-silence.ts` splits the seats three ways and
// names both silent groups; the slates are what tell them apart, which is why
// every round's authors are carried beside its ballots.
//
// SPENDS QUOTA, roughly twenty calls per slice before any re-ask. Point
// `TRANSLATION_REPAIR_RUNS_DIR` at a throwaway directory.

/**
 * Slices drawn when the caller names no count.
 */
const DEFAULT_SLICES = 10;

/**
 * What one slice produced, with everyone who wrote on it.
 *
 * THE AUTHORS ARE CARRIED APART FROM THE ROUND, because a standing is summed
 * from ballots and a slate can hold a candidate no ballot ever named. Without
 * this list a model its provider refused and a model whose wording every peer
 * proposed word for word are both simply absent from the table, and the two
 * call for opposite readings.
 *
 * @example
 * ```ts
 * const { round, authors, } = await runOne({ slice, },);
 * ```
 */
type SliceRound = {
  /**
   * Slate and ballots, in the shape a standing is summed from.
   */
  readonly round: SelectionRound;

  /**
   * Every model holding a stake in any candidate on that slate, including one
   * whose text was collapsed into an identical peer's.
   */
  readonly authors: readonly RosterModelId[];
};

/**
 * Runs one slice with every model writing and every model judging.
 *
 * @param slice - passage to translate
 *
 * @returns Slate, ballots and authors of that round
 *
 * @example
 * ```ts
 * const round = await runOne({ slice, },);
 * ```
 */
async function runOne(
  { slice, }: { readonly slice: BenchSlice; },
): Promise<SliceRound> {
  /**
   * Logger tagged for this slice.
   */
  const l = tagged({ tag: `calibrate-${slice.entryId}-${String(slice.index,)}`, },);

  /**
   * What the stage decided, with every seat filled.
   */
  const result = await runTranslateStage({
    client: createRunClient(),
    translatorModelIds: RUN_ROSTER,
    judgeModelIds: RUN_ROSTER,
    sourceText: slice.sourceText,
    incumbentText: slice.incumbentText,
    // Every drawn slice comes from a pair the archive HAS translated, so there
    // is always something to fall back on.
    incumbentKind: 'present',
    lineStructured: slice.lineStructured,
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
  },);

  /**
   * Provenance of every candidate the judges were shown, in slate order.
   */
  const producers = result
    .slate
    .map(function toProducer(entry,) {
      return entry.producer;
    },);

  return {
    round: {
      producers,
      ballots: result.ballots,
    },
    authors: producers.flatMap(function stakeholders(producer,): readonly RosterModelId[] {
      return producerModelIds(producer,);
    },),
  };
}

/**
 * Runs the calibration and prints the standing.
 *
 * Returns nothing: the report on stdout IS the output.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Slices asked for on the command line, or the default.
   */
  const wanted = Number(process.argv[2] ?? String(DEFAULT_SLICES,),);

  /**
   * Slices every model writes.
   */
  const sample = await sampleBenchSlices({ count: wanted, },);

  /**
   * Pipeline commit this calibration was produced by.
   */
  const headSha = await readHeadSha();

  console.log(
    `CALIBRATE ${String(sample.length,)} slices, all ${String(RUN_ROSTER.length,)} writing`
      + ` and all ${String(RUN_ROSTER.length,)} judging, at ${headSha}`,
  );

  /**
   * Rounds accumulated as they finish, so a killed run still reports.
   *
   * SEQUENTIAL rather than fanned out: each round already asks twenty models,
   * and running slices concurrently on top would multiply that into the
   * providers at once for no gain in what is being measured.
   */
  const rounds: SliceRound[] = [];

  for (const slice of sample) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- one round already asks twenty models
      rounds.push(await runOne({ slice, },),);
      console.log(
        `  ${slice.entryId}#${String(slice.index,)}: round ${String(rounds.length,)}`
          + ` of ${String(sample.length,)}`,
      );
    } catch (error) {
      // A slice that fails is one fewer round, not a failed calibration; the
      // denominators report how much evidence survived.
      console.log(
        `  ${slice.entryId}#${String(slice.index,)}: LOST (${
          errorName({ error, },)
        })`,
      );
    }
  }

  /**
   * What the surviving rounds came to.
   */
  const standings = producerStandings({
    rounds: rounds.map(function toRound(sliceRound,): SelectionRound {
      return sliceRound.round;
    },),
  },);

  console.log(`\nSTANDING over ${String(rounds.length,)} rounds, best first:`,);
  for (const standing of rankStandings({ standings, },)) {
    console.log(`  ${standingLine({ standing, },)}`,);
  }

  /**
   * Which of the seated models that table actually describes.
   *
   * READ AFTER THE TABLE IS PRINTED, so a run whose evidence disagrees with its
   * own roster still leaves every standing it paid for on stdout before the
   * refusal.
   */
  const coverage = readStandingCoverage({
    roster: RUN_ROSTER,
    standings,
    produced: rounds.flatMap(function authorsOf(sliceRound,): readonly RosterModelId[] {
      return sliceRound.authors;
    },),
  },);

  for (const line of coverageGapLines({ coverage, },)) {
    console.log(`  ${line}`,);
  }

  console.log(
    '\nA lead smaller than its own denominator supports is not a lead.'
      + ' Read the counts before seating anyone.',
  );
}

if (import.meta.main)
  await reportingRefusals({
    what: 'producer-calibrate',
    run: main,
  },);

//endregion Producer calibrate
