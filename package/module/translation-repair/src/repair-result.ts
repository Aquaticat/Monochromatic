import type { ChunkCriticRecord, } from './critic-attribution.ts';
import type { LaneSliceText, } from './lane-slice-text.ts';
import type { RepairIssueRecord, } from './repair-record.ts';

//region Repair result
// What the repair driver RETURNS, kept beside neither the driver nor the
// assembler so both can name it without importing each other.

/**
 * Completion status of one repair run;
 * never an unqualified "corrected translation".
 *
 * @example
 * ```ts
 * const status: RepairStatus = 'repaired';
 * ```
 */
export type RepairStatus =
  | 'repaired'
  | 'unchanged'
  | 'blocked-non-translation';

/**
 * Output contract of the batch driver.
 *
 * @example
 * ```ts
 * const { repairedText, status, issues, } = await repairTranslation({ ... },);
 * ```
 */
export type RepairTranslationResult = {
  /**
   * Best translation the run can justify;
   * equals the input when nothing demonstrably beat it.
   */
  readonly repairedText: string;

  /**
   * How the run ended.
   */
  readonly status: RepairStatus;

  /**
   * Every adjudicated issue with its chunk and resolution fate.
   */
  readonly issues: readonly RepairIssueRecord[];

  /**
   * Alignment and stage findings in scorecard-stable wording.
   */
  readonly findings: readonly string[];

  /**
   * Per-chunk critic calibration: who answered, and who raised each claim.
   *
   * Separate from {@link RepairTranslationResult.issues} because a chunk whose
   * critics raised nothing produces no issue record, and that chunk is exactly
   * the one a rate needs: it is the difference between a critic that was asked
   * and stayed quiet and a critic that was never asked.
   */
  readonly chunkCritics: readonly ChunkCriticRecord[];

  /**
   * Slices the returned document CARRIES a repair for, in document order.
   *
   * Named rather than counted, because the question this lane is measured
   * against is per slice: which slices did this lane change, and did the other
   * lane change the same ones. A count answers neither. Empty on a blocked run,
   * which returns its input whatever each slice decided.
   */
  readonly shippedChunkIndices: readonly number[];

  /**
   * Slices whose repair the assembly guard took back, in the order it took
   * them.
   *
   * Disjoint from {@link RepairTranslationResult.shippedChunkIndices} by
   * construction. Kept apart from the issue records because a withdrawal is a
   * fact about the DOCUMENT, and a slice can be withdrawn while carrying no
   * adjudicated issue of its own.
   */
  readonly withdrawnChunkIndices: readonly number[];

  /**
   * What this lane DECIDED for every prepared slice, beside the archive's own
   * wording, in document order.
   *
   * One entry per slice whether or not anything changed, because a rate needs
   * its denominator and "this lane looked and left it alone" is a decision.
   * Carries no shipped flag: {@link RepairTranslationResult.shippedChunkIndices}
   * is that fact, and repeating it per slice would let the two disagree.
   */
  readonly sliceTexts: readonly LaneSliceText[];
};

//endregion Repair result
