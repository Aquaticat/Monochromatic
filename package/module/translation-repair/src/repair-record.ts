import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { RegionDefectTally, } from './introduced-defect-screen.ts';
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
   * slice's selection, so that repair reached no reader.
   *
   * Says nothing about the returned TEXT: the naturalness lane runs after the
   * accuracy stage regardless of what that stage's selection decided, so a
   * slice can still have been rewritten. {@link RepairIssueRecord.refined} is
   * what answers that, and the repair sheet discloses it here too.
   */
  | 'not-selected'
  /**
   * A replaced region served this issue and its slice was repaired, and the
   * document took that repair back: either it was blocked for non-translation
   * and returned its input, which withdraws every slice at once, or the
   * assembly guard withdrew this slice to keep a footnote relation whole.
   *
   * Either way the repair reached no reader, which is what a measurement over
   * these records has to see.
   */
  | 'withdrawn'
  /**
   * No replaced region served this issue at all: either no envelope could be
   * cut from its evidence, or its envelope received no operation that survived
   * the apply gate. The two are merged because both mean the same thing to a
   * measurement, that no targeted repair exists to grade.
   *
   * Also says nothing about the returned text, for the reason given on
   * {@link RepairDisposition} `not-selected`.
   */
  | 'no-region';

/**
 * Every disposition the pipeline writes, as data.
 *
 * Kept beside the union so a reader can check a value against it without
 * restating the list, which is how the two drift apart.
 *
 * @example
 * ```ts
 * const known = REPAIR_DISPOSITIONS.includes('shipped',);
 * ```
 */
export const REPAIR_DISPOSITIONS: readonly RepairDisposition[] = [
  'shipped',
  'not-selected',
  'withdrawn',
  'no-region',
];

/**
 * Probe result as one issue's record carries it.
 *
 * @example
 * ```ts
 * const reading: IssueProbeReading = { heardProbers: 3, configuredProbers: 3, regions: [], };
 * ```
 */
export type IssueProbeReading = {
  /**
   * Probers whose reply arrived and validated for this issue's chunk.
   */
  readonly heardProbers: number;

  /**
   * Probers asked, which is the denominator a majority rule needs.
   */
  readonly configuredProbers: number;

  /**
   * Screened tallies for the regions serving this issue.
   */
  readonly regions: readonly RegionDefectTally[];
};

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
   * Shadow-mode probe result for the regions serving this issue, absent where
   * the chunk was never probed.
   *
   * Carried per issue rather than per chunk so a graded sheet item and the
   * probe's opinion of that same item sit side by side in the artifact, which
   * is what a calibration comparing the two has to join on. Nothing reads it to
   * decide what ships.
   *
   * The roster sizes ride along with the tallies rather than being left on the
   * chunk, because without them an artifact cannot answer whether a MAJORITY
   * agreed. Heard voices are recoverable from a tally by summing its verdicts,
   * but the configured roster is not recoverable from anything, and two of three
   * heard is different evidence from two of six configured.
   */
  readonly introducedDefects?: IssueProbeReading;

  /**
   * Whether the naturalness lane rewrote this issue's slice afterwards, making
   * every {@link RepairRegion.editorAfter} pre-refinement wording.
   */
  readonly refined: boolean;

  /**
   * Audit of damage the naturalness REWRITE caused, present only where the lane
   * rewrote this issue's slice.
   *
   * Every issue of a rewritten slice carries the same report, because the lane
   * edits the slice as a whole. Kept apart from
   * {@link RepairIssueRecord.introducedDefects}, which audits the accuracy
   * stage against a different baseline: one compares the original translation
   * with the repaired one, the other the repaired one with what shipped.
   */
  readonly refinementDefects?: IssueProbeReading;

  /**
   * Final text of this issue's slice, carried ONLY when
   * {@link RepairIssueRecord.refined} is set.
   *
   * Present exactly where a SHIPPED replacement stopped being the returned
   * wording, so a grader judging a shipped repair always judges what shipped.
   * Absent otherwise, for two different reasons that both make it needless.
   * Under {@link RepairDisposition} `shipped` with no refinement, `spliceSlices`
   * splices the patched slice verbatim, so the replacement IS the returned
   * wording and copying the slice onto every one of its issues would multiply a
   * large document's text by its accepted-issue count for no added fact. Under
   * every other disposition the replacement reached no reader at all, so there
   * is no shipped wording to compare it against and the sheet grades nothing.
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
 * @param withdrawnChunkIndices - slices whose repair the assembly guard took
 * back, whose issues reached no reader for the same reason a blocked document's
 * did; absent means none were
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
    withdrawnChunkIndices = [],
  }: {
    readonly outcomes: readonly ChunkRepairOutcome[];
    readonly blocked: boolean;
    readonly withdrawnChunkIndices?: readonly number[];
  },
): readonly RepairIssueRecord[] {
  /**
   * Slices the assembly guard took back, for membership tests.
   */
  const withdrawn = new Set(withdrawnChunkIndices,);

  return outcomes.flatMap(function toRecords(outcome,) {
    /**
     * Whether this slice's repair reached the document at all, which a blocked
     * run and a withdrawn slice both answer no to.
     */
    const reachedNobody = blocked || withdrawn.has(outcome.chunkIndex,);
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

        /**
         * Probe tallies for exactly those regions, empty when unprobed.
         */
        const probed = (outcome.introducedDefects
          ?.regions
          ?? [])
          .filter(function coversRegion(tally,) {
            return regions.some(function isSame(region,) {
              return region.envelopeId === tally.envelopeId;
            },);
          },);

        return {
          chunkIndex: outcome.chunkIndex,
          issue,
          resolved: (!reachedNobody)
            && outcome.resolvedIssueIds
            .includes(issue.issueId,),
          repairRegions: regions,
          repairDisposition: judgeDisposition({
            regions,
            accuracyPatchSelected: outcome.accuracyPatchSelected,
            blocked: reachedNobody,
          },),
          refined: outcome.refined,
          ...(probed.length === 0
            ? {}
            : {
              introducedDefects: {
                heardProbers: outcome.introducedDefects
                  ?.heardProbers
                  ?? 0,
                configuredProbers: outcome.introducedDefects
                  ?.configuredProbers
                  ?? 0,
                regions: probed,
              },
            }),
          ...(outcome.refined
            ? { finalSliceText: outcome.repairedText, }
            : {}),
          // Carried unfiltered, unlike introducedDefects above. That one is
          // narrowed to the regions serving THIS issue, because the accuracy
          // stage replaces one region per envelope and an issue is served by
          // some of them. The lane rewrites the whole slice as one edit, so
          // every issue in the slice shares the same single region and there is
          // nothing to select.
          // Rebuilt field by field rather than spread. The outcome carries an
          // IntroducedDefectReport, which also holds `findings`, and a record
          // is an IssueProbeReading, which does not. Structural typing accepts
          // the wider value silently, so spreading it would write a field into
          // every artifact that nothing declares and nothing reads.
          ...(outcome.refinementDefects === undefined
            ? {}
            : {
              refinementDefects: {
                heardProbers: outcome.refinementDefects
                  .heardProbers,
                configuredProbers: outcome.refinementDefects
                  .configuredProbers,
                regions: outcome.refinementDefects
                  .regions,
              },
            }),
        };
      },);
  },);
}

//endregion Repair issue record
