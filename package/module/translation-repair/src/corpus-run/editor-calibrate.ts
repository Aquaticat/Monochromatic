import pLimit from 'p-limit';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  adoptCalibrationGrace,
  STRAGGLER_GRACE_VAR,
} from '../grace-override.ts';
import type { SyntheticClient, } from '../chat-contract.ts';
import { repairChunk, } from '../repair-chunk.ts';
import { settleRefinedSlice, } from '../refine-slice-settle.ts';
import {
  EDITOR_ROUND_STAGES,
  REFINER_ROUND_STAGES,
  selectionRoundsFor,
} from '../repair-selection-rounds.ts';
import type { RosterModelId, } from '../roster-id.ts';
import type { SelectionRound, } from '../self-preference.ts';
import {
  type BenchSlice,
  sampleBenchSlices,
} from './bench-sample.ts';
import {
  judgedAuthors,
  standingReportLines,
} from './editor-calibrate-standing.ts';
import {
  shippedAuthors,
  type SliceRounds,
  sliceProgressLine,
} from './editor-calibrate-slice.ts';
import {
  createRunClient,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';
import { readAskedCount, } from './asked-count.ts';
import {
  CALIBRATION_OVERLAP,
  readOverlap,
} from './slice-overlap.ts';
import { reportingRefusals, } from './cli-refusal.ts';

//region Editor calibrate
// WHICH OF THE ROSTER SHOULD EDIT, measured on the editor's own job.
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
// check, whatever the roster's width (eight when this was written, nine since
// 2026-09-01). The alternative is rotating editors out, which
// re-introduces the survivorship the shape exists to avoid. The trade is safe
// for THIS measurement because checking runs after selection: a standing reads
// the envelope and chunk-patch ballots, which are cast before any checker is
// asked. What self-certification can move is how many rounds happen, not who
// won the ones that did.
//
// IT RUNS THE NATURALNESS LANE TOO, so the refiner seat is measured rather
// than assumed. `repairChunk` does NOT reach it: it takes `refinerModelIds`
// only to compute the union of models it must seat, sets `refined: false`, and
// returns. Refinement is a separate stage the document driver runs afterwards.
// This was found live, by a nine-slice run reporting zero refiner rounds and no
// refine activity in its log at all, against a module note here claiming the
// refiner standing came off the same spend. It did not; it now does.
//
// THE REFINER SEAT WAS RESEATED ON THE SAME WRITING EVIDENCE the editor seat
// was, so it is exactly as unmeasured, and leaving it that way while measuring
// the seat beside it would answer half the question this runner exists for.
//
// EMPTY DEFINITIONS, honestly. A drawn slice has no document-level glossary
// block behind it, so there is nothing to pass; that is a real value here, not
// an absence dressed as one.
//
// THE TWO SEATS ARE CREDITED SEPARATELY, which takes work because the lane
// unions them. `collectRefinedAuthors` merges the editors with any refiner
// whose rewrite won, so the refined outcome's authorship names both seats in
// one list that cannot be split back apart. The editor column is therefore read
// off the accuracy lane's own outcome, and the refiner column off
// `settleRefinedSlice`'s `refinedBy`.
//
// WHO IS MISSING FROM EACH TABLE IS REPORTED TOO, by `producer-silence.ts`, and
// the two reasons are separated rather than lumped: a model its provider
// refused wrote nothing, while a model whose wording every peer proposed word
// for word shipped without a ballot. The first is evidence nobody bought yet
// and the second is evidence already paid for.
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
 * Runs one slice through the whole repair lane, every model editing and
 * every model judging.
 *
 * @param slice - passage to repair, with the archive text it stands against
 *
 * @param client - client every slice of the run shares
 *
 * @returns Rounds that slice produced, split by seat
 *
 * @example
 * ```ts
 * const rounds = await runOne({ slice, client, },);
 * ```
 */
async function runOne(
  {
    slice,
    client,
  }: {
    readonly slice: BenchSlice;
    readonly client: SyntheticClient;
  },
): Promise<SliceRounds> {
  /**
   * Logger tagged for this slice.
   */
  const l = tagged({ tag: `editor-calibrate-${slice.entryId}-${String(slice.index,)}`, },);

  /**
   * Abort signal for the whole slice.
   */
  const { signal, } = new AbortController();

  /**
   * Every seat filled by every model, matching the module note.
   */
  const models = {
    criticModelIds: RUN_ROSTER,
    panelModelIds: RUN_ROSTER,
    editorModelIds: RUN_ROSTER,
    judgeModelIds: RUN_ROSTER,
    refinerModelIds: RUN_ROSTER,
    checkerModelIds: RUN_ROSTER,
    // See the module note: a full editor roster leaves nobody independent,
    // and checking runs after the ballots a standing reads.
    checkerSelfCertificationPermitted: true,
  };

  /**
   * Everything the accuracy lane decided about this passage.
   */
  const outcome = await repairChunk({
    client,
    sliceIndex: slice.index,
    sourceText: slice.sourceText,
    targetText: slice.incumbentText,
    lineStructured: slice.lineStructured,
    models,
    declaredNames: [],
    signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
  },);

  /**
   * Same slice after the naturalness lane, whose rounds land on the outcome
   * beside the accuracy lane's own.
   */
  const refined = await settleRefinedSlice({
    client,
    outcome,
    sourceText: slice.sourceText,
    incumbentText: slice.incumbentText,
    // See the module note: a drawn slice carries no document glossary.
    definitions: '',
    models,
    refinerModelIds: RUN_ROSTER,
    declaredNames: [],
    signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
  },);

  return {
    editor: selectionRoundsFor({
      rounds: refined.outcome
        .rounds,
      stages: EDITOR_ROUND_STAGES,
    },),
    refiner: selectionRoundsFor({
      rounds: refined.outcome
        .rounds,
      stages: REFINER_ROUND_STAGES,
    },),
    refineAsked: refined.asked,
    editorShipped: shippedAuthors({ authorship: outcome.authorship, },),
    refinerShipped: refined.refinedBy,
    refinerHeard: refined.refinersHeard,
  };
}

/**
 * Prints how many slices the naturalness lane could reach at all.
 *
 * THE REFINER STANDING'S DENOMINATOR, and it is not the slice count. A
 * paragraph under the eligibility floor is never offered to a rewriter, so a
 * slice can buy the whole accuracy lane and reach no refiner. Without this an
 * empty refiner standing reads as a rewriter roster that answered nothing,
 * which is a different and much worse fact.
 *
 * @param perSlice - what every slice produced
 *
 * @example
 * ```ts
 * reportRefineReach({ perSlice, },);
 * ```
 */
function reportRefineReach(
  { perSlice, }: { readonly perSlice: readonly SliceRounds[]; },
): void {
  /**
   * Slices carrying a paragraph the lane was willing to offer a rewriter.
   */
  const asked = perSlice.filter(function eligible(slice,): boolean {
    return slice.refineAsked;
  },);

  console.log(
    `  reached a rewriter on ${String(asked.length,)} of ${String(perSlice.length,)} slices; `
      + 'the rest carried no paragraph over the eligibility floor, so no refiner was asked '
      + 'and their silence is not evidence about any model',
  );
}

/**
 * Prints what shipped, and how much of it no vote ever touched.
 *
 * THE STANDING'S BLIND SPOT, MEASURED. `selectChunkPatch` ships outright when
 * every proposal is identical, recording no round because there was nothing to
 * choose between. A slice like that repairs and contributes nothing to a
 * standing, so without this line a converged run reads as a lane that did no
 * work. It was found live: a slice whose panel adjudicated seven issues
 * repaired one of them and reported zero editor rounds.
 *
 * SHIPPING IS NOT WINNING. Nobody preferred this text to anything, so these
 * counts must never be read as a rate against the standing above.
 *
 * @param perSlice - what every slice produced
 *
 * @example
 * ```ts
 * reportShipped({ perSlice, },);
 * ```
 */
function reportShipped(
  { perSlice, }: { readonly perSlice: readonly SliceRounds[]; },
): void {
  /**
   * Slices that shipped a repair without any editor round being judged.
   */
  const unvoted = perSlice.filter(function converged(slice,): boolean {
    return (slice.editor
      .length
      === 0) && (slice.editorShipped
        .length
        > 0);
  },);

  /**
   * Slices that shipped a repair at all.
   */
  const shipping = perSlice.filter(function repaired(slice,): boolean {
    return slice.editorShipped
      .length
      > 0;
  },);

  console.log(
    `\nEDITORS SHIPPED on ${String(shipping.length,)} of ${String(perSlice.length,)} slices, `
      + `${String(unvoted.length,)} of them with no editor round judged at all`,
  );

  if (shipping.length === 0) {
    console.log('  NOTHING SHIPPED. No slice in this sample carried an accepted issue.',);
    return;
  }

  /**
   * How many slices each model wrote shipping text on.
   */
  const credits = new Map<RosterModelId, number>();

  for (const slice of shipping) {
    for (const modelId of slice.editorShipped) {
      credits.set(
        modelId,
        (credits.get(modelId,) ?? 0) + 1,
      );
    }
  }

  for (
    const [modelId, count,] of [...credits.entries(),].toSorted(function byCount(
      left,
      right,
    ): number {
      return right[1] - left[1];
    },)
  ) {
    console.log(
      `  ${modelId}: wrote shipping text on ${String(count,)} of ${String(shipping.length,)} slices`,
    );
  }

  console.log(
    '  THIS IS NOT A PREFERENCE. A model ships here by writing text that survived, including '
      + 'text every other editor proposed identically, which no judge was ever asked about.',
  );
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
  const wanted = readAskedCount({
    argv: process.argv,
    fallback: DEFAULT_SLICES,
    asks: 'slices',
  },);

  /**
   * How many slices may be in flight at once.
   *
   * FOUR BY THE OWNER'S DECISION OF 2026-08-26, read from the environment so
   * one build still serves both arms of a comparison: `1` reproduces the
   * sequential driver exactly, which is what makes the sequential arm a control
   * rather than a different program. Read before the sample is drawn, so a
   * value nothing can read refuses before any work is done.
   */
  const overlap = readOverlap({ fallback: CALIBRATION_OVERLAP, },);

  /**
   * Slices every model edits.
   */
  const sample = await sampleBenchSlices({ count: wanted, },);

  console.log(
    `editor-calibrate: ${String(sample.length,)} slices, `
      + `${String(RUN_ROSTER.length,)} models editing and judging each, `
      + `${String(overlap,)} slices in flight`,
  );

  /**
   * Straggler window this run's rounds wait under, and where it came from.
   *
   * ADOPTED HERE, before any round, so an unreadable override refuses the run
   * before it spends anything, and printed so the log says which window this
   * run was under whether or not a voice was ever cut. The calibration's own
   * window is 300000 ms under four slices in flight, the owner's decision of
   * 2026-08-26 on arm D; a launch that sets the variable is honored instead.
   */
  const grace = adoptCalibrationGrace();
  console.log(
    `straggler window ${String(grace.effectiveMs,)}ms (${
      (grace.source === 'override') ? `${STRAGGLER_GRACE_VAR} override` : 'calibration default'
    })`,
  );

  /**
   * Client every slice shares, built once for the run.
   *
   * ONCE RATHER THAN PER SLICE, because the client holds the budget cooldowns,
   * the meter caches and the per-model limiters: built per slice, a provider
   * held out on one slice was re-asked immediately on the next, and every
   * slice re-read the meters. The two probes already build theirs in `main`.
   *
   * SHARED ACROSS SLICES IN FLIGHT TOO, on purpose. The per-model limiter is
   * what production routes through, so a slice overlapping another meets the
   * same slot rule a corpus pass would, and the comparison describes the
   * program that would ship rather than one with the limiter taken out.
   */
  const client = createRunClient();

  /**
   * Admits at most `overlap` slices at a time.
   */
  const inFlight = pLimit(overlap,);

  /**
   * What every slice produced, IN SAMPLE ORDER rather than completion order.
   *
   * ORDER MATTERS HERE AND NOWHERE ELSE IN THE RUN. Every standing below is
   * computed off this array, so a report that depended on which slice happened
   * to finish first would not be comparable between two runs of one sample,
   * which is exactly what the overlap dial measures. `Promise.all` keeps input
   * order whatever order the work completes in.
   *
   * WHAT THE SEQUENTIAL DRIVER'S NOTE SAID, kept because it is the claim under
   * test: slices ran one at a time because one slice already fans eight models
   * across several stages, and stacking whole lanes was expected to queue
   * behind the per-model concurrency the client enforces anyway. That was
   * written before the multi-provider routing existed, and the run `#215`
   * measured spends 87.2% of its round time waiting after quorum, at a mean of
   * 2.56 calls in flight.
   */
  const perSlice: readonly SliceRounds[] = await Promise.all(
    sample.map(function runSlice(
      slice,
      position,
    ): Promise<SliceRounds> {
      return inFlight(async function admitted(): Promise<SliceRounds> {
        /**
         * Rounds this slice produced, both seats.
         */
        const rounds = await runOne({
          slice,
          client,
        },);

        // PER SLICE RATHER THAN ONLY AT THE END. A whole lane per slice makes
        // this a long run, and a report that arrives only on completion is
        // unreadable while it matters most: a reader watching an outage needs
        // to know whether rounds are accumulating at all.
        console.log(sliceProgressLine({
          position,
          total: sample.length,
          slice,
          rounds,
        },),);

        return rounds;
      },);
    },),
  );

  /**
   * Editor rounds, grouped by the slice that bought them.
   */
  const editorPerSlice = perSlice.map(function editorRounds(rounds,): readonly SelectionRound[] {
    return rounds.editor;
  },);

  /**
   * Refiner rounds, grouped the same way.
   */
  const refinerPerSlice = perSlice.map(function refinerRounds(rounds,): readonly SelectionRound[] {
    return rounds.refiner;
  },);

  for (
    const line of standingReportLines({
    seat: 'EDITOR',
    roster: RUN_ROSTER,
    perSlice: editorPerSlice,
    // JUDGED AUTHORS PLUS SHIPPING ONES, because a slice where every editor
    // proposed the same text ships it with no round at all, and a model seen
    // only there wrote something no ballot names.
    produced: [
      ...judgedAuthors({ perSlice: editorPerSlice, },),
      ...perSlice.flatMap(function shippingEditors(rounds,): readonly RosterModelId[] {
        return rounds.editorShipped;
      },),
    ],
    // THE EDITOR STAGE CARRIES NO ANSWER LIST OUT OF THE CHUNK OUTCOME, only a
    // count for `editor-width-arm`, so this seat cannot tell an editor that
    // answered and was dropped before judging from one that never answered.
    // The line it prints says so and points at the SEAT lines.
    answered: { kind: 'unrecorded', },
  },)
  ) {
    console.log(line,);
  }

  for (
    const line of standingReportLines({
    seat: 'REFINER',
    roster: RUN_ROSTER,
    perSlice: refinerPerSlice,
    produced: [
      ...judgedAuthors({ perSlice: refinerPerSlice, },),
      ...perSlice.flatMap(function shippingRefiners(rounds,): readonly RosterModelId[] {
        return rounds.refinerShipped;
      },),
    ],
    // WHO THE REFINE STAGE HEARD, so a rewriter that answered every ask and
    // left every paragraph as it stood is reported as answered, not silent.
    answered: {
      kind: 'recorded',
      modelIds: perSlice.flatMap(function heardRefiners(rounds,): readonly RosterModelId[] {
        return rounds.refinerHeard;
      },),
    },
  },)
  ) {
    console.log(line,);
  }

  reportRefineReach({ perSlice, },);

  reportShipped({ perSlice, },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'editor-calibrate',
    run: main,
  },);

//endregion Editor calibrate
