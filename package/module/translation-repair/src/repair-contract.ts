import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import {
  FULL_VOTE_WEIGHT,
  MIN_SELECTION_WEIGHT,
  SELF_VOTE_WEIGHT,
} from './candidate-select-model.ts';
import type { ClaimAttribution, } from './critic-attribution.ts';
import type { IntroducedDefectReport, } from './introduced-defect-probe.ts';
import type { RepairRegion, } from './repair-region.ts';
import type { RepairJudgedRound, } from './repair-round-record.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Repair contract
// Role roster and chunk outcome types shared by the chunk runner, the
// document driver, and the benchmark; they live beside neither so the
// runner stays within its line budget.

/**
 * Model roster for one repair run, by role.
 *
 * @example
 * ```ts
 * const models: RepairModels = {
 *   criticModelIds: wholeRoster,
 *   panelModelIds: wholeRoster,
 *   editorModelIds: twoEditors,
 *   judgeModelIds: wholeRoster,
 *   checkerModelIds: rosterMinusEditors,
 * };
 * ```
 */
export type RepairModels = {
  /**
   * Critic fan-out electorate.
   */
  readonly criticModelIds: readonly SyntheticModelId[];

  /**
   * Fixed adjudication panel.
   */
  readonly panelModelIds: readonly SyntheticModelId[];

  /**
   * Editors that each independently propose a repaired candidate;
   * judges drawn from {@link RepairModels.judgeModelIds} choose what ships,
   * so no one model decides the repaired text.
   */
  readonly editorModelIds: readonly SyntheticModelId[];

  /**
   * Whole roster candidate selection draws judges from, editors included.
   *
   * Producers used to be removed per round, which is why this once required a
   * model that never edits. Since the ruling of 2026-08-14 they are seated and
   * a ballot for their own work is discounted instead, so the only requirement
   * left is that some candidate could reach the minimum weight: see
   * {@link assertJudgeableEditorRoster}.
   */
  readonly judgeModelIds: readonly SyntheticModelId[];

  /**
   * Extra rule line appended to the editor system prompt, for prompt
   * calibration experiments; absent means the baseline prompt.
   */
  readonly editorRuleAddendum?: string;

  /**
   * Rewriters proposing naturalness refinements over the repaired text.
   *
   * Absent means the lane is off, which is a supported configuration: the
   * accuracy pipeline is complete without it.
   */
  readonly refinerModelIds?: readonly SyntheticModelId[];

  /**
   * Resolution checkers proving the repair. Must exclude every editor AND
   * every refiner, or a model ends up certifying text it wrote.
   */
  readonly checkerModelIds: readonly SyntheticModelId[];
};

/**
 * Thrown when a roster could not decide a round however its judges voted.
 *
 * NAMED FOR THE ROLE IT ACTUALLY GUARDS. It was `EditorRosterError` while the
 * editor ensemble was the only stage that produced candidates; the translate
 * lane and the naturalness lane throw it too, and both were passing their own
 * producers into a field called `editorModelIds`. The `role` parameter has
 * always said which stage the message names, so the type was the last place
 * still claiming editors.
 *
 * @example
 * ```ts
 * throw new ProducerRosterError({ producerModelIds, judgeModelIds, fault, },);
 * ```
 */
export class ProducerRosterError extends Error {
  /**
   * Builds the report from the two colliding rosters.
   *
   * @param producerModelIds - models that propose candidates in this stage
   *
   * @param judgeModelIds - roster judges are drawn from
   *
   * @param role - what the producers do, so the message names the real stage
   * rather than always saying editor; defaults to `editor`
   *
   * @param fault - what exactly is wrong, since the guard refuses for several
   * unrelated reasons and a message covering all of them sends whoever reads it
   * looking in the wrong place
   */
  constructor(
    {
      producerModelIds,
      judgeModelIds,
      role = 'editor',
      fault,
    }: {
      readonly producerModelIds: readonly SyntheticModelId[];
      readonly judgeModelIds: readonly SyntheticModelId[];
      readonly role?: string;
      readonly fault: string;
    },
  ) {
    super(
      `this ${role} roster cannot select anything: ${fault}. ${role}s [${
        producerModelIds.join(', ',)
      }], judges [${judgeModelIds.join(', ',)}]`,
    );
    this.name = 'ProducerRosterError';
  }
}

