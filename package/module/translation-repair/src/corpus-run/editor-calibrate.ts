import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { producerStandings, } from '../producer-standing.ts';
import {
  rankStandings,
  standingLine,
} from '../producer-standing-report.ts';
import { repairChunk, } from '../repair-chunk.ts';
import {
  EDITOR_ROUND_STAGES,
  REFINER_ROUND_STAGES,
  selectionRoundsFor,
} from '../repair-selection-rounds.ts';
import type { SelectionRound, } from '../self-preference.ts';
import {
  type BenchSlice,
  sampleBenchSlices,
} from './bench-sample.ts';
import {
  createRunClient,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';

//region Editor calibrate
// WHICH OF THE TEN SHOULD EDIT, measured on the editor's own job.
//
// `producer-calibrate.ts` seated the three writers, and its instrument drives
// `runTranslateStage`: a model writing English from Chinese, with nothing in
// front of it but the source. An editor does something else. It is handed
// archive text, a set of adjudicated claims against it, and a window of
// neighbouring prose, and asked to repair what the claims name without
// disturbing what they do not. Seating an editor on a writer's standing is one
// step removed from the job, and this closes that step.
//
// IT DRIVES THE LANE RATHER THAN REPLAYING IT. `ChunkRepairOutcome.rounds`
// already carries every slate judges saw with each candidate's producer
// attached, plus every ballot, which is what a standing counts.
// `repair-selection-rounds.ts` re-shapes it. So the critics, the panel and the
// window are all real: the claims an editor works from here are claims models
// actually raised about that passage, not fixtures.
//
// EVERY MODEL EDITS EVERY SLICE, for the reason the writer calibration gives:
// a narrow slate compares only the models that happened to be seated, and a
// standing then means something different for each of them.
//
// CHECKERS SELF-CERTIFY HERE, AND ONLY HERE. Production forbids a checker from
// proving its own repair, so a full editor roster leaves nobody independent to
// check, and the roster is ten. The alternative is rotating editors out, which
// re-introduces the survivorship the shape exists to avoid. The trade is safe
// for THIS measurement because checking runs after selection: a standing reads
// the envelope and chunk-patch ballots, which are cast before any checker is
// asked. What self-certification can move is how many rounds happen, not who
// won the ones that did.
//
// IT REPORTS THE REFINER STANDING TOO, off the same spend. The refine rounds
// are recorded beside the editor's and belong to a different seat, so throwing
// them away would mean buying them twice.
//
// SPENDS QUOTA, and more per slice than the writer calibration does: a whole
// repair lane rather than one stage. Point `TRANSLATION_REPAIR_RUNS_DIR` at a
// throwaway directory.

/**
 * Slices drawn when the caller names no count.
 *
 * SMALLER THAN THE WRITER CALIBRATION'S DEFAULT, because a slice here buys a
 * whole lane rather than one stage.
 */
const DEFAULT_SLICES = 6;

/**
 * Rounds one slice produced, split by the seat that produced them.
 */
type SliceRounds = {
  /**
   * Rounds the editors' candidates were judged in.
   */
  readonly editor: readonly SelectionRound[];

  /**
   * Rounds the refiners' candidates were judged in.
   */
  readonly refiner: readonly SelectionRound[];
};

/**
 * Runs one slice through the whole repair lane, every model editing and
 * every model judging.
 *
 * @param slice - passage to repair, with the archive text it stands against
 *
 * @returns Rounds that slice produced, split by seat
 *
 * @example
 * ```ts
 * const rounds = await runOne({ slice, },);
 * ```
 */
async function runOne(
  { slice, }: { readonly slice: BenchSlice; },
): Promise<SliceRounds> {
  /**
   * Logger tagged for this slice.
   */
  const l = tagged({ tag: `editor-calibrate-${slice.entryId}-${String(slice.index,)}`, },);

  /**
   * Everything the lane decided about this passage.
   */
  const outcome = await repairChunk({
    client: createRunClient(),
    chunkIndex: slice.index,
    sourceText: slice.sourceText,
    targetText: slice.incumbentText,
    lineStructured: slice.lineStructured,
    models: {
      criticModelIds: RUN_ROSTER,
      panelModelIds: RUN_ROSTER,
      editorModelIds: RUN_ROSTER,
      judgeModelIds: RUN_ROSTER,
      refinerModelIds: RUN_ROSTER,
      checkerModelIds: RUN_ROSTER,
      // See the module note: a full editor roster leaves nobody independent,
      // and checking runs after the ballots a standing reads.
      checkerSelfCertificationPermitted: true,
    },
    declaredNames: [],
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
  },);

  return {
    editor: selectionRoundsFor({
      rounds: outcome.rounds,
      stages: EDITOR_ROUND_STAGES,
    },),
    refiner: selectionRoundsFor({
      rounds: outcome.rounds,
      stages: REFINER_ROUND_STAGES,
    },),
  };
}

/**
 * Prints one seat's standing over the rounds it produced.
 *
 * @param seat - what the standing is about, for the heading
 *
 * @param perSlice - that seat's rounds, grouped by the slice that bought them
 *
 * @example
 * ```ts
 * reportSeat({ seat: 'EDITOR', perSlice, },);
 * ```
 */
function reportSeat(
  {
    seat,
    perSlice,
  }: {
    readonly seat: string;
    readonly perSlice: readonly (readonly SelectionRound[])[];
  },
): void {
  /**
   * Every round this seat produced, across every slice.
   */
  const rounds = perSlice.flat();

  /**
   * Slices that produced any round at all.
   *
   * THE DENOMINATOR THE ROUND COUNT HIDES. A slice carrying no accepted issue
   * never asks an editor to write, so it buys critics and a panel and
   * contributes nothing here. Without this, a standing drawn almost entirely
   * from one slice reads the same as one drawn evenly from six, and the first
   * is a much narrower measurement than its round count suggests.
   */
  const contributed = perSlice.filter(function paidIn(slice,): boolean {
    return slice.length > 0;
  },);

  console.log(
    `\n${seat} standing over ${String(rounds.length,)} judged rounds, `
      + `from ${String(contributed.length,)} of ${String(perSlice.length,)} slices`,
  );

  if (rounds.length === 0) {
    console.log(
      '  NO ROUNDS. This seat judged nothing across the sample, so it has no standing. '
        + 'For the editor seat that means no slice carried an ACCEPTED issue: critics can '
        + 'raise claims and the panel can adjudicate them and the lane still report '
        + '"nothing to edit", which is what one live slice did. For the refiner seat it '
        + 'means the naturalness lane proposed nothing. Draw more slices.',
    );
    return;
  }

  /**
   * What the rounds came to, best first.
   */
  const standings = producerStandings({ rounds, },);

  for (const standing of rankStandings({ standings, },)) {
    console.log(`  ${standingLine({ standing, },)}`,);
  }

  /**
   * Roster models that wrote no candidate at all.
   *
   * NAMED RATHER THAN OMITTED. `producerStandings` lists only models that
   * wrote something, so a model whose provider was out of budget simply
   * vanishes from the table, and absence there reads exactly like a model
   * that wrote and lost. During a provider outage that is half the roster.
   */
  const silent = RUN_ROSTER.filter(function wroteNothing(modelId,): boolean {
    return !standings.some(function isIt(standing,): boolean {
      return standing.modelId === modelId;
    },);
  },);

  if (silent.length > 0) {
    console.log(
      `  WROTE NOTHING, so this standing says nothing about them: ${silent.join(', ',)}. `
        + 'Check the log for lost voices: a model refused for budget leaves no candidate, '
        + 'which is absence of evidence rather than a poor showing.',
    );
  }
}

/**
 * Runs the calibration and prints both standings.
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
   * Slices every model edits.
   */
  const sample = await sampleBenchSlices({ count: wanted, },);

  console.log(
    `editor-calibrate: ${String(sample.length,)} slices, `
      + `${String(RUN_ROSTER.length,)} models editing and judging each`,
  );

  /**
   * What every slice produced.
   *
   * SEQUENTIAL RATHER THAN FANNED OUT. One slice already fans ten models
   * across several stages, and stacking whole lanes on top of that would
   * queue behind the per-model concurrency the client enforces anyway.
   */
  const perSlice: SliceRounds[] = [];

  for (const slice of sample) {
    /* oxlint-disable no-await-in-loop -- slices run one at a time on purpose;
       see the note on `perSlice`. */
    /**
     * Rounds this slice produced, both seats.
     */
    const rounds = await runOne({ slice, },);
    /* oxlint-enable no-await-in-loop */

    perSlice.push(rounds,);

    /**
     * How many rounds the editors were judged in on this slice.
     */
    const editorCount = rounds
      .editor
      .length;

    /**
     * How many the refiners were judged in.
     */
    const refinerCount = rounds
      .refiner
      .length;

    // PER SLICE RATHER THAN ONLY AT THE END. A whole lane per slice makes this
    // a long run, and a report that arrives only on completion is unreadable
    // while it matters most: a reader watching an outage needs to know whether
    // rounds are accumulating at all.
    console.log(
      `  slice ${String(perSlice.length,)} of ${String(sample.length,)} `
        + `(${slice.entryId} chunk ${String(slice.index,)}): `
        + `${String(editorCount,)} editor rounds, `
        + `${String(refinerCount,)} refiner rounds`,
    );
  }

  reportSeat({
    seat: 'EDITOR',
    perSlice: perSlice.map(function editorRounds(rounds,): readonly SelectionRound[] {
      return rounds.editor;
    },),
  },);

  reportSeat({
    seat: 'REFINER',
    perSlice: perSlice.map(function refinerRounds(rounds,): readonly SelectionRound[] {
      return rounds.refiner;
    },),
  },);
}

await main();

//endregion Editor calibrate
