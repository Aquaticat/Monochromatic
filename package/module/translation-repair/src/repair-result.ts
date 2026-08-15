import type { ChunkCriticRecord, } from './critic-attribution.ts';
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
};

//endregion Repair result