/**
 * Refuses an editor roster that could not decide a round.
 *
 * Names the editor role and defers everything else to
 * `assertJudgeableProducerRoster`, which holds the rule and the reasoning.
 *
 * @param editorModelIds - editors that propose candidates
 *
 * @param judgeModelIds - roster judges are drawn from
 *
 * @throws {@link ProducerRosterError} when either side repeats, editors are
 * empty, or too few judges are seated to reach the minimum weight
 *
 * @example
 * ```ts
 * assertJudgeableEditorRoster({ editorModelIds, judgeModelIds, },);
 * ```
 */
export function assertJudgeableEditorRoster(
  {
    editorModelIds,
    judgeModelIds,
  }: {
    readonly editorModelIds: readonly SyntheticModelId[];
    readonly judgeModelIds: readonly SyntheticModelId[];
  },
): void {
  assertJudgeableProducerRoster({
    producerModelIds: editorModelIds,
    judgeModelIds,
    role: 'editor',
  },);
}

/**
 * Refuses a roster that could not decide a round however it voted.
 *
 * WHAT THIS NO LONGER REQUIRES, by the user ruling of 2026-08-14: judges
 * outside the producer roster. Self-judging is allowed and carries reduced
 * weight instead, which is `SELF_VOTE_WEIGHT`, so a model grading its own work
 * is a discounted opinion rather than a forbidden one. Refusing here would have
 * made that ruling unreachable, since a roster where every model produces has
 * no disinterested judge at all.
 *
 * WHAT REMAINS STRUCTURAL: a judge contributes at most one full-weight ballot,
 * so a roster with fewer seats than the minimum weight cannot select anything,
 * and every round would decline into the fallback. That reads as a working
 * pipeline in logs and in tests, which is why it is refused at stage entry
 * rather than left to be inferred from a corpus of unchanged documents.
 *
 * Repeats are refused on both sides: a repeated id is one model counted twice,
 * inflating an ensemble without adding an independent voice, and a repeated
 * judge would reach the minimum weight by itself.
 *
 * @param producerModelIds - models that generate candidates
 *
 * @param judgeModelIds - roster judges are drawn from
 *
 * @throws {@link ProducerRosterError} when either side repeats, producers are
 * empty, or too few judges are seated to reach the minimum weight
 *
 * @example
 * ```ts
 * assertJudgeableProducerRoster({ producerModelIds, judgeModelIds, },);
 * ```
 */
