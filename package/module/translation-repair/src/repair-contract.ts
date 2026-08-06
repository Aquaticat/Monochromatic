import type { AdjudicatedIssue, } from './adjudicate-model.ts';
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
 * Refuses a roster whose judges are all editors.
 *
 * Selection removes producers from the judge roster, so an all-editor roster
 * does not fail loudly on its own: every round would return
 * `no disinterested judge available` and the ensemble would silently degrade
 * into always shipping its fallback, which looks like a working pipeline in
 * logs and in tests. Refusing at stage entry turns that into a first-chunk
 * crash instead of a wasted corpus run.
 *
 * @param editorModelIds - editors that propose candidates
 *
 * @param judgeModelIds - roster judges are drawn from
 *
 * @throws {@link EditorRosterError} when no judge sits outside the editors
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
   * Editors keyed for membership tests.
   */
  const editors = new Set(editorModelIds,);
  if (judgeModelIds.some(function isDisinterested(modelId,) {
    return !editors.has(modelId,);
  },))
    return;
  throw new EditorRosterError({
    editorModelIds,
    judgeModelIds,
  },);
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
