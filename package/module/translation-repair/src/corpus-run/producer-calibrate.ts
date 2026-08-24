import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { errorName, } from '../error-name.ts';
import {
  preferenceRate,
  type ProducerStanding,
  producerStandings,
} from '../producer-standing.ts';
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
// SPENDS QUOTA, roughly twenty calls per slice before any re-ask. Point
// `TRANSLATION_REPAIR_RUNS_DIR` at a throwaway directory.

/**
 * Slices drawn when the caller names no count.
 */
const DEFAULT_SLICES = 10;

/**
 * Percent, for rendering a share as one.
 */
const AS_PERCENT = 100;

/**
 * Decimal places a reported share carries.
 */
const SHARE_PLACES = 1;

/**
 * Runs one slice with every model writing and every model judging.
 *
 * @param slice - passage to translate
 *
 * @returns Slate and ballots of that round
 *
 * @example
 * ```ts
 * const round = await runOne({ slice, },);
 * ```
 */
async function runOne(
  { slice, }: { readonly slice: BenchSlice; },
): Promise<SelectionRound> {
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

  return {
    producers: result
      .slate
      .map(function toProducer(entry,) {
        return entry.producer;
      },),
    ballots: result.ballots,
  };
}

/**
 * Renders one model's standing as a report line.
 *
 * @param standing - counts for one model
 *
 * @returns Line naming the share and the evidence behind it
 *
 * @example
 * ```ts
 * console.log(standingLine({ standing, },),);
 * ```
 */
function standingLine(
  { standing, }: { readonly standing: ProducerStanding; },
): string {
  /**
   * Share of disinterested ballots, where anything was cast.
   */
  const rate = preferenceRate({ standing, },);

  /**
   * That share rendered, or a mark saying nothing was cast.
   */
  const share = rate.measured
    ? `${(rate.share * AS_PERCENT).toFixed(SHARE_PLACES,)}%`
    : 'UNJUDGED';

  return `${standing.modelId}: ${share} (${String(standing.disinterestedVotes,)}`
    + ` of ${String(standing.disinterestedBallots,)} disinterested ballots,`
    + ` over ${String(standing.candidates,)} candidates)`;
}

/**
 * Orders standings best first, with unjudged models last.
 *
 * @param standings - what the tally produced
 *
 * @returns Same standings, sorted
 *
 * @example
 * ```ts
 * const ranked = rankStandings({ standings, },);
 * ```
 */
function rankStandings(
  { standings, }: { readonly standings: readonly ProducerStanding[]; },
): readonly ProducerStanding[] {
  return standings.toSorted(function byShare(
    left,
    right,
  ): number {
    /**
     * Both shares, with an unjudged model sorting last rather than as a zero.
     */
    const leftRate = preferenceRate({ standing: left, },);

    /**
     * Right-hand share, read the same way.
     */
    const rightRate = preferenceRate({ standing: right, },);

    if (!leftRate.measured)
      return rightRate.measured ? 1 : 0;
    if (!rightRate.measured)
      return -1;
    return rightRate.share - leftRate.share;
  },);
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
  const rounds: SelectionRound[] = [];

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

  console.log(`\nSTANDING over ${String(rounds.length,)} rounds, best first:`,);
  for (const standing of rankStandings({ standings: producerStandings({ rounds, },), },)) {
    console.log(`  ${standingLine({ standing, },)}`,);
  }
  console.log(
    '\nA lead smaller than its own denominator supports is not a lead.'
      + ' Read the counts before seating anyone.',
  );
}

await main();

//endregion Producer calibrate