export function assertJudgeableProducerRoster(
  {
    producerModelIds,
    judgeModelIds,
    role,
  }: {
    readonly producerModelIds: readonly SyntheticModelId[];
    readonly judgeModelIds: readonly SyntheticModelId[];
    readonly role: string;
  },
): void {
  /**
   * Producers keyed for membership tests, also revealing repeats by size.
   */
  const producers = new Set(producerModelIds,);
  if (producers.size === 0)
    throw new ProducerRosterError({
      producerModelIds,
      judgeModelIds,
      role,
      fault: `no ${role} was seated`,
    },);
  if (producers.size !== producerModelIds.length)
    throw new ProducerRosterError({
      producerModelIds,
      judgeModelIds,
      role,
      fault: `a ${role} is listed more than once, which is one voice pretending to be two`,
    },);

  /**
   * Judges keyed the same way, since a repeated judge is one opinion counted
   * twice and would reach the minimum weight on its own.
   */
  const judges = new Set(judgeModelIds,);
  if (judges.size !== judgeModelIds.length)
    throw new ProducerRosterError({
      producerModelIds,
      judgeModelIds,
      role,
      fault: 'a judge is listed more than once, which would let one model reach the minimum weight alone',
    },);

  /**
   * Whether some producer sits outside the judge roster, in which case a
   * candidate exists that every judge can back at full weight.
   */
  const hasOutsideProducer = producerModelIds.some(function isOutside(
    modelId,
  ): boolean {
    return !judges.has(modelId,);
  },);

  /**
   * Most weight ANY candidate this roster could write is able to draw.
   *
   * Measured over the most favourable candidate, which is one written by
   * exactly ONE producer: every other judge is disinterested in it and votes at
   * full weight, and only its author is discounted. That is the right question
   * for a guard whose stated job is refusing rosters that could not decide a
   * round HOWEVER they voted.
   *
   * NOT THE COLLAPSE CASE, which an earlier version of this measured instead by
   * treating every producer as a stakeholder in one candidate. That refused
   * three authors judging only each other, and that roster decides comfortably:
   * a candidate by one of them draws half a vote from its author and a full one
   * from each of the other two. Rounds where those three write identical text
   * and each back it do decline, at three halves against a minimum of two, and
   * that is the weights doing their work rather than a broken roster. The same
   * arithmetic ships four byte-identical authors and stops three.
   *
   * COUNTING SEATS INSTEAD WOULD PASS A ROSTER THAT CAN NEVER DECIDE: one
   * producer, judged by itself and one other model, tops out at half a vote
   * plus a whole one, which never reaches a minimum of two. Every round would
   * keep its fallback and the stage would read as one that found nothing worth
   * changing.
   *
   * What this bounds is FRESH text specifically. A candidate nobody on the
   * bench wrote, which in the translate lane is the incumbent translation, can
   * still draw full weight from every judge; the roster this refuses is one
   * whose own proposals can never beat what was already there.
   *
   * Derived from the weights rather than written as a number, so tuning any of
   * them cannot leave this quietly wrong.
   */
  const capacity = hasOutsideProducer
    ? FULL_VOTE_WEIGHT * judgeModelIds.length
    : (FULL_VOTE_WEIGHT * (judgeModelIds.length - 1)) + SELF_VOTE_WEIGHT;
  if (capacity >= MIN_SELECTION_WEIGHT)
    return;
  throw new ProducerRosterError({
    producerModelIds,
    judgeModelIds,
    role,
    fault: `these judges could award at most ${String(capacity,)} to text this roster wrote, against a minimum of ${
      String(MIN_SELECTION_WEIGHT,)
    }, so nothing it proposes could ever be selected`,
  },);
}

/**
 * Thrown when a checker would certify text it helped write.
 *
 * @example
 * ```ts
 * throw new CheckerIndependenceError({ overlapping, },);
 * ```
 */
export class CheckerIndependenceError extends Error {
  /**
   * Builds the report from whichever fault was found.
   *
   * @param overlapping - models that both write and check; empty when the
   * roster fault is a repeat rather than an overlap
   *
   * @param duplicated - checker ids listed more than once
   */
  constructor(
    {
      overlapping = [],
      duplicated = [],
    }: {
      readonly overlapping?: readonly SyntheticModelId[];
      readonly duplicated?: readonly SyntheticModelId[];
    },
  ) {
    super(
      overlapping.length === 0
        ? `these checker ids are listed more than once: [${duplicated.join(', ',)}]; a repeated id `
          + `is one model counted twice, which meets quorum on fewer independent voices than the `
          + `roster size promises`
        : `these models would check text they wrote themselves: [${overlapping.join(', ',)}]; `
          + `checkerModelIds must exclude every editor and every refiner`,
    );
    this.name = 'CheckerIndependenceError';
  }
}

/**
 * Refuses a roster where an editor also checks.
 *
 * The checker stage is the proof that an accepted issue is actually gone. A
 * model grading its own rewrite is not proof, and unlike the judge roster this
 * one is not filtered at runtime, so nothing else would catch the overlap.
 *
 * @param editorModelIds - editors that propose candidates
 *
 * @param refinerModelIds - naturalness rewriters; absent means the lane is off
 *
 * @param checkerModelIds - checkers proving the shipped repair
 *
 * @throws {@link CheckerIndependenceError} when any model holds both roles
 *
 * @example
 * ```ts
 * assertCheckerIndependence({ editorModelIds, checkerModelIds, },);
 * ```
 */
