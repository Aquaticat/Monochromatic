import { alignDocumentSections, } from './chunk-document.ts';
import { parseDocument, } from './parse-document.ts';
import type { RepairIssueRecord, } from './repair-translation.ts';
import {
  seedHitByRegion,
  type SeededErrorApplication,
} from './seeded-error.ts';

//region Seed detection grading
// Separates the ways a planted seed goes unrestored: the panel never accepted
// an issue at its region (detection failure), or an accepted issue existed and
// the editor under-restored it (repair failure). Issue spans are chunk-local
// because the pipeline parses each chunk as its own document; the deterministic
// alignment recomputes here to translate them back into whole-document
// coordinates.
//
// A THIRD way exists and used to be invisible, which is why the verdict is no
// longer a boolean. The house policy tells the pipeline, verbatim, never to
// restore a suicide method or a drug name and dosage "even when the ORIGINAL
// states it plainly". This benchmark plants seeds by deleting sentences from
// the published English and scores restoration, so wherever a seed's Chinese
// counterpart carries protected content, the pipeline is INSTRUCTED not to
// restore it and the old boolean recorded a plain detection miss. That scored
// correct behavior as failure and left it unattributable.
//
// Both ground truths are defensible and they genuinely differ. The benchmark's
// is "this sentence was in the published English, so it belongs", which holds
// because the community wrote that English under its own rules. The critic
// cannot see that: it sees the mutilated English beside the Chinese, so
// Chinese-only sensitive detail reads to it as a deliberate omission. Rather
// than excluding such seeds, which would need a classifier over suicide and
// medication topics whose misfires are their own harm, the verdict now records
// WHICH of the two happened and lets the scorecard report both numbers.

/**
 * How a planted seed fared at the detection stage.
 *
 * @example
 * ```ts
 * const verdict: SeedDetectionVerdict = 'declined-protective';
 * ```
 */
export type SeedDetectionVerdict =
  | 'accepted'
  | 'declined-protective'
  | 'declined-other'
  | 'undetected';

/**
 * Adjudication status the panel lands on when it judges the ORIGINAL at fault
 * and the translation right to differ from it, which is where a policy-driven
 * protective omission arrives.
 */
const PROTECTIVE_STATUS = 'source-defect';

/**
 * How each planted seed fared, distinguishing a seed nobody reported from one
 * the panel saw and declined on protective grounds.
 *
 * @param sourceText - original document exactly as repaired
 *
 * @param seededText - translation after planting, exactly as repaired
 *
 * @param applications - planted regions in seeded-text coordinates
 *
 * @param issues - whole-document issue report from the repair run
 *
 * @returns Detection verdict keyed by seed id
 *
 * @example
 * ```ts
 * const detection = gradeSeedDetection({ sourceText, seededText, applications, issues, },);
 * ```
 */
export function gradeSeedDetection(
  {
    sourceText,
    seededText,
    applications,
    issues,
  }: {
    readonly sourceText: string;
    readonly seededText: string;
    readonly applications: readonly SeededErrorApplication[];
    readonly issues: readonly RepairIssueRecord[];
  },
): Readonly<Record<string, SeedDetectionVerdict>> {
  /**
   * The same alignment the pipeline computed, for chunk start offsets.
   */
  const alignment = alignDocumentSections({
    source: parseDocument({ text: sourceText, },),
    target: parseDocument({ text: seededText, },),
  },);

  /**
   * Every target-side span in whole-document coordinates, carrying the status
   * the panel gave it; statuses other than accepted are kept precisely so a
   * declined seed stays distinguishable from an unreported one.
   */
  const regions = issues.flatMap(function toRegions(record,) {
    /**
     * Target chunk this issue's spans are local to.
     */
    const chunk = alignment.pairs[record.chunkIndex]
      ?.target;
    if (chunk === undefined)
      return [];
    return record
      .issue
      .claims
      .flatMap(function claimRegions(member,) {
        return member
          .claim
          .spans
          .flatMap(function spanRegion(span,): readonly {
            readonly start: number;
            readonly end: number;
            readonly status: string;
          }[] {
            if (span.side !== 'target')
              return [];
            return [{
              start: chunk.startOffset + span.startOffset,
              end: chunk.startOffset + span.endOffset,
              status: record.issue
                .status,
            },];
          },);
      },);
  },);

  return Object.fromEntries(applications.map(function toVerdict(application,) {
    /**
     * Statuses of every reported span covering this seed's planted region.
     */
    const covering = regions
      .filter(function hits(region,) {
        return seedHitByRegion({
          spanStart: region.start,
          spanEnd: region.end,
          application,
        },);
      },)
      .map(function toStatus(region,) {
        return region.status;
      },);

    // Acceptance outranks everything: one accepted issue at the region means
    // the pipeline was free to repair, whatever else was also reported there.
    // A protective decline outranks an ordinary one because it is the verdict
    // that says the pipeline behaved correctly by not repairing.
    /**
     * Verdict for this seed, by status precedence.
     */
    const verdict: SeedDetectionVerdict = covering.includes('accepted',)
      ? 'accepted'
      : covering.includes(PROTECTIVE_STATUS,)
      ? 'declined-protective'
      : covering.length > 0
      ? 'declined-other'
      : 'undetected';
    return [
      application.spec
        .id,
      verdict,
    ];
  },),);
}

//endregion Seed detection grading
