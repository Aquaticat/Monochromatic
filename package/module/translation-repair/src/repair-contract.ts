import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import { MIN_SELECTION_VOTES, } from './candidate-select-model.ts';
import type { IntroducedDefectReport, } from './introduced-defect-probe.ts';
import type { RepairRegion, } from './repair-region.ts';
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
   * Whole roster candidate selection draws judges from. Producers are removed
   * per selection round, so this must contain at least one model that never
   * edits: see {@link assertJudgeableEditorRoster}.
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
 * Thrown when every judge also edits, which would leave candidate selection
 * with nobody disinterested to ask.
 *
 * @example
 * ```ts
 * throw new EditorRosterError({ editorModelIds, judgeModelIds, },);
 * ```
 */
export class EditorRosterError extends Error {
  /**
   * Builds the report from the two colliding rosters.
   *
   * @param editorModelIds - producers that propose candidates
   *
   * @param judgeModelIds - roster judges are drawn from
   *
   * @param role - what the producers do, so the message names the real stage
   * rather than always saying editor; defaults to `editor`
   */
  constructor(
    {
      editorModelIds,
      judgeModelIds,
      role = 'editor',
    }: {
      readonly editorModelIds: readonly SyntheticModelId[];
      readonly judgeModelIds: readonly SyntheticModelId[];
      readonly role?: string;
    },
  ) {
    super(
      `too few judges sit outside the ${role} roster, so selection could not run without a model `
        + `grading itself: ${role}s [${editorModelIds.join(', ',)}], judges [${
          judgeModelIds.join(', ',)
        }]`,
    );
    this.name = 'EditorRosterError';
  }
}

/**
 * Refuses a roster that cannot seat enough disinterested judges.
 *
 * Selection removes producers from the judge roster, so a roster short of
 * judges does not fail loudly on its own: rounds would return
 * `no disinterested judge available` or `winner short of the minimum vote
 * count`, and the ensemble would silently degrade into always shipping its
 * fallback, which looks like a working pipeline in logs and in tests. Refusing
 * at stage entry turns that into a first-chunk crash instead of a wasted
 * corpus run.
 *
 * Duplicate editor ids are refused for the same reason: a repeated id is one
 * model counted twice, which inflates the apparent ensemble without adding an
 * independent voice.
 *
 * @param editorModelIds - editors that propose candidates
 *
 * @param judgeModelIds - roster judges are drawn from
 *
 * @throws {@link EditorRosterError} when editors repeat or too few judges sit
 * outside the editors
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
 * Refuses a producer roster that cannot seat enough disinterested judges.
 *
 * Shared by the editor ensemble and the naturalness lane because the failure is
 * identical in both: selection removes producers from the judge roster, so a
 * roster short of judges declines every round and the stage silently degrades
 * into always shipping its fallback, which reads as a working pipeline in logs
 * and in tests.
 *
 * @param producerModelIds - models that generate candidates
 *
 * @param judgeModelIds - roster judges are drawn from
 *
 * @throws {@link EditorRosterError} when producers repeat or too few judges sit
 * outside them
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
  if ((producers.size !== producerModelIds.length) || (producers.size === 0))
    throw new EditorRosterError({
      editorModelIds: producerModelIds,
      judgeModelIds,
      role,
    },);

  /**
   * Judges with no stake in any candidate this roster produces.
   */
  const disinterested = new Set(
    judgeModelIds.filter(function isDisinterested(modelId,) {
      return !producers.has(modelId,);
    },),
  );
  if (disinterested.size >= MIN_SELECTION_VOTES)
    return;
  throw new EditorRosterError({
    editorModelIds: producerModelIds,
    judgeModelIds,
    role,
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