export function assertCheckerIndependence(
  {
    editorModelIds,
    refinerModelIds = [],
    checkerModelIds,
  }: {
    readonly editorModelIds: readonly SyntheticModelId[];
    readonly refinerModelIds?: readonly SyntheticModelId[];
    readonly checkerModelIds: readonly SyntheticModelId[];
  },
): void {
  /**
   * Checker ids keyed for membership tests, also revealing repeats by size.
   *
   * Refused for the same reason `assertJudgeableProducerRoster` refuses
   * repeated producers, and the consequence here is quieter: `gatherStageVoices`
   * counts a repeated id's replies separately toward quorum, while
   * `runCheckerStage` keys its ballots by model id and so collapses them into
   * one. A roster of three with a repeat could therefore report quorum on two
   * voices that are one model.
   */
  const distinctCheckers = new Set(checkerModelIds,);
  if (distinctCheckers.size !== checkerModelIds.length) {
    throw new CheckerIndependenceError({
      duplicated: [...distinctCheckers,].filter(function repeats(modelId,) {
        return checkerModelIds.filter(function isSame(candidate,) {
          return candidate === modelId;
        },)
          .length
          > 1;
      },),
    },);
  }

  /**
   * Every model that writes shipped text, keyed for membership tests.
   *
   * Refiners belong here as much as editors do: the recheck that follows a
   * refinement asks the checkers whether the accepted issues survived it, and
   * a refiner among them would be answering for its own rewrite.
   */
  const writers = new Set([
    ...editorModelIds,
    ...refinerModelIds,
  ],);

  /**
   * Models holding both roles.
   */
  const overlapping = checkerModelIds.filter(function alsoWrites(modelId,) {
    return writers.has(modelId,);
  },);
  if (overlapping.length === 0)
    return;
  throw new CheckerIndependenceError({ overlapping, },);
}

/**
 * Everything one chunk's repair decided.
 *
 * @example
 * ```ts
 * const outcome = await repairChunk({ ... },);
 * if (outcome.changed) splice(outcome.repairedText,);
 * ```
 */
