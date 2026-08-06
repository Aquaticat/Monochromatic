import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { ChunkRepairOutcome, } from './repair-contract.ts';
import type { RepairRegion, } from './repair-region.ts';

//region Repair issue record
// The whole-document issue report, flattened out of the per-slice outcomes.
//
// This is also the only layer that can decide whether a repair reached the
// reader. A slice's own selection is not the answer: `repairTranslation` can
// settle several slices and then return the entire original text when
// non-translation dominance blocks the document, which withdraws every slice
// repair at once. Deciding here, after dominance and after the naturalness
// lane, is the difference between a status that is true of the run and one that
// is true of a stage.
//
// One builder serves both driver exits so the two cannot drift; the blocked
// exit already reported `resolved: false` correctly while carrying no repair
// provenance at all, which is exactly the kind of divergence a shared builder
// prevents.

/**
 * What became of the repair for one accepted issue in the returned document.
 *
 * @example
 * ```ts
 * const disposition: RepairDisposition = 'shipped';
 * ```
 */
export type RepairDisposition =
  /**
   * A replaced region served this issue and the returned document carries it.
   */
  | 'shipped'
  /**
   * A replaced region served this issue, but the unchanged text won its
   * slice's selection, so nothing reached the reader.
   */
  | 'not-selected'
  /**
   * A replaced region served this issue and its slice was repaired, but the
   * document was blocked for non-translation and returned its input, which
   * withdraws every slice repair at once.
   */
  | 'withdrawn'
  /**
   * No replaced region served this issue at all: either no envelope could be
   * cut from its evidence, or its envelope received no operation that survived
   * the apply gate. The two are merged because both mean the same thing to a
   * measurement, that no targeted repair exists to grade.
   */
  | 'no-region';

/**
 * One adjudicated issue in the whole-document report.
 *
 * @example
 * ```ts
 * const record: RepairIssueRecord = {
 *   chunkIndex: 0,
 *   issue,
 *   resolved: false,
 *   repairRegions: [],
 *   repairDisposition: 'no-region',
 *   refined: false,
 * };
 * ```
 */
export type RepairIssueRecord = {
  /**
   * Chunk the issue belongs to.
   */
  readonly chunkIndex: number;

  /**
   * Adjudicated issue exactly as the panel decided it.
   */
  readonly issue: AdjudicatedIssue;

  /**
   * Whether the checkers confirmed it fixed in the shipped text.
   */
  readonly resolved: boolean;

  /**
   * Replaced regions serving this issue, so repair quality can be graded apart
   * from whether the issue was real. A region shared with other accepted issues
   * names them all, because one edit judged against one issue's claim has to be
   * presented as the shared thing it is.
   */
  readonly repairRegions: readonly RepairRegion[];

  /**
   * What became of that repair in the returned document.
   */
  readonly repairDisposition: RepairDisposition;

  /**
   * Whether the naturalness lane rewrote this issue's slice afterwards, making
   * every {@link RepairRegion.editorAfter} pre-refinement wording.
   */
  readonly refined: boolean;

  /**
   * Final text of this issue's slice, carried ONLY when
   * {@link RepairIssueRecord.refined} is set.
   *
   * Present exactly where the recorded replacement stopped being the returned
   * wording, so a grader always judges what shipped. Absent otherwise because
   * the replacement is then verbatim in the returned document, and copying a
   * slice onto every one of its issues would multiply a large document's text
   * by its accepted-issue count for no added fact.
   */
  readonly finalSliceText?: string;
};

/**
 * Decides what became of one issue's repair in the returned document.
 *
 * @param regions - replaced regions serving this issue
 *
 * @param accuracyPatchSelected - whether the slice's patched candidate won
 *
 * @param blocked - whether the document returned its input unchanged
 *
 * @returns Disposition for this issue
 *
 * @example
 * ```ts
 * const disposition = judgeDisposition({
 *   regions,
 *   accuracyPatchSelected: true,
 *   blocked: false,
 * },);
 * ```
 */
function judgeDisposition(
  {
    regions,
    accuracyPatchSelected,
    blocked,
  }: {
    readonly regions: readonly RepairRegion[];
    readonly accuracyPatchSelected: boolean;
    readonly blocked: boolean;
  },
): RepairDisposition {
  if (regions.length === 0)
    return 'no-region';
  if (!accuracyPatchSelected)
    return 'not-selected';
  return blocked
    ? 'withdrawn'
    : 'shipped';
}

/**
 * Flattens settled slice outcomes into the whole-document issue report.
 *
 * @param outcomes - settled per-slice outcomes in document order
 *
 * @param blocked - whether the run returned its input for non-translation, in
 * which case no slice repair reached the reader whatever its slice decided
 *
 * @returns One record per adjudicated issue, in slice then issue order
 *
 * @example
 * ```ts
 * const issues = buildIssueRecords({ outcomes, blocked: false, },);
 * ```
 */
export function buildIssueRecords(
  {
    outcomes,
    blocked,
  }: {
    readonly outcomes: readonly ChunkRepairOutcome[];
    readonly blocked: boolean;
  },
): readonly RepairIssueRecord[] {
  return outcomes.flatMap(function toRecords(outcome,) {
    return outcome.issues
      .map(function toRecord(issue,): RepairIssueRecord {
        /**
         * Regions whose envelope was cut for this issue among others.
         */
        const regions = outcome.repairRegions
          .filter(function servesIssue(region,) {
            return region.issueIds
              .includes(issue.issueId,);
          },);

        return {
          chunkIndex: outcome.chunkIndex,
          issue,
          resolved: (!blocked)
            && outcome.resolvedIssueIds
            .includes(issue.issueId,),
          repairRegions: regions,
          repairDisposition: judgeDisposition({
            regions,
            accuracyPatchSelected: outcome.accuracyPatchSelected,
            blocked,
          },),
          refined: outcome.refined,
          ...(outcome.refined
            ? { finalSliceText: outcome.repairedText, }
            : {}),
        };
      },);
  },);
}

//endregion Repair issue record
