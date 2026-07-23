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
 *   criticModelIds: allSeven,
 *   panelModelIds: allSeven,
 *   editorModelId: 'hf:zai-org/GLM-5.2',
 *   checkerModelIds: strongestThree,
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
   * Editor voice producing the repaired candidate.
   */
  readonly editorModelId: SyntheticModelId;

  /**
   * Extra rule line appended to the editor system prompt, for prompt
   * calibration experiments; absent means the baseline prompt.
   */
  readonly editorRuleAddendum?: string;

  /**
   * Resolution checkers proving the repair.
   */
  readonly checkerModelIds: readonly SyntheticModelId[];
};

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