export type ChunkRepairOutcome = {
  /**
   * Chunk position within the document.
   */
  readonly chunkIndex: number;

  /**
   * Winning chunk text; equals the input when unchanged won.
   */
  readonly repairedText: string;

  /**
   * Whether the repaired candidate demonstrably beat unchanged.
   */
  readonly changed: boolean;

  /**
   * Adjudicated issues of this chunk.
   */
  readonly issues: readonly AdjudicatedIssue[];

  /**
   * Which critics raised each surviving claim, keyed by deterministic claim id.
   *
   * Chunk-level rather than attached to each issue, deliberately. Every
   * `AdjudicatedIssue` already carries its member claims with their ids, so a
   * consumer joins on the ids an issue actually holds. That sidesteps the
   * transitive-cluster hazard by construction: clustering can chain A to B to C
   * without A and C overlapping, so unioning a cluster's proposers onto each
   * issue it produced would credit critics for claims their issue does not
   * represent. Nothing is unioned here, so nothing can be miscredited.
   *
   * Calibration only. Adjudication never sees it, and it must never enter a
   * judging prompt: a real defect can arrive with exactly one proposer.
   */
  readonly claimAttributions: readonly ClaimAttribution[];

  /**
   * WHICH critics answered on this chunk, sorted by model id.
   *
   * The denominator {@link ChunkRepairOutcome.claimAttributions} cannot supply.
   * A critic heard that raised nothing and a critic never heard both leave no
   * attribution entry, so hits are countable without this and rates are not.
   * Its presence also marks the chunk as attributable at all, which is what
   * separates a critic that stayed silent from an outcome written before any of
   * this existed.
   */
  readonly heardCriticIds: readonly SyntheticModelId[];

  /**
   * Accepted issues the checkers confirmed fixed in the winning text;
   * empty when unchanged won.
   */
  readonly resolvedIssueIds: readonly string[];

  /**
   * Every accepted issue the checkers confirmed fixed IN THE PATCHED CANDIDATE,
   * whether or not an applied operation served it and whether or not that
   * candidate won.
   *
   * Kept because {@link ChunkRepairOutcome.resolvedIssueIds} discards two
   * different things and both are worth auditing: verdicts on issues no
   * operation served, which must not earn selection credit but are still what
   * the checkers said, and every verdict at all when the unchanged text won, so
   * that a rejected candidate leaves no trace of how it was judged. This field
   * decides nothing; it exists so a later analysis can ask why.
   */
  readonly candidateResolvedIssueIds: readonly string[];

  /**
   * Regions the accuracy stage replaced, with the accepted issues each served.
   *
   * Recorded whether or not the patched candidate won, because "no repair was
   * attempted" and "a repair was attempted and lost to unchanged" are different
   * facts and only the second one indicts the stage.
   */
  readonly repairRegions: readonly RepairRegion[];

  /**
   * Shadow-mode audit of defects the edit itself introduced, absent on chunks
   * where no region was replaced and so nothing was probed.
   *
   * Nothing reads this to decide what ships. It exists because
   * `regressedKnownIssues` can only see issues a critic already raised, so a
   * patch that fixes its target and mangles the clause beside it currently
   * scores as clean and the pipeline had no way to notice. Whether these
   * verdicts deserve to gate is a question this round's human repair grades
   * answer, not one the probe's existence settles.
   */
  readonly introducedDefects?: IntroducedDefectReport;

  /**
   * Whether the patched candidate beat unchanged in the ACCURACY stage's own
   * selection.
   *
   * Separate from {@link ChunkRepairOutcome.changed} because the two diverge
   * downstream: the naturalness lane sets `changed` on a refinement-only
   * rewrite, so after that phase `changed` no longer answers whether any
   * accuracy repair was selected. Reading `changed` for that would report a
   * rejected repair as a shipped one whenever refinement happened to touch the
   * same slice.
   */
  readonly accuracyPatchSelected: boolean;

  /**
   * Whether the naturalness lane rewrote this slice after the accuracy pass
   * settled, which makes every {@link RepairRegion.editorAfter} in
   * {@link ChunkRepairOutcome.repairRegions} pre-refinement text rather than
   * what shipped. A grading sheet has to disclose that, and disclosing it only
   * where it happened keeps the caveat meaningful.
   */
  readonly refined: boolean;

  /**
   * Every judged round this slice went through, editor and refinement alike,
   * with the ballots that decided each one.
   *
   * ONE ARRAY RATHER THAN ONE FIELD PER STAGE, because the interesting question
   * is asked across stages: which panel preferred which wording, and the stage
   * is recorded on the round itself. Rounds appear in the order they ran, so a
   * refinement that undid an accuracy repair reads as the later entry.
   *
   * Empty on a slice nothing judged, which is an ordinary outcome: an envelope
   * only one editor proposed for is adopted without a vote, and a chunk every
   * editor agreed on ships unjudged.
   */
  readonly rounds: readonly RepairJudgedRound[];

  /**
   * Declared names a winning patch would have dropped, empty on every slice
   * that dropped none.
   *
   * Required rather than optional, unlike its translate-lane counterpart on
   * `TranslateSliceRecord`. That one is optional because settled artifacts
   * written before the guard existed carry the record and have to keep reading.
   * No artifact ever carried a repair outcome, so there is no older shape to
   * stay compatible with, and an always-present field means a reader never has
   * to tell "dropped nothing" from "field not written".
   */
  readonly droppedDeclaredNames: readonly string[];

  /**
   * Shadow-mode audit of damage the NATURALNESS REWRITE caused, present only on
   * a slice the lane actually rewrote.
   *
   * Separate from {@link ChunkRepairOutcome.introducedDefects} because the two
   * audit different edits against different baselines, and merging them would
   * produce a rate about neither: the accuracy probe compares the original
   * translation with the repaired one, this compares the repaired one with the
   * refined one.
   *
   * It exists because the lane was the one stage that could change shipped text
   * with nothing asking whether it broke anything. `retainsResolvedIssues`
   * guards the opposite direction, that a rewrite did not UNDO a confirmed
   * repair, and a rewrite can leave every confirmed repair standing while
   * damaging the wording around them.
   */
  readonly refinementDefects?: IntroducedDefectReport;

  /**
   * Critics reporting critical non-translation at wire level.
   */
  readonly nonTranslationVotes: number;

  /**
   * Whether deterministic evidence (enough validated content-critique
   * claims anchored into target text) contradicted the votes;
   * callers must never block on contradicted votes.
   */
  readonly nonTranslationContradicted: boolean;

  /**
   * Whether votes met the block threshold uncontradicted, so this slice
   * shipped unchanged; the caller weighs standing slices by character
   * share for the document-level block.
   */
  readonly nonTranslationStanding: boolean;

  /**
   * Critics heard, for the caller's degradation accounting.
   */
  readonly heardCritics: number;

  /**
   * Stage findings in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

//endregion Repair contract
