import { alignDocumentSections, } from './chunk-document.ts';
import { parseDocument, } from './parse-document.ts';
import type { RepairIssueRecord, } from './repair-translation.ts';
import {
  seedHitByRegion,
  type SeededErrorApplication,
} from './seeded-error.ts';

//region Seed detection grading
// Separates the two ways a planted seed goes unrestored: the panel never
// accepted an issue at its region (detection failure), or an accepted issue
// existed and the editor under-restored it (repair failure). Issue spans
// are chunk-local because the pipeline parses each chunk as its own
// document; the deterministic alignment recomputes here to translate them
// back into whole-document coordinates.

/**
 * Whether each planted seed had an ACCEPTED issue anchored at its region.
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
): Readonly<Record<string, boolean>> {
  /**
   * The same alignment the pipeline computed, for chunk start offsets.
   */
  const alignment = alignDocumentSections({
    source: parseDocument({ text: sourceText, },),
    target: parseDocument({ text: seededText, },),
  },);

  /**
   * Accepted target-side spans in whole-document coordinates.
   */
  const acceptedRegions = issues.flatMap(function toRegions(record,) {
    if (record.issue
      .status
      !== 'accepted')
      return [];

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
          }[] {
            if (span.side !== 'target')
              return [];
            return [{
              start: chunk.startOffset + span.startOffset,
              end: chunk.startOffset + span.endOffset,
            },];
          },);
      },);
  },);

  return Object.fromEntries(applications.map(function toVerdict(application,) {
    return [
      application.spec
        .id,
      acceptedRegions.some(function hits(region,) {
        return seedHitByRegion({
          spanStart: region.start,
          spanEnd: region.end,
          application,
        },);
      },),
    ];
  },),);
}

//endregion Seed detection grading
