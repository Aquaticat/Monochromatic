import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import { MIN_SELECTION_VOTES, } from './candidate-select-model.ts';
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
   * Resolution checkers proving the repair. Must exclude every editor, or a
   * model ends up certifying text it wrote.
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
   * @param editorModelIds - editors that propose candidates
   *
   * @param judgeModelIds - roster judges are drawn from
   */
  constructor(
    {
      editorModelIds,
      judgeModelIds,
    }: {
      readonly editorModelIds: readonly SyntheticModelId[];
      readonly judgeModelIds: readonly SyntheticModelId[];
    },
  ) {
    super(
      `every judge is also an editor, so no model could judge the ensemble without grading itself: `
        + `editors [${editorModelIds.join(', ',)}], judges [${judgeModelIds.join(', ',)}]`,
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
  /**
   * Editors keyed for membership tests, also revealing repeats by size.
   */
  const editors = new Set(editorModelIds,);
  if ((editors.size !== editorModelIds.length) || (editors.size === 0))
    throw new EditorRosterError({
      editorModelIds,
      judgeModelIds,
    },);

  /**
   * Judges with no stake in any editor candidate.
   */
  const disinterested = new Set(
    judgeModelIds.filter(function isDisinterested(modelId,) {
      return !editors.has(modelId,);
    },),
  );
  if (disinterested.size >= MIN_SELECTION_VOTES)
    return;
  throw new EditorRosterError({
    editorModelIds,
    judgeModelIds,
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
   * Builds the report from the models holding both roles.
   *
   * @param overlapping - models that both edit and check
   */
  constructor(
    {
      overlapping,
    }: {
      readonly overlapping: readonly SyntheticModelId[];
    },
  ) {
    super(
      `these models would check their own edits: [${overlapping.join(', ',)}]; `
        + `checkerModelIds must exclude every editor`,
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
    checkerModelIds,
  }: {
    readonly editorModelIds: readonly SyntheticModelId[];
    readonly checkerModelIds: readonly SyntheticModelId[];
  },
): void {
  /**
   * Editors keyed for membership tests.
   */
  const editors = new Set(editorModelIds,);

  /**
   * Models holding both roles.
   */
  const overlapping = checkerModelIds.filter(function alsoEdits(modelId,) {
    return editors.has(modelId,);
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
